/**
 * Desk RBAC gate — mirrors API `roleAllows` against the session actor role.
 * DEV_ACTOR is theater until PIN/JWT gateway; optional `hos_desk_role` override for QA.
 */
import { permission, roleAllows, type PermissionKey } from "@hos-v2/domain";
import { DEV_ACTOR } from "./api";

export function deskSessionRole(): string {
  if (typeof localStorage === "undefined") return DEV_ACTOR.role;
  return localStorage.getItem("hos_desk_role")?.trim() || DEV_ACTOR.role;
}

export function deskCan(module: string, action: string): boolean {
  return roleAllows(deskSessionRole(), permission(module, action));
}

export function deskCanKey(key: PermissionKey): boolean {
  return roleAllows(deskSessionRole(), key);
}
