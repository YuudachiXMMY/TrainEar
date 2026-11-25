import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./legacy-compat.css";

const rootEl = document.getElementById("app");
if (!rootEl) throw new Error("#app root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
