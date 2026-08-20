export { default as MarketHeatmap } from "./MarketHeatmap";
export type { MarketHeatmapProps } from "./MarketHeatmap";

export {
  squarify,
  layoutTree,
  getTreemapDensity,
  getTileLabelMode,
  aggregateTinyLeaves,
  changeColor,
  escapeXml,
} from "./core";
export type {
  HeatmapNode,
  HeatmapLeaf,
  HeatmapGroup,
  Rect,
  LayoutItem,
  LayoutOptions,
  TileLabelMode,
  TreemapAggregationEntry,
  TreemapAggregate,
  AggregatedTreemap,
} from "./core";
