const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const dataDirectory = path.join(__dirname, "..", "demo", "data");
const referenceSnapshot = JSON.parse(
  fs.readFileSync(path.join(dataDirectory, "ftse-constituents.json"), "utf8"),
);
const quoteSnapshot = JSON.parse(
  fs.readFileSync(path.join(dataDirectory, "mock-quotes.json"), "utf8"),
);
const uiSource = fs.readFileSync(
  path.join(__dirname, "..", "demo", "UkMarketHeatmap.tsx"),
  "utf8",
);
const providerSource = fs.readFileSync(
  path.join(dataDirectory, "marketDataProvider.ts"),
  "utf8",
);

const references = referenceSnapshot.constituents;
const quotes = quoteSnapshot.quotes;
const quotesBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
const stocks = references.map((reference) => ({
  ...reference,
  ...quotesBySymbol.get(reference.symbol),
}));

const canonicalFields = [
  "symbol",
  "companyName",
  "sector",
  "indexMembership",
  "marketCap",
  "price",
  "change1d",
  "change1w",
  "change1m",
  "changeYtd",
];

const supportedSectors = [
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
];

const supportedMemberships = ["FTSE 100", "FTSE 250"];
const percentageFields = ["change1d", "change1w", "change1m", "changeYtd"];

const expectedMajorSectors = {
  AZN: "Health Care",
  GSK: "Health Care",
  HLN: "Health Care",
  "SN.": "Health Care",
  HIK: "Health Care",
  HLMA: "Industrials",
  SGE: "Technology",
  SHEL: "Energy",
  "BP.": "Energy",
  HSBA: "Financials",
  LLOY: "Financials",
  BARC: "Financials",
  NWG: "Financials",
  STAN: "Financials",
  RIO: "Basic Materials",
  GLEN: "Basic Materials",
  AAL: "Basic Materials",
  ULVR: "Consumer Staples",
  DGE: "Consumer Staples",
  TSCO: "Consumer Staples",
  BATS: "Consumer Staples",
  IMB: "Consumer Staples",
  "NG.": "Utilities",
  SSE: "Utilities",
  VOD: "Telecommunications",
  "BT.A": "Telecommunications",
};

const expectedTechnology = [
  "ALFA",
  "ATG",
  "AUTO",
  "BCG",
  "BYIT",
  "CCC",
  "FCH",
  "GBG",
  "KNOS",
  "MONY",
  "NCC",
  "REL",
  "RPI",
  "SCT",
  "SGE",
  "TRST",
];

const expectedReviewedSectors = {
  COA: "Industrials",
  EWG: "Industrials",
  FCH: "Technology",
  FGP: "Industrials",
  HILS: "Basic Materials",
  IWG: "Real Estate",
  MKS: "Consumer Staples",
  MNDI: "Industrials",
  PTEC: "Consumer Discretionary",
  RHIM: "Basic Materials",
  TCAP: "Financials",
  TRN: "Consumer Discretionary",
};

test("the canonical merged records use the required schema", () => {
  assert.equal(stocks.length, 350);
  for (const stock of stocks) {
    assert.deepEqual(Object.keys(stock), canonicalFields, `${stock.symbol} has a non-canonical schema`);
  }
});

test("tickers are unique in reference and quote snapshots", () => {
  const referenceSymbols = references.map((stock) => stock.symbol);
  const quoteSymbols = quotes.map((quote) => quote.symbol);
  assert.equal(new Set(referenceSymbols).size, referenceSymbols.length);
  assert.equal(new Set(quoteSymbols).size, quoteSymbols.length);
});

test("every constituent has one matching quote record", () => {
  assert.equal(quotes.length, references.length);
  assert.deepEqual(
    quotes.map((quote) => quote.symbol).sort(),
    references.map((stock) => stock.symbol).sort(),
  );
});

