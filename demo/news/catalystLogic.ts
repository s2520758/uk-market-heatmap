import type {
  Catalyst,
  CatalystFilter,
  CatalystImportance,
  RecencyWindow,
} from "./types";

const WINDOW_MS: Record<RecencyWindow, number> = {
  "24H": 24 * 60 * 60 * 1000,
  "72H": 72 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
};

export interface CatalystFilterOptions {
  asOf: string;
  window: RecencyWindow;
  category: CatalystFilter;
}

function matchesCategory(catalyst: Catalyst, filter: CatalystFilter): boolean {
  if (filter === "All") return true;
  if (filter === "Other") {
    return !["M&A", "Earnings", "Clinical"].includes(catalyst.category);
  }
  return catalyst.category === filter;
}

export function filterCatalysts(
  catalysts: Catalyst[],
  options: CatalystFilterOptions,
): Catalyst[] {
  const asOf = Date.parse(options.asOf);
  const since = asOf - WINDOW_MS[options.window];
  return catalysts
    .filter((catalyst) => {
      const publishedAt = Date.parse(catalyst.publishedAt);
      return (
        Number.isFinite(publishedAt) &&
        publishedAt <= asOf &&
        publishedAt >= since &&
        matchesCategory(catalyst, options.category)
      );
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function groupCatalystsBySymbol(
  catalysts: Catalyst[],
  knownSymbols?: Set<string>,
): Map<string, Catalyst[]> {
  const grouped = new Map<string, Catalyst[]>();
  for (const catalyst of catalysts) {
    if (knownSymbols && !knownSymbols.has(catalyst.symbol)) continue;
    const existing = grouped.get(catalyst.symbol) ?? [];
    existing.push(catalyst);
    grouped.set(catalyst.symbol, existing);
  }
  for (const items of grouped.values()) {
    items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  }
  return grouped;
}

export function buildCatalystMarkers(
  catalysts: Catalyst[],
  knownSymbols?: Set<string>,
): Record<string, Exclude<CatalystImportance, "low">> {
  const markers: Record<string, Exclude<CatalystImportance, "low">> = {};
  for (const catalyst of catalysts) {
    if (knownSymbols && !knownSymbols.has(catalyst.symbol)) continue;
    if (catalyst.importance === "low") continue;
    if (catalyst.importance === "high" || !markers[catalyst.symbol]) {
      markers[catalyst.symbol] = catalyst.importance;
    }
  }
  return markers;
}

export function compactCatalysts(catalysts: Catalyst[], maximum = 3): Catalyst[] {
  return catalysts
    .slice()
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, Math.max(0, maximum));
}

export function formatCatalystTime(publishedAt: string, asOf: string): string {
  const published = Date.parse(publishedAt);
  const reference = Date.parse(asOf);
  const difference = Math.max(0, reference - published);
  const hours = Math.floor(difference / (60 * 60 * 1000));
  if (hours < 1) return "Less than 1h ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(publishedAt));
}
