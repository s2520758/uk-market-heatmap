import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev harness only. The published package is built with tsup (see tsup.config.ts);
// this config just serves demo/ so you can view the component with demo data.
export default defineConfig({
  root: "demo",
  plugins: [react()],
  server: { port: 5173 },
});
