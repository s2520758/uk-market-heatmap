'use strict';

var react = require('react');
var jsxRuntime = require('react/jsx-runtime');

// src/MarketHeatmap.tsx

// src/core.ts
function getTreemapDensity(stockCount) {
  const count = Number.isFinite(stockCount) ? Math.max(0, Math.floor(stockCount)) : 0;
  if (count <= 120) return { pad: 2, headerHeight: 20 };
  if (count <= 275) return { pad: 1.5, headerHeight: 16 };
  return { pad: 1, headerHeight: 14 };
}
function getTileLabelMode(rect, symbol) {
  const safeSymbol = symbol.trim();
  const area = rect.w * rect.h;
  const innerWidth = Math.max(0, rect.w - 6);
  const innerHeight = Math.max(0, rect.h - 4);
  const tickerWidth = Math.max(20, safeSymbol.length * 4.7 + 6);
  if (innerWidth < tickerWidth || innerHeight < 10 || area < 180) return "none";
  const fullWidth = Math.max(46, safeSymbol.length * 6.5 + 12);
  if (innerWidth >= fullWidth && innerHeight >= 30 && area >= 1300) return "full";
  return "ticker";
}
function worstAspect(sum, min, max, side) {
  const s2 = sum * sum;
  const side2 = side * side;
  return Math.max(side2 * max / s2, s2 / (side2 * min));
}
function squarify(items, rect) {
  const out = [];
  let i = 0;
  const n = items.length;
  let { x, y, w, h } = rect;
  while (i < n) {
    const side = Math.min(w, h);
    if (side <= 0) break;
    const start = i;
    let sum = items[i].area;
    let min = items[i].area;
    let max = items[i].area;
    let best = worstAspect(sum, min, max, side);
    i++;
    while (i < n) {
      const a = items[i].area;
      const nSum = sum + a;
      const nMin = a < min ? a : min;
      const nMax = a > max ? a : max;
      const nWorst = worstAspect(nSum, nMin, nMax, side);
      if (nWorst <= best) {
        sum = nSum;
        min = nMin;
        max = nMax;
        best = nWorst;
        i++;
      } else break;
    }
    if (w >= h) {
      const colW = sum / h;
      let yy = y;
      for (let k = start; k < i; k++) {
        const tileH = items[k].area / colW;
        out.push({ ...items[k], x, y: yy, w: colW, h: tileH });
        yy += tileH;
      }
      x += colW;
      w -= colW;
    } else {
      const rowH = sum / w;
      let xx = x;
      for (let k = start; k < i; k++) {
        const tileW = items[k].area / rowH;
        out.push({ ...items[k], x: xx, y, w: tileW, h: rowH });
        xx += tileW;
      }
      y += rowH;
      h -= rowH;
    }
  }
  return out;
}
function safeSize(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
function sumValue(node) {
  if ("children" in node) return node.children.reduce((s, c) => s + sumValue(c), 0);
  return safeSize(node.value);
}
function groupHeaderHeight(rect, requested, pad, name) {
  if (requested <= 0) return 0;
  const readableWidth = Math.min(84, Math.max(30, name.length * 4.2));
  if (rect.w < readableWidth) return 0;
  if (rect.h >= requested * 3 + pad) return requested;
  const compact = Math.min(10, requested);
  if (compact >= 8 && rect.h >= compact * 2.8 + pad) return compact;
  return 0;
}
function layoutTree(nodes, rect, depth, opt, out) {
  const scored = nodes.map((node) => ({ node, value: sumValue(node) })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const total = scored.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return;
  const area = rect.w * rect.h;
  const items = scored.map((d) => ({ ...d, area: d.value / total * area }));
  const placed = squarify(items, rect);
  for (const p of placed) {
    const r = { x: p.x, y: p.y, w: p.w, h: p.h };
    if ("children" in p.node) {
      const group = p.node;
      const localPad = Math.min(Math.max(0, opt.pad), r.w * 0.12, r.h * 0.12);
      const hh = groupHeaderHeight(r, opt.headerHeight, localPad, group.name);
      out.push({ type: "group", name: group.name, depth, headerHeight: hh, rect: r });
      const topInset = hh > 0 ? hh : localPad;
      const inner = {
        x: r.x + localPad,
        y: r.y + topInset,
        w: r.w - localPad * 2,
        h: r.h - topInset - localPad
      };
      if (inner.w > 0 && inner.h > 0) layoutTree(group.children, inner, depth + 1, opt, out);
    } else {
      out.push({ type: "leaf", node: p.node, depth, rect: r });
    }
  }
}
function buildAggregatedTreemap(entries, aggregatedSymbols) {
  const groupOrder = [...new Set(entries.map((entry) => entry.group))];
  const visible = entries.filter((entry) => !aggregatedSymbols.has(entry.symbol));
  const aggregates = [];
  for (const group of groupOrder) {
    const members = entries.filter((entry) => entry.group === group && aggregatedSymbols.has(entry.symbol)).sort((a, b) => b.value - a.value);
    if (members.length === 0) continue;
    const value = members.reduce((sum, member) => sum + member.value, 0);
    const weightedChange = members.reduce(
      (sum, member) => sum + member.value * member.change,
      0
    );
    aggregates.push({
      symbol: `__OTHER__${encodeURIComponent(group)}`,
      group,
      value,
      change: value > 0 ? weightedChange / value : 0,
      members
    });
  }
  const aggregatesBySymbol = new Map(
    aggregates.map((aggregate) => [aggregate.symbol, aggregate])
  );
  const data = groupOrder.map((group) => {
    const individualLeaves = visible.filter((entry) => entry.group === group).map((entry) => ({
      symbol: entry.symbol,
      value: entry.value,
      change: entry.change
    }));
    const aggregateLeaves = aggregates.filter((aggregate) => aggregate.group === group).map((aggregate) => ({
      symbol: aggregate.symbol,
      label: "OTHER",
      sublabel: `${aggregate.members.length} ${aggregate.members.length === 1 ? "stock" : "stocks"}`,
      value: aggregate.value,
      change: aggregate.change
    }));
    return {
      name: group,
      children: [...individualLeaves, ...aggregateLeaves].sort((a, b) => b.value - a.value)
    };
  }).filter((group) => group.children.length > 0);
  return { data, visible, aggregates, aggregatesBySymbol };
}
function aggregateTinyLeaves(entries, rect, opt) {
  const aggregatedSymbols = /* @__PURE__ */ new Set();
  let snapshot = buildAggregatedTreemap(entries, aggregatedSymbols);
  if (rect.w <= 0 || rect.h <= 0 || entries.length === 0) return snapshot;
  for (let iteration = 0; iteration < entries.length; iteration += 1) {
    const output = [];
    layoutTree(snapshot.data, rect, 0, opt, output);
    const newlyTiny = output.filter((item) => item.type === "leaf").filter((item) => !snapshot.aggregatesBySymbol.has(item.node.symbol)).filter(
      (item) => getTileLabelMode(item.rect, item.node.label ?? item.node.symbol) === "none"
    ).map((item) => item.node.symbol).filter((symbol) => !aggregatedSymbols.has(symbol));
    if (newlyTiny.length === 0) return snapshot;
    for (const symbol of newlyTiny) aggregatedSymbols.add(symbol);
    snapshot = buildAggregatedTreemap(entries, aggregatedSymbols);
  }
  return snapshot;
}
var NEUTRAL = [62, 68, 82];
var RED = [228, 60, 60];
var GREEN = [33, 191, 94];
function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}
function changeColor(change, cap = 3) {
  const safe = Number.isFinite(change) ? change : 0;
  const t = Math.max(-1, Math.min(1, safe / cap));
  const eased = Math.sign(t) * Math.pow(Math.abs(t), 0.85);
  const rgb = eased < 0 ? mix(NEUTRAL, RED, -eased) : mix(NEUTRAL, GREEN, eased);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}
function escapeXml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) => c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&apos;"
  );
}
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
  const [hover, setHover] = react.useState(null);
  const [pos, setPos] = react.useState({ x: 0, y: 0, cw: 0 });
  const wrapRef = react.useRef(null);
  const clipPrefix = `heatmap-${react.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const titleBar = title ? 26 : 0;
  const items = react.useMemo(() => {
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
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      ref: wrapRef,
      className,
      onMouseMove: showTooltip ? onMove : void 0,
      style: { position: "relative", width: "100%", background, fontFamily, ...style },
      children: [
        /* @__PURE__ */ jsxRuntime.jsxs(
          "svg",
          {
            viewBox: `0 0 ${width} ${height}`,
            style: { display: "block", width: "100%", height: "auto", fontFamily: "inherit" },
            children: [
              /* @__PURE__ */ jsxRuntime.jsx("defs", { children: leaves.map((leaf, idx) => /* @__PURE__ */ jsxRuntime.jsx("clipPath", { id: `${clipPrefix}-tile-${idx}`, children: /* @__PURE__ */ jsxRuntime.jsx(
                "rect",
                {
                  x: leaf.rect.x + 1,
                  y: leaf.rect.y + 1,
                  width: Math.max(0, leaf.rect.w - 2),
                  height: Math.max(0, leaf.rect.h - 2)
                }
              ) }, `${clipPrefix}-tile-${idx}`)) }),
              titleBar > 0 && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
                /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 0, y: 0, width, height: titleBar, fill: background }),
                /* @__PURE__ */ jsxRuntime.jsx(
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
              groups.map((g, idx) => /* @__PURE__ */ jsxRuntime.jsxs("g", { children: [
                /* @__PURE__ */ jsxRuntime.jsx(
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
                g.headerHeight > 0 && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntime.jsx(
                    "rect",
                    {
                      x: g.rect.x,
                      y: g.rect.y,
                      width: g.rect.w,
                      height: g.headerHeight,
                      fill: "#17171b"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntime.jsx(
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
                return /* @__PURE__ */ jsxRuntime.jsxs(
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
                      /* @__PURE__ */ jsxRuntime.jsx(
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
                      showCatalystMarker && /* @__PURE__ */ jsxRuntime.jsxs("g", { style: { pointerEvents: "none" }, children: [
                        catalystImportance === "high" && /* @__PURE__ */ jsxRuntime.jsx(
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
                        /* @__PURE__ */ jsxRuntime.jsx(
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
                      showTicker && /* @__PURE__ */ jsxRuntime.jsxs("g", { clipPath: `url(#${clipPrefix}-tile-${idx})`, style: { pointerEvents: "none" }, children: [
                        /* @__PURE__ */ jsxRuntime.jsx(
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
                        showSecondary && /* @__PURE__ */ jsxRuntime.jsx(
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
                return /* @__PURE__ */ jsxRuntime.jsxs("g", { style: { pointerEvents: "none" }, children: [
                  hh > 0 && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
                    /* @__PURE__ */ jsxRuntime.jsx(
                      "rect",
                      {
                        x: g.rect.x + 1,
                        y: g.rect.y + 1,
                        width: Math.max(0, g.rect.w - 2),
                        height: Math.max(0, hh - 1),
                        fill: highlightHeaderFill
                      }
                    ),
                    /* @__PURE__ */ jsxRuntime.jsx(
                      "path",
                      {
                        d: `M ${mx} ${my - 3} L ${mx + 3} ${my} L ${mx} ${my + 3} L ${mx - 3} ${my} Z`,
                        fill: highlightColor
                      }
                    ),
                    /* @__PURE__ */ jsxRuntime.jsx(
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
                  /* @__PURE__ */ jsxRuntime.jsx(
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
        showLegend && /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "8px 8px 10px" }, children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { style: { color: "#8b8f9c", fontSize: 11 }, children: `-${cap}%` }),
          /* @__PURE__ */ jsxRuntime.jsx(
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
          /* @__PURE__ */ jsxRuntime.jsx("span", { style: { color: "#8b8f9c", fontSize: 11 }, children: `+${cap}%` })
        ] }),
        showTooltip && hover && /* @__PURE__ */ jsxRuntime.jsxs(
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
              /* @__PURE__ */ jsxRuntime.jsx("div", { style: { color: "#fff", fontWeight: 700, fontSize: 13 }, children: hover.node.label ?? hover.node.symbol }),
              hover.node.sublabel && /* @__PURE__ */ jsxRuntime.jsx("div", { style: { color: "#9aa0ad", fontSize: 11 }, children: hover.node.sublabel }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { style: { color: colorScale(changeOf(hover.node), cap), fontSize: 12, fontWeight: 600 }, children: fmtPct(changeOf(hover.node)) }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { color: "#9aa0ad", fontSize: 11, marginTop: 2 }, children: [
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

exports.MarketHeatmap = MarketHeatmap;
exports.aggregateTinyLeaves = aggregateTinyLeaves;
exports.changeColor = changeColor;
exports.escapeXml = escapeXml;
exports.getTileLabelMode = getTileLabelMode;
exports.getTreemapDensity = getTreemapDensity;
exports.layoutTree = layoutTree;
exports.squarify = squarify;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map