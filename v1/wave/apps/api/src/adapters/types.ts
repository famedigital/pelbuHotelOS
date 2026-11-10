import type { HotelOsSupabase } from "@hotel-os/db";
import type { DeskJwt } from "../auth.js";

export type AdapterCtx = {
  admin: HotelOsSupabase;
  jwt: DeskJwt;
};
