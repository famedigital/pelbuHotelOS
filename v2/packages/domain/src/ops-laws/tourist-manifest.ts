/** Royal Bhutan Police / Immigration tourist manifest row. */

export type TouristManifestGuest = {
  guestName: string;
  passportOrCid: string;
  nationality: string;
  visaEntryStamp: string | null;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  guideLicenseNo: string | null;
  vehiclePlate: string | null;
};

export function buildTouristManifestCsv(rows: TouristManifestGuest[]): string {
  const header = [
    "Guest",
    "Passport_CID",
    "Nationality",
    "Visa_Entry",
    "Room",
    "CheckIn",
    "CheckOut",
    "Guide_TCR",
    "Vehicle_Plate",
  ].join(",");
  const body = rows.map((r) =>
    [
      csv(r.guestName),
      csv(r.passportOrCid),
      csv(r.nationality),
      csv(r.visaEntryStamp ?? ""),
      csv(r.roomNumber),
      csv(r.checkIn),
      csv(r.checkOut),
      csv(r.guideLicenseNo ?? ""),
      csv(r.vehiclePlate ?? ""),
    ].join(","),
  );
  return [header, ...body].join("\n");
}

function csv(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
  return v;
}
