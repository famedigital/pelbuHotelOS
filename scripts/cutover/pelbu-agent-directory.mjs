/**
 * Canonical travel-agent names for Pelbu rack codes.
 * Rejects room-number / junk names scraped from sheet cells.
 */

export const AGENT_DIRECTORY = {
  ST: "SOULTRIPS",
  SOULTRIPS: "SOULTRIPS",
  TL: "Travel & Living",
  TNL: "Travel & Living",
  LB: "Little Bhutan",
  YH: "Yak Holidays",
  YD: "Yak Holidays",
  YHI: "Yak Holidays International",
  JDMC: "Journey DMC",
  JDMCB: "Journey DMC",
  BBT: "Bhutan - Bhutan Travel",
  BBTT: "Backcountry Bhutan Tours and Treks",
  BBTGUIDE: "Bhutan - Bhutan Travel (Guide)",
  BV: "Bespoke Voyages",
  ETT: "Ecclesia Tours & Treks",
  WIG: "Walk-in Guest",
  WIH: "Walk-in Guest",
  TB: "Trekking-in-Bhutan",
  TIB: "Trekking-in-Bhutan",
  SPJ: "Sacred Peaks Journeys",
  DB: "Destiny Bhutan",
  BTB: "Back To Bhutan Tours",
  DTT: "Dainty Tours & Travels",
  EB: "Experience Bhutan",
  KT: "Kuenga Tours",
  KTT: "Karma Tours & Travels",
  SK: "Sacred Kingdom",
  ADT: "AD Tours",
  AD: "AD Tours & Travels",
  ADH: "Amazing Dragon Holidays",
  SHA: "Southeast Himalaya Adventures",
  WGA: "We Go Authentic",
  TP: "Trinpa",
  BE: "Bhutan Exposure",
  LF: "Lhoden Foundation",
  VA: "Vacation Adda",
  BT: "Byways Tours",
  BTE: "Bhutan Travel Experts",
  BFT: "Bhutan Frontline Travels",
  CEO: "Silver Pine Tours",
  SP: "Silver Pine Tours",
  TFT: "Travel Finder Tour",
  ETH: "Excursion to Himalayas",
  FFB: "Flying-Fox Bhutan",
  GBT: "Good Morning Bhutan Travelers",
  GD: "Glimpse of Drukyul",
  GOD: "Glimpse of Drukyul",
  MD: "Medieval Bhutan",
  MHT: "Maya Himalaya Travels",
  OBT: "Only Bhutan Tour",
  PCAL: "Penden Cement Authority",
  SBTT: "Sri Balaji Tour and Travels",
  SSAT: "Soul-Search Adventure Tours",
  TT: "Trikaya Travel",
  YYT: "Yak and Yeti Travels",
  CVTT: "Crane Valley Tours & Treks",
  CVT: "Crane Valley Tours & Treks",
  ABTT: "Active Bhutan Tours & Treks",
  AITT: "Alliance International Tours and Travels",
  AVT: "Aaraya Village Tours",
  BD: "Bhutan DAGO / Travel 24",
  BHT: "Bhutan Holidays",
  BK: "BK Tours and Travels",
  BMTA: "Bhutan Mystical Tours & Adventure",
  BPY: "Bhutan Pema Yoedling",
  BRTT: "Bhutan Riwong Tour and Travels",
  BTJ: "BodhiTrail Journeys",
  BYTT: "Bhutan Yeegaa Tours & Treks",
  CD: "Unknown / incomplete",
  DAGO: "Bhutan DAGO",
  DC: "Dungsam Cement",
  DST: "Druk Sakura Tours",
  GX: "GoXimbo",
  HA: "Hotel Asura",
  HX: "Heritage Xplorer",
  KTD: "Khenpo Tenzin Dorji",
  MILE: "Miles with BTW",
  PW: "Peam Wangdi",
  RTT: "Ren Tours & Treks",
  TBT: "Tandin Bhutan Travel",
  UNI: "UNI ASIA",
  VIP: "Kuenshey Tours",
  BTB: "Back To Bhutan Tours",
};

function looksLikeRoomNumber(name) {
  const s = String(name || "").trim();
  if (!s) return true;
  if (/^\d{3}([\/,]\s*\d{3})*$/.test(s)) return true;
  if (/^\d+$/.test(s)) return true;
  if (/^(tentative|note|hold|cancelled|\.\.|manual bill)/i.test(s)) return true;
  if (/^agent\s*name\s*:/i.test(s)) return false; // will clean below
  return false;
}

function cleanScrapedName(name) {
  let s = String(name || "")
    .replace(/\u00a0/g, " ")
    .replace(/^agent\s*names?\s*:\s*/i, "")
    .replace(/^agent\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  // Drop trailing guide phone blobs on the name
  s = s.replace(/\s*Guide:.*$/i, "").trim();
  return s;
}

/**
 * Pick best display name for a rack agent code.
 * @param {string} code
 * @param {string} scrapedName from sheet comment company line
 */
export function resolveAgentName(code, scrapedName = "") {
  const c = String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  if (!c) return "Unknown";

  if (AGENT_DIRECTORY[c]) return AGENT_DIRECTORY[c];

  // Full-name-as-code cells
  const cleanedCode = cleanScrapedName(c);
  if (
    cleanedCode.length > 3 &&
    !/^[A-Z0-9]{2,6}$/.test(c) &&
    !looksLikeRoomNumber(cleanedCode)
  ) {
    return cleanedCode.replace(/\b\w/g, (ch) => ch.toUpperCase()).slice(0, 120);
  }

  const scraped = cleanScrapedName(scrapedName);
  if (scraped && !looksLikeRoomNumber(scraped) && scraped.toUpperCase() !== c) {
    // Prefer directory match on scraped
    const key = scraped.toUpperCase();
    for (const [k, v] of Object.entries(AGENT_DIRECTORY)) {
      if (key.includes(k) && k.length >= 2) return v;
    }
    if (/soul\s*trips?/i.test(scraped)) return "SOULTRIPS";
    if (/little\s*bhutan/i.test(scraped)) return "Little Bhutan";
    if (/journey\s*dmc/i.test(scraped)) return "Journey DMC";
    if (/yak\s*holidays?/i.test(scraped)) return "Yak Holidays";
    if (/walk[\s-]*in/i.test(scraped)) return "Walk-in Guest";
    return scraped.slice(0, 120);
  }

  return c;
}

export function isJunkAgentCode(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return true;
  if (c === ".." || c === "." || c === "-" || c === "NOTE" || c === "CD") return true;
  if (/^AGENT NAME/.test(c)) return false; // keep but rename
  return false;
}
