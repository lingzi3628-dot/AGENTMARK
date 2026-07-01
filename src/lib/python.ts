// Python code execution via Pyodide (in-browser WASM Python).
// Runs Python scripts safely in a WebAssembly sandbox — no server-side Python needed.
// Supports numpy, pandas, scikit-learn, and other scientific libraries.

import type { WorkflowNodeData } from "./types";

export interface PythonResult {
  ok: boolean;
  output?: string;
  error?: string;
  stdout: string[];
  stderr: string[];
}

let _pyodidePromise: Promise<unknown> | null = null;

/**
 * Lazy-load Pyodide (only when first Python node runs).
 * The package is ~10MB but cached after first load.
 */
async function getPyodide(): Promise<{
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
  loadPackagesFromImports: (code: string) => Promise<void>;
  FS: { readFile: (path: string, opts: { encoding: string }) => string };
}> {
  if (!_pyodidePromise) {
    _pyodidePromise = (async () => {
      const mod = await import("pyodide");
      return mod.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/",
      });
    })();
  }
  return _pyodidePromise as Promise<ReturnType<typeof getPyodide extends () => Promise<infer T> ? () => Promise<T> : never>>;
}

/**
 * Execute Python code in a Pyodide WASM sandbox.
 * Input is available as `input` variable. Return value becomes the output.
 *
 * @example
 * const result = await runPython("input.upper()", "hello world");
 * // result.output === "HELLO WORLD"
 */
export async function runPython(
  code: string,
  input: string,
  history: { role: string; content: string }[],
  timeoutMs = 30000,
): Promise<PythonResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];

  try {
    const pyodide = await getPyodide();

    // Capture stdout/stderr
    pyodide.setStdout({ batched: (s: string) => stdout.push(s) });
    pyodide.setStderr({ batched: (s: string) => stderr.push(s) });

    // Auto-load packages from imports (e.g. import numpy)
    await pyodide.loadPackagesFromImports(code).catch(() => undefined);

    // Set input variables
    const wrappedCode = `
import json
input = ${JSON.stringify(input)}
history = ${JSON.stringify(history)}
${code}
`;

    // Run with timeout
    const resultPromise = pyodide.runPythonAsync(wrappedCode);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Python execution timed out")), timeoutMs),
    );
    const result = await Promise.race([resultPromise, timeoutPromise]);

    // Convert result to string
    let output: string;
    if (result === undefined || result === null) {
      output = stdout.join("\n") || "(no output)";
    } else if (typeof result === "string") {
      output = result;
    } else {
      try {
        output = JSON.stringify(result, null, 2);
      } catch {
        output = String(result);
      }
    }

    return {
      ok: true,
      output,
      stderr: stderr,
      stdout: stdout,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stdout,
      stderr,
    };
  }
}
