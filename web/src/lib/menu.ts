export type MenuItem = {
  id: string;
  outlet: string;
  category: string;
  name: string;
  description: string | null;
  price_btn: number;
  gst_applicable: boolean;
  sort_order: number;
};
