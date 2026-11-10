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
    assert.equal(isSupabaseAuthSessionCookieName("hotelos_desk_session"), false);
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

describe("clearSupabaseAuthSessionCookies", () => {
  it("deletes session chunks but keeps unrelated cookies", async () => {
    const { clearSupabaseAuthSessionCookies } = await import(
      "./supabase-auth-cookies"
    );
    const jar = {
      cookies: [
        { name: "sb-umrpibwhxpzsfdyypiuf-auth-token.0" },
        { name: "sb-umrpibwhxpzsfdyypiuf-auth-token.1" },
        { name: "hotelos_desk_session" },
      ],
      getAll() {
        return this.cookies;
      },
      delete(name: string) {
        this.cookies = this.cookies.filter((c) => c.name !== name);
      },
    };
    clearSupabaseAuthSessionCookies(jar);
    assert.deepEqual(
      jar.getAll().map((c) => c.name),
      ["hotelos_desk_session"],
    );
  });
});
