import type { MenuItem } from "@/lib/menu";
import { loadMenuByOutlets } from "@/lib/menu-loader";
import { loadPublicRooms, type PublicRoom } from "@/lib/public-content";

export type HomeShowcase = {
  rooms: PublicRoom[];
  restaurant: MenuItem[];
  cafe: MenuItem[];
  pastry: MenuItem[];
  counts: {
    rooms: number;
    restaurant: number;
    cafe: number;
    pastry: number;
    bar: number;
    orderable: number;
  };
};

/** Popular dishes first, then menu order — used for the homepage teasers. */
function highlight(items: MenuItem[], outlet: string, take: number): MenuItem[] {
  return items
    .filter((item) => item.outlet === outlet)
    .sort((a, b) => {
      const popular = Number(Boolean(b.is_popular)) - Number(Boolean(a.is_popular));
      return popular !== 0 ? popular : a.sort_order - b.sort_order;
    })
    .slice(0, take);
}

export async function loadHomeShowcase(): Promise<HomeShowcase> {
  const [rooms, menu] = await Promise.all([
    loadPublicRooms(),
    loadMenuByOutlets(["cafe", "pastry", "restaurant", "bar"]),
  ]);

  const countFor = (outlet: string) =>
    menu.filter((item) => item.outlet === outlet).length;

  return {
    rooms,
    restaurant: highlight(menu, "restaurant", 4),
    cafe: highlight(menu, "cafe", 4),
    pastry: highlight(menu, "pastry", 4),
    counts: {
      rooms: rooms.length,
      restaurant: countFor("restaurant"),
      cafe: countFor("cafe"),
      pastry: countFor("pastry"),
      bar: countFor("bar"),
      orderable:
        countFor("restaurant") + countFor("cafe") + countFor("pastry"),
    },
  };
}
