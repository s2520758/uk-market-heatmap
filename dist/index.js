import { layoutTree, changeColor, getTileLabelMode } from './chunk-VRN4ZC7P.js';
export { aggregateTinyLeaves, changeColor, escapeXml, getTileLabelMode, getTreemapDensity, layoutTree, squarify } from './chunk-VRN4ZC7P.js';
import { useState, useRef, useId, useMemo } from 'react';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';

function fmtPct(v) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtCap(v) {
  return v >= 1e3 ? `$${(v / 1e3).toFixed(2)}T` : `$${v.toFixed(0)}B`;
}
function clip(text, w, fontSize = 10) {
  const max = Math.floor(w / (fontSize * 0.62));
  if (text.length <= max) return text;
  if (max <= 1) return "";
  return text.slice(0, Math.max(0, max - 1)) + "\u2026";
}
function MarketHeatmap({
  data,
  quotes,
  catalystMarkers,
  title = "",
  width = 920,
  height = 1180,
  cap = 3,
  headerHeight = 17,
  pad = 2,
  background = "#0d0d0f",
  fontFamily = "Inter, 'Helvetica Neue', system-ui, sans-serif",
  showLegend = true,
  colorScale = changeColor,
  className,
  style,
  showTooltip = true,
  onHover,
  onLeafClick,
  highlightGroup,
  highlightColor = "#ffcc33",
  highlightStrokeWidth = 2,
  highlightHeaderFill = "#211d12"
}) {
  const [hover, setHover] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0, cw: 0 });
  const wrapRef = useRef(null);
  const clipPrefix = `heatmap-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const titleBar = title ? 26 : 0;
  const items = useMemo(() => {
    const out = [];
    layoutTree(
      data,
      { x: 0, y: titleBar, w: width, h: height - titleBar },
      0,
      { headerHeight, pad },
      out
    );
    return out;
  }, [data, width, height, headerHeight, pad, titleBar]);
  const groups = items.filter((i) => i.type === "group");
  const leaves = items.filter((i) => i.type === "leaf");
  const changeOf = (leaf) => {
    const q = quotes?.[leaf.symbol];
    return Number.isFinite(q) ? q : leaf.change;
  };
  const onMove = (e) => {
    const b = wrapRef.current?.getBoundingClientRect();
    if (!b) return;
    setPos({ x: e.clientX - b.left, y: e.clientY - b.top, cw: b.width });
  };
  const legend = [-cap, -cap / 2, 0, cap / 2, cap].map((v) => colorScale(v, cap));
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: wrapRef,
      className,
      onMouseMove: showTooltip ? onMove : void 0,
      style: { position: "relative", width: "100%", background, fontFamily, ...style },
      children: [
        /* @__PURE__ */ jsxs(
          "svg",
          {
            viewBox: `0 0 ${width} ${height}`,
            style: { display: "block", width: "100%", height: "auto", fontFamily: "inherit" },
            children: [
              /* @__PURE__ */ jsx("defs", { children: leaves.map((leaf, idx) => /* @__PURE__ */ jsx("clipPath", { id: `${clipPrefix}-tile-${idx}`, children: /* @__PURE__ */ jsx(
                "rect",
                {
                  x: leaf.rect.x + 1,
                  y: leaf.rect.y + 1,
                  width: Math.max(0, leaf.rect.w - 2),
                  height: Math.max(0, leaf.rect.h - 2)
                }
              ) }, `${clipPrefix}-tile-${idx}`)) }),
              titleBar > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx("rect", { x: 0, y: 0, width, height: titleBar, fill: background }),
                /* @__PURE__ */ jsx(
                  "text",
                  {
                    x: 8,
                    y: titleBar / 2,
                    fill: "#cfd2da",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    dominantBaseline: "central",
                    children: title
                  }
                )
              ] }),
              groups.map((g, idx) => /* @__PURE__ */ jsxs("g", { children: [
                /* @__PURE__ */ jsx(
                  "rect",
                  {
                    x: g.rect.x,
                    y: g.rect.y,
                    width: g.rect.w,
                    height: g.rect.h,
                    fill: "none",
                    stroke: background,
                    strokeWidth: 2
                  }
                ),
                g.headerHeight > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(
                    "rect",
                    {
                      x: g.rect.x,
                      y: g.rect.y,
                      width: g.rect.w,
                      height: g.headerHeight,
                      fill: "#17171b"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "text",
                    {
                      x: g.rect.x + 5,
                      y: g.rect.y + g.headerHeight / 2,
                      fill: "#8b8f9c",
                      fontSize: Math.min(10, Math.max(7, g.headerHeight * 0.58)),
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      dominantBaseline: "central",
                      children: clip(
                        g.name,
                        g.rect.w - 10,
                        Math.min(10, Math.max(7, g.headerHeight * 0.58))
                      )
                    }
                  )
                ] })
              ] }, `g${idx}`)),
              leaves.map((t, idx) => {
                const { x, y, w, h } = t.rect;
                const n = t.node;
                const change = changeOf(n);
                const fill = colorScale(change, cap);
                const label = n.label ?? n.symbol;
                const isAggregate = Boolean(n.sublabel);
                const availW = Math.max(0, w - 6);
                const labelMode = getTileLabelMode(t.rect, label);
                const showTicker = isAggregate || labelMode !== "none";
                const showSecondary = showTicker && (labelMode === "full" || Boolean(n.sublabel && h >= 16));
                const heightScale = showSecondary ? 0.32 : 0.52;
                const fittedFontSize = Math.max(
                  0,
                  Math.min(availW / (label.length * 0.68), h * heightScale, isAggregate ? 22 : 40)
                );
                const fs = isAggregate ? Math.max(fittedFontSize, Math.min(6.5, h * heightScale)) : fittedFontSize;
                const isHover = hover === t;
                const tickerW = label.length * fs * 0.64;
                const changeStr = fmtPct(change);
                const secondaryText = n.sublabel ?? changeStr;
                const secondaryW = secondaryText.length * fs * 0.6 * 0.6;
                const catalystImportance = catalystMarkers?.[n.symbol];
                const showCatalystMarker = Boolean(catalystImportance && w >= 16 && h >= 14);
                const markerX = x + w - 5;
                const markerY = y + 5;
                return /* @__PURE__ */ jsxs(
                  "g",
                  {
                    onClick: () => onLeafClick?.(t.node),
                    onMouseEnter: (event) => {
                      setHover(t);
                      onHover?.(t.node, event.currentTarget.getBoundingClientRect());
                    },
                    onMouseLeave: () => {
                      setHover((p) => p === t ? null : p);
                      onHover?.(null);
                    },
                    children: [
                      /* @__PURE__ */ jsx(
                        "rect",
                        {
                          x,
                          y,
                          width: w,
                          height: h,
                          fill,
                          stroke: isHover ? "#ffffff" : background,
                          strokeWidth: isHover ? 1.5 : 1,
                          style: { cursor: onLeafClick ? "pointer" : void 0 }
                        }
                      ),
                      showCatalystMarker && /* @__PURE__ */ jsxs("g", { style: { pointerEvents: "none" }, children: [
                        catalystImportance === "high" && /* @__PURE__ */ jsx(
                          "circle",
                          {
                            cx: markerX,
                            cy: markerY,
                            r: 4.5,
                            fill: "rgba(255, 205, 92, 0.2)",
                            stroke: "rgba(255, 222, 132, 0.9)",
                            strokeWidth: 0.8
                          }
                        ),
                        /* @__PURE__ */ jsx(
                          "circle",
                          {
                            cx: markerX,
                            cy: markerY,
                            r: catalystImportance === "high" ? 2.5 : 2.1,
                            fill: catalystImportance === "high" ? "#ffd15c" : "#c6d5e3",
                            stroke: "rgba(8, 11, 15, 0.85)",
                            strokeWidth: 0.8
                          }
                        )
                      ] }),
                      showTicker && /* @__PURE__ */ jsxs("g", { clipPath: `url(#${clipPrefix}-tile-${idx})`, style: { pointerEvents: "none" }, children: [
                        /* @__PURE__ */ jsx(
                          "text",
                          {
                            x: x + w / 2,
                            y: showSecondary ? y + h / 2 - fs * 0.42 : y + h / 2,
                            fill: "#ffffff",
                            fontSize: fs,
                            fontWeight: 700,
                            textAnchor: "middle",
                            dominantBaseline: "central",
                            textLength: tickerW > availW ? availW : void 0,
                            lengthAdjust: "spacingAndGlyphs",
                            children: label
                          }
                        ),
                        showSecondary && /* @__PURE__ */ jsx(
                          "text",
                          {
                            x: x + w / 2,
                            y: y + h / 2 + fs * 0.5,
                            fill: "rgba(255,255,255,0.92)",
                            fontSize: fs * 0.6,
                            fontWeight: 600,
                            textAnchor: "middle",
                            dominantBaseline: "central",
                            textLength: secondaryW > availW ? availW : void 0,
                            lengthAdjust: "spacingAndGlyphs",
                            children: secondaryText
                          }
                        )
                      ] })
                    ]
                  },
                  `t${idx}`
                );
              }),
              highlightGroup && groups.filter((g) => g.name === highlightGroup).map((g, i) => {
                const hh = g.headerHeight;
                const mx = g.rect.x + 10;
                const my = g.rect.y + (hh > 0 ? hh / 2 : 8);
                return /* @__PURE__ */ jsxs("g", { style: { pointerEvents: "none" }, children: [
                  hh > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx(
                      "rect",
                      {
                        x: g.rect.x + 1,
                        y: g.rect.y + 1,
                        width: Math.max(0, g.rect.w - 2),
                        height: Math.max(0, hh - 1),
                        fill: highlightHeaderFill
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "path",
                      {
                        d: `M ${mx} ${my - 3} L ${mx + 3} ${my} L ${mx} ${my + 3} L ${mx - 3} ${my} Z`,
                        fill: highlightColor
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "text",
                      {
                        x: mx + 9,
                        y: my,
                        fill: highlightColor,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        dominantBaseline: "central",
                        children: clip(g.name, g.rect.w - 16)
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsx(
                    "rect",
                    {
                      x: g.rect.x,
                      y: g.rect.y,
                      width: g.rect.w,
                      height: g.rect.h,
                      fill: "none",
                      stroke: highlightColor,
                      strokeWidth: highlightStrokeWidth
                    }
                  )
                ] }, `hl${i}`);
              })
            ]
          }
        ),
        showLegend && /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "8px 8px 10px" }, children: [
          /* @__PURE__ */ jsx("span", { style: { color: "#8b8f9c", fontSize: 11 }, children: `-${cap}%` }),
          /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                flex: 1,
                height: 8,
                borderRadius: 2,
                background: `linear-gradient(to right, ${legend.join(", ")})`
              }
            }
          ),
          /* @__PURE__ */ jsx("span", { style: { color: "#8b8f9c", fontSize: 11 }, children: `+${cap}%` })
        ] }),
        showTooltip && hover && /* @__PURE__ */ jsxs(
          "div",
          {
            style: {
              position: "absolute",
              left: Math.max(0, Math.min(pos.x + 14, pos.cw - 168)),
              top: pos.y + 14,
              width: 154,
              padding: "8px 10px",
              background: "#1c1c22",
              border: "1px solid #34343c",
              borderRadius: 6,
              boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
              pointerEvents: "none",
              zIndex: 10
            },
            children: [
              /* @__PURE__ */ jsx("div", { style: { color: "#fff", fontWeight: 700, fontSize: 13 }, children: hover.node.label ?? hover.node.symbol }),
              hover.node.sublabel && /* @__PURE__ */ jsx("div", { style: { color: "#9aa0ad", fontSize: 11 }, children: hover.node.sublabel }),
              /* @__PURE__ */ jsx("div", { style: { color: colorScale(changeOf(hover.node), cap), fontSize: 12, fontWeight: 600 }, children: fmtPct(changeOf(hover.node)) }),
              /* @__PURE__ */ jsxs("div", { style: { color: "#9aa0ad", fontSize: 11, marginTop: 2 }, children: [
                "Mkt cap ",
                fmtCap(hover.node.value)
              ] })
            ]
          }
        )
      ]
    }
  );
}

export { MarketHeatmap };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map