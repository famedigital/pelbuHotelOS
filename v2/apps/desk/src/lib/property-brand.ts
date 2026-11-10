import type { RoomTypeCode } from "./commercial-store";

/** Property identity for rate sheets / print (seed; Settings later). */
export type PropertyBrand = {
  propertyId: string;
  name: string;
  legalName: string;
  tagline: string;
  addressLines: string[];
  phone: string;
  email: string;
  website: string;
  /** Public logo URL or data URL */
  logoUrl: string;
  /** Dzongkhag / city for footer */
  locality: string;
};

export type RoomTypeMedia = {
  typeCode: RoomTypeCode;
  label: string;
  /** 0–N photo URLs; empty → print placeholder */
  photos: string[];
};

const PELBU_LOGO =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none">
      <rect width="80" height="80" rx="16" fill="#1a0f0a"/>
      <path d="M40 14 L62 52 H18 Z" fill="#e8a838"/>
      <circle cx="40" cy="44" r="8" fill="#fff6ea"/>
    </svg>`,
  );

/** Demo Himalayan room photos (Unsplash) — replace in Settings later */
const DEMO_PHOTOS = {
  deluxe: [
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80",
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80",
  ],
  valley: [
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80",
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  ],
  exec: [
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80",
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80",
  ],
} as const;

export const DEFAULT_PROPERTY_BRAND: PropertyBrand = {
  propertyId: "pelbu-olakha",
  name: "Pelbu Suites",
  legalName: "Pelbu Suites Olakha",
  tagline: "Boutique stay · Olakha · Thimphu",
  addressLines: [
    "Next to Number 7 Building / Asha Bakery",
    "Olakha, Thimphu",
    "Kingdom of Bhutan",
  ],
  phone: "+975 1619 3410",
  email: "pelbusuites@gmail.com",
  website: "https://www.pelbusuites.bt",
  logoUrl:
    "https://res.cloudinary.com/hkkchsfy/image/upload/w_140,h_140,c_fit,f_png,q_auto/pelbu/brand/h2q193tfpc5qrgchfjj1",
  locality: "Thimphu",
};

export const DEFAULT_ROOM_MEDIA: RoomTypeMedia[] = [
  { typeCode: "deluxe_queen", label: "Deluxe Queen", photos: [...DEMO_PHOTOS.deluxe] },
  { typeCode: "deluxe_king", label: "Deluxe King", photos: [...DEMO_PHOTOS.deluxe].reverse() },
  { typeCode: "deluxe_twin", label: "Deluxe Twin", photos: [...DEMO_PHOTOS.valley] },
  { typeCode: "suite", label: "Pelbu Suite", photos: [...DEMO_PHOTOS.exec] },
];

let brandState: PropertyBrand = { ...DEFAULT_PROPERTY_BRAND };
let mediaState: RoomTypeMedia[] = DEFAULT_ROOM_MEDIA.map((m) => ({
  ...m,
  photos: [...m.photos],
}));

export function getPropertyBrand(): PropertyBrand {
  return { ...brandState, addressLines: [...brandState.addressLines] };
}

export function setPropertyBrand(patch: Partial<PropertyBrand>): PropertyBrand {
  brandState = {
    ...brandState,
    ...patch,
    addressLines: patch.addressLines ?? brandState.addressLines,
  };
  return getPropertyBrand();
}

export function getRoomTypeMedia(): RoomTypeMedia[] {
  return mediaState.map((m) => ({ ...m, photos: [...m.photos] }));
}

export function setRoomTypePhotos(
  typeCode: RoomTypeCode,
  photos: string[],
): void {
  mediaState = mediaState.map((m) =>
    m.typeCode === typeCode ? { ...m, photos: [...photos] } : m,
  );
}

export function photosForType(typeCode: RoomTypeCode): string[] {
  return mediaState.find((m) => m.typeCode === typeCode)?.photos ?? [];
}
