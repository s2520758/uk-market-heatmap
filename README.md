# UK Market Heatmap

A Finviz-style UK equity heatmap built from the existing
[`marketcalls/openalgo-heatmap`](https://github.com/marketcalls/openalgo-heatmap)
React/TypeScript treemap architecture.

The reusable SVG renderer and framework-free squarified layout engine remain in
`src/`. The demo now contains a complete 100-security FTSE 100 snapshot and a
complete, non-overlapping 250-security FTSE 250 snapshot. Their union is the
350-security FTSE 350 view. Companies are grouped into the 11 FTSE Russell
Industry Classification Benchmark (ICB) industries.

## Features

- FTSE 100, FTSE 250 and combined FTSE 350 filters
- Tile area driven by market capitalisation
- Red/green diverging colour driven by 1D, 1W, 1M or YTD return
- Hover details and click-to-pin details
- Scroll zoom, drag pan and double-click reset
- Explicitly labelled static mock data
- Provider contract that can be implemented by a live market-data adapter

The constituent, price and market-cap snapshots are dated 13 August 2026.
Market caps are stored as GBP billions and prices as GBX. The bundled 1D, 1W,
1M and YTD returns are deterministic mock values, so the application retains a
single `DEMO DATA` banner and must not be interpreted as a live market feed.

## Architecture

| File | Responsibility |
| --- | --- |
| `src/core.ts` | Framework-free squarified treemap and diverging colour scale |
| `src/MarketHeatmap.tsx` | Generic React SVG heatmap component |
| `demo/UkMarketHeatmap.tsx` | UK controls, zoom/pan, hover and pinned detail UI |
| `demo/data/types.ts` | Stable constituent, quote and merged market-data contracts |
| `demo/data/marketDataProvider.ts` | Adapter that joins reference data to a quote provider and filters the index |
| `demo/data/heatmapData.ts` | Converts provider DTOs into the generic tree and quote map |
| `demo/data/ftse-constituents.json` | Canonical FTSE 100/250 constituent reference snapshot |
| `demo/data/mock-quotes.json` | Static price/market-cap snapshot plus mock period returns |
| `tests/ftse-data.test.cjs` | Schema, coverage, membership and classification validation |

`MarketHeatmap` receives only a sector tree and a symbol-to-return quote map.
`MarketDataProvider` merges a `ConstituentRepository` with a `QuoteProvider` and
returns one canonical `UkStock[]`. The heatmap, hover card, sector panel, index
filters and period controls all consume that merged array. A delayed or live API
only needs a new quote provider; no treemap component changes are required.

Each merged company record contains `symbol`, `companyName`, `sector`,
`indexMembership`, `marketCap`, `price`, `change1d`, `change1w`, `change1m`
and `changeYtd`. Components do not define or generate company-level values.

Sector assignments follow the
[FTSE Russell Industry Classification Benchmark](https://www.lseg.com/en/ftse-russell/industry-classification-benchmark-icb)
industry level and its published
[structure and definitions](https://www.lseg.com/content/dam/ftse-russell/en_us/documents/other/icb-structure-and-definitions.xlsx).
The constituent lists are cross-checked against the London Stock Exchange
[FTSE 100](https://www.londonstockexchange.com/indices/ftse-100/constituents/table)
and
[FTSE 250](https://www.londonstockexchange.com/indices/ftse-250/constituents/table)
tables. The static price and full-market-cap snapshot is sourced from the
[FTSE All-Share ranking dated 13 August 2026](https://www.stockchallenge.co.uk/ftse.php);
its published caveat about shares-in-issue changes applies.

Technology is not padded for visual balance. It contains the constituents
classified in current ICB Technology groups, including Software and Computer
Services, Consumer Digital Services and Technology Hardware and Equipment.

## Run locally

```bash
npm install
npm run demo
```

Open `http://localhost:5173`.

## Validate

```bash
npm test
npm run typecheck
npm run build
npm run build:demo
```

Run the complete validation sequence with:

```bash
npm run check
```

## Use the reusable component

```tsx
import MarketHeatmap from "openalgo-heatmap";

const data = [
  {
    name: "Health Care",
    children: [
      { symbol: "AZN", value: 190, change: 1.2 },
      { symbol: "GSK", value: 75, change: -0.4 },
    ],
  },
];

export function Example() {
  return <MarketHeatmap data={data} width={1200} height={700} />;
}
```

## Data semantics

- `value`: positive numeric size driver, expressed as GBP billions in the demo
- `change`: percentage return used by the colour scale
- `quotes`: optional symbol-to-change overrides for cheap period or realtime
  updates without recomputing the layout

## Attribution and licence

Based on `marketcalls/openalgo-heatmap`, licensed under the MIT License. See
`LICENSE`.
