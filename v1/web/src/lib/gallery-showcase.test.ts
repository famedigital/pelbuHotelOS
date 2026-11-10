import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  amenityKindToFilter,
  buildGalleryChips,
  filterGalleryPhotos,
  galleryChipById,
  normalizeGalleryFilter,
  selectedUnitIdsForFilter,
  uniquePhotosByPublicId,
  type GalleryPhoto,
} from "./gallery-showcase";

const photos: GalleryPhoto[] = [
  {
    id: "1",
    publicId: "pelbu/rooms/twin",
    resourceType: "image",
    posterPublicId: null,
    alt: "Twin",
    caption: null,
    filterIds: ["dt", "west"],
  },
  {
    id: "2",
    publicId: "pelbu/restaurant/dining-room",
    resourceType: "image",
    posterPublicId: null,
    alt: "Dining",
    caption: null,
    filterIds: ["restaurant"],
  },
  {
    id: "3",
    publicId: "pelbu/rooms/twin",
    resourceType: "image",
    posterPublicId: null,
    alt: "Twin dup",
    caption: null,
    filterIds: ["dt"],
  },
];

describe("filterGalleryPhotos", () => {
  it("returns all when filter is all", () => {
    assert.equal(filterGalleryPhotos(photos, "all").length, 3);
  });

  it("keeps photos tagged with the chip", () => {
    const twin = filterGalleryPhotos(photos, "dt");
    assert.equal(twin.length, 2);
    const west = filterGalleryPhotos(photos, "west");
    assert.equal(west.length, 1);
    assert.equal(west[0]?.id, "1");
  });
});

describe("selectedUnitIdsForFilter", () => {
  const units = [
    { id: "a", room_type_code: "dq", facade_side: "east", floor_label: "2" },
    { id: "b", room_type_code: "dt", facade_side: "west", floor_label: "2" },
    { id: "c", room_type_code: "dt", facade_side: "east", floor_label: "3" },
  ];

  it("selects a room type", () => {
    assert.deepEqual(selectedUnitIdsForFilter(units, "dt"), ["b", "c"]);
  });

  it("selects a facade", () => {
    assert.deepEqual(selectedUnitIdsForFilter(units, "east"), ["a", "c"]);
  });
});

describe("buildGalleryChips", () => {
  it("omits chips with no photos and labels rooms from live types", () => {
    const chips = buildGalleryChips({
      photos: uniquePhotosByPublicId(photos),
      rooms: [{ code: "dt", name: "Deluxe Twin", slug: "dt" }],
    });
    assert.deepEqual(
      chips.map((c) => c.id),
      ["all", "dt", "restaurant", "west"],
    );
    assert.equal(chips.find((c) => c.id === "dt")?.href, "/rooms/dt");
    assert.equal(
      chips.find((c) => c.id === "restaurant")?.href,
      "/restaurant",
    );
  });
});

describe("normalizeGalleryFilter", () => {
  it("falls back to all for unknown ids", () => {
    assert.equal(normalizeGalleryFilter("nope", new Set(["dt"])), "all");
    assert.equal(normalizeGalleryFilter("dt", new Set(["dt"])), "dt");
  });
});

describe("amenityKindToFilter", () => {
  it("maps guest-facing spaces", () => {
    assert.equal(amenityKindToFilter("restaurant"), "restaurant");
    assert.equal(amenityKindToFilter("spa"), "spa");
    assert.equal(amenityKindToFilter("steam"), "steam");
    assert.equal(amenityKindToFilter("meeting"), "meeting");
    assert.equal(amenityKindToFilter("cafe"), "cafe");
    assert.equal(amenityKindToFilter("stair"), null);
  });
});

describe("galleryChipById", () => {
  it("falls back to the amenity chip when photos are missing", () => {
    const chips = buildGalleryChips({
      photos: uniquePhotosByPublicId(photos),
      rooms: [{ code: "dt", name: "Deluxe Twin", slug: "dt" }],
    });
    const meeting = galleryChipById("meeting", chips);
    assert.equal(meeting?.label, "Meeting");
    assert.equal(meeting?.href, "/meeting");
  });
});
