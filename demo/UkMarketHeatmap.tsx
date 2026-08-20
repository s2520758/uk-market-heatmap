import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import MarketHeatmap from "../src/MarketHeatmap";
import {
  aggregateTinyLeaves,
  changeColor,
  getTreemapDensity,
  type HeatmapLeaf,
} from "../src/core";
import { buildQuoteMap, buildSectorTree, changeForPeriod } from "./data/heatmapData";
import { marketDataProvider } from "./data/marketDataProvider";
import {
  buildCatalystMarkers,
  compactCatalysts,
  filterCatalysts,
  formatCatalystTime,
  groupCatalystsBySymbol,
} from "./news/catalystLogic";
import { demoNewsProvider } from "./news/newsProvider";
import {
  CATALYST_FILTERS,
  RECENCY_WINDOWS,
  type CatalystFeed,
  type CatalystFilter,
  type NewsProvider,
  type RecencyWindow,
} from "./news/types";
import { placeFloatingPanel, type FloatingRect } from "./panelPosition";
import {
  INDEX_FILTERS,
  PERIODS,
  type IndexFilter,
  type MarketDataProvider,
  type MarketUniverse,
  type PerformancePeriod,
  type UkStock,
} from "./data/types";

const Heat = memo(MarketHeatmap);
const BACKGROUND = "#080b0f";
const CAP_BY_PERIOD: Record<PerformancePeriod, number> = {
  "1D": 3,
  "1W": 6,
  "1M": 12,
  YTD: 25,
};

