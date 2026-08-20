import constituentData from "./ftse-constituents.json";
import quoteData from "./mock-quotes.json";
import type {
  ConstituentRepository,
  ConstituentSnapshot,
  IndexFilter,
  MarketDataProvider,
  MarketQuote,
  MarketUniverse,
  QuoteProvider,
  QuoteSnapshot,
} from "./types";

const staticConstituentRepository: ConstituentRepository = {
  async loadConstituents(): Promise<ConstituentSnapshot> {
    return constituentData as ConstituentSnapshot;
  },
};

const mockQuoteProvider: QuoteProvider = {
  async loadQuotes(symbols: string[]): Promise<QuoteSnapshot> {
    const requested = new Set(symbols);
    const snapshot = quoteData as QuoteSnapshot;
    return {
      ...snapshot,
      quotes: snapshot.quotes.filter((quote) => requested.has(quote.symbol)),
    };
  },
};

export function createMarketDataProvider(
  constituentRepository: ConstituentRepository,
  quoteProvider: QuoteProvider,
): MarketDataProvider {
  return {
    async loadUniverse(index: IndexFilter): Promise<MarketUniverse> {
      const reference = await constituentRepository.loadConstituents();
      const constituents = index === "FTSE 350"
        ? reference.constituents
        : reference.constituents.filter((item) => item.indexMembership === index);
      const quoteSnapshot = await quoteProvider.loadQuotes(
        constituents.map((item) => item.symbol),
      );
      const quotesBySymbol = new Map<string, MarketQuote>(
        quoteSnapshot.quotes.map((quote) => [quote.symbol, quote]),
      );
      const stocks = constituents.map((item) => {
        const quote = quotesBySymbol.get(item.symbol);
        if (!quote) throw new Error(`Missing quote data for ${item.symbol}`);
        return { ...item, ...quote };
      });
      return {
        stocks,
        currency: "GBX",
        marketCapCurrency: "GBP",
        sourceLabel: "FTSE constituent reference with static market snapshot",
        asOfLabel: `Constituents and price/market-cap snapshot ${quoteSnapshot.asOf}; returns are simulated`,
        isMock: quoteSnapshot.performanceMode === "mock",
      };
    },
  };
}

export const marketDataProvider = createMarketDataProvider(
  staticConstituentRepository,
  mockQuoteProvider,
);
