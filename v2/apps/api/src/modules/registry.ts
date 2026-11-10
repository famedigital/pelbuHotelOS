import type { CommandContext, CommandResult } from "../platform/command.js";

export type ModuleMeta = {
  id: string;
  wave: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "platform";
  path: string;
  title: string;
  /** Honest status — never claim done without module-done gate. */
  status: "spine" | "commands" | "ui_partial" | "done";
};

export const MODULE_REGISTRY: ModuleMeta[] = [
  { id: "pin", wave: "platform", path: "/", title: "PIN Gateway", status: "commands" },
  { id: "settings", wave: "A", path: "/settings", title: "Settings", status: "commands" },
  { id: "hr", wave: "A", path: "/hr", title: "HR", status: "commands" },
  { id: "rates", wave: "A", path: "/rates", title: "Rates", status: "commands" },
  { id: "reservations", wave: "B", path: "/reservations", title: "Reservations", status: "commands" },
  { id: "stayview", wave: "B", path: "/stayview", title: "StayView", status: "commands" },
  { id: "desk", wave: "B", path: "/desk", title: "Desk", status: "commands" },
  { id: "guests", wave: "B", path: "/guests", title: "Guests", status: "commands" },
  { id: "hermes", wave: "B", path: "/telegram", title: "Hermes Telegram", status: "ui_partial" },
  { id: "groups", wave: "B", path: "/groups", title: "Groups", status: "commands" },
  { id: "night-audit", wave: "B", path: "/night-audit", title: "Night Audit", status: "commands" },
  { id: "finance", wave: "C", path: "/finance", title: "Finance", status: "commands" },
  { id: "reports", wave: "C", path: "/reports", title: "Reports", status: "commands" },
  { id: "compliance", wave: "C", path: "/compliance", title: "Compliance", status: "commands" },
  { id: "pos", wave: "D", path: "/pos", title: "POS", status: "commands" },
  { id: "kds", wave: "D", path: "/kds", title: "KDS", status: "commands" },
  { id: "housekeeping", wave: "D", path: "/housekeeping", title: "Housekeeping", status: "commands" },
  { id: "laundry", wave: "D", path: "/laundry", title: "Laundry", status: "commands" },
  { id: "agents", wave: "E", path: "/agents", title: "Agents", status: "commands" },
  { id: "registry", wave: "E", path: "/registry", title: "Registry", status: "commands" },
  { id: "channel", wave: "E", path: "/channel", title: "Channel", status: "commands" },
  { id: "purchases", wave: "F", path: "/purchases", title: "Purchases", status: "commands" },
  { id: "staff-portal", wave: "F", path: "/staff-portal", title: "Staff Portal", status: "commands" },
  { id: "owner", wave: "F", path: "/owner", title: "Owner", status: "commands" },
  { id: "loyalty", wave: "F", path: "/loyalty", title: "Loyalty", status: "commands" },
  { id: "superadmin", wave: "F", path: "/superadmin", title: "Super-admin", status: "commands" },
  { id: "cms", wave: "G", path: "/cms", title: "CMS", status: "commands" },
  { id: "website", wave: "G", path: "/website", title: "Website", status: "commands" },
  { id: "marketing", wave: "G", path: "/marketing", title: "Marketing", status: "commands" },
  { id: "innora-ai", wave: "G", path: "/ai", title: "Innora AI", status: "commands" },
  { id: "services", wave: "H", path: "/services", title: "Services", status: "commands" },
  { id: "events", wave: "H", path: "/events", title: "Events & Banquets", status: "commands" },
];

export type CommandFn = (
  input: unknown,
  ctx: CommandContext,
) => Promise<CommandResult<unknown>>;

export const commandHandlers = new Map<string, CommandFn>();

export function registerCommand(name: string, fn: CommandFn): void {
  commandHandlers.set(name, fn);
}
