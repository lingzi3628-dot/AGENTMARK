import vm from "node:vm";

export interface SandboxResult {
  ok: boolean;
  output?: string;
  error?: string;
  consoleLogs: string[];
}

/**
 * Run arbitrary user JavaScript in a locked-down Node `vm` context.
 *
 * Available globals:
 *   - input    : string   (the upstream node output or trigger text)
 *   - history  : {role, content}[]  (recent chat history)
 *   - fetch    : the global fetch (allowed for HTTP calls)
 *   - console  : log/error/warn → captured into consoleLogs
 *   - JSON, Date, Math
 *
 * Locked down: no `require`, no `process`, no `fs`, no `import`, no globals leak.
 *
 * The code is wrapped in an async IIFE so users can `return` a value
 * (sync) or `await` something (async, e.g. fetch).
 *
 * Returns a Promise because we await the async IIFE result.
 */
export async function runSandboxed(
  code: string,
  input: string,
  history: { role: string; content: string }[],
  timeoutMs = 5000,
): Promise<SandboxResult> {
  const consoleLogs: string[] = [];
  const sandbox = {
    input,
    history,
    fetch,
    console: {
      log: (...args: unknown[]) => consoleLogs.push(args.map(stringify).join(" ")),
      error: (...args: unknown[]) => consoleLogs.push("[ERROR] " + args.map(stringify).join(" ")),
      warn: (...args: unknown[]) => consoleLogs.push("[WARN] " + args.map(stringify).join(" ")),
      info: (...args: unknown[]) => consoleLogs.push(args.map(stringify).join(" ")),
    },
    JSON,
    Date,
    Math,
    // Explicitly undefined — locked down
    // (no require, no process, no fs, no global, no Buffer)
  };

  try {
    const context = vm.createContext(sandbox);
    const wrapped = `(async () => {\n${code}\n})()`;
    const result = vm.runInContext(wrapped, context, {
      timeout: timeoutMs,
      breakOnSigint: true,
    });
    // The wrapped function returns a Promise (async IIFE). Await it.
    const output = await Promise.resolve(result);
    return {
      ok: true,
      output: typeof output === "string" ? output : JSON.stringify(output, null, 2),
      consoleLogs,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      consoleLogs,
    };
  }
}

function stringify(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
