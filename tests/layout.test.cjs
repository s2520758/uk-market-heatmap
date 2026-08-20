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

const { getTileLabelMode, getTreemapDensity, layoutTree } = loadCore();
const dataDirectory = path.join(__dirname, "..", "demo", "data");
const references = JSON.parse(
  fs.readFileSync(path.join(dataDirectory, "ftse-constituents.json"), "utf8"),
).constituents;
const quotes = JSON.parse(
  fs.readFileSync(path.join(dataDirectory, "mock-quotes.json"), "utf8"),
).quotes;
const capsBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote.marketCap]));

function stocksFor(index) {
  if (index === "FTSE 350") return references;
  return references.filter((stock) => stock.indexMembership === index);
}

function sectorTree(stocks) {
  const groups = new Map();
  for (const stock of stocks) {
    const children = groups.get(stock.sector) ?? [];
    children.push({
      symbol: stock.symbol,
      value: capsBySymbol.get(stock.symbol),
      change: 0,
    });
    groups.set(stock.sector, children);
  }
  return [...groups].map(([name, children]) => ({ name, children }));
}

test("treemap density follows stock count rather than index names", () => {
  assert.deepEqual(getTreemapDensity(100), { pad: 2, headerHeight: 20 });
  assert.deepEqual(getTreemapDensity(120), { pad: 2, headerHeight: 20 });
  assert.deepEqual(getTreemapDensity(121), { pad: 1.5, headerHeight: 16 });
  assert.deepEqual(getTreemapDensity(250), { pad: 1.5, headerHeight: 16 });
  assert.deepEqual(getTreemapDensity(275), { pad: 1.5, headerHeight: 16 });
  assert.deepEqual(getTreemapDensity(276), { pad: 1, headerHeight: 14 });
  assert.deepEqual(getTreemapDensity(350), { pad: 1, headerHeight: 14 });
});

for (const index of ["FTSE 100", "FTSE 250", "FTSE 350"]) {
  test(`${index} sectors cover the canvas and every security receives a tile`, () => {
    const stocks = stocksFor(index);
    const width = 1440;
    const height = 900;
    const output = [];
    layoutTree(
      sectorTree(stocks),
      { x: 0, y: 0, w: width, h: height },
      0,
      getTreemapDensity(stocks.length),
      output,
    );

    const groups = output.filter((item) => item.type === "group" && item.depth === 0);
    const leaves = output.filter((item) => item.type === "leaf");
    const expectedSectorCount = new Set(stocks.map((stock) => stock.sector)).size;
    const canvasArea = width * height;
    const coveredArea = groups.reduce((sum, group) => sum + group.rect.w * group.rect.h, 0);
    const totalCap = stocks.reduce((sum, stock) => sum + capsBySymbol.get(stock.symbol), 0);
    const sectorCaps = new Map();
    for (const stock of stocks) {
      sectorCaps.set(
        stock.sector,
        (sectorCaps.get(stock.sector) ?? 0) + capsBySymbol.get(stock.symbol),
      );
    }

    assert.equal(groups.length, expectedSectorCount);
    assert.ok(
      Math.abs(coveredArea - canvasArea) <= canvasArea * 1e-9,
      `${index} leaves unexplained top-level canvas area`,
    );
    assert.equal(leaves.length, stocks.length, `${index} dropped positive-market-cap securities`);

    for (const group of groups) {
      const expectedArea = (sectorCaps.get(group.name) / totalCap) * canvasArea;
      const actualArea = group.rect.w * group.rect.h;
      assert.ok(
        Math.abs(actualArea - expectedArea) <= canvasArea * 1e-9,
        `${index} changed market-cap weighting for ${group.name}`,
      );
    }

    let currentSector = null;
    const areaPerCapBySector = new Map();
    for (const item of output) {
      if (item.type === "group" && item.depth === 0) {
        currentSector = item.name;
      } else if (item.type === "leaf") {
        const areaPerCap = (item.rect.w * item.rect.h) / capsBySymbol.get(item.node.symbol);
        const baseline = areaPerCapBySector.get(currentSector);
        if (baseline === undefined) {
          areaPerCapBySector.set(currentSector, areaPerCap);
        } else {
          assert.ok(
            Math.abs(areaPerCap - baseline) <= Math.max(1, baseline) * 1e-9,
            `${index} changed within-sector weighting for ${item.node.symbol}`,
          );
        }
      }
    }

    for (const leaf of leaves) {
      assert.ok(Number.isFinite(leaf.rect.x) && Number.isFinite(leaf.rect.y));
      assert.ok(Number.isFinite(leaf.rect.w) && leaf.rect.w > 0, `${leaf.node.symbol} has invalid width`);
      assert.ok(Number.isFinite(leaf.rect.h) && leaf.rect.h > 0, `${leaf.node.symbol} has invalid height`);
      assert.ok(leaf.rect.x >= 0 && leaf.rect.y >= 0, `${leaf.node.symbol} starts outside the canvas`);
      assert.ok(leaf.rect.x + leaf.rect.w <= width + 1e-7, `${leaf.node.symbol} exceeds canvas width`);
      assert.ok(leaf.rect.y + leaf.rect.h <= height + 1e-7, `${leaf.node.symbol} exceeds canvas height`);
    }
  });
}

test("tile labels degrade from ticker and return to ticker-only to colour-only", () => {
  assert.equal(getTileLabelMode({ x: 0, y: 0, w: 90, h: 48 }, "AZN"), "full");
  assert.equal(getTileLabelMode({ x: 0, y: 0, w: 42, h: 18 }, "AZN"), "ticker");
  assert.equal(getTileLabelMode({ x: 0, y: 0, w: 12, h: 8 }, "AZN"), "none");
});

test("sector headers shrink and then disappear as sector rectangles get smaller", () => {
  const tree = [{ name: "Technology", children: [{ symbol: "SGE", value: 1, change: 0 }] }];
  const layout = (height) => {
    const output = [];
    layoutTree(tree, { x: 0, y: 0, w: 100, h: height }, 0, { pad: 1, headerHeight: 14 }, output);
    return output.find((item) => item.type === "group").headerHeight;
  };

  assert.equal(layout(60), 14);
  assert.equal(layout(32), 10);
  assert.equal(layout(20), 0);
});
