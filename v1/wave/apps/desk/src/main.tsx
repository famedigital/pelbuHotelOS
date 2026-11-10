import { Component, type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "@hotel-os/ui/styles.css";
import "./desk.css";

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <pre
          style={{
            color: "#f87171",
            padding: 24,
            whiteSpace: "pre-wrap",
            background: "#111827",
            minHeight: "100vh",
            margin: 0,
          }}
        >
          {this.state.error.stack || this.state.error.message}
        </pre>
      );
    }
    return this.props.children;
  }
}

const el = document.getElementById("root");
if (!el) {
  throw new Error("Hotel OS desk: #root missing");
}

createRoot(el).render(
  <StrictMode>
    <RootErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </RootErrorBoundary>
  </StrictMode>,
);
