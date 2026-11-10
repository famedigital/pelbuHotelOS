import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  erpCredentialsPresent,
  shouldApplyMiddlewareAuthCookies,
} from "./middleware-session-gate";

describe("erpCredentialsPresent", () => {
  it("allows staff Auth cookies in production when DESK_PIN is unset", () => {
    assert.equal(
      erpCredentialsPresent({
        deskPinConfigured: false,
        isProduction: true,
        hasValidDeskPinCookie: false,
        hasSupabaseSessionCookie: true,
      }),
      true,
    );
  });

  it("blocks production ERP when DESK_PIN is unset and there is no session cookie", () => {
    assert.equal(
      erpCredentialsPresent({
        deskPinConfigured: false,
        isProduction: true,
        hasValidDeskPinCookie: false,
        hasSupabaseSessionCookie: false,
      }),
      false,
    );
  });

  it("keeps open desk in non-production when DESK_PIN is unset", () => {
    assert.equal(
      erpCredentialsPresent({
        deskPinConfigured: false,
        isProduction: false,
        hasValidDeskPinCookie: false,
        hasSupabaseSessionCookie: false,
      }),
      true,
    );
  });

  it("accepts either valid PIN cookie or Supabase session when PIN is configured", () => {
    assert.equal(
      erpCredentialsPresent({
        deskPinConfigured: true,
        isProduction: true,
        hasValidDeskPinCookie: true,
        hasSupabaseSessionCookie: false,
      }),
      true,
    );
    assert.equal(
      erpCredentialsPresent({
        deskPinConfigured: true,
        isProduction: true,
        hasValidDeskPinCookie: false,
        hasSupabaseSessionCookie: true,
      }),
      true,
    );
    assert.equal(
      erpCredentialsPresent({
        deskPinConfigured: true,
        isProduction: true,
        hasValidDeskPinCookie: false,
        hasSupabaseSessionCookie: false,
      }),
      false,
    );
  });
});

describe("shouldApplyMiddlewareAuthCookies", () => {
  it("does not apply Set-Cookie when refresh timed out or failed open", () => {
    assert.equal(shouldApplyMiddlewareAuthCookies(false), false);
  });

  it("applies Set-Cookie when getUser completed inside the deadline", () => {
    assert.equal(shouldApplyMiddlewareAuthCookies(true), true);
  });
});
