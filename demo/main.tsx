import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import UkMarketHeatmap from "./UkMarketHeatmap";
import "./styles.css";

const el = document.getElementById("root");
if (!el) throw new Error("missing #root");

createRoot(el).render(
  <StrictMode>
    <UkMarketHeatmap />
  </StrictMode>,
);
