const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadCore() {
  const filename = path.join(__dirname, "..", "src", "core.ts");
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      strict: true,
    },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  const execute = new Function("module", "exports", compiled);
  execute(module, module.exports);
  return module.exports;
}

const { aggregateTinyLeaves, getTileLabelMode, getTreemapDensity, layoutTree } = loadCore();
const dataDirectory = path.join(__dirname, "..", "demo", "data");
const references = JSON.parse(
  fs.readFileSync(path.join(dataDirectory, "ftse-constituents.json"), "utf8"),
).constituents;
const quotes = JSON.parse(
  fs.readFileSync(path.join(dataDirectory, "mock-quotes.json"), "utf8"),
).quotes;
const quotesBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
const stocks = references.map((reference) => ({
  ...reference,
  ...quotesBySymbol.get(reference.symbol),
}));

function buildAggregation(width = 1440, height = 900) {
  const entries = stocks.map((stock) => ({
    symbol: stock.symbol,
    group: stock.sector,
    value: stock.marketCap,
    change: stock.change1d,
    data: stock,
  }));
  return aggregateTinyLeaves(
    entries,
    { x: 0, y: 0, w: width, h: height },
    getTreemapDensity(entries.length),
  );
}

test("aggregation retains every FTSE 350 constituent exactly once", () => {
  const aggregation = buildAggregation();
  const represented = [
    ...aggregation.visible.map((entry) => entry.symbol),
    ...aggregation.aggregates.flatMap((aggregate) =>
      aggregate.members.map((member) => member.symbol),
    ),
  ];

  assert.ok(aggregation.aggregates.length > 0);
  assert.equal(represented.length, stocks.length);
  assert.equal(new Set(represented).size, stocks.length);
  assert.deepEqual(represented.slice().sort(), stocks.map((stock) => stock.symbol).sort());
});

test("OTHER market cap and return equal their member calculations", () => {
  const aggregation = buildAggregation();

  for (const aggregate of aggregation.aggregates) {
    const expectedCap = aggregate.members.reduce((sum, member) => sum + member.value, 0);
    const expectedReturn =
      aggregate.members.reduce(
        (sum, member) => sum + member.value * member.change,
        0,
      ) / expectedCap;

    assert.ok(Math.abs(aggregate.value - expectedCap) <= 1e-10);
    assert.ok(Math.abs(aggregate.change - expectedReturn) <= 1e-12);
  }
});

test("each OTHER contains securities from exactly one sector", () => {
  const aggregation = buildAggregation();

  for (const aggregate of aggregation.aggregates) {
    assert.ok(aggregate.members.length > 0);
    assert.ok(
      aggregate.members.every((member) => member.group === aggregate.group),
      `${aggregate.group} OTHER contains a cross-sector member`,
    );
  }
});

test("sector market caps are unchanged after aggregation", () => {
  const aggregation = buildAggregation();
  const originalCaps = new Map();
  const displayedCaps = new Map();

  for (const stock of stocks) {
    originalCaps.set(stock.sector, (originalCaps.get(stock.sector) ?? 0) + stock.marketCap);
  }
  for (const entry of aggregation.visible) {
    displayedCaps.set(entry.group, (displayedCaps.get(entry.group) ?? 0) + entry.value);
  }
  for (const aggregate of aggregation.aggregates) {
    displayedCaps.set(
      aggregate.group,
      (displayedCaps.get(aggregate.group) ?? 0) + aggregate.value,
    );
  }

  for (const [sector, originalCap] of originalCaps) {
    assert.ok(Math.abs(displayedCaps.get(sector) - originalCap) <= 1e-9, `${sector} cap changed`);
  }
});

test("every final individual tile has enough rendered space for its ticker", () => {
  const width = 1440;
  const height = 900;
  const aggregation = buildAggregation(width, height);
  const output = [];
  layoutTree(
    aggregation.data,
    { x: 0, y: 0, w: width, h: height },
    0,
    getTreemapDensity(stocks.length),
    output,
  );

  const anonymousIndividuals = output
    .filter((item) => item.type === "leaf")
    .filter((item) => !aggregation.aggregatesBySymbol.has(item.node.symbol))
    .filter((item) => getTileLabelMode(item.rect, item.node.symbol) === "none");
  assert.deepEqual(anonymousIndividuals, []);
});

test("aggregation responds to rendered viewport dimensions", () => {
  const wide = buildAggregation(1800, 1000);
  const narrow = buildAggregation(900, 600);
  const wideMembers = wide.aggregates.reduce((sum, aggregate) => sum + aggregate.members.length, 0);
  const narrowMembers = narrow.aggregates.reduce((sum, aggregate) => sum + aggregate.members.length, 0);

  assert.ok(narrowMembers >= wideMembers);
});
