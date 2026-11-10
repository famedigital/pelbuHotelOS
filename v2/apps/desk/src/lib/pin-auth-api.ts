import { API_BASE } from "./api";
import { activeBearer, readHotelToken } from "./auth-session";

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
      return { ok: false, error: String(data.error ?? data.message ?? "Sign-in failed") };
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
      return { ok: false, error: String(data.error ?? data.message ?? "Sign-in failed") };
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
    return { ok: false, error: err instanceof Error ? err.message : "Sign-in failed" };
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

export async function fetchAuthStaff(
  propertySlug: string,
  signal?: AbortSignal,
): Promise<{ property: AuthProperty; staff: AuthStaff[] }> {
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
    throw new Error(data.error || "Could not load staff");
  }
  return { property: data.property, staff: data.staff ?? [] };
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

export async function verifyStaffPin(input: {
  propertySlug: string;
  staffId: string;
  pin: string;
  confirmPin?: string;
}): Promise<PinAuthResult> {
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
}
