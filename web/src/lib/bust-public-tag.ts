import { revalidateTag as nextRevalidateTag } from "next/cache";

/** Next 16 requires a cache life profile; "max" busts immediately. */
export function bustPublicTag(tag: string) {
  nextRevalidateTag(tag, "max");
}
