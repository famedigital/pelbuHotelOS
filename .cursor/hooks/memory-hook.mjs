/**
 * Keyword memory for every agent in this repo.
 * recall: inject only matching lines (beforeSubmitPrompt)
 * note:   keep the latest answer (afterAgentResponse)
 * commit: append one keyword line (stop, sessionEnd)
 * backfill: index saved transcripts once
 *
 * stdout is hook JSON only. Failures still allow the prompt.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const memDir = join(root, ".cursor", "memory");
const keywordsPath = join(memDir, "KEYWORDS.md");
const pendingPath = join(memDir, ".pending.json");
const recallPath = join(memDir, ".recall-state.json");
const reportPath = join(root, "docs", "agent-memory", "REPORT.md");

const HEADER = "# keywords | date | fact | chat\n# One line per turn. Agents grep or receive <mem> hits. Do not load this file whole.\n";

const SEED = [
  "keyword memory hook recall | 2026-10-23 | Every agent chat is stored as one keyword line in .cursor/memory/KEYWORDS.md. The beforeSubmitPrompt hook injects only matching lines. Do not load the file whole. | seed",
  "folio edit pin session | 2026-10-23 | Open-folio edits use cookie hotelos_folio_edit for 4 hours after the manager PIN, scoped to one property. After the master bill, corrections are a credit note. | seed",
  "hotel doc numbers psfn psbk psbn | 2026-10-23 | Staff numbers are prefix + FN/BK/BN + year + 5 digits. Pelbu prefix is PS: folio PSFN-2026-00160, booking PSBK-2026-00088, master bill PSBN-2026-00041. Booking code PS-2026-00160 is not the folio number. | seed",
  "rate offers room_rates label agent guest | 2026-10-23 | Room prices stay on room_rates. An offer has a label (Standard and others), optional agent_id, optional guest_label, and active. The stay copies the chosen nightly amount. | seed",
  "folios doc_no missing column | 2026-10-23 | A stay-card print failed with column folios_1.doc_no does not exist. Confirm the column exists before selecting it. | seed",
  "zero balance settle master bill | 2026-10-23 | A zero balance must not settle the folio until the master bill exists. maybeSettleZeroBalanceFolio still runs from issue-document, folio ops, and POS. | seed",
];

const STOP = new Set(
  "a an the and or to for of in on at is it this that with from you u can please me my we our i do does what how why when where which all just want need make about into so be are was were have has had not no yes if then than also only any some get got let its as by but will would should could did done your youre im ive dont thats there here they them their his her she he its too very more most other such same than then into over after before out up down off than via per each both few own same using use used one two three four five six seven eight nine ten about into from with".split(
    /\s+/,
  ),
);

const KEEP_SHORT = new Set(["gst", "pin", "kot", "pos", "sdf", "fnb", "hk", "rls", "ari", "mou", "uat", "fo"]);
const SOFT = new Set(
  "format number booking print folio login portal agent room guest hotel page design staff check sheet list name date time total amount rate rates rooms guests stay stays desk screen owner click plan implement specified attached reference exist record right third brain file edit itself todo todos thing things stuff like just also still".split(
    /\s+/,
  ),
);

const THEMES = [
  ["Deploy and login", /coolify|deploy|traefik|droplet|502|login|ssl|cutover/i],
  ["Folio, bill, GST", /folio|invoice|gst|bill|doc_no|payment|settle|psfn|psbn/i],
  ["Rates", /rate|season|offer|fill-up|fillup|contract|rack money/i],
  ["Rooms and stays", /room|check-?in|check-?out|rack|in-?house|booking|reserv|calendar/i],
  ["Agents", /agent|mou|portal|soultrip/i],
  ["POS and kitchen", /\bpos\b|kot|fnb|cafe|laundry|kitchen/i],
  ["Desk UI", /stay hub|phone|redesign|shadcn|manifest/i],
];

function ensureDir() {
  mkdirSync(memDir, { recursive: true });
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(path, value) {
  ensureDir();
  writeFileSync(path, JSON.stringify(value), "utf8");
}

function localDate(ms = Date.now()) {
  const d = new Date(ms);
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

function redact(text) {
  return String(text || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?<!\w)\+?\d[\d\s()]{7,}\d(?!\w)/g, "[phone]")
    .replace(
      /\b(pin|password|secret|token|api[_-]?key|service[_-]?role)\b(\s*[:=]\s*|\s+)(?=\S*\d)\S+/gi,
      "$1 [redacted]",
    )
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[db]")
    .replace(/\b(sb_secret|eyJ)[A-Za-z0-9._-]{8,}/g, "[secret]");
}

function collapse(text) {
  return redact(text)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\|/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(text, max) {
  const t = collapse(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`;
}

function userText(prompt) {
  const raw = String(prompt || "");
  const m = raw.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/);
  return (m ? m[1] : raw).replace(/<timestamp>[\s\S]*?<\/timestamp>/g, "").trim();
}

function tokens(text) {
  const raw = collapse(text).toLowerCase().match(/[a-z0-9][a-z0-9_-]{1,24}/g) || [];
  const out = [];
  for (const t of raw) {
    if (STOP.has(t)) continue;
    if (t.length < 4 && !KEEP_SHORT.has(t) && !/^\d{3,4}$/.test(t)) continue;
    out.push(t);
  }
  return [...new Set(out)];
}

function keywordField(text) {
  const list = tokens(text).slice(0, 6);
  return list.length ? list.join(" ") : "note";
}

function outcome(text) {
  const clean = collapse(text);
  if (!clean) return "";
  if (clean.length <= 140) return clean;
  const parts = clean.split(/(?<=[.!?])\s+/).filter((p) => p.length > 40);
  return clip(parts.at(-1) || clean, 140);
}

function isAck(text) {
  return /^(ok|okay|thanks|thank you|yes|no|yep|sure|continue|go ahead|do it|proceed|lgtm)[.!]?$/i.test(
    collapse(text),
  );
}

function readLines() {
  if (!existsSync(keywordsPath)) return [];
  return readFileSync(keywordsPath, "utf8")
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function writeLines(lines) {
  ensureDir();
  const body = lines.filter(Boolean).join("\n");
  writeFileSync(keywordsPath, `${HEADER}${body}${body ? "\n" : ""}`, "utf8");
}

function convoId(input) {
  return String(input?.conversation_id || input?.session_id || "").trim();
}

function hookOut(obj) {
  process.stdout.write(JSON.stringify(obj));
}

function allow(extra) {
  hookOut(extra ? { continue: true, ...extra } : { continue: true });
}

function matchingLines(prompt) {
  const q = tokens(userText(prompt)).slice(0, 10);
  if (!q.length) return [];
  const lines = readLines();
  const df = new Map();
  const tokenized = lines.map((line) => new Set(tokens(line)));
  for (const set of tokenized) {
    for (const t of q) if (set.has(t)) df.set(t, (df.get(t) || 0) + 1);
  }
  const scored = [];
  for (let i = 0; i < lines.length; i++) {
    const set = tokenized[i];
    const keywordSet = new Set(tokens(lines[i].split(" | ")[0] || ""));
    let score = 0;
    let hard = 0;
    let keyHits = 0;
    for (const t of q) {
      if (!set.has(t)) continue;
      const d = df.get(t) || 1;
      score += 1 / d;
      if (keywordSet.has(t)) keyHits++;
      if (!SOFT.has(t) && t.length >= 4 && d <= 6) hard++;
    }
    if (hard === 0 && keyHits < 2) continue;
    if (hard > 0) score += 10;
    scored.push({ line: lines[i], score });
  }
  scored.sort((a, b) => b.score - a.score || a.line.length - b.line.length);
  return scored.slice(0, 4).map((s) => s.line);
}

function recall(input) {
  const prompt = userText(input.prompt || "");
  const id = convoId(input) || "latest";
  if (prompt && !isAck(prompt)) {
    const pending = readJson(pendingPath, {});
    pending[id] = {
      prompt: clip(prompt, 500),
      answer: pending[id]?.answer || "",
      at: Date.now(),
    };
    for (const key of Object.keys(pending)) {
      if (Date.now() - (pending[key]?.at || 0) > 2 * 24 * 60 * 60 * 1000) delete pending[key];
    }
    writeJson(pendingPath, pending);
  }
  const hits = matchingLines(prompt);
  if (!hits.length) {
    allow();
    return;
  }
  const state = readJson(recallPath, {});
  const seen = new Set(state[id] || []);
  const fresh = hits.filter((line) => {
    const key = line.slice(0, 120);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ids = Object.keys(state);
  state[id] = [...seen].slice(-24);
  if (ids.length > 40) delete state[ids[0]];
  writeJson(recallPath, state);
  if (!fresh.length) {
    allow();
    return;
  }
  allow({ additional_context: `<mem>\n${fresh.join("\n")}\n</mem>` });
}

function note(input) {
  const id = convoId(input) || "latest";
  const answer = outcome(input.text || "");
  if (!answer) {
    hookOut({});
    return;
  }
  const pending = readJson(pendingPath, {});
  const row = pending[id] || { prompt: "", at: Date.now() };
  row.answer = answer;
  row.at = Date.now();
  pending[id] = row;
  writeJson(pendingPath, pending);
  hookOut({});
}

function lineFrom(prompt, answer, chat) {
  const ask = clip(userText(prompt), 90);
  const did = clip(answer || "", 120);
  if (!ask && !did) return "";
  if (isAck(ask) && !did) return "";
  const fact = ask && did ? `Ask: ${ask} / Did: ${did}` : did ? `Did: ${did}` : `Ask: ${ask}`;
  if (collapse(fact).length < 24) return "";
  return `${keywordField(`${ask} ${did}`)} | ${localDate()} | ${fact} | ${chat}`;
}

function appendUnique(line) {
  if (!line) return false;
  const lines = readLines();
  const fact = line.split(" | ")[2] || line;
  if (lines.some((existing) => (existing.split(" | ")[2] || "") === fact)) return false;
  ensureDir();
  if (!existsSync(keywordsPath)) writeFileSync(keywordsPath, HEADER, "utf8");
  writeFileSync(keywordsPath, `${readFileSync(keywordsPath, "utf8").replace(/\s*$/, "")}\n${line}\n`, "utf8");
  return true;
}

function commit(input) {
  const pending = readJson(pendingPath, {});
  const id = convoId(input);
  const keys = id && pending[id] ? [id] : id ? [] : Object.keys(pending);
  for (const key of keys) {
    const row = pending[key];
    if (!row?.prompt && !row?.answer) {
      delete pending[key];
      continue;
    }
    appendUnique(lineFrom(row.prompt, row.answer, "live"));
    delete pending[key];
  }
  writeJson(pendingPath, pending);
  hookOut({});
}

function transcriptRoot() {
  return join(homedir(), ".cursor", "projects", "c-GitHub-Hotel-OS-Bhutan", "agent-transcripts");
}

function loadParents() {
  const dir = transcriptRoot();
  if (!existsSync(dir)) return [];
  const parents = [];
  for (const name of readdirSync(dir)) {
    const folder = join(dir, name);
    let st;
    try {
      st = statSync(folder);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const jl = join(folder, `${name}.jsonl`);
    if (!existsSync(jl)) continue;
    const queries = [];
    for (const line of readFileSync(jl, "utf8").split(/\n/)) {
      if (!line.trim()) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      if (row.role !== "user") continue;
      const content = row.message?.content;
      const texts = [];
      if (typeof content === "string") texts.push(content);
      else if (Array.isArray(content)) {
        for (const c of content) {
          if (typeof c === "string") texts.push(c);
          else if (c?.type === "text") texts.push(c.text || "");
        }
      }
      const q = userText(texts.join("\n"));
      if (q && !isAck(q)) queries.push(clip(q, 160));
    }
    const fileStat = statSync(jl);
    parents.push({
      id: name,
      short: name.slice(0, 8),
      mtime: fileStat.mtimeMs,
      date: localDate(fileStat.mtimeMs),
      queries,
    });
  }
  parents.sort((a, b) => b.mtime - a.mtime);
  return parents;
}

function themeOf(text) {
  for (const [name, re] of THEMES) if (re.test(text)) return name;
  return "Other";
}

function backfill() {
  const parents = loadParents();
  const historical = [];
  const seen = new Set();
  for (const chat of parents) {
    for (const q of chat.queries) {
      const fact = `Ask: ${clip(q, 150)}`;
      if (seen.has(fact)) continue;
      seen.add(fact);
      historical.push(`${keywordField(q)} | ${chat.date} | ${fact} | ${chat.short}`);
    }
  }
  const live = readLines().filter((line) => line.endsWith(" | live"));
  writeLines([...SEED, ...historical, ...live]);

  const lines = readLines();
  const buckets = new Map(THEMES.map(([name]) => [name, []]));
  buckets.set("Other", []);
  for (const line of lines) {
    if (line.endsWith(" | seed")) continue;
    buckets.get(themeOf(line)).push(line);
  }
  const themeBlocks = [...buckets.entries()]
    .filter(([, rows]) => rows.length)
    .map(([name, rows]) => {
      const samples = rows.slice(0, 6).map((row) => {
        const parts = row.split(" | ");
        return `- ${parts[2] || row} (${parts[3] || ""})`;
      });
      return `## ${name} (${rows.length})\n\n${samples.join("\n")}`;
    })
    .join("\n\n");
  const catalog = parents
    .map((chat) => `- ${chat.date} \`${chat.short}\` — ${clip(chat.queries[0] || "(no user text)", 110)} (${chat.queries.length} asks)`)
    .join("\n");
  mkdirSync(dirname(reportPath), { recursive: true });
  const report = `# Agent memory report

Compiled ${localDate()} from ${parents.length} parent chats and ${lines.length} keyword lines.

Agents do not load this report or the keyword file whole. Each question runs a local hook that injects at most four matching lines inside \`<mem>\`. The same line is not injected again in that chat.

Operating facts are the \`seed\` lines at the top of \`.cursor/memory/KEYWORDS.md\`. Every later user ask is one keyword line. New chats append a \`live\` line when the agent finishes.

## Operating facts

${SEED.map((row) => `- ${row.split(" | ")[2]}`).join("\n")}

${themeBlocks}

## Chat catalog

${catalog || "- No transcripts found."}
`;
  writeFileSync(reportPath, report, "utf8");
  process.stderr.write(
    `memory backfill: ${parents.length} chats, ${lines.length} lines, report ${reportPath}\n`,
  );
}

function main() {
  const mode = process.argv[2] || "recall";
  try {
    if (mode === "backfill") {
      backfill();
      return;
    }
    const raw = readFileSync(0, "utf8").replace(/^\uFEFF/, "").trim();
    let input = {};
    try {
      input = raw ? JSON.parse(raw) : {};
    } catch {
      const start = raw.indexOf("{");
      try {
        input = start >= 0 ? JSON.parse(raw.slice(start)) : {};
      } catch {
        process.stderr.write("memory-hook: could not parse hook input\n");
        input = {};
      }
    }
    if (mode === "note") note(input);
    else if (mode === "commit") commit(input);
    else recall(input);
  } catch (err) {
    process.stderr.write(`memory-hook ${mode} failed: ${err?.message || err}\n`);
    if (mode === "recall") allow();
    else hookOut({});
  }
}

main();
