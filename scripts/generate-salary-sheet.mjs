/**
 * Generate Pelbu Suites printable salary sheet (deposit table + per-person slips).
 * Usage: node scripts/generate-salary-sheet.mjs
 * Reads logo/CSS from docs/salary-sheet-print.html (or prior period file).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outPath = path.join(root, "docs", "salary-sheet-print.html");
const sourcePath = outPath;

const period = {
  label: "October 2026",
  prepared: "5 November 2026",
  notes:
    "PF is 5% employee and 5% employer of basic salary. Health contribution is 1% of basic, for the Bhutan Health Trust Fund. Personal income tax is not on this sheet. Management salaries are listed and are not included in the deposit total. Leader-of-the-month Nu. 4,000 allowance is not on this sheet — confirm who performed in October and add separately if paying.",
  attn:
    "October leavers (not paid on this sheet): Anjana Rai, Kelden, Priya. Also previously terminated: Pema Wangdi, Jigme Choda. Carry-forward advances from September: Meghraj balance Nu. 1,000 (cleared this month). Mohan balance Nu. 2,000 (no deduct this month). Damber balance Nu. 3,000 (no deduct this month). Anjana’s remaining advance Nu. 3,000 — settle separately. Geeta’s BoB 205764758 is in the name Dhan Maya Gurung.",
};

/** @typedef {{ name: string, role?: string, dept: string, management?: boolean, id?: string, bank?: string, holder?: string, basic: number, advanceTaken?: number, advanceDeduct?: number, advanceBalance?: number, note?: string }} StaffRow */

/** @type {StaffRow[]} */
const staff = [
  // Management
  { name: "Dawa Yonzon", dept: "Management", management: true, id: "10304001752", basic: 40000 },
  { name: "Tshering Lhamo", dept: "Management", management: true, basic: 25000 },
  { name: "Rajiv Pradhan", dept: "Management", management: true, basic: 25000 },
  // Sales
  {
    name: "Choki Wangmo",
    dept: "Sales and marketing",
    role: "Reservation, Sales & Marketing Manager",
    bank: "BoB 201380437",
    basic: 20000,
  },
  // Front office (Anjana left)
  {
    name: "Meghraj",
    dept: "Front office",
    role: "Front Office Agent",
    bank: "BNB 651619841",
    basic: 12000,
    advanceTaken: 2000,
    advanceDeduct: 1000,
    advanceBalance: 0,
  },
  {
    name: "Rigzang",
    dept: "Front office",
    role: "Front Office Agent",
    bank: "BNB 652395097",
    basic: 12000,
  },
  {
    name: "Mohan",
    dept: "Front office",
    role: "Front Office Agent",
    bank: "BoB 205710917",
    basic: 12000,
    advanceTaken: 2000,
    advanceDeduct: 0,
    advanceBalance: 2000,
  },
  // Housekeeping
  {
    name: "Dorji Wangmo",
    dept: "Housekeeping",
    role: "House Keeping Attendant",
    id: "11506003323",
    bank: "BoB 202267830",
    basic: 13500,
  },
  {
    name: "Renuka Gurung",
    dept: "Housekeeping",
    role: "House Keeping Attendant",
    id: "11201005790",
    bank: "BNB 652238188",
    basic: 13500,
  },
  {
    name: "Sherab Chezom",
    dept: "Housekeeping",
    role: "House Keeping Attendant",
    id: "11514003118",
    bank: "BoB 209606390",
    basic: 13000,
  },
  {
    name: "Lobzang Dema",
    dept: "Housekeeping",
    role: "House Keeping Attendant",
    id: "11607003029",
    bank: "BNB 650295381",
    basic: 13000,
  },
  {
    name: "Geeta",
    dept: "Housekeeping",
    role: "House Keeping Attendant",
    bank: "BoB 205764758",
    holder: "Dhan Maya Gurung",
    basic: 12000,
  },
  {
    name: "Rinchen",
    dept: "Housekeeping",
    role: "House Keeping Attendant",
    bank: "BoB 202831935",
    basic: 12000,
  },
  // F&B (Priya left)
  {
    name: "Damber Kumari Ghalley",
    dept: "Food and beverage",
    role: "F&B Attendant",
    bank: "BoB 209061637",
    basic: 12000,
    advanceTaken: 3000,
    advanceDeduct: 0,
    advanceBalance: 3000,
  },
  {
    name: "Sushma Rai",
    dept: "Food and beverage",
    role: "F&B Attendant",
    bank: "BoB 207353394",
    basic: 12000,
  },
  {
    name: "Krishna",
    dept: "Food and beverage",
    role: "F&B Attendant",
    bank: "BoB 203488951",
    basic: 12000,
  },
  {
    name: "Bhanu",
    dept: "Food and beverage",
    role: "F&B Attendant",
    bank: "BoB 17306833",
    basic: 12000,
  },
  // Kitchen (Kelden left)
  {
    name: "Khem",
    dept: "Kitchen",
    role: "Kitchen Assistant",
    bank: "BoB 130035256",
    basic: 15000,
  },
  {
    name: "Gedhan",
    dept: "Kitchen",
    role: "Cook",
    bank: "BoB 212079720",
    basic: 12000,
  },
];