const formatPercent = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const formatPrice = (valueGbx: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(
    valueGbx / 100,
  );
const formatMarketCap = (value: number) =>
  value >= 10 ? `£${value.toFixed(0)}bn` : `£${value.toFixed(1)}bn`;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

interface UkMarketHeatmapProps {
  provider?: MarketDataProvider;
  newsProvider?: NewsProvider;
}

export default function UkMarketHeatmap({
  provider = marketDataProvider,
  newsProvider = demoNewsProvider,
}: UkMarketHeatmapProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const view = useRef({ scale: 1, tx: 0, ty: 0 });
  const drag = useRef<null | { x: number; y: number; tx: number; ty: number }>(null);
  const didDrag = useRef(false);
  const pointer = useRef({ x: 24, y: 24 });
  const hoverAnchor = useRef<FloatingRect | null>(null);
  const pinnedOnly = useRef(false);

  const [indexFilter, setIndexFilter] = useState<IndexFilter>("FTSE 350");
  const [period, setPeriod] = useState<PerformancePeriod>("1D");
  const [universe, setUniverse] = useState<MarketUniverse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [catalystFeed, setCatalystFeed] = useState<CatalystFeed | null>(null);
  const [catalystError, setCatalystError] = useState<string | null>(null);
  const [catalystFilter, setCatalystFilter] = useState<CatalystFilter>("All");
  const [recencyWindow, setRecencyWindow] = useState<RecencyWindow>("72H");
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  pinnedOnly.current = Boolean(pinned && !hovered);

  const dimsRef = useRef(dims);
  dimsRef.current = dims;

  useEffect(() => {
    let active = true;
    setLoadError(null);
    provider
      .loadUniverse(indexFilter)
      .then((nextUniverse) => {
        if (!active) return;
        setUniverse(nextUniverse);
        setHovered(null);
        setPinned(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load market data");
      });
    return () => {
      active = false;
    };
  }, [indexFilter, provider]);

  useEffect(() => {
    if (!universe) return;
    let active = true;
    setCatalystError(null);
    const maximumWindowStart = new Date(0).toISOString();
    newsProvider
      .getRecentCatalysts(
        universe.stocks.map((stock) => stock.symbol),
        maximumWindowStart,
      )
      .then((feed) => {
        if (active) setCatalystFeed(feed);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCatalystFeed(null);
        setCatalystError(error instanceof Error ? error.message : "Unable to load catalysts");
      });
    return () => {
      active = false;
    };
  }, [newsProvider, universe]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const measure = () => setDims({ w: element.clientWidth, h: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const applyTransform = useCallback(() => {
    const layer = zoomRef.current;
    if (!layer) return;
    const { w, h } = dimsRef.current;
    const { scale, tx, ty } = view.current;
    layer.style.width = `${w * scale}px`;
    layer.style.height = `${h * scale}px`;
    layer.style.transform = `translate(${tx}px, ${ty}px)`;
  }, []);

  const clampPan = useCallback(() => {
    const { w, h } = dimsRef.current;
    const current = view.current;
    if (current.scale <= 1) {
      current.scale = 1;
      current.tx = 0;
      current.ty = 0;
      return;
    }
    current.tx = clamp(current.tx, w * (1 - current.scale), 0);
    current.ty = clamp(current.ty, h * (1 - current.scale), 0);
  }, []);

  const positionCard = useCallback(() => {
    const card = cardRef.current;
    if (!card || pinnedOnly.current) return;

    const anchor = hoverAnchor.current ?? {
      left: pointer.current.x,
      right: pointer.current.x,
      top: pointer.current.y,
      bottom: pointer.current.y,
    };
    const placement = placeFloatingPanel(
      anchor,
      { width: window.innerWidth, height: window.innerHeight },
      {
        width: card.offsetWidth || Math.min(340, Math.max(0, window.innerWidth - 24)),
        height: card.offsetHeight || 210,
      },
    );
    card.style.left = `${placement.left}px`;
    card.style.top = `${placement.top}px`;
    card.dataset.side = placement.side;
  }, []);

  const resetView = useCallback(() => {
    view.current = { scale: 1, tx: 0, ty: 0 };
    applyTransform();
  }, [applyTransform]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      const current = view.current;
      const worldX = (cursorX - current.tx) / current.scale;
      const worldY = (cursorY - current.ty) / current.scale;
      current.scale = clamp(current.scale * Math.exp(-event.deltaY * 0.0015), 1, 14);
      current.tx = cursorX - worldX * current.scale;
      current.ty = cursorY - worldY * current.scale;
      clampPan();
      applyTransform();
      positionCard();
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [applyTransform, clampPan, positionCard]);

  useEffect(() => {
    window.addEventListener("resize", positionCard);
    return () => window.removeEventListener("resize", positionCard);
  }, [positionCard]);

  useEffect(() => {
    applyTransform();
  }, [applyTransform, dims]);

  const endDrag = useCallback(() => {
    if (!drag.current) return;
    drag.current = null;
    setIsDragging(false);
    if (zoomRef.current) zoomRef.current.style.willChange = "auto";
    window.setTimeout(() => {
      didDrag.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    window.addEventListener("mouseup", endDrag);
    return () => window.removeEventListener("mouseup", endDrag);
  }, [endDrag]);

  const onMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!viewportRef.current) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    if (drag.current) {
      const deltaX = event.clientX - drag.current.x;
      const deltaY = event.clientY - drag.current.y;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
        didDrag.current = true;
        setIsDragging(true);
      }
      if (didDrag.current) {
        view.current.tx = drag.current.tx + deltaX;
        view.current.ty = drag.current.ty + deltaY;
        clampPan();
        applyTransform();
      }
    } else {
      positionCard();
    }
  };

  const onMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      tx: view.current.tx,
      ty: view.current.ty,
    };
    if (zoomRef.current) zoomRef.current.style.willChange = "transform";
  };

  const stocksBySymbol = useMemo(
    () => new Map((universe?.stocks ?? []).map((stock) => [stock.symbol, stock])),
    [universe],
  );
  const knownStockSymbols = useMemo(
    () => new Set((universe?.stocks ?? []).map((stock) => stock.symbol)),
    [universe],
  );
  const filteredCatalysts = useMemo(
    () =>
      catalystFeed
        ? filterCatalysts(catalystFeed.catalysts, {
            asOf: catalystFeed.asOf,
            window: recencyWindow,
            category: catalystFilter,
          })
        : [],
    [catalystFeed, catalystFilter, recencyWindow],
  );
  const catalystsBySymbol = useMemo(
    () => groupCatalystsBySymbol(filteredCatalysts, knownStockSymbols),
    [filteredCatalysts, knownStockSymbols],
  );
  const catalystMarkers = useMemo(
    () => buildCatalystMarkers(filteredCatalysts, knownStockSymbols),
    [filteredCatalysts, knownStockSymbols],
  );
  const density = useMemo(
    () => getTreemapDensity(universe?.stocks.length ?? 0),
    [universe?.stocks.length],
  );
  const aggregation = useMemo(
    () =>
      aggregateTinyLeaves(
        (universe?.stocks ?? []).map((stock) => ({
          symbol: stock.symbol,
          group: stock.sector,
          value: stock.marketCap,
          change: changeForPeriod(stock, period),
          data: stock,
        })),
        { x: 0, y: 0, w: dims.w, h: dims.h },
        density,
      ),
    [density, dims.h, dims.w, period, universe],
  );
  const tree = aggregation.data;
  const quotes = useMemo(() => buildQuoteMap(universe?.stocks ?? [], period), [period, universe]);
  const cap = CAP_BY_PERIOD[period];
  const activeSymbol = hovered ?? pinned;
  const visibleSymbols = useMemo(
    () => new Set(aggregation.visible.map((entry) => entry.symbol)),
    [aggregation.visible],
  );
  const activeOther = activeSymbol
    ? aggregation.aggregatesBySymbol.get(activeSymbol) ?? null
    : null;
  const activeStock =
    activeSymbol && visibleSymbols.has(activeSymbol)
      ? stocksBySymbol.get(activeSymbol) ?? null
      : null;
  const activeCatalysts = useMemo(
    () => compactCatalysts(activeStock ? catalystsBySymbol.get(activeStock.symbol) ?? [] : []),
    [activeStock, catalystsBySymbol],
  );
  const activeSector = activeOther?.group ?? activeStock?.sector ?? null;
  const sectorPeers = activeStock
    ? (universe?.stocks ?? [])
        .filter((stock) => stock.sector === activeStock.sector)
        .sort((a, b) => b.marketCap - a.marketCap)
    : [];
  const sectorTree = activeStock
    ? buildSectorTree(sectorPeers).flatMap((group) => ("children" in group ? group.children : []))
    : [];

  const onLeafHover = useCallback(
    (leaf: HeatmapLeaf | null, anchorRect?: DOMRect) => {
      if (didDrag.current) return;
      if (!leaf) {
        hoverAnchor.current = null;
        setHovered(null);
        return;
      }
      const aggregate = aggregation.aggregatesBySymbol.get(leaf.symbol);
      if (aggregate) {
        hoverAnchor.current = anchorRect ?? null;
        setHovered(aggregate.symbol);
        requestAnimationFrame(positionCard);
        return;
      }
      const stock = stocksBySymbol.get(leaf.symbol);
      if (!stock) return;
      hoverAnchor.current = anchorRect ?? null;
      setHovered(stock.symbol);
      requestAnimationFrame(positionCard);
    },
    [aggregation.aggregatesBySymbol, positionCard, stocksBySymbol],
  );

  const onLeafClick = useCallback(
    (leaf: HeatmapLeaf) => {
      if (didDrag.current) return;
      const isAggregate = aggregation.aggregatesBySymbol.has(leaf.symbol);
      const isVisibleStock = visibleSymbols.has(leaf.symbol) && stocksBySymbol.has(leaf.symbol);
      if (isAggregate || isVisibleStock) {
        setPinned((current) => (current === leaf.symbol ? null : leaf.symbol));
      }
    },
    [aggregation.aggregatesBySymbol, stocksBySymbol, visibleSymbols],
  );

  const legend = [-cap, -cap / 2, 0, cap / 2, cap]
    .map((value) => changeColor(value, cap))
    .join(", ");
  const activeReturn = activeOther?.change ?? (activeStock ? changeForPeriod(activeStock, period) : 0);
  const activeMarketCap = activeOther?.value ?? activeStock?.marketCap ?? 0;
  const hasActiveTile = Boolean(activeOther || activeStock);

  useEffect(() => {
    if (!activeSymbol) return;
    const frame = requestAnimationFrame(positionCard);
    return () => cancelAnimationFrame(frame);
  }, [activeCatalysts.length, activeSymbol, positionCard]);

  return (
    <main className="app-shell">
      <header className="toolbar">
        <div className="brand-block">
          <div className="brand-row">
            <strong>UK MARKET MAP</strong>
            {universe?.isMock && <span className="mock-badge">DEMO DATA</span>}
          </div>
          <span className="market-meta" data-testid="loaded-constituent-count">
            {universe ? `${universe.stocks.length} constituents · LSE` : "Loading universe…"}
          </span>
        </div>

        <div className="control-group" aria-label="Index filter">
          {INDEX_FILTERS.map((index) => (
            <button
              className={index === indexFilter ? "control-button active" : "control-button"}
              key={index}
              onClick={() => setIndexFilter(index)}
            >
              {index}
            </button>
          ))}
        </div>

        <div className="control-group period-controls" aria-label="Performance period">
          {PERIODS.map((item) => (
            <button
              className={item === period ? "control-button active" : "control-button"}
              key={item}
              onClick={() => setPeriod(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="legend-wrap" aria-label={`Colour scale minus ${cap} to plus ${cap} percent`}>
          <span>−{cap}%</span>
          <div className="legend" style={{ background: `linear-gradient(to right, ${legend})` }} />
          <span>+{cap}%</span>
        </div>

        <button className="reset-button" onClick={resetView}>Reset view</button>
      </header>

      <div className="data-notice">
        <span className="notice-dot" />
        {universe?.asOfLabel ?? "Loading market fixture"} · Tile area = market cap · Colour = {period} return
      </div>

      <div className="catalyst-controls">
        <div className="catalyst-control-label">
          <span>Catalysts</span>
          {catalystFeed?.isDemo && <span className="demo-catalyst-badge">DEMO CATALYSTS</span>}
        </div>
        <div className="control-group catalyst-filter-group" aria-label="Catalyst category filter">
          {CATALYST_FILTERS.map((filter) => (
            <button
              className={filter === catalystFilter ? "control-button active" : "control-button"}
              key={filter}
              onClick={() => setCatalystFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="control-group catalyst-window-group" aria-label="Catalyst recency window">
          {RECENCY_WINDOWS.map((window) => (
            <button
              className={window === recencyWindow ? "control-button active" : "control-button"}
              key={window}
              onClick={() => setRecencyWindow(window)}
            >
              {window}
            </button>
          ))}
        </div>
        <span className="catalyst-status">
          {catalystError
            ? "Catalyst feed unavailable"
            : `${catalystFeed?.sourceLabel ?? "Loading catalyst feed"} · ${filteredCatalysts.length} events · ${Object.keys(catalystMarkers).length} marked stocks`}
        </span>
      </div>

      <section
        ref={viewportRef}
        className={isDragging ? "viewport dragging" : "viewport"}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseLeave={() => {
          hoverAnchor.current = null;
          setHovered(null);
          endDrag();
        }}
        onDoubleClick={resetView}
      >
        <div ref={zoomRef} className="zoom-layer" style={{ width: dims.w, height: dims.h }}>
          {dims.w > 0 && universe && (
            <Heat
              data={tree}
              quotes={quotes}
              catalystMarkers={catalystMarkers}
              width={dims.w}
              height={dims.h}
              cap={cap}
              pad={density.pad}
              headerHeight={density.headerHeight}
              background={BACKGROUND}
              showLegend={false}
              showTooltip={false}
              onHover={onLeafHover}
              onLeafClick={onLeafClick}
              highlightGroup={activeSector}
              highlightColor="rgba(205, 216, 226, 0.55)"
              highlightStrokeWidth={1}
              highlightHeaderFill="#141a20"
            />
          )}
        </div>

        {loadError && <div className="status-panel error">{loadError}</div>}
        {!loadError && !universe && <div className="status-panel">Loading UK market fixture…</div>}

        {hasActiveTile &&
          !isDragging &&
          typeof document !== "undefined" &&
          createPortal(
            <aside
              ref={cardRef}
              className={pinned && !hovered ? "stock-card pinned" : "stock-card"}
              onMouseDown={(event) => event.stopPropagation()}
            >
            <div className="card-kicker">
              <span>{activeSector}</span>
              <span>{activeOther ? indexFilter : activeStock?.indexMembership}</span>
            </div>
            <div className="card-title-row">
              <div>
                <strong>{activeOther ? "OTHER" : activeStock?.symbol}</strong>
                <div className="company-name">
                  {activeOther
                    ? `${activeOther.members.length} aggregated ${activeOther.members.length === 1 ? "stock" : "stocks"}`
                    : activeStock?.companyName}
                </div>
              </div>
              <span className="change" style={{ color: changeColor(activeReturn, cap) }}>
                {formatPercent(activeReturn)}
              </span>
            </div>
            <dl className="metrics">
              {activeOther ? (
                <div><dt>Companies</dt><dd>{activeOther.members.length}</dd></div>
              ) : (
                <div><dt data-testid="price-label">Price</dt><dd>{formatPrice(activeStock?.price ?? 0)}</dd></div>
              )}
              <div><dt>Market cap</dt><dd>{formatMarketCap(activeMarketCap)}</dd></div>
              <div><dt>Period</dt><dd>{period}</dd></div>
            </dl>
            {activeOther ? (
              <div className="other-members">
                <div className="other-members-title">Aggregated securities</div>
                {activeOther.members.map((member) => (
                  <div className="other-member" key={member.symbol}>
                    <span className="other-symbol">{member.symbol}</span>
                    <span className="other-name" title={member.data.companyName}>
                      {member.data.companyName}
                    </span>
                    <span className="other-cap">{formatMarketCap(member.value)}</span>
                    <span className="other-return" style={{ color: changeColor(member.change, cap) }}>
                      {formatPercent(member.change)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="mini-map">
                  <Heat
                    data={sectorTree}
                    quotes={quotes}
                    width={258}
                    height={76}
                    cap={cap}
                    pad={1}
                    headerHeight={0}
                    background="#111820"
                    showLegend={false}
                    showTooltip={false}
                  />
                </div>
                <div className="peer-list">
                  {sectorPeers.slice(0, 5).map((peer) => (
                    <div className={peer.symbol === activeStock?.symbol ? "peer active" : "peer"} key={peer.symbol}>
                      <span>{peer.symbol}</span>
                      <span>{formatMarketCap(peer.marketCap)}</span>
                      <span style={{ color: changeColor(changeForPeriod(peer, period), cap) }}>
                        {formatPercent(changeForPeriod(peer, period))}
                      </span>
                    </div>
                  ))}
                </div>
                <section className="catalyst-panel" aria-label="Recent company catalysts">
                  <div className="catalyst-panel-heading">
                    <span>Latest catalysts</span>
                    <span>{recencyWindow}</span>
                  </div>
                  {activeCatalysts.length > 0 ? (
                    activeCatalysts.map((catalyst) => (
                      <article className={`catalyst-item ${catalyst.importance}`} key={catalyst.id}>
                        <div className="catalyst-item-meta">
                          <span className="catalyst-category">{catalyst.category}</span>
                          <span>{formatCatalystTime(catalyst.publishedAt, catalystFeed?.asOf ?? catalyst.publishedAt)}</span>
                        </div>
                        <a href={catalyst.sourceUrl} target="_blank" rel="noreferrer">
                          {catalyst.headline}
                        </a>
                        <p>{catalyst.summary}</p>
                        <span className="catalyst-source">{catalyst.sourceName}</span>
                      </article>
                    ))
                  ) : (
                    <div className="no-catalysts">No matching catalysts in this window</div>
                  )}
                </section>
              </>
            )}
            {pinned && !hovered && (
              <button className="close-card" onClick={() => setPinned(null)}>Close pinned card</button>
            )}
            </aside>,
            document.body,
          )}

        <div className="interaction-hint">Scroll to zoom · drag to pan · click a tile to pin</div>
      </section>
    </main>
  );
}
