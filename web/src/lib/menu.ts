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
};
