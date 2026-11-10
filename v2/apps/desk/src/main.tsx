import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GlassShell } from "@hos-v2/ui";
import { App } from "./shell/App";
import { DeskQueryProvider } from "./lib/query";
import "./styles/global.css";
import "./styles/deep.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <DeskQueryProvider>
        <GlassShell className="h-full">
          <App />
        </GlassShell>
      </DeskQueryProvider>
    </BrowserRouter>
  </StrictMode>,
);