test("company names, sectors, and memberships are present and supported", () => {
  for (const stock of stocks) {
    assert.equal(typeof stock.companyName, "string", `${stock.symbol} has no company name`);
    assert.ok(stock.companyName.trim().length > 0, `${stock.symbol} has no company name`);
    assert.ok(supportedSectors.includes(stock.sector), `${stock.symbol} has invalid sector ${stock.sector}`);
    assert.ok(
      supportedMemberships.includes(stock.indexMembership),
      `${stock.symbol} has invalid membership ${stock.indexMembership}`,
    );
  }
});

test("prices and market caps are finite and positive", () => {
  for (const stock of stocks) {
    assert.ok(Number.isFinite(stock.price) && stock.price > 0, `${stock.symbol} has invalid price`);
    assert.ok(
      Number.isFinite(stock.marketCap) && stock.marketCap > 0,
      `${stock.symbol} has invalid market cap`,
    );
  }
});

test("all percentage values are finite", () => {
  for (const stock of stocks) {
    for (const field of percentageFields) {
      assert.ok(Number.isFinite(stock[field]), `${stock.symbol} has invalid ${field}`);
    }
  }
});

test("FTSE 100 and FTSE 250 have exact, non-overlapping membership", () => {
  const ftse100 = stocks.filter((stock) => stock.indexMembership === "FTSE 100");
  const ftse250 = stocks.filter((stock) => stock.indexMembership === "FTSE 250");
  const ftse100Symbols = new Set(ftse100.map((stock) => stock.symbol));
  const overlap = ftse250.filter((stock) => ftse100Symbols.has(stock.symbol));
  assert.equal(ftse100.length, 100);
  assert.equal(ftse250.length, 250);
  assert.deepEqual(overlap, []);
});

test("FTSE 350 is exactly the union of FTSE 100 and FTSE 250", () => {
  const union = new Set(
    stocks
      .filter((stock) => supportedMemberships.includes(stock.indexMembership))
      .map((stock) => stock.symbol),
  );
  assert.equal(union.size, 350);
  assert.equal(union.size, stocks.length);
});

test("required major-company mappings match the ICB industry view", () => {
  const bySymbol = new Map(stocks.map((stock) => [stock.symbol, stock]));
  for (const [symbol, sector] of Object.entries(expectedMajorSectors)) {
    assert.equal(bySymbol.get(symbol)?.sector, sector, `${symbol} should be ${sector}`);
  }
  assert.equal(bySymbol.get("SN.")?.companyName, "Smith & Nephew");
  assert.equal(bySymbol.get("HIK")?.companyName, "Hikma Pharmaceuticals");
});

test("reviewed ambiguous mappings match current FTSE Russell company reports", () => {
  const bySymbol = new Map(stocks.map((stock) => [stock.symbol, stock]));
  for (const [symbol, sector] of Object.entries(expectedReviewedSectors)) {
    assert.equal(bySymbol.get(symbol)?.sector, sector, `${symbol} should be ${sector}`);
  }
});

test("Technology contains only the reviewed ICB Technology constituents", () => {
  const actual = stocks
    .filter((stock) => stock.sector === "Technology")
    .map((stock) => stock.symbol)
    .sort();
  assert.deepEqual(actual, expectedTechnology);
});

test("the market snapshot is static and performance remains explicitly mock", () => {
  assert.match(referenceSnapshot.asOf, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(quoteSnapshot.asOf, referenceSnapshot.asOf);
  assert.equal(quoteSnapshot.marketCapUnit, "GBP billions");
  assert.equal(quoteSnapshot.priceUnit, "GBX");
  assert.equal(quoteSnapshot.performanceMode, "mock");
});

test("the company card uses PRICE and mock status appears only as the global banner", () => {
  assert.doesNotMatch(uiSource, /MOCK\s+PRICE/i);
  assert.match(uiSource, /data-testid="price-label">Price<\/dt>/);
  assert.equal((uiSource.match(/DEMO DATA/g) ?? []).length, 1);
});

test("the index controls load and display the filtered provider universe", () => {
  assert.match(uiSource, /provider\s*\.loadUniverse\(indexFilter\)/);
  assert.match(uiSource, /setIndexFilter\(index\)/);
  assert.match(uiSource, /universe\.stocks\.length/);
  assert.match(providerSource, /item\.indexMembership === index/);
});
