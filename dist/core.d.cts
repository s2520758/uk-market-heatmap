/**
 * Pure, framework-free treemap + color engine.
 * No React, no DOM, no network. Safe to use in a Canvas or WebGL renderer, in
 * Node for server-side image generation, or as a reference when porting to Go
 * or Rust.
 */
interface HeatmapLeaf {
    symbol: string;
    /** Optional display label when the stable symbol is an internal identifier. */
    label?: string;
    /** Optional second line, such as the member count of an aggregate tile. */
    sublabel?: string;
    /** Size driver, e.g. market cap. */
    value: number;
    /** Color driver, e.g. percent change. */
    change: number;
}
interface HeatmapGroup {
    name: string;
    children: HeatmapNode[];
}
type HeatmapNode = HeatmapLeaf | HeatmapGroup;
interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
type LayoutItem = {
    type: "group";
    depth: number;
    rect: Rect;
    name: string;
    headerHeight: number;
} | {
    type: "leaf";
    depth: number;
    rect: Rect;
    node: HeatmapLeaf;
};
interface LayoutOptions {
    headerHeight: number;
    pad: number;
}
type TileLabelMode = "full" | "ticker" | "none";
interface TreemapAggregationEntry<T> {
    symbol: string;
    group: string;
    value: number;
    change: number;
    data: T;
}
interface TreemapAggregate<T> {
    symbol: string;
    group: string;
    value: number;
    change: number;
    members: TreemapAggregationEntry<T>[];
}
interface AggregatedTreemap<T> {
    data: HeatmapNode[];
    visible: TreemapAggregationEntry<T>[];
    aggregates: TreemapAggregate<T>[];
    aggregatesBySymbol: Map<string, TreemapAggregate<T>>;
}
/**
 * Density is driven by the number of leaves, not by a named index. The values
 * only reserve rendering gutters and headers; they never alter node weights.
 */
declare function getTreemapDensity(stockCount: number): LayoutOptions;
/** Decide how much text a tile can safely contain at its rendered size. */
declare function getTileLabelMode(rect: Rect, symbol: string): TileLabelMode;
/**
 * Squarified treemap (Bruls, Huizing & van Wijk, 2000).
 * Packs items (each carrying `area`) into `rect`, keeping tiles near-square.
 * Returns each item with x, y, w, h written onto it. Runs in a single pass.
 */
declare function squarify<T extends {
    area: number;
}>(items: T[], rect: Rect): (T & Rect)[];
/**
 * Recursively lay out groups, reserve a header strip on each, then recurse into
 * children. Appends a flat list of positioned `LayoutItem`s to `out`.
 */
declare function layoutTree(nodes: HeatmapNode[], rect: Rect, depth: number, opt: LayoutOptions, out: LayoutItem[]): void;
/**
 * Repeatedly lays out individual securities and folds only label-less leaves
 * into a market-cap weighted OTHER tile inside the same top-level group.
 */
declare function aggregateTinyLeaves<T>(entries: TreemapAggregationEntry<T>[], rect: Rect, opt: LayoutOptions): AggregatedTreemap<T>;
/** Diverging scale: clamp change to +/- cap, ease, interpolate red..neutral..green. */
declare function changeColor(change: number, cap?: number): string;
/**
 * Escape a string for safe inclusion in SVG/XML text or attributes.
 * Only needed if you build SVG as a raw string outside React (the React
 * component already escapes everything). Use this in the Node/Go/Rust path.
 */
declare function escapeXml(s: string): string;

export { type AggregatedTreemap, type HeatmapGroup, type HeatmapLeaf, type HeatmapNode, type LayoutItem, type LayoutOptions, type Rect, type TileLabelMode, type TreemapAggregate, type TreemapAggregationEntry, aggregateTinyLeaves, changeColor, escapeXml, getTileLabelMode, getTreemapDensity, layoutTree, squarify };
