# M01 — Agency org, members, portal auth hardening

**Status:** APPROVED 2026-11-13 (PM cycle — proceed Implement)  
**Layer:** L0–L3  
**Depends on:** ADR 001, ADR 002  
**Blocks:** M03–M12 (org id), all agency commands

---

## 1. Purpose

Create the **agency tenant** and harden portal authentication so Travel Agent OS has a real security boundary before any trip UI exists.

## 2. Actors

| Actor | Needs |
|-------|--------|
| Agency owner | Org exists; invite members; own home `/partner` |
| Agency ops / finance / viewer | Role-limited access (roles reserved; fine-grained UI later) |
| Guide / driver portal user | Login still works; claims include subject; no agency trip tables yet |
| Hotel staff | Unchanged PIN desk; must not read agency_org tables |
| Attacker / other agency | Must not read or mutate another org |

## 3. User stories

1. **Given** GoTrue user `soultrip@gmail.com` linked to Soultrips org, **when** they sign in at `/login`, **then** they receive a portal session with `role=agent`, `agencyOrgId=<uuid>`, home `/partner`.
2. **Given** a token without `exp` or with expired `exp`, **when** they call any agency or desk command, **then** API returns 401.
3. **Given** `DESK_JWT_SECRET` is the default dev string on a non-dev boot, **when** API starts, **then** process refuses to start (or logs fatal and exits).
4. **Given** client sends `viewerAgentId` / `agencyOrgId` differing from token claims, **when** partner/agency command runs, **then** server uses claims only and ignores/forbids client override.
5. **Given** `ALLOW_E2E_DEMO_AUTH` is unset, **when** client uses hardcoded field PINs (7788/4455/5566), **then** auth fails.
6. **Given** agency member role `viewer`, **when** they hit a mutating agency command (future), **then** forbidden — matrix stub in M01 must include roles even if few commands exist yet.
7. **Given** two orgs A and B, **when** A’s token lists members, **then** B’s members never appear.

## 4. In scope

- Tables: `agency_orgs`, `agency_members`, `agency_org_hotel_links`
- Seed/link path for Soultrips → Pelbu (or demo) MoU agent id (document exact seed in Design)
- Portal token claims: add `agencyOrgId`, `exp`; verify exp
- Permission matrix entries for `agent` | `guide` | `driver` (minimal grants)
- Force subject/org from claims on partner-related commands touched in this module
- Gate list of sensitive unauthenticated GETs (enumerated in Design)
- Kill or hard-gate demo field portal PINs
- Settings stub page: org name + member list (read) + invite placeholder returning typed “not implemented” **only if** invite RPC not in M01 — prefer invite in M01 Design if small

## 5. Out of scope

- httpOnly cookie Phase B (document as M01.1 / later)
- Trips, guides pool UI, budget, shares
- Rewriting entire Partner shell chrome
- Redis revocation registry (Phase B+)
- Changing hotel staff PIN crypto

## 6. Entities owned

- `agency_orgs`
- `agency_members`
- `agency_org_hotel_links`

## 7. Commands / queries (M01)

| Name | Type | Notes |
|------|------|-------|
| `agency.org.get` | query | Current org profile |
| `agency.org.members.list` | query | Members of caller's org |
| `agency.org.members.invite` | command | Optional in M01; if deferred, Design says so and UI hides button |
| `agency.org.hotelLinks.list` | query | MoU hotels for org |
| Auth paths | existing | unified login / portal email — extend claims |

## 8. Privacy / never-leak

- Other orgs’ members, links, names (except public marketing)
- `pin_hash`, desk secrets
- Raw share secrets (N/A yet)
- Hotel folio balances via agency org APIs (none in M01)

## 9. Edge cases

| Case | Expected |
|------|----------|
| User in zero orgs | 403 typed `NO_AGENCY_ORG` after login attempt as agent |
| User in multiple orgs | M01: pick primary `agency_members.is_primary`; switcher later |
| Inactive member | Cannot get portal token |
| Inactive org | Cannot get portal token |
| Link to missing agent_id | Migration/seed fails closed; no orphan UI |

## 10. Acceptance criteria

- [ ] Migrations apply on clean `v2` schema via existing additive migrate script
- [ ] Indexes + FK as Design
- [ ] Unit: token exp reject; claim bind helper; permission matrix includes portal roles
- [ ] Integration: member of A cannot `org.get` as B
- [ ] Demo field PINs dead without e2e flag
- [ ] Sensitive GET list from Design requires Bearer + property/org check
- [ ] `/partner` still loads for Soultrips after login (smoke); may be empty shell
- [ ] No `TODO` stubs in auth path; typed errors only

## 11. Dependencies

- None (first organ). M02 is parallel (pure domain) and does not depend on M01.
