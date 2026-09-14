"use client";

import * as React from "react";
import type { DeskRole } from "@/lib/desk-auth";
import {
  canUseBackOfficeWorkspace,
  canUseFrontDeskWorkspace,
  DESK_WORKSPACE_COOKIE,
  DESK_WORKSPACE_COOKIE_MAX_AGE,
  DESK_WORKSPACE_STORAGE_KEY,
  defaultWorkspaceForRole,
  isDeskWorkspace,
  type DeskWorkspace,
} from "@/lib/erp/desk-workspace";

type DeskWorkspaceContextValue = {
  workspace: DeskWorkspace;
  setWorkspace: (next: DeskWorkspace) => void;
  showToggle: boolean;
  canFrontDesk: boolean;
  canBackOffice: boolean;
  allowedModuleKeys?: readonly string[];
};

const DeskWorkspaceContext =
  React.createContext<DeskWorkspaceContextValue | null>(null);

function readStoredWorkspace(): DeskWorkspace | null {
  if (typeof window === "undefined") return null;
  try {
    const fromLs = window.localStorage.getItem(DESK_WORKSPACE_STORAGE_KEY);
    if (isDeskWorkspace(fromLs)) return fromLs;
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${DESK_WORKSPACE_COOKIE}=([^;]*)`),
  );
  const raw = match?.[1] ? decodeURIComponent(match[1]) : null;
  return isDeskWorkspace(raw) ? raw : null;
}

function persistWorkspace(next: DeskWorkspace) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DESK_WORKSPACE_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  document.cookie = `${DESK_WORKSPACE_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${DESK_WORKSPACE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function DeskWorkspaceProvider({
  deskRole,
  allowedModuleKeys,
  children,
}: {
  deskRole?: DeskRole | null;
  allowedModuleKeys?: readonly string[];
  children: React.ReactNode;
}) {
  const canFrontDesk = canUseFrontDeskWorkspace(allowedModuleKeys);
  const canBackOffice = canUseBackOfficeWorkspace(allowedModuleKeys);
  const roleDefault = defaultWorkspaceForRole(deskRole);

  const [workspace, setWorkspaceState] = React.useState<DeskWorkspace>(() => {
    if (!canFrontDesk && canBackOffice) return "back_office";
    if (!canBackOffice && canFrontDesk) return "front_desk";
    return roleDefault;
  });
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const stored = readStoredWorkspace();
    let next = stored ?? roleDefault;
    if (next === "front_desk" && !canFrontDesk && canBackOffice) {
      next = "back_office";
    } else if (next === "back_office" && !canBackOffice && canFrontDesk) {
      next = "front_desk";
    }
    setWorkspaceState(next);
    persistWorkspace(next);
    setHydrated(true);
  }, [roleDefault, canFrontDesk, canBackOffice]);

  const setWorkspace = React.useCallback(
    (next: DeskWorkspace) => {
      if (next === "front_desk" && !canFrontDesk) return;
      if (next === "back_office" && !canBackOffice) return;
      setWorkspaceState(next);
      persistWorkspace(next);
    },
    [canFrontDesk, canBackOffice],
  );

  const showToggle = canFrontDesk && canBackOffice;

  const value = React.useMemo(
    () => ({
      workspace: hydrated ? workspace : roleDefault,
      setWorkspace,
      showToggle,
      canFrontDesk,
      canBackOffice,
      allowedModuleKeys,
    }),
    [
      hydrated,
      workspace,
      roleDefault,
      setWorkspace,
      showToggle,
      canFrontDesk,
      canBackOffice,
      allowedModuleKeys,
    ],
  );

  return (
    <DeskWorkspaceContext.Provider value={value}>
      {children}
    </DeskWorkspaceContext.Provider>
  );
}

export function useDeskWorkspace(): DeskWorkspaceContextValue {
  const ctx = React.useContext(DeskWorkspaceContext);
  if (!ctx) {
    return {
      workspace: "front_desk",
      setWorkspace: () => {},
      showToggle: false,
      canFrontDesk: true,
      canBackOffice: true,
      allowedModuleKeys: undefined,
    };
  }
  return ctx;
}
