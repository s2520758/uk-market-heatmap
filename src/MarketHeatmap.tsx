import { useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import {
  layoutTree,
  changeColor,
  getTileLabelMode,
  type HeatmapNode,
  type HeatmapLeaf,
  type LayoutItem,
} from "./core";

export interface MarketHeatmapProps {
  /** Sector/industry tree. Leaves are { symbol, value, change }. Keep this
   *  reference stable; update `quotes` for realtime ticks, not this. */
  data: HeatmapNode[];
  /** Optional realtime overrides: symbol -> latest percent change. Updating
   *  this repaints tile colors without recomputing the treemap layout. */
  quotes?: Record<string, number>;
  /** Optional symbol-level catalyst markers. Markers are visual overlays and
   *  never affect tile size or fill colour. */
  catalystMarkers?: Record<string, "high" | "medium">;
  title?: string;
  /** viewBox width. Sets the internal coordinate space and aspect ratio, not
   *  the on-screen pixel size (the SVG scales to its container). */
  width?: number;
  /** viewBox height. */
  height?: number;
  /** Percent move that saturates the color scale. Lower = more contrast. */
  cap?: number;
  headerHeight?: number;
  pad?: number;
  background?: string;
  fontFamily?: string;
  showLegend?: boolean;
  /** Override the built-in red/green scale. */
  colorScale?: (change: number, cap: number) => string;
  className?: string;
  /** Merged onto the root element. Use it to set width/height/maxWidth. */
  style?: CSSProperties;
  /** Show the built-in hover tooltip. Set false to render your own from `onHover`. */
  showTooltip?: boolean;
  /** Fires with the hovered leaf, or null on leave. Use it to drive a custom
   *  tooltip, a drill-down panel, or a linked view. */
  onHover?: (leaf: HeatmapLeaf | null, anchorRect?: DOMRect) => void;
  /** Fires when a leaf is clicked. Useful for pinning a detail card or
   *  navigating to a security page. */
  onLeafClick?: (leaf: HeatmapLeaf) => void;
  /** Spotlight the top-level group with this name by outlining the whole sector
   *  and marking its header. Drive it from the hovered leaf's sector. */
  highlightGroup?: string | null;
  /** Colour of the {@link highlightGroup} outline, header strip and marker. */
  highlightColor?: string;
  /** Width of the selected group's outline. */
  highlightStrokeWidth?: number;
  /** Fill behind the selected group's header label. */
  highlightHeaderFill?: string;
}

type GroupItem = Extract<LayoutItem, { type: "group" }>;
type LeafItem = Extract<LayoutItem, { type: "leaf" }>;

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtCap(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toFixed(2)}T` : `$${v.toFixed(0)}B`;
}
function clip(text: string, w: number, fontSize = 10): string {
  const max = Math.floor(w / (fontSize * 0.62));
  if (text.length <= max) return text;
  if (max <= 1) return "";
  return text.slice(0, Math.max(0, max - 1)) + "\u2026";
}

export default function MarketHeatmap({
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
  highlightHeaderFill = "#211d12",
}: MarketHeatmapProps) {
  const [hover, setHover] = useState<LeafItem | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0, cw: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const clipPrefix = `heatmap-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const titleBar = title ? 26 : 0;

  // Layout depends only on structure and sizes, never on `quotes`, so realtime
  // ticks are cheap: no treemap recompute, only fill attributes change.
  const items = useMemo(() => {
    const out: LayoutItem[] = [];
    layoutTree(
      data,
      { x: 0, y: titleBar, w: width, h: height - titleBar },
      0,
      { headerHeight, pad },
      out,
    );
    return out;
  }, [data, width, height, headerHeight, pad, titleBar]);

  const groups = items.filter((i): i is GroupItem => i.type === "group");
  const leaves = items.filter((i): i is LeafItem => i.type === "leaf");

  // Live value falls back to the baked-in change if there is no fresh quote.
  const changeOf = (leaf: HeatmapLeaf): number => {
    const q = quotes?.[leaf.symbol];
    return Number.isFinite(q as number) ? (q as number) : leaf.change;
  };

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const b = wrapRef.current?.getBoundingClientRect();
    if (!b) return;
    setPos({ x: e.clientX - b.left, y: e.clientY - b.top, cw: b.width });
  };

  const legend = [-cap, -cap / 2, 0, cap / 2, cap].map((v) => colorScale(v, cap));

  return (
    <div
      ref={wrapRef}
      className={className}
      onMouseMove={showTooltip ? onMove : undefined}
      style={{ position: "relative", width: "100%", background, fontFamily, ...style }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", width: "100%", height: "auto", fontFamily: "inherit" }}
      >
        <defs>
          {leaves.map((leaf, idx) => (
            <clipPath id={`${clipPrefix}-tile-${idx}`} key={`${clipPrefix}-tile-${idx}`}>
              <rect
                x={leaf.rect.x + 1}
                y={leaf.rect.y + 1}
                width={Math.max(0, leaf.rect.w - 2)}
                height={Math.max(0, leaf.rect.h - 2)}
              />
            </clipPath>
          ))}
        </defs>

        {titleBar > 0 && (
          <>
            <rect x={0} y={0} width={width} height={titleBar} fill={background} />
            <text
              x={8}
              y={titleBar / 2}
              fill="#cfd2da"
              fontSize={13}
              fontWeight={700}
              letterSpacing={1.5}
              dominantBaseline="central"
            >
              {title}
            </text>
          </>
        )}

        {groups.map((g, idx) => (
          <g key={`g${idx}`}>
            <rect
              x={g.rect.x}
              y={g.rect.y}
              width={g.rect.w}
              height={g.rect.h}
              fill="none"
              stroke={background}
              strokeWidth={2}
            />
            {g.headerHeight > 0 && (
              <>
                <rect
                  x={g.rect.x}
                  y={g.rect.y}
                  width={g.rect.w}
                  height={g.headerHeight}
                  fill="#17171b"
                />
                <text
                  x={g.rect.x + 5}
                  y={g.rect.y + g.headerHeight / 2}
                  fill="#8b8f9c"
                  fontSize={Math.min(10, Math.max(7, g.headerHeight * 0.58))}
                  fontWeight={700}
                  letterSpacing={0.5}
                  dominantBaseline="central"
                >
                  {clip(
                    g.name,
                    g.rect.w - 10,
                    Math.min(10, Math.max(7, g.headerHeight * 0.58)),
                  )}
                </text>
              </>
            )}
          </g>
        ))}

        {leaves.map((t, idx) => {
          const { x, y, w, h } = t.rect;
          const n = t.node;
          const change = changeOf(n);
          const fill = colorScale(change, cap);
          const label = n.label ?? n.symbol;
          const isAggregate = Boolean(n.sublabel);
          const availW = Math.max(0, w - 6);
          const labelMode = getTileLabelMode(t.rect, label);
          const showTicker = isAggregate || labelMode !== "none";
          const showSecondary =
            showTicker &&
            (labelMode === "full" || Boolean(n.sublabel && h >= 16));
          const heightScale = showSecondary ? 0.32 : 0.52;
          const fittedFontSize = Math.max(
            0,
            Math.min(availW / (label.length * 0.68), h * heightScale, isAggregate ? 22 : 40),
          );
          const fs = isAggregate
            ? Math.max(fittedFontSize, Math.min(6.5, h * heightScale))
            : fittedFontSize;
          const isHover = hover === t;
          // Estimated rendered widths. When a tile is height-limited it can be
          // narrower than the label, so clamp with textLength: a long ticker
          // condenses to fit its tile instead of bleeding into its neighbours.
          const tickerW = label.length * fs * 0.64;
          const changeStr = fmtPct(change);
          const secondaryText = n.sublabel ?? changeStr;
          const secondaryW = secondaryText.length * fs * 0.6 * 0.6;
          const catalystImportance = catalystMarkers?.[n.symbol];
          const showCatalystMarker = Boolean(catalystImportance && w >= 16 && h >= 14);
          const markerX = x + w - 5;
          const markerY = y + 5;
          return (
            <g
              key={`t${idx}`}
              onClick={() => onLeafClick?.(t.node)}
              onMouseEnter={(event) => {
                setHover(t);
                onHover?.(t.node, event.currentTarget.getBoundingClientRect());
              }}
              onMouseLeave={() => {
                setHover((p) => (p === t ? null : p));
                onHover?.(null);
              }}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={fill}
                stroke={isHover ? "#ffffff" : background}
                strokeWidth={isHover ? 1.5 : 1}
                style={{ cursor: onLeafClick ? "pointer" : undefined }}
              />
              {showCatalystMarker && (
                <g style={{ pointerEvents: "none" }}>
                  {catalystImportance === "high" && (
                    <circle
                      cx={markerX}
                      cy={markerY}
                      r={4.5}
                      fill="rgba(255, 205, 92, 0.2)"
                      stroke="rgba(255, 222, 132, 0.9)"
                      strokeWidth={0.8}
                    />
                  )}
                  <circle
                    cx={markerX}
                    cy={markerY}
                    r={catalystImportance === "high" ? 2.5 : 2.1}
                    fill={catalystImportance === "high" ? "#ffd15c" : "#c6d5e3"}
                    stroke="rgba(8, 11, 15, 0.85)"
                    strokeWidth={0.8}
                  />
                </g>
              )}
              {showTicker && (
                <g clipPath={`url(#${clipPrefix}-tile-${idx})`} style={{ pointerEvents: "none" }}>
                  <text
                    x={x + w / 2}
                    y={showSecondary ? y + h / 2 - fs * 0.42 : y + h / 2}
                    fill="#ffffff"
                    fontSize={fs}
                    fontWeight={700}
                    textAnchor="middle"
                    dominantBaseline="central"
                    textLength={tickerW > availW ? availW : undefined}
                    lengthAdjust="spacingAndGlyphs"
                  >
                    {label}
                  </text>
                  {showSecondary && (
                    <text
                      x={x + w / 2}
                      y={y + h / 2 + fs * 0.5}
                      fill="rgba(255,255,255,0.92)"
                      fontSize={fs * 0.6}
                      fontWeight={600}
                      textAnchor="middle"
                      dominantBaseline="central"
                      textLength={secondaryW > availW ? availW : undefined}
                      lengthAdjust="spacingAndGlyphs"
                    >
                      {secondaryText}
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* Spotlight the hovered leaf's whole sector: a coloured outline over
            everything, plus a marked header strip. Drawn last so it sits on top. */}
        {highlightGroup &&
          groups
            .filter((g) => g.name === highlightGroup)
            .map((g, i) => {
              const hh = g.headerHeight;
              const mx = g.rect.x + 10;
              const my = g.rect.y + (hh > 0 ? hh / 2 : 8);
              return (
                <g key={`hl${i}`} style={{ pointerEvents: "none" }}>
                  {hh > 0 && (
                    <>
                      <rect
                        x={g.rect.x + 1}
                        y={g.rect.y + 1}
                        width={Math.max(0, g.rect.w - 2)}
                        height={Math.max(0, hh - 1)}
                        fill={highlightHeaderFill}
                      />
                      <path
                        d={`M ${mx} ${my - 3} L ${mx + 3} ${my} L ${mx} ${my + 3} L ${mx - 3} ${my} Z`}
                        fill={highlightColor}
                      />
                      <text
                        x={mx + 9}
                        y={my}
                        fill={highlightColor}
                        fontSize={10}
                        fontWeight={700}
                        letterSpacing={0.5}
                        dominantBaseline="central"
                      >
                        {clip(g.name, g.rect.w - 16)}
                      </text>
                    </>
                  )}
                  <rect
                    x={g.rect.x}
                    y={g.rect.y}
                    width={g.rect.w}
                    height={g.rect.h}
                    fill="none"
                    stroke={highlightColor}
                    strokeWidth={highlightStrokeWidth}
                  />
                </g>
              );
            })}
      </svg>

      {showLegend && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 8px 10px" }}>
          <span style={{ color: "#8b8f9c", fontSize: 11 }}>{`-${cap}%`}</span>
          <div
            style={{
              flex: 1,
              height: 8,
              borderRadius: 2,
              background: `linear-gradient(to right, ${legend.join(", ")})`,
            }}
          />
          <span style={{ color: "#8b8f9c", fontSize: 11 }}>{`+${cap}%`}</span>
        </div>
      )}

      {showTooltip && hover && (
        <div
          style={{
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
            zIndex: 10,
          }}
        >
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>
            {hover.node.label ?? hover.node.symbol}
          </div>
          {hover.node.sublabel && (
            <div style={{ color: "#9aa0ad", fontSize: 11 }}>{hover.node.sublabel}</div>
          )}
          <div style={{ color: colorScale(changeOf(hover.node), cap), fontSize: 12, fontWeight: 600 }}>
            {fmtPct(changeOf(hover.node))}
          </div>
          <div style={{ color: "#9aa0ad", fontSize: 11, marginTop: 2 }}>
            Mkt cap {fmtCap(hover.node.value)}
          </div>
        </div>
      )}
    </div>
  );
}
