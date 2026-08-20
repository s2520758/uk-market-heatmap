import type { HeatmapNode } from "../../src/core";
import { SECTOR_ORDER, type PerformancePeriod, type UkStock } from "./types";

export function changeForPeriod(stock: UkStock, period: PerformancePeriod): number {
  if (period === "1D") return stock.change1d;
  if (period === "1W") return stock.change1w;
  if (period === "1M") return stock.change1m;
  return stock.changeYtd;
}

export function buildSectorTree(stocks: UkStock[]): HeatmapNode[] {
  return SECTOR_ORDER.map((sector) => ({
    name: sector,
    children: stocks
      .filter((stock) => stock.sector === sector)
      .sort((a, b) => b.marketCap - a.marketCap)
      .map((stock) => ({ symbol: stock.symbol, value: stock.marketCap, change: 0 })),
  })).filter((sector) => sector.children.length > 0);
}

export function buildQuoteMap(stocks: UkStock[], period: PerformancePeriod): Record<string, number> {
  return Object.fromEntries(stocks.map((stock) => [stock.symbol, changeForPeriod(stock, period)]));
}
