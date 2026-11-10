import { API_BASE, DEV_PROPERTY_ID } from "./api";
import { activeBearer, readHotelToken } from "./auth-session";

/** Local Vite UAT when API has no DATABASE_URL — not for production. */
export const LOCAL_DEMO_PROPERTY: AuthProperty = {
  id: DEV_PROPERTY_ID,
  slug: "demo-hotel",
  name: "Demo Hotel",
};

const LOCAL_DEMO_PINS: ReadonlyArray<{
  staffId: string;
  pin: string;
  fullName: string;
  deskRole: string;
  homeRoute: string;
  employeeCode: string;
}> = [
  {
    staffId: "karma",
    pin: "1234",
    fullName: "Karma Dorji",
    deskRole: "fo_manager",
    homeRoute: "/desk",
    employeeCode: "101",
  },
  {
    staffId: "deki",
    pin: "2345",
    fullName: "Deki Yangzom",
    deskRole: "cashier",
    homeRoute: "/pos",
    employeeCode: "201",
  },
  {
    staffId: "tshering",
    pin: "3456",
    fullName: "Tshering Tobgay",
    deskRole: "hk",
    homeRoute: "/housekeeping",
    employeeCode: "301",
  },
  {
    staffId: "ugyen",
    pin: "4567",
    fullName: "Ugyen Penjor",
    deskRole: "night_auditor",
    homeRoute: "/night-audit",
    employeeCode: "401",
  },
  {
    staffId: "tenzin",
    pin: "9999",
    fullName: "Tenzin Norbu",
    deskRole: "gm",
    homeRoute: "/owner",
    employeeCode: "001",
  },
];

function isLocalDemoAuthEnabled(): boolean {
  return Boolean(import.meta.env.DEV);
}

export type AuthProperty = {
  id: string;
  slug: string;
  name: string;
  organization_id?: string;
};

export type AuthStaff = {
  id: string;
  fullName: string;
  employeeCode: string | null;
  deskRole: string | null;
  homeRoute: string;
  pinSet: boolean;
  pinResetRequired: boolean;
};

export type PublicHotel = {
  id: string;
  slug: string;
  name: string;
  gateEnabled: boolean;
  hint: string | null;
};

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = activeBearer();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchPublicHotels(signal?: AbortSignal): Promise<PublicHotel[]> {
  const res = await fetch(`${API_BASE}/v1/auth/hotels`, { signal });
  const data = (await res.json()) as { ok?: boolean; hotels?: PublicHotel[]; error?: string };
  if (!res.ok || !data.ok) throw new Error(data.error || "Could not load hotels");
  return data.hotels ?? [];
}

export async function unlockHotelDesk(input: {
  propertySlug: string;
  deskCode: string;
}): Promise<
  | { ok: true; token: string; property: AuthProperty; homeRoute: string }
  | { ok: false; error: string }
