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

export { aggregateTinyLeaves, changeColor, escapeXml, getTileLabelMode, getTreemapDensity, layoutTree, squarify };
//# sourceMappingURL=chunk-VRN4ZC7P.js.map
//# sourceMappingURL=chunk-VRN4ZC7P.js.map