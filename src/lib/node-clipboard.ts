import type { WorkflowNode } from "./types";

// Module-level in-memory clipboard for copy/paste of canvas nodes.
// Not the system clipboard — we don't want to clobber whatever the user
// has copied elsewhere, and WorkflowNode isn't text-serializable from
// outside the app anyway.
let clipboardNode: WorkflowNode | null = null;

/** Store a deep copy of the given node in the in-memory clipboard. */
export function copyNode(node: WorkflowNode | null): void {
  if (!node) {
    clipboardNode = null;
    return;
  }
  clipboardNode = cloneNode(node);
}

/** Returns a deep copy of the clipboard node, or null if nothing is copied. */
export function pasteNode(): WorkflowNode | null {
  if (!clipboardNode) return null;
  return cloneNode(clipboardNode);
}

export function hasCopiedNode(): boolean {
  return clipboardNode !== null;
}

function cloneNode(node: WorkflowNode): WorkflowNode {
  return {
    id: node.id,
    type: node.type,
    position: { ...node.position },
    data: { ...node.data },
  };
}
