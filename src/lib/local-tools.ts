// 10 powerful local tools — run entirely server-side, no external API needed.
// Each tool takes input + optional config, returns output string.

import { createHash, randomUUID, randomBytes } from "crypto";

export interface LocalToolResult {
  ok: boolean;
  output: string;
  error?: string;
}

// 1. Text Extractor — extract emails, URLs, phone numbers, dates from text
export function textExtract(input: string, config: { extractType?: string }): LocalToolResult {
  const type = config.extractType || "all";
  const results: Record<string, string[]> = {};

  if (type === "all" || type === "emails") {
    const emails = input.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    if (emails.length) results.emails = [...new Set(emails)];
  }
  if (type === "all" || type === "urls") {
    const urls = input.match(/https?:\/\/[^\s<>"']+/g) || [];
    if (urls.length) results.urls = [...new Set(urls)];
  }
  if (type === "all" || type === "phones") {
    const phones = input.match(/(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g) || [];
    if (phones.length) results.phones = [...new Set(phones)];
  }
  if (type === "all" || type === "dates") {
    const dates = input.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}/g) || [];
    if (dates.length) results.dates = [...new Set(dates)];
  }
  if (type === "all" || type === "ips") {
    const ips = input.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) || [];
    if (ips.length) results.ips = [...new Set(ips)];
  }

  return { ok: true, output: JSON.stringify(results, null, 2) };
}

