export type MenuItem = {
  id: string;
  outlet: string;
  category: string;
  name: string;
  description: string | null;
  price_btn: number;
  gst_applicable: boolean;
  sort_order: number;
  image_public_id?: string | null;
  image_src?: string | null;
  is_popular?: boolean;
  prep_station?: "kitchen" | "bar" | "pastry" | "grill" | "cold";
  /** Admin only — never returned by the public loader. */
  is_available?: boolean;
  stock_mode?: "untracked" | "finished_good" | "recipe";
  stock_on_hand?: number | null;
  stock_unit?: string | null;
  sold_out?: boolean;
  stock_inventory_item_id?: string | null;
  stock_qty_per_sale?: number;
  family_id?: string | null;
  sell_size?: "pek" | "bottle" | "single" | "case" | null;
  /** Human label for remaining stock (peks / bottles). */
  stock_label?: string | null;
};