function fmt(n) {
  if (n == null || Number.isNaN(n)) return "";
  return Math.round(n).toLocaleString("en-IN");
}

function calc(row) {
  const basic = row.basic;
  const empPf = Math.round(basic * 0.05);
  const health = Math.round(basic * 0.01);
  const advance = row.advanceDeduct ?? 0;
  const totalDed = empPf + health + advance;
  const net = basic - totalDed;
  const erPf = empPf;
  const ctc = basic + erPf;
  return { basic, empPf, health, advance, totalDed, net, erPf, ctc };
}

function advanceNote(row) {
  if (row.advanceTaken == null && row.advanceDeduct == null) return "";
  const taken = row.advanceTaken ?? 0;
  const deduct = row.advanceDeduct ?? 0;
  const bal =
    row.advanceBalance != null
      ? row.advanceBalance
      : Math.max(0, taken - deduct);
  return `Advance taken ${fmt(taken)} · deduct ${fmt(deduct)} · balance ${fmt(bal)}`;
}

function extractLogo(html) {
  const m = html.match(/src="(data:image\/png;base64,[^"]+)"/);
  if (!m) throw new Error("Logo data URL not found in source HTML");
  return m[1];
}

function extractCss(html) {
  const start = html.indexOf("<style>");
  const end = html.indexOf("</style>");
  if (start < 0 || end < 0) throw new Error("CSS block not found");
  return html.slice(start, end + "</style>".length);
}

function letterhead(logo, kindTitle, kindSub) {
  return `<header class="lh">
              <div class="brand">
                <img src="${logo}" alt="">
                <div>
                  <h1>PELBU SUITES</h1>
                  <address class="addr">
                    Olakha, Thimphu, Bhutan<br>
                    T +975 16193410 · pelbusuites@gmail.com
                  </address>
                </div>
              </div>
              <div class="kind">
                <p class="k">${kindTitle}</p>
                <h2>${kindSub}</h2>
                ${
                  kindTitle.includes("Private")
                    ? `<p>${period.label} · Prepared ${period.prepared}</p>`
                    : ""
                }
              </div>
            </header>`;
}