// 2. JSON Transform — filter, map, pick fields from JSON data
export function jsonTransform(input: string, config: { operation?: string; field?: string; value?: string }): LocalToolResult {
  try {
    const data = JSON.parse(input);
    const op = config.operation || "pick";

    switch (op) {
      case "pick": {
        const field = config.field || "";
        if (!field) return { ok: false, output: "", error: "field required for pick" };
        const result = Array.isArray(data)
          ? data.map((item: Record<string, unknown>) => item[field])
          : data[field];
        return { ok: true, output: JSON.stringify(result, null, 2) };
      }
      case "filter": {
        const field = config.field || "";
        const value = config.value || "";
        if (!field) return { ok: false, output: "", error: "field required for filter" };
        const result = Array.isArray(data)
          ? data.filter((item: Record<string, unknown>) => String(item[field]) === value)
          : data;
        return { ok: true, output: JSON.stringify(result, null, 2) };
      }
      case "count": {
        const count = Array.isArray(data) ? data.length : Object.keys(data).length;
        return { ok: true, output: String(count) };
      }
      case "keys": {
        const keys = Array.isArray(data) ? Object.keys(data[0] || {}) : Object.keys(data);
        return { ok: true, output: JSON.stringify(keys, null, 2) };
      }
      case "flatten": {
        if (!Array.isArray(data)) return { ok: false, output: "", error: "flatten requires an array" };
        return { ok: true, output: JSON.stringify(data.flat(), null, 2) };
      }
      case "sort": {
        const field = config.field || "";
        if (!Array.isArray(data)) return { ok: false, output: "", error: "sort requires an array" };
        const sorted = field
          ? [...data].sort((a: Record<string, unknown>, b: Record<string, unknown>) => String(a[field]).localeCompare(String(b[field])))
          : [...data].sort();
        return { ok: true, output: JSON.stringify(sorted, null, 2) };
      }
      default:
        return { ok: false, output: "", error: `unknown operation: ${op}` };
    }
  } catch (err) {
    return { ok: false, output: "", error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// 3. Regex Match — run regex patterns on input
export function regexMatch(input: string, config: { pattern?: string; flags?: string; operation?: string }): LocalToolResult {
  const pattern = config.pattern || "";
  const flags = config.flags || "g";
  const op = config.operation || "match";

  if (!pattern) return { ok: false, output: "", error: "pattern required" };

  try {
    const regex = new RegExp(pattern, flags);

    switch (op) {
      case "match": {
        const matches = input.match(regex) || [];
        return { ok: true, output: JSON.stringify(matches, null, 2) };
      }
      case "test": {
        return { ok: true, output: String(regex.test(input)) };
      }
      case "replace": {
        const replaced = input.replace(regex, config.value || "");
        return { ok: true, output: replaced };
      }
      case "split": {
        const parts = input.split(regex);
        return { ok: true, output: JSON.stringify(parts, null, 2) };
      }
      case "extract": {
        const matches = [...input.matchAll(regex)].map((m) => m.groups || m[0]);
        return { ok: true, output: JSON.stringify(matches, null, 2) };
      }
      default:
        return { ok: false, output: "", error: `unknown operation: ${op}` };
    }
  } catch (err) {
    return { ok: false, output: "", error: `Invalid regex: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// 4. Markdown Converter — convert between text, HTML, and Markdown
export function markdownConvert(input: string, config: { direction?: string }): LocalToolResult {
  const direction = config.direction || "md-to-html";

  switch (direction) {
    case "md-to-html": {
      let html = input;
      // Headers
      html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
      html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
      html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
      // Bold + italic
      html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
      html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
      // Code blocks
      html = html.replace(/```([\s\S]+?)```/g, "<pre><code>$1</code></pre>");
      html = html.replace(/`(.+?)`/g, "<code>$1</code>");
      // Links
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
      // Lists
      html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
      html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");
      // Paragraphs
      html = html.replace(/\n\n/g, "</p><p>");
      html = `<p>${html}</p>`;
      return { ok: true, output: html };
    }
    case "html-to-md": {
      let md = input;
      md = md.replace(/<h1>(.*?)<\/h1>/gi, "# $1\n");
      md = md.replace(/<h2>(.*?)<\/h2>/gi, "## $1\n");
      md = md.replace(/<h3>(.*?)<\/h3>/gi, "### $1\n");
      md = md.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
      md = md.replace(/<em>(.*?)<\/em>/gi, "*$1*");
      md = md.replace(/<code>(.*?)<\/code>/gi, "`$1`");
      md = md.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, "```$1```");
      md = md.replace(/<a href="(.*?)">(.*?)<\/a>/gi, "[$2]($1)");
      md = md.replace(/<li>(.*?)<\/li>/gi, "- $1\n");
      md = md.replace(/<\/?(ul|ol|p|div|span)>/gi, "");
      md = md.replace(/\n{3,}/g, "\n\n");
      return { ok: true, output: md.trim() };
    }
    case "text-to-md": {
      let md = input;
      md = md.replace(/\n/g, "\n");
      return { ok: true, output: md };
    }
    default:
      return { ok: false, output: "", error: `unknown direction: ${direction}` };
  }
}

// 5. Hash Generator — generate MD5, SHA-256, SHA-512 hashes
export function hashGenerate(input: string, config: { algorithm?: string }): LocalToolResult {
  const algorithm = config.algorithm || "sha256";
  const validAlgos = ["md5", "sha1", "sha256", "sha512"];

  if (!validAlgos.includes(algorithm)) {
    return { ok: false, output: "", error: `Invalid algorithm. Use: ${validAlgos.join(", ")}` };
  }

  const hash = createHash(algorithm).update(input).digest("hex");
  return {
    ok: true,
    output: JSON.stringify({
      algorithm,
      input_length: input.length,
      hash,
      hash_length: hash.length,
    }, null, 2),
  };
}

// 6. Base64 Codec — encode or decode Base64
export function base64Codec(input: string, config: { operation?: string }): LocalToolResult {
  const op = config.operation || "encode";

  switch (op) {
    case "encode": {
      const encoded = Buffer.from(input, "utf-8").toString("base64");
      return { ok: true, output: encoded };
    }
    case "decode": {
      try {
        const decoded = Buffer.from(input, "base64").toString("utf-8");
        return { ok: true, output: decoded };
      } catch {
        return { ok: false, output: "", error: "Invalid Base64 input" };
      }
    }
    default:
      return { ok: false, output: "", error: `unknown operation: ${op}` };
  }
}

// 7. URL Codec — encode or decode URL strings
export function urlCodec(input: string, config: { operation?: string }): LocalToolResult {
  const op = config.operation || "encode";

  switch (op) {
    case "encode": {
      return { ok: true, output: encodeURIComponent(input) };
    }
    case "decode": {
      try {
        return { ok: true, output: decodeURIComponent(input) };
      } catch {
        return { ok: false, output: "", error: "Invalid URL-encoded input" };
      }
    }
    case "parse": {
      try {
        const url = new URL(input);
        const params: Record<string, string> = {};
        url.searchParams.forEach((v, k) => { params[k] = v; });
        return {
          ok: true,
          output: JSON.stringify({
            protocol: url.protocol,
            host: url.host,
            hostname: url.hostname,
            port: url.port,
            pathname: url.pathname,
            search: url.search,
            hash: url.hash,
            params,
          }, null, 2),
        };
      } catch {
        return { ok: false, output: "", error: "Invalid URL" };
      }
    }
    default:
      return { ok: false, output: "", error: `unknown operation: ${op}` };
  }
}

// 8. Text Diff — compare two texts and show line-by-line differences
export function diffText(input: string, config: { compareWith?: string }): LocalToolResult {
  const compareWith = config.compareWith || "";
  const lines1 = input.split("\n");
  const lines2 = compareWith.split("\n");
  const maxLen = Math.max(lines1.length, lines2.length);
  const diffs: { type: "same" | "added" | "removed"; line: string; lineNum: number }[] = [];

  for (let i = 0; i < maxLen; i++) {
    if (i < lines1.length && i < lines2.length) {
      if (lines1[i] === lines2[i]) {
        diffs.push({ type: "same", line: lines1[i], lineNum: i + 1 });
      } else {
        diffs.push({ type: "removed", line: lines1[i], lineNum: i + 1 });
        diffs.push({ type: "added", line: lines2[i], lineNum: i + 1 });
      }
    } else if (i < lines1.length) {
      diffs.push({ type: "removed", line: lines1[i], lineNum: i + 1 });
    } else if (i < lines2.length) {
      diffs.push({ type: "added", line: lines2[i], lineNum: i + 1 });
    }
  }

  const output = diffs.map((d) => {
    const prefix = d.type === "added" ? "+ " : d.type === "removed" ? "- " : "  ";
    return `${prefix}${d.line}`;
  }).join("\n");

  const added = diffs.filter((d) => d.type === "added").length;
  const removed = diffs.filter((d) => d.type === "removed").length;

  return {
    ok: true,
    output: `Diff: +${added} added, -${removed} removed\n\n${output}`,
  };
}

// 9. CSV Parser — parse CSV to JSON or JSON to CSV
export function csvParser(input: string, config: { operation?: string; delimiter?: string }): LocalToolResult {
  const op = config.operation || "csv-to-json";
  const delimiter = config.delimiter || ",";

  switch (op) {
    case "csv-to-json": {
      const lines = input.trim().split("\n");
      if (lines.length < 2) return { ok: false, output: "", error: "CSV needs at least a header + 1 row" };
      const headers = lines[0].split(delimiter).map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const values = line.split(delimiter);
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = (values[i] || "").trim(); });
        return obj;
      });
      return { ok: true, output: JSON.stringify(rows, null, 2) };
    }
    case "json-to-csv": {
      try {
        const data = JSON.parse(input) as Record<string, unknown>[];
        if (!Array.isArray(data) || data.length === 0) {
          return { ok: false, output: "", error: "JSON must be a non-empty array of objects" };
        }
        const headers = Object.keys(data[0]);
        const csvLines = [headers.join(delimiter)];
        for (const row of data) {
          csvLines.push(headers.map((h) => String(row[h] ?? "")).join(delimiter));
        }
        return { ok: true, output: csvLines.join("\n") };
      } catch {
        return { ok: false, output: "", error: "Invalid JSON input" };
      }
    }
    default:
      return { ok: false, output: "", error: `unknown operation: ${op}` };
  }
}

// 10. UUID Generator — generate UUIDs v4 and v7
export function uuidGenerate(_input: string, config: { version?: string; count?: string }): LocalToolResult {
  const version = config.version || "v4";
  const count = Math.min(parseInt(config.count || "1", 10), 100);

  const uuids: string[] = [];
  for (let i = 0; i < count; i++) {
    if (version === "v4") {
      uuids.push(randomUUID());
    } else if (version === "v7") {
      // UUID v7: timestamp-based + random
      const timestamp = Date.now();
      const timestampHex = timestamp.toString(16).padStart(12, "0");
      const random = randomBytes(8).toString("hex");
      // Set version nibble to 7
      const uuid = `${timestampHex.slice(0, 8)}-${timestampHex.slice(8, 12)}-7${random.slice(0, 3)}-${random.slice(3, 7)}-${random.slice(7, 19)}`;
      uuids.push(uuid);
    } else {
      return { ok: false, output: "", error: `unknown version: ${version} (use v4 or v7)` };
    }
  }

  return {
    ok: true,
    output: count === 1 ? uuids[0] : JSON.stringify(uuids, null, 2),
  };
}

// === Dispatcher — called from the AI engine when a tool node runs ===

export function executeLocalTool(
  toolType: string,
  input: string,
  config: Record<string, string>,
): LocalToolResult {
  switch (toolType) {
    case "text-extract":
      return textExtract(input, config);
    case "json-transform":
      return jsonTransform(input, config);
    case "regex-match":
      return regexMatch(input, config);
    case "markdown-convert":
      return markdownConvert(input, config);
    case "hash-generate":
      return hashGenerate(input, config);
    case "base64-codec":
      return base64Codec(input, config);
    case "url-codec":
      return urlCodec(input, config);
    case "diff-text":
      return diffText(input, config);
    case "csv-parser":
      return csvParser(input, config);
    case "uuid-generate":
      return uuidGenerate(input, config);
    default:
      return { ok: false, output: "", error: `unknown local tool: ${toolType}` };
  }
}
