import * as react from 'react';
import { CSSProperties } from 'react';
import { HeatmapNode, HeatmapLeaf } from './core.js';
export { AggregatedTreemap, HeatmapGroup, LayoutItem, LayoutOptions, Rect, TileLabelMode, TreemapAggregate, TreemapAggregationEntry, aggregateTinyLeaves, changeColor, escapeXml, getTileLabelMode, getTreemapDensity, layoutTree, squarify } from './core.js';

interface MarketHeatmapProps {
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
declare function MarketHeatmap({ data, quotes, catalystMarkers, title, width, height, cap, headerHeight, pad, background, fontFamily, showLegend, colorScale, className, style, showTooltip, onHover, onLeafClick, highlightGroup, highlightColor, highlightStrokeWidth, highlightHeaderFill, }: MarketHeatmapProps): react.JSX.Element;

export { HeatmapLeaf, HeatmapNode, MarketHeatmap, type MarketHeatmapProps };
