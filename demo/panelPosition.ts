export interface FloatingRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface FloatingSize {
  width: number;
  height: number;
}

export interface PanelPlacement {
  left: number;
  top: number;
  side: "left" | "right" | "overlap";
}

export function placeFloatingPanel(
  anchor: FloatingRect,
  viewport: FloatingSize,
  panel: FloatingSize,
  gap = 12,
  margin = 12,
): PanelPlacement {
  const panelWidth = Math.min(panel.width, Math.max(0, viewport.width - margin * 2));
  const panelHeight = Math.min(panel.height, Math.max(0, viewport.height - margin * 2));
  const maxLeft = Math.max(margin, viewport.width - margin - panelWidth);
  const maxTop = Math.max(margin, viewport.height - margin - panelHeight);
  const rightCandidate = anchor.right + gap;
  const leftCandidate = anchor.left - gap - panelWidth;

  let left: number;
  let side: PanelPlacement["side"];

  if (rightCandidate <= maxLeft) {
    left = rightCandidate;
    side = "right";
  } else if (leftCandidate >= margin) {
    left = leftCandidate;
    side = "left";
  } else {
    const rightSpace = viewport.width - margin - anchor.right;
    const leftSpace = anchor.left - margin;
    const preferred = rightSpace >= leftSpace ? rightCandidate : leftCandidate;
    left = Math.max(margin, Math.min(maxLeft, preferred));
    side = "overlap";
  }

  return {
    left,
    top: Math.max(margin, Math.min(maxTop, anchor.top)),
    side,
  };
}