function staffMeta(row) {
  const parts = [];
  if (row.role) parts.push(`<span>${esc(row.role)}</span>`);
  if (row.bank) parts.push(`<span class="bank">${esc(row.bank)}</span>`);
  if (row.holder)
    parts.push(`<span class="holder">${esc(row.holder)}</span>`);
  const adv = advanceNote(row);
  if (adv) parts.push(`<em>${esc(adv)}</em>`);
  if (row.note) parts.push(`<em>${esc(row.note)}</em>`);
  return parts.join("");
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sum(rows, pick) {
  return rows.reduce((a, r) => a + pick(calc(r)), 0);
}

function build(logo, css) {
  const depts = [];
  for (const row of staff) {
    const last = depts[depts.length - 1];
    if (!last || last.name !== row.dept) depts.push({ name: row.dept, rows: [row] });
    else last.rows.push(row);
  }

  let sn = 0;
  const bodyRows = [];
  for (const dept of depts) {
    bodyRows.push(`<tr class="dept"><td colspan="12">${esc(dept.name)}</td></tr>`);
    for (const row of dept.rows) {
      sn += 1;
      const c = calc(row);
      const advCell =
        row.advanceDeduct == null && row.advanceTaken == null
          ? ""
          : fmt(c.advance);
      bodyRows.push(`<tr class="">
    <td class="num">${sn}</td>
    <td class="who"><strong>${esc(row.name)}</strong>${staffMeta(row)}</td>
    <td class="cid">${esc(row.id ?? "")}</td>
    <td class="num">${fmt(c.basic)}</td>
    <td class="num">${fmt(c.empPf)}</td>
    <td class="num">${fmt(c.health)}</td>
    <td class="num">${advCell}</td>
    <td class="num">${fmt(c.totalDed)}</td>
    <td class="num net">${fmt(c.net)}</td>
    <td class="num">${fmt(c.erPf)}</td>
    <td class="num">${fmt(c.ctc)}</td>
    <td class="sign"><span></span></td>
  </tr>`);
    }
    if (dept.name === "Management") {
      const mgmt = dept.rows;
      bodyRows.push(`<tr class="mgmt-total">
    <td colspan="3" class="label">Management total — paid separately</td>
    <td class="num">${fmt(sum(mgmt, (c) => c.basic))}</td>
    <td class="num">${fmt(sum(mgmt, (c) => c.empPf))}</td>
    <td class="num">${fmt(sum(mgmt, (c) => c.health))}</td>
    <td class="num">${fmt(sum(mgmt, (c) => c.advance))}</td>
    <td class="num">${fmt(sum(mgmt, (c) => c.totalDed))}</td>
    <td class="num">${fmt(sum(mgmt, (c) => c.net))}</td>
    <td class="num">${fmt(sum(mgmt, (c) => c.erPf))}</td>
    <td class="num">${fmt(sum(mgmt, (c) => c.ctc))}</td>
    <td></td>
  </tr>`);
    }
  }

  const deposit = staff.filter((r) => !r.management);
  const foot = `<tr>
          <td colspan="3" class="label">Deposit total — excludes management</td>
          <td class="num">${fmt(sum(deposit, (c) => c.basic))}</td>
          <td class="num">${fmt(sum(deposit, (c) => c.empPf))}</td>
          <td class="num">${fmt(sum(deposit, (c) => c.health))}</td>
          <td class="num">${fmt(sum(deposit, (c) => c.advance))}</td>
          <td class="num">${fmt(sum(deposit, (c) => c.totalDed))}</td>
          <td class="num">${fmt(sum(deposit, (c) => c.net))}</td>
          <td class="num">${fmt(sum(deposit, (c) => c.erPf))}</td>
          <td class="num">${fmt(sum(deposit, (c) => c.ctc))}</td>
          <td></td>
        </tr>`;

  const slips = staff
    .map((row) => {
      const c = calc(row);
      const roleBits = [row.dept, row.role].filter(Boolean).join(" · ");
      const adv = advanceNote(row);
      return `<article class="slip">
    ${letterhead(logo, "Salary sheet", period.label)}
    <h2 class="slip-name">${esc(row.name)}</h2>
    <p class="slip-role">${esc(roleBits)}</p>
    ${row.id ? `<p class="slip-role">ID card ${esc(row.id)}</p>` : ""}
    ${
      row.bank
        ? `<p class="slip-bank">${esc(row.bank)}</p>`
        : `<p class="slip-role">Bank account not on file</p>`
    }
    ${row.holder ? `<p class="slip-role">Account holder ${esc(row.holder)}</p>` : ""}
    <table class="slip-table">
      <tbody>
        <tr><th>Basic salary (Nu.)</th><td>${fmt(c.basic)}</td></tr>
        <tr><th>Employee PF 5%</th><td>${fmt(c.empPf)}</td></tr>
        <tr><th>Health contribution 1%</th><td>${fmt(c.health)}</td></tr>
        ${
          adv
            ? `<tr><th>Advance deducted</th><td>${fmt(c.advance)}</td></tr>`
            : ""
        }
        <tr><th>Total deductions</th><td>${fmt(c.totalDed)}</td></tr>
        <tr class="net"><th>Net pay (Nu.)</th><td>${fmt(c.net)}</td></tr>
        <tr><th>Employer PF 5%</th><td>${fmt(c.erPf)}</td></tr>
        <tr><th>Cost to company</th><td>${fmt(c.ctc)}</td></tr>
      </tbody>
    </table>
    ${adv ? `<p class="attn">${esc(adv)}</p>` : ""}
    ${row.note ? `<p class="attn">${esc(row.note)}</p>` : ""}
    <p class="slip-foot">${esc(period.label)} salary. Sign to confirm this net pay. Personal income tax is not on this sheet.</p>
    <div class="slip-signs">
      <div><span></span>Staff signature</div>
      <div><span></span>Date</div>
    </div>
  </article>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pelbu Suites — Monthly salary sheet — ${esc(period.label)}</title>
<!--
  Hotel OS salary sheet. Same layout for every tenant.
  Swap only the letterhead (logo, name, address, phone, email, period) and the staff rows.
  Employee PF 5% + health contribution 1% of basic. Employer PF 5%. Cost to company = basic + employer PF.
  Personal income tax is not on this sheet. Blank basic stays blank. Terminated staff are omitted from the sign-off table.
  Regenerate: node scripts/generate-salary-sheet.mjs
-->
${css}
</head>
<body>
  <div class="bar">
    <p>Deposit table: A4 landscape. Then one portrait salary sheet per person. Management pay is listed, and kept out of the deposit total.</p>
    <button type="button" onclick="window.print()">Print salary sheet</button>
  </div>
  <article class="sheet">
    <table>
      <thead>
        <tr class="lh-row">
          <td colspan="12">
            ${letterhead(logo, "Private sector payroll", "Monthly salary sheet")}
          </td>
        </tr>
        <tr>
          <th>S.N.</th>
          <th>Name</th>
          <th>ID card no.</th>
          <th>Basic<br>(Nu.)</th>
          <th>Employee<br>PF 5%</th>
          <th>Health<br>1%</th>
          <th>Advance<br>deducted</th>
          <th>Total<br>deductions</th>
          <th>Net pay<br>(Nu.)</th>
          <th>Employer<br>PF 5%</th>
          <th>Cost to<br>company</th>
          <th>Staff signature</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows.join("\n")}
      </tbody>
      <tfoot>
        ${foot}
      </tfoot>
    </table>
    <p class="notes">
      Sign beside your name to confirm this month’s net pay. ${esc(period.notes)}
      This sheet is the ${esc(period.label)} payroll.
    </p>
    <p class="attn">${esc(period.attn)}</p>
  </article>
  <h2 class="screen-only">Individual salary sheets</h2>
  ${slips}
</body>
</html>
`;
}

const source = fs.readFileSync(sourcePath, "utf8");
const logo = extractLogo(source);
const css = extractCss(source);
const html = build(logo, css);
fs.writeFileSync(outPath, html, "utf8");

const deposit = staff.filter((r) => !r.management);
const mgmt = staff.filter((r) => r.management);
console.log(`Wrote ${outPath}`);
console.log(
  `Staff ${staff.length} · deposit headcount ${deposit.length} · management ${mgmt.length}`,
);
console.log(
  `Deposit net Nu. ${fmt(sum(deposit, (c) => c.net))} · management net Nu. ${fmt(sum(mgmt, (c) => c.net))}`,
);
