export const INDEX_FILTERS = ["FTSE 100", "FTSE 250", "FTSE 350"] as const;
export type IndexFilter = (typeof INDEX_FILTERS)[number];

export const PERIODS = ["1D", "1W", "1M", "YTD"] as const;
export type PerformancePeriod = (typeof PERIODS)[number];

export const SECTOR_ORDER = [
  "Financials",
  "Technology",
  "Health Care",
  "Energy",
  "Industrials",
  "Consumer Staples",
  "Consumer Discretionary",
  "Basic Materials",
  "Real Estate",
  "Utilities",
  "Telecommunications",
] as const;
export type UkSector = (typeof SECTOR_ORDER)[number];

export type IndexMembership = Exclude<IndexFilter, "FTSE 350">;

export interface ConstituentReference {
  symbol: string;
  companyName: string;
  sector: UkSector;
  indexMembership: IndexMembership;
}

export interface MarketQuote {
  symbol: string;
  price: number;
  marketCap: number;
  change1d: number;
  change1w: number;
  change1m: number;
  changeYtd: number;
}

export interface UkStock extends ConstituentReference, MarketQuote {}

export interface ConstituentSnapshot {
  asOf: string;
  classification: string;
  sources: string[];
  constituents: ConstituentReference[];
}

export interface QuoteSnapshot {
  asOf: string;
  marketSnapshotSource: string;
  marketCapUnit: "GBP billions";
  priceUnit: "GBX";
  performanceMode: "mock" | "live" | "delayed";
  quotes: MarketQuote[];
}

export interface ConstituentRepository {
  loadConstituents(): Promise<ConstituentSnapshot>;
}

export interface QuoteProvider {
  loadQuotes(symbols: string[]): Promise<QuoteSnapshot>;
}

export interface MarketUniverse {
  stocks: UkStock[];
  currency: "GBX";
  marketCapCurrency: "GBP";
  sourceLabel: string;
  asOfLabel: string;
  isMock: boolean;
}

export interface MarketDataProvider {
  loadUniverse(index: IndexFilter): Promise<MarketUniverse>;
}
