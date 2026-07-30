const baseUrl = (process.env.UAT_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);

const publicChecks = [
  ["/", "Pelbu"],
  ["/rooms", "Rooms"],
  ["/rooms/deluxe", "Deluxe Suite"],
  ["/book", "Book"],
  ["/menu", "add dishes and order for pickup"],
  ["/faq", "answer"],
  ["/guide", "Useful before you arrive"],
  ["/guide/choosing-olakha-for-a-thimphu-stay", "Choosing Olakha"],
  ["/agents/login", "Agent"],
  ["/login", "Work"],
  ["/staff/login", "Staff"],
  ["/offline.html", "offline"],
  ["/work-offline.html", "offline"],
];

async function checkPage(path, marker) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "follow",
    headers: { "user-agent": "Pelbu-UAT/1.0" },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${path}: expected 2xx, received ${response.status}`);
  }
  if (!body.toLowerCase().includes(marker.toLowerCase())) {
    throw new Error(`${path}: missing marker "${marker}"`);
  }
  console.log(`PASS ${path} (${response.status})`);
}

async function checkAsset(path, contentType) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`${path}: expected 2xx, received ${response.status}`);
  }
  const actual = response.headers.get("content-type") || "";
  if (!actual.includes(contentType)) {
    throw new Error(`${path}: expected ${contentType}, received ${actual}`);
  }
  console.log(`PASS ${path} (${actual})`);
}

async function main() {
  console.log(`Pelbu smoke UAT: ${baseUrl}`);
  for (const check of publicChecks) await checkPage(...check);
  await checkAsset("/manifest.webmanifest", "json");
  await checkAsset("/staff.webmanifest", "json");
  await checkAsset("/work.webmanifest", "json");
  await checkAsset("/pelbu-sw.js", "javascript");
  await checkAsset("/staff-sw.js", "javascript");
  await checkAsset("/work-sw.js", "javascript");

  const sitemap = await fetch(`${baseUrl}/sitemap.xml`).then((response) =>
    response.text(),
  );
  for (const path of ["/rooms/deluxe", "/guide/choosing-olakha"]) {
    if (!sitemap.includes(path)) {
      throw new Error(`/sitemap.xml: missing ${path}`);
    }
  }
  console.log("PASS /sitemap.xml dynamic content");
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
