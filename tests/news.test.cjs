const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const moduleCache = new Map();

function loadTypeScriptModule(filename) {
  const resolved = path.resolve(filename);
  if (moduleCache.has(resolved)) return moduleCache.get(resolved).exports;

  const source = fs.readFileSync(resolved, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      strict: true,
    },
    fileName: resolved,
  }).outputText;
  const module = { exports: {} };
  moduleCache.set(resolved, module);
  const localRequire = (specifier) => {
    if (!specifier.startsWith(".")) return require(specifier);
    const candidate = path.resolve(path.dirname(resolved), specifier);
    const dependency = path.extname(candidate) ? candidate : `${candidate}.ts`;
    return loadTypeScriptModule(dependency);
  };
  const execute = new Function("module", "exports", "require", compiled);
  execute(module, module.exports, localRequire);
  return module.exports;
}

const newsDirectory = path.join(__dirname, "..", "demo", "news");
const logic = loadTypeScriptModule(path.join(newsDirectory, "catalystLogic.ts"));
const { DEMO_CATALYST_FEED } = loadTypeScriptModule(
  path.join(newsDirectory, "demoCatalysts.ts"),
);
const { StaticNewsProvider } = loadTypeScriptModule(
  path.join(newsDirectory, "newsProvider.ts"),
);

const categories = new Set([
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
]);
const importanceLevels = new Set(["high", "medium", "low"]);

test("demo catalysts use the complete model and map to the expected major symbols", () => {
  assert.equal(DEMO_CATALYST_FEED.isDemo, true);
  assert.match(DEMO_CATALYST_FEED.sourceLabel, /not live news/i);
  const expectedSymbols = ["AZN", "SHEL", "HSBA", "RR.", "BA.", "GSK"];
  const actualSymbols = new Set(DEMO_CATALYST_FEED.catalysts.map((item) => item.symbol));
  for (const symbol of expectedSymbols) assert.ok(actualSymbols.has(symbol));

  for (const catalyst of DEMO_CATALYST_FEED.catalysts) {
    assert.ok(catalyst.id);
    assert.ok(catalyst.symbol);
    assert.match(catalyst.headline, /^Demo scenario:/);
    assert.ok(categories.has(catalyst.category));
    assert.ok(Number.isFinite(Date.parse(catalyst.publishedAt)));
    assert.ok(catalyst.sourceName);
    assert.doesNotThrow(() => new URL(catalyst.sourceUrl));
    assert.ok(catalyst.summary);
    assert.ok(importanceLevels.has(catalyst.importance));
  }
});

test("catalysts group by symbol and ignore unknown symbols safely", () => {
  const knownSymbols = new Set(["AZN", "SHEL"]);
  const grouped = logic.groupCatalystsBySymbol(
    [
      ...DEMO_CATALYST_FEED.catalysts,
      {
        ...DEMO_CATALYST_FEED.catalysts[0],
        id: "unknown-symbol-event",
        symbol: "UNKNOWN",
      },
    ],
    knownSymbols,
  );

  assert.equal(grouped.get("AZN").length, 3);
  assert.equal(grouped.get("SHEL").length, 2);
  assert.equal(grouped.has("UNKNOWN"), false);
});

test("recency filtering supports 24H, 72H, and 7D", () => {
  const filter = (window) =>
    logic.filterCatalysts(DEMO_CATALYST_FEED.catalysts, {
      asOf: DEMO_CATALYST_FEED.asOf,
      window,
      category: "All",
    });

  assert.equal(filter("24H").length, 6);
  assert.equal(filter("72H").length, 11);
  assert.equal(filter("7D").length, 14);
});

test("category filters include explicit categories and the remaining-category bucket", () => {
  const select = (category) =>
    logic.filterCatalysts(DEMO_CATALYST_FEED.catalysts, {
      asOf: DEMO_CATALYST_FEED.asOf,
      window: "72H",
      category,
    });

  assert.deepEqual(select("M&A").map((item) => item.symbol), ["AZN"]);
  assert.deepEqual(new Set(select("Earnings").map((item) => item.symbol)), new Set(["SHEL", "HSBA"]));
  assert.deepEqual(new Set(select("Clinical").map((item) => item.symbol)), new Set(["AZN", "GSK"]));
  assert.ok(
    select("Other").every((item) => !["M&A", "Earnings", "Clinical"].includes(item.category)),
  );
});

test("marker importance excludes low events and high importance wins", () => {
  const recent = logic.filterCatalysts(DEMO_CATALYST_FEED.catalysts, {
    asOf: DEMO_CATALYST_FEED.asOf,
    window: "7D",
    category: "All",
  });
  const markers = logic.buildCatalystMarkers(recent);

  assert.equal(markers.AZN, "high");
  assert.equal(markers.SHEL, "high");
  assert.equal(markers.HSBA, "high");
  const lowOnly = recent.filter((item) => item.importance === "low");
  assert.deepEqual(logic.buildCatalystMarkers(lowOnly), {});
});

test("compact company detail view returns at most three latest catalysts", () => {
  const compact = logic.compactCatalysts(DEMO_CATALYST_FEED.catalysts, 3);
  assert.equal(compact.length, 3);
  assert.ok(Date.parse(compact[0].publishedAt) >= Date.parse(compact[1].publishedAt));
  assert.ok(Date.parse(compact[1].publishedAt) >= Date.parse(compact[2].publishedAt));
});

test("tile markers only represent eligible recent medium or high events", () => {
  const recent = logic.filterCatalysts(DEMO_CATALYST_FEED.catalysts, {
    asOf: DEMO_CATALYST_FEED.asOf,
    window: "24H",
    category: "All",
  });
  const markers = logic.buildCatalystMarkers(recent);
  const markerSymbols = Object.keys(markers);

  assert.deepEqual(
    new Set(markerSymbols),
    new Set(["AZN", "SHEL", "HSBA", "RR.", "BA.", "GSK"]),
  );
  assert.ok(recent.every((item) => item.importance !== "low" || !markerSymbols.includes(item.symbol)));
});

test("static provider implements both provider methods and unknown symbols return empty feeds", async () => {
  const provider = new StaticNewsProvider();
  const azn = await provider.getCatalystsForSymbol("AZN");
  const unknown = await provider.getRecentCatalysts(["UNKNOWN"], new Date(0).toISOString());
  const unknownSymbol = await provider.getCatalystsForSymbol("UNKNOWN");

  assert.equal(azn.catalysts.length, 3);
  assert.deepEqual(unknown.catalysts, []);
  assert.deepEqual(unknownSymbol.catalysts, []);
});

test("heatmap UI passes catalyst markers without filtering the stock universe", () => {
  const component = fs.readFileSync(
    path.join(__dirname, "..", "demo", "UkMarketHeatmap.tsx"),
    "utf8",
  );
  const heatmap = fs.readFileSync(path.join(__dirname, "..", "src", "MarketHeatmap.tsx"), "utf8");

  assert.match(component, /catalystMarkers=\{catalystMarkers\}/);
  assert.match(component, /compactCatalysts\(/);
  assert.match(component, /activeCatalysts\.map/);
  assert.match(heatmap, /Markers are visual overlays/);
  assert.match(heatmap, /catalystMarkers\?\.\[n\.symbol\]/);
});
