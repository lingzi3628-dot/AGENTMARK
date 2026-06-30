// Rough token estimation utilities (chars/4 heuristic).

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateNodeTokens(
  data: import("./types").WorkflowNodeData,
): number {
  switch (data.kind) {
    case "model":
      return estimateTokens(data.systemPrompt ?? "") + 50;
    case "knowledge":
      return estimateTokens(data.content ?? "");
    case "tool":
      return data.tool === "web-search" || data.tool === "page-reader" ? 500 : 200;
    case "image-gen":
      return 250;
    case "vision":
      return 350;
    case "trigger":
      return estimateTokens(data.content ?? "") + 20;
    default:
      return 0;
  }
}

export function estimateGraphTokens(
  nodes: import("./types").WorkflowNode[],
): number {
  return nodes.reduce((sum, n) => sum + estimateNodeTokens(n.data), 0);
}

export function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  return `${(n / 1000).toFixed(1)}k`;
}
