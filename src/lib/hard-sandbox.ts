// Hard sandbox using isolated-vm — V8 isolate-based execution with strict boundaries.
// Replaces the basic Node.js `vm` module with a proper isolated V8 runtime.
// No access to Node.js APIs, no prototype pollution, memory + CPU limits.

import ivm from "isolated-vm";

export interface HardSandboxResult {
  ok: boolean;
  output?: string;
  error?: string;
  stdout: string[];
  stderr: string[];
  executionTimeMs: number;
  memoryUsedBytes?: number;
}

/**
 * Execute JavaScript code in a hard-isolated V8 sandbox.
 * Uses isolated-vm for proper security boundaries:
 * - Separate V8 isolate (no shared heap)
 * - Memory limit (default 128MB)
 * - CPU timeout (default 5s)
 * - No Node.js APIs (no require, process, fs, etc.)
 * - Transferable values only (strings, numbers, booleans, arrays, objects)
 *
 * @example
 * const result = await runHardSandboxed("input.toUpperCase()", "hello");
 * // result.output === "HELLO"
 */
export async function runHardSandboxed(
  code: string,
  input: string,
  history: { role: string; content: string }[],
  timeoutMs = 5000,
  memoryLimitMB = 128,
): Promise<HardSandboxResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const startedAt = Date.now();

  try {
    // Create a new isolate with memory limit
    const isolate = new ivm.Isolate({ memoryLimit: memoryLimitMB });
    const context = isolate.createContextSync();

    // Set up the global scope
    const jail = context.global;
    jail.setSync("global", jail.derefInto());

    // Inject input data (transferable)
    jail.setSync("input", input);
    jail.setSync("history", history);

    // Inject a safe console
    jail.setSync("__stdout", (s: string) => stdout.push(s));
    jail.setSync("__stderr", (s: string) => stderr.push(s));

    // Set up console.log/error — these call back to the host
    context.evalClosureSync(`
      global.console = {
        log: (...args) => __stdout(args.map(String).join(" ")),
        error: (...args) => __stderr(args.map(String).join(" ")),
        warn: (...args) => __stderr(args.map(String).join(" ")),
        info: (...args) => __stdout(args.map(String).join(" ")),
      };
    `);

    // Inject safe globals (JSON, Math, Date — no fetch, no require)
    // These are already available in the V8 context by default.

    // Wrap the user code in an async function
    const wrappedCode = `
      (async () => {
        ${code}
      })()
    `;

    // Execute with timeout
    const script = isolate.compileScriptSync(wrappedCode);
    const resultPromise = script.run(context, {
      timeout: timeoutMs,
      copy: true,
    });

    const result = await resultPromise;

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

    isolate.dispose();

    return {
      ok: true,
      output,
      stdout,
      stderr,
      executionTimeMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stdout,
      stderr,
      executionTimeMs: Date.now() - startedAt,
    };
  }
}

/**
 * Check if isolated-vm is available (it requires native compilation).
 * Falls back to the basic vm sandbox if not.
 */
export function isHardSandboxAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ivmModule = require("isolated-vm");
    return !!ivmModule.default || !!ivmModule.Isolate;
  } catch {
    return false;
  }
}
