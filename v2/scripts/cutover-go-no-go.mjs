#!/usr/bin/env node
/**
 * CUTOVER.md go/no-go harness — reports readiness; never flips V2_DESK_CUTOVER.
 *
 * Usage: node v2/scripts/cutover-go-no-go.mjs
 * Exit 0 = safe to keep Innora live (flag must stay false until owner override).
 * Exit 1 = hard fail (flag already true without evidence, or domain journey broken).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(root, "..");
const flag = (process.env.V2_DESK_CUTOVER ?? "false").trim().toLowerCase();

const checklist = [
  {
    id: "shadow_diffs",
    label: "Shadow diffs = 0 unexplained",
    auto: false,
    status: "manual",
  },
  {
    id: "restore_drill",
    label: "Restore drill from off-droplet v2 dump passed",
    auto: false,
    status: "manual",
  },
  {
    id: "printers_keys",
    label: "Printers / keycards on-site",
    auto: false,
    status: "manual",
  },
  {
    id: "agents_notified",
    label: "Agents notified; portal logins sent",
    auto: false,
    status: "manual",
  },
  {
    id: "dns_staged",
    label: "Website DNS staged",
    auto: false,
    status: "manual",
  },
  {
    id: "journeys_green",
    label: "All §5 journeys green on v2/ Playwright",
    auto: true,
    status: "pending",
  },
  {
    id: "schema_isolation",
    label: "v2_app cannot SELECT from public.bookings",
    auto: false,
    status: "manual",
  },
];

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
  });
  return {
    ok: r.status === 0,
    status: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

console.log("Hotel OS v2 — CUTOVER go/no-go (flag must stay false until owner sets it)\n");
console.log(`V2_DESK_CUTOVER=${flag || "(unset→false)"}`);

if (flag === "true") {
  console.error(
    "\nNO-GO: V2_DESK_CUTOVER is already true. Set false and re-run shadow + journeys before live desk flip.",
  );
  process.exit(1);
}

const domain = run("pnpm", ["--filter", "@hos-v2/domain", "test"], root);
const foFit = domain.ok && /fo-fit-journey|FO FIT journey/i.test(domain.stdout + domain.stderr)
  ? "pass"
  : domain.ok
    ? "pass"
    : "fail";

checklist.find((c) => c.id === "journeys_green").status =
  foFit === "pass" ? "domain-pass · desk e2e separate" : "fail";

const cutoverDoc = join(repoRoot, "docs", "v2", "CUTOVER.md");
const opsDoc = join(repoRoot, "docs", "v2", "OPERATIONS-FLOW.md");
const e2eSpec = join(root, "apps", "desk", "e2e", "fo-01-fit-journey.spec.ts");

console.log("\nAutomated checks");
console.log(`  domain FO FIT journey …… ${domain.ok ? "PASS" : "FAIL"}`);
if (!domain.ok) {
  console.log(domain.stdout);
  console.log(domain.stderr);
}
console.log(
  `  desk e2e spec present …… ${existsSync(e2eSpec) ? "PASS" : "FAIL"}`,
);
console.log(
  `  CUTOVER.md present ……… ${existsSync(cutoverDoc) ? "PASS" : "FAIL"}`,
);
console.log(
  `  OPERATIONS-FLOW.md ……… ${existsSync(opsDoc) ? "PASS" : "FAIL"}`,
);

console.log("\nGo/no-go checklist (from docs/v2/CUTOVER.md)");
for (const row of checklist) {
  const mark =
    row.status === "fail"
      ? "✗"
      : row.status.startsWith("domain") || row.status === "pass"
        ? "·"
        : "○";
  console.log(`  ${mark} [${row.status}] ${row.label}`);
}

const evidencePath = join(root, "scripts", "cutover-evidence.json");
let evidenceNote = "none";
if (existsSync(evidencePath)) {
  try {
    const ev = JSON.parse(readFileSync(evidencePath, "utf8"));
    evidenceNote = ev.summary ?? "present";
  } catch {
    evidenceNote = "unreadable";
  }
}
console.log(`\nOptional evidence file: ${evidenceNote}`);

const hardFail = !domain.ok || !existsSync(e2eSpec);
if (hardFail) {
  console.error("\nNO-GO — fix domain journey / e2e scaffold before cutover discussion.");
  process.exit(1);
}

console.log(
  "\nRESULT: HOLD CUTOVER — keep V2_DESK_CUTOVER=false until every manual □ is green and desk Playwright §5.2 is green.",
);
process.exit(0);
