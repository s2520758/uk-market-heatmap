import { DEMO_CATALYST_FEED } from "./demoCatalysts";
import type { CatalystFeed, NewsProvider } from "./types";

function cloneFeed(catalysts: CatalystFeed["catalysts"]): CatalystFeed {
  return {
    ...DEMO_CATALYST_FEED,
    catalysts: catalysts.map((catalyst) => ({ ...catalyst })),
  };
}

export class StaticNewsProvider implements NewsProvider {
  async getRecentCatalysts(symbols: string[], since: string): Promise<CatalystFeed> {
    const symbolsSet = new Set(symbols);
    const sinceTime = Date.parse(since);
    const catalysts = DEMO_CATALYST_FEED.catalysts.filter((catalyst) => {
      const publishedAt = Date.parse(catalyst.publishedAt);
      return (
        symbolsSet.has(catalyst.symbol) &&
        Number.isFinite(publishedAt) &&
        (!Number.isFinite(sinceTime) || publishedAt >= sinceTime)
      );
    });
    return cloneFeed(catalysts);
  }

  async getCatalystsForSymbol(symbol: string): Promise<CatalystFeed> {
    return cloneFeed(
      DEMO_CATALYST_FEED.catalysts.filter((catalyst) => catalyst.symbol === symbol),
    );
  }
}

export const demoNewsProvider: NewsProvider = new StaticNewsProvider();
