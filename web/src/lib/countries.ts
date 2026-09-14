/** ISO 3166-1 alpha-2 codes for guest nationality Combobox. */

export type CountryOption = {
  code: string;
  name: string;
  pinned?: boolean;
};

/** Bhutan + common inbound markets — shown first in Combobox. */
export const PINNED_COUNTRY_CODES = [
  "BT",
  "IN",
  "US",
  "GB",
  "DE",
  "FR",
  "JP",
  "CN",
  "TH",
  "SG",
  "AU",
  "BD",
  "NP",
] as const;

const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan",
  AL: "Albania",
  DZ: "Algeria",
  AR: "Argentina",
  AM: "Armenia",
  AU: "Australia",
  AT: "Austria",
  AZ: "Azerbaijan",
  BD: "Bangladesh",
  BY: "Belarus",
  BE: "Belgium",
  BT: "Bhutan",
  BO: "Bolivia",
  BA: "Bosnia and Herzegovina",
  BR: "Brazil",
  BN: "Brunei",
  BG: "Bulgaria",
  KH: "Cambodia",
  CM: "Cameroon",
  CA: "Canada",
  CL: "Chile",
  CN: "China",
  CO: "Colombia",
  CR: "Costa Rica",
  HR: "Croatia",
  CU: "Cuba",
  CY: "Cyprus",
  CZ: "Czechia",
  DK: "Denmark",
  EC: "Ecuador",
  EG: "Egypt",
  EE: "Estonia",
  ET: "Ethiopia",
  FI: "Finland",
  FR: "France",
  GE: "Georgia",
  DE: "Germany",
  GH: "Ghana",
  GR: "Greece",
  GT: "Guatemala",
  HK: "Hong Kong",
  HU: "Hungary",
  IS: "Iceland",
  IN: "India",
  ID: "Indonesia",
  IR: "Iran",
  IQ: "Iraq",
  IE: "Ireland",
  IL: "Israel",
  IT: "Italy",
  JP: "Japan",
  JO: "Jordan",
  KZ: "Kazakhstan",
  KE: "Kenya",
  KR: "Korea, Republic of",
  KW: "Kuwait",
  LA: "Laos",
  LV: "Latvia",
  LB: "Lebanon",
  LT: "Lithuania",
  LU: "Luxembourg",
  MO: "Macao",
  MY: "Malaysia",
  MV: "Maldives",
  MX: "Mexico",
  MN: "Mongolia",
  MA: "Morocco",
  MM: "Myanmar",
  NP: "Nepal",
  NL: "Netherlands",
  NZ: "New Zealand",
  NG: "Nigeria",
  NO: "Norway",
  OM: "Oman",
  PK: "Pakistan",
  PA: "Panama",
  PE: "Peru",
  PH: "Philippines",
  PL: "Poland",
  PT: "Portugal",
  QA: "Qatar",
  RO: "Romania",
  RU: "Russia",
  SA: "Saudi Arabia",
  RS: "Serbia",
  SG: "Singapore",
  SK: "Slovakia",
  SI: "Slovenia",
  ZA: "South Africa",
  ES: "Spain",
  LK: "Sri Lanka",
  SE: "Sweden",
  CH: "Switzerland",
  TW: "Taiwan",
  TZ: "Tanzania",
  TH: "Thailand",
  TR: "Turkey",
  UA: "Ukraine",
  AE: "United Arab Emirates",
  GB: "United Kingdom",
  US: "United States",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  VE: "Venezuela",
  VN: "Vietnam",
  YE: "Yemen",
  ZM: "Zambia",
  ZW: "Zimbabwe",
};

const pinnedSet = new Set<string>(PINNED_COUNTRY_CODES);

/** All countries for Combobox — pinned first, then alphabetical. */
export function countryOptions(): CountryOption[] {
  const pinned: CountryOption[] = PINNED_COUNTRY_CODES.map((code) => ({
    code,
    name: COUNTRY_NAMES[code] ?? code,
    pinned: true,
  }));

  const rest = Object.entries(COUNTRY_NAMES)
    .filter(([code]) => !pinnedSet.has(code))
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([code, name]) => ({ code, name }));

  return [...pinned, ...rest];
}

export function countryComboboxOptions(): { value: string; label: string; hint?: string }[] {
  return countryOptions().map((c) => ({
    value: c.name,
    label: c.name,
    hint: c.pinned ? c.code : undefined,
  }));
}

export function nationalityRequired(origin: string): boolean {
  return origin === "international" || origin === "regional";
}
