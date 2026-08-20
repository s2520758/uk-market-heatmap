const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadPanelPosition() {
  const filename = path.join(__dirname, "..", "demo", "panelPosition.ts");
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

const { placeFloatingPanel } = loadPanelPosition();
const viewport = { width: 1200, height: 800 };
const panel = { width: 340, height: 250 };

test("panel prefers the right side near the left edge", () => {
  const placement = placeFloatingPanel(
    { left: 10, right: 60, top: 100, bottom: 150 },
    viewport,
    panel,
  );

  assert.deepEqual(placement, { left: 72, top: 100, side: "right" });
});

test("panel moves to the left side near the right edge", () => {
  const placement = placeFloatingPanel(
    { left: 1100, right: 1160, top: 100, bottom: 150 },
    viewport,
    panel,
  );

  assert.deepEqual(placement, { left: 748, top: 100, side: "left" });
});

test("panel shifts upward near the bottom edge", () => {
  const placement = placeFloatingPanel(
    { left: 100, right: 150, top: 760, bottom: 795 },
    viewport,
    panel,
  );

  assert.deepEqual(placement, { left: 162, top: 538, side: "right" });
});

test("panel remains inside a viewport narrower than its preferred width", () => {
  const placement = placeFloatingPanel(
    { left: 130, right: 170, top: 10, bottom: 40 },
    { width: 300, height: 500 },
    { width: 340, height: 250 },
  );

  assert.deepEqual(placement, { left: 12, top: 12, side: "overlap" });
});

test("detail panel is portalled and has explicit responsive width constraints", () => {
  const component = fs.readFileSync(
    path.join(__dirname, "..", "demo", "UkMarketHeatmap.tsx"),
    "utf8",
  );
  const styles = fs.readFileSync(path.join(__dirname, "..", "demo", "styles.css"), "utf8");

  assert.match(component, /createPortal\(/);
  assert.match(component, /placeFloatingPanel\(/);
  assert.match(styles, /position:\s*fixed/);
  assert.match(styles, /min-width:\s*min\(280px, calc\(100vw - 24px\)\)/);
  assert.match(styles, /width:\s*min\(340px, calc\(100vw - 24px\)\)/);
  assert.match(styles, /grid-template-columns:\s*minmax\(64px, auto\)/);
});
