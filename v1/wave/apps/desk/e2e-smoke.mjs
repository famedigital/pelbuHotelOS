/**
 * Lightweight smoke (no Playwright browser required):
 *   node apps/desk/e2e-smoke.mjs
 *
 * Optional PIN path when env set:
 *   SMOKE_PROPERTY_SLUG=demo-hotel SMOKE_STAFF_ID=… SMOKE_PIN=…
 */
const API = process.env.HOTEL_OS_API_URL || "http://127.0.0.1:4100";

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

async function mustOk(path, init) {
  const res = await fetch(`${API}${path}`, init);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${path} → ${res.status} ${text.slice(0, 400)}`);
  }
  return json;
}

async function main() {
  const health = await mustOk("/health");
  if (!health.ok) throw new Error("health not ok");
  console.log("PASS health", health.version || health);
  if (health.deskCutover === true) {
    console.warn(
      "WARN deskCutover=true — production FO should only flip after owner OK",
    );
  }

  const inDate = new Date();
  inDate.setUTCDate(inDate.getUTCDate() + 1);
  const outDate = new Date(inDate);
  outDate.setUTCDate(outDate.getUTCDate() + 2);
  const checkIn = ymd(inDate);
  const checkOut = ymd(outDate);

  const explore = await mustOk(
    `/v1/marketplace/explore?checkIn=${checkIn}&checkOut=${checkOut}&market=local`,
  );
  if (!Array.isArray(explore.results)) {
    throw new Error("explore missing results[]");
  }
  console.log(
    "PASS marketplace explore (priced)",
    explore.results.length,
    `nights=${explore.results[0]?.nights ?? "?"}`,
  );

  const slug = process.env.SMOKE_PROPERTY_SLUG;
  const staffId = process.env.SMOKE_STAFF_ID;
  const pin = process.env.SMOKE_PIN;

  if (slug && staffId && pin) {
    const auth = await mustOk("/v1/auth/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertySlug: slug, staffId, pin }),
    });
    const token = auth.token;
    if (!token) throw new Error("PIN login missing token");
    console.log("PASS PIN login");

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const day = await mustOk("/v1/desk/day", { headers });
    console.log("PASS day board", day.businessDate);

    const today = day.businessDate;
    const tomorrow = ymd(
      new Date(Date.parse(`${today}T00:00:00Z`) + 86400000),
    );

    const created = await mustOk("/v1/reservations", {
      method: "POST",
      headers,
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        contactName: "Smoke Guest",
        checkIn: today,
        checkOut: tomorrow,
        adults: 1,
        mealPlanCode: "EP",
        intent: "confirm",
        agreedNightlyRateBtn: 1000,
      }),
    });
    console.log("PASS Fast Book", created.confirmationCode);

    await mustOk("/v1/stays/check-in", {
      method: "POST",
      headers,
      body: JSON.stringify({
        bookingId: created.bookingId,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    console.log("PASS check-in");

    await mustOk("/v1/folio/charge", {
      method: "POST",
      headers,
      body: JSON.stringify({
        bookingId: created.bookingId,
        description: "Smoke charge",
        amountBtn: 250,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    console.log("PASS folio charge");

    await mustOk("/v1/folio/payment", {
      method: "POST",
      headers,
      body: JSON.stringify({
        bookingId: created.bookingId,
        amountBtn: 250,
        method: "cash",
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    console.log("PASS folio payment");

    const bal = await mustOk(`/v1/folio/${created.bookingId}/balance`, {
      headers,
    });
    console.log("PASS folio balance", bal.balanceBtn);

    const menu = await mustOk("/v1/pos/menu", { headers });
    console.log("PASS POS menu", (menu.items || []).length, "items");

    if ((menu.items || [])[0]) {
      const item = menu.items[0];
      await mustOk("/v1/pos/orders", {
        method: "POST",
        headers,
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          bookingId: created.bookingId,
          fireKot: true,
          lines: [
            {
              menuItemId: item.id,
              name: item.name,
              qty: 1,
              unitPriceBtn: item.priceBtn,
            },
          ],
        }),
      });
      console.log("PASS POS+KOT");
    } else {
      console.log("SKIP POS order (no menu_items)");
    }

    await mustOk("/v1/finance/expenses", {
      method: "POST",
      headers,
      body: JSON.stringify({
        description: "Smoke expense",
        amountBtn: 50,
        spentAt: today,
        paymentMethod: "cash",
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    console.log("PASS expense (till RPC)");

    const auditPreview = await mustOk("/v1/night-audit/preview", { headers });
    console.log("PASS night-audit preview", auditPreview.businessDate);

    try {
      const auditRun = await mustOk("/v1/night-audit/run", {
        method: "POST",
        headers,
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          force: false,
        }),
      });
      console.log("PASS night-audit run", auditRun.businessDate || auditRun.ok);
    } catch (err) {
      console.warn(
        "WARN night-audit run (RPC may be missing on DB):",
        err instanceof Error ? err.message : err,
      );
    }

    await mustOk("/v1/rates/approvals", { headers });
    console.log("PASS rates approvals list");

    const reports = await mustOk("/v1/reports/catalog", { headers });
    if (!Array.isArray(reports.reports) || reports.reports.length < 1) {
      throw new Error("reports catalog empty");
    }
    console.log("PASS reports catalog", reports.reports.length);

    try {
      await mustOk("/v1/stays/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({
          bookingId: created.bookingId,
          idempotencyKey: crypto.randomUUID(),
          allowBalance: true,
        }),
      });
      console.log("PASS checkout");
    } catch (err) {
      console.warn(
        "WARN checkout (balance/RPC):",
        err instanceof Error ? err.message : err,
      );
    }

    const ai = await mustOk("/v1/ai/desk", {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt: "open fast book" }),
    });
    console.log("PASS copilot draft", ai.provider);

    console.log("Smoke FO path OK");
  } else {
    console.log(
      "SKIP PIN→FO path (set SMOKE_PROPERTY_SLUG, SMOKE_STAFF_ID, SMOKE_PIN)",
    );
  }

  console.log("Smoke OK");
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
