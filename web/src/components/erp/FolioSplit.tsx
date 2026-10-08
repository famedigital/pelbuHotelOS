"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Children, useEffect, useState, type ReactNode } from "react";

/**
 * Folio body: charges on the left, actions on the right.
 * Children order is actions, then activity — matching the mobile stack.
 */
export function FolioSplit({ children }: { children: ReactNode }) {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const [actions, activity] = Children.toArray(children);

  if (!wide) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {actions}
        {activity}
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="min-h-0 items-start"
      id="folio-split"
    >
      <ResizablePanel
        id="folio-activity"
        defaultSize="68%"
        minSize="46%"
        className="min-w-0"
        style={{ overflow: "visible" }}
      >
        {activity}
      </ResizablePanel>
      <ResizableHandle withHandle className="mx-1 bg-transparent" />
      <ResizablePanel
        id="folio-actions"
        defaultSize="32%"
        minSize="24%"
        maxSize="42%"
        className="min-w-0"
        style={{ overflow: "visible" }}
      >
        {actions}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
