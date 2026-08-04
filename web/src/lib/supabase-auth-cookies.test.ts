import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasSupabaseAuthSessionCookie,
  isSupabaseAuthSessionCookieName,
} from "./supabase-auth-cookies";

describe("isSupabaseAuthSessionCookieName", () => {
  it("matches base and chunked auth tokens for project ref", () => {
    const ref = "umrpibwhxpzsfdyypiuf";
    assert.equal(isSupabaseAuthSessionCookieName(`sb-${ref}-auth-token`), true);
    assert.equal(
      isSupabaseAuthSessionCookieName(`sb-${ref}-auth-token.0`),
      true,
    );
    assert.equal(
      isSupabaseAuthSessionCookieName(`sb-${ref}-auth-token.1`),
      true,
    );
  });

  it("rejects PKCE verifier-only and unrelated cookies", () => {
    const ref = "umrpibwhxpzsfdyypiuf";
    assert.equal(
      isSupabaseAuthSessionCookieName(`sb-${ref}-auth-token-code-verifier`),
      false,
    );
    assert.equal(isSupabaseAuthSessionCookieName("pelbu_desk_session"), false);
    assert.equal(isSupabaseAuthSessionCookieName("sb-x-access-token"), false);
  });
});

describe("hasSupabaseAuthSessionCookie", () => {
  it("returns true when any session chunk is present", () => {
    assert.equal(
      hasSupabaseAuthSessionCookie([
        { name: "sb-umrpibwhxpzsfdyypiuf-auth-token-code-verifier" },
        { name: "sb-umrpibwhxpzsfdyypiuf-auth-token.0" },
      ]),
      true,
    );
  });

  it("returns false for verifier only", () => {
    assert.equal(
      hasSupabaseAuthSessionCookie([
        { name: "sb-umrpibwhxpzsfdyypiuf-auth-token-code-verifier" },
      ]),
      false,
    );
  });
});