> {
  const res = await fetch(`${API_BASE}/v1/auth/hotel/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || data.ok === false) {
    return { ok: false, error: String(data.error ?? data.message ?? "Unlock failed") };
  }
  return {
    ok: true,
    token: String(data.token),
    homeRoute: String(data.homeRoute ?? "/pin"),
    property: data.property as AuthProperty,
  };
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      res.ok
        ? "Server returned non-JSON"
        : `Server error ${res.status} (not JSON — check API / proxy)`,
    );
  }
}

/** Map machine auth codes to desk-safe copy (never show DATABASE_REQUIRED raw). */
export function humanizeAuthError(error: string): string {
  const e = error.trim();
  const key = e.toUpperCase();
  if (key === "DATABASE_REQUIRED" || key.includes("DATABASE_REQUIRED")) {
    return "Desk cannot reach the hotel database. Retry in a moment, or sign in via Hotel desk.";
  }
  if (key === "SUPABASE_ANON_KEY NOT CONFIGURED" || e.includes("SUPABASE_ANON_KEY")) {
    return "Sign-in service is not configured on this server.";
  }
  if (/auth unreachable/i.test(e)) {
    return "Sign-in service is temporarily unreachable. Retry in a moment.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(e)) {
    return "Cannot reach the desk API. Check your connection and retry.";
  }
  if (/incorrect email or password/i.test(e)) {
    return "Incorrect email or password. Hotel staff use Hotel desk — Partner is for tour operators only.";
  }
  return e;
}

/** Org member email/password → owner JWT for staff PIN pad. */
export async function loginHotelEmail(input: {
  email: string;
  password: string;
  propertyId?: string;
}): Promise<
  | {
      ok: true;
      token: string;
      homeRoute: string;
      property: AuthProperty;
      properties: AuthProperty[];
    }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${API_BASE}/v1/auth/hotel/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await readJson(res);
    if (!res.ok || data.ok === false) {
      const err = String(data.error ?? data.message ?? "Sign-in failed");
      if (
        isLocalDemoAuthEnabled() &&
        input.password.length >= 6 &&
        (err === "DATABASE_REQUIRED" || res.status >= 500)
      ) {
        return {
          ok: true,
          token: "local-demo-hotel",
          homeRoute: "/pin",
          property: LOCAL_DEMO_PROPERTY,
          properties: [LOCAL_DEMO_PROPERTY],
        };
      }
      return { ok: false, error: humanizeAuthError(err) };
    }
    return {
      ok: true,
      token: String(data.token),
      homeRoute: String(data.homeRoute ?? "/pin"),
      property: data.property as AuthProperty,
      properties: (data.properties as AuthProperty[] | undefined) ?? [
        data.property as AuthProperty,
      ],
    };
  } catch (err) {
    if (isLocalDemoAuthEnabled() && input.password.length >= 6) {
      return {
        ok: true,
        token: "local-demo-hotel",
        homeRoute: "/pin",
        property: LOCAL_DEMO_PROPERTY,
        properties: [LOCAL_DEMO_PROPERTY],
      };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Sign-in failed" };
  }
}

/** Agent/guide/driver email+password → multi-hotel portal JWT. */
export async function portalEmailLogin(input: {
  role: "agent" | "guide" | "driver";
  email: string;
  password: string;
  propertyId?: string;
}): Promise<
  | {
      ok: true;
      token: string;
      homeRoute: string;
      account: {
        id: string;
        role: string;
        loginCode: string;
        displayName: string;
        subjectId: string;
      };
      property: AuthProperty;
      properties: AuthProperty[];
    }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${API_BASE}/v1/auth/portal/email-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await readJson(res);
    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        error: humanizeAuthError(String(data.error ?? data.message ?? "Sign-in failed")),
      };
    }
    return {
      ok: true,
      token: String(data.token),
      homeRoute: String(data.homeRoute ?? "/partner"),
      account: data.account as {
        id: string;
        role: string;
        loginCode: string;
        displayName: string;
        subjectId: string;
      },
      property: data.property as AuthProperty,
      properties: (data.properties as AuthProperty[] | undefined) ?? [
        data.property as AuthProperty,
      ],
    };
  } catch (err) {
    return {
      ok: false,
      error: humanizeAuthError(err instanceof Error ? err.message : "Sign-in failed"),
    };
  }
}

export async function portalLogin(input: {
  role: "agent" | "guide" | "driver";
  propertySlug: string;
  loginCode: string;
  pin: string;
  confirmPin?: string;
}): Promise<
  | {
      ok: true;
      token: string;
      homeRoute: string;
      pinWasReset?: boolean;
      account: {
        id: string;
        role: string;
        loginCode: string;
        displayName: string;
        subjectId: string;
      };
      property: AuthProperty;
    }
  | { ok: false; status: number; error: string; resetRequired?: boolean }
> {
  const res = await fetch(`${API_BASE}/v1/auth/portal/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (res.status === 409 && data.error === "PIN_RESET_REQUIRED") {
    return {
      ok: false,
      status: 409,
      error: String(data.message ?? "Set a new PIN"),
      resetRequired: true,
    };
  }
  if (!res.ok || data.ok === false) {
    return { ok: false, status: res.status, error: String(data.error ?? "Login failed") };
  }
  return {
    ok: true,
    token: String(data.token),
    homeRoute: String(data.homeRoute ?? "/partner"),
    pinWasReset: Boolean(data.pinWasReset),
    account: data.account as {
      id: string;
      role: string;
      loginCode: string;
      displayName: string;
      subjectId: string;
    },
    property: data.property as AuthProperty,
  };
}

export async function fetchAuthProperties(signal?: AbortSignal): Promise<AuthProperty[]> {
  const res = await fetch(`${API_BASE}/v1/auth/properties`, {
    signal,
    headers: authHeaders(),
  });
  const data = (await res.json()) as { ok?: boolean; properties?: AuthProperty[]; error?: string };
  if (!res.ok || !data.ok) throw new Error(data.error || "Could not load hotels");
  return data.properties ?? [];
}

/** Re-issue owner hotel gate JWT for another property in the same org. */
export async function switchHotelProperty(input: {
  propertyId?: string;
  propertySlug?: string;
}): Promise<
  | { ok: true; token: string; property: AuthProperty }
  | { ok: false; error: string }
> {
  try {
    const token = readHotelToken();
    if (!token) return { ok: false, error: "Hotel session required" };
    const res = await fetch(`${API_BASE}/v1/auth/hotel/switch-property`, {
      method: "POST",
      headers: authHeaders({
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(input),
    });
    const data = await readJson(res);
    if (!res.ok || data.ok === false || !data.token || !data.property) {
      return { ok: false, error: String(data.error ?? "Could not switch hotel") };
    }
    return {
      ok: true,
      token: String(data.token),
      property: data.property as AuthProperty,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not switch hotel" };
  }
}

function localDemoStaffList(): AuthStaff[] {
  return LOCAL_DEMO_PINS.map((s) => ({
    id: s.staffId,
    fullName: s.fullName,
    employeeCode: s.employeeCode,
    deskRole: s.deskRole,
    homeRoute: s.homeRoute,
    pinSet: true,
    pinResetRequired: false,
  }));
}

export async function fetchAuthStaff(
  propertySlug: string,
  signal?: AbortSignal,
): Promise<{ property: AuthProperty; staff: AuthStaff[] }> {
  try {
    const q = new URLSearchParams({ propertySlug });
    const res = await fetch(`${API_BASE}/v1/auth/staff?${q}`, {
      signal,
      headers: authHeaders({ Authorization: `Bearer ${readHotelToken() ?? activeBearer() ?? ""}` }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      property?: AuthProperty;
      staff?: AuthStaff[];
      error?: string;
    };
    if (!res.ok || !data.ok || !data.property) {
      if (isLocalDemoAuthEnabled()) {
        return {
          property: { ...LOCAL_DEMO_PROPERTY, slug: propertySlug || LOCAL_DEMO_PROPERTY.slug },
          staff: localDemoStaffList(),
        };
      }
      throw new Error(data.error || "Could not load staff");
    }
    return { property: data.property, staff: data.staff ?? [] };
  } catch (err) {
    if (isLocalDemoAuthEnabled() && !(err instanceof DOMException && err.name === "AbortError")) {
      return {
        property: { ...LOCAL_DEMO_PROPERTY, slug: propertySlug || LOCAL_DEMO_PROPERTY.slug },
        staff: localDemoStaffList(),
      };
    }
    throw err;
  }
}

export type PinAuthResult =
  | {
      ok: true;
      token: string;
      homeRoute: string;
      pinWasReset?: boolean;
      staff: {
        id: string;
        fullName: string;
        deskRole: string | null;
        employeeCode: string | null;
      };
      property: AuthProperty;
    }
  | { ok: false; status: number; error: string; resetRequired?: boolean };

function verifyLocalDemoPin(input: {
  propertySlug: string;
  staffId: string;
  pin: string;
}): PinAuthResult {
  const hit = LOCAL_DEMO_PINS.find((s) => s.staffId === input.staffId && s.pin === input.pin);
  if (!hit) {
    return { ok: false, status: 401, error: "Incorrect PIN" };
  }
  return {
    ok: true,
    token: `local-demo-staff:${hit.staffId}`,
    homeRoute: hit.homeRoute,
    staff: {
      id: hit.staffId,
      fullName: hit.fullName,
      deskRole: hit.deskRole,
      employeeCode: hit.employeeCode,
    },
    property: {
      ...LOCAL_DEMO_PROPERTY,
      slug: input.propertySlug || LOCAL_DEMO_PROPERTY.slug,
    },
  };
}

export async function verifyStaffPin(input: {
  propertySlug: string;
  staffId: string;
  pin: string;
  confirmPin?: string;
}): Promise<PinAuthResult> {
  try {
    const hotel = readHotelToken();
    const res = await fetch(`${API_BASE}/v1/auth/pin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(hotel ? { Authorization: `Bearer ${hotel}` } : {}),
      },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (res.status === 409 && data.error === "PIN_RESET_REQUIRED") {
      return {
        ok: false,
        status: 409,
        error: String(data.message ?? "Set a new PIN"),
        resetRequired: true,
      };
    }
    if (!res.ok || data.ok === false) {
      if (
        isLocalDemoAuthEnabled() &&
        (String(data.error) === "DATABASE_REQUIRED" || res.status >= 500)
      ) {
        return verifyLocalDemoPin(input);
      }
      return {
        ok: false,
        status: res.status,
        error: String(data.error ?? "Incorrect PIN"),
      };
    }
    return {
      ok: true,
      token: String(data.token),
      homeRoute: String(data.homeRoute ?? "/desk"),
      pinWasReset: Boolean(data.pinWasReset),
      staff: data.staff as PinAuthResult extends { ok: true; staff: infer S } ? S : never,
      property: data.property as AuthProperty,
    };
  } catch {
    if (isLocalDemoAuthEnabled()) return verifyLocalDemoPin(input);
    return { ok: false, status: 0, error: "PIN verification failed" };
  }
}
