export const CATALYST_CATEGORIES = [
  "M&A",
  "Earnings",
  "Guidance",
  "Clinical",
  "Regulatory",
  "Contract",
  "Management",
  "Dividend",
  "Buyback",
  "Litigation",
  "Macro",
  "Other",
] as const;

export type CatalystCategory = (typeof CATALYST_CATEGORIES)[number];

export const CATALYST_IMPORTANCE = ["high", "medium", "low"] as const;
export type CatalystImportance = (typeof CATALYST_IMPORTANCE)[number];

export interface Catalyst {
  id: string;
  symbol: string;
  headline: string;
  category: CatalystCategory;
  publishedAt: string;
  sourceName: string;
  sourceUrl: string;
  summary: string;
  importance: CatalystImportance;
}

export interface CatalystFeed {
  catalysts: Catalyst[];
  asOf: string;
  isDemo: boolean;
  sourceLabel: string;
}

export interface NewsProvider {
  getRecentCatalysts(symbols: string[], since: string): Promise<CatalystFeed>;
  getCatalystsForSymbol(symbol: string): Promise<CatalystFeed>;
}

export const CATALYST_FILTERS = ["All", "M&A", "Earnings", "Clinical", "Other"] as const;
export type CatalystFilter = (typeof CATALYST_FILTERS)[number];

export const RECENCY_WINDOWS = ["24H", "72H", "7D"] as const;
export type RecencyWindow = (typeof RECENCY_WINDOWS)[number];
