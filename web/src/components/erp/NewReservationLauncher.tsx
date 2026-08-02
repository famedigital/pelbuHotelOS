"use client";

import {
  FastBookDialog,
  type FastBookDialogProps,
} from "@/components/erp/FastBookDialog";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type FormBundle = Omit<FastBookDialogProps, "open" | "onOpenChange" | "onCreated">;

/**
 * Primary “New reservation” CTA for Reservations. Deep link: ?new=1 opens modal.
 */
export function NewReservationLauncher({
  form,
}: {
  form: FormBundle;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  /** Avoid clobbering StayHub `?booking=` right after a successful create. */
  const skipUrlWriteRef = useRef(false);

  const writeNewParam = useCallback(
    (next: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("new", "1");
      else params.delete("new");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (searchParams.get("new") === "1") setOpen(true);
  }, [searchParams]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (skipUrlWriteRef.current) {
      skipUrlWriteRef.current = false;
      return;
    }
    writeNewParam(next);
  };

  return (
    <>
      <Button
        type="button"
        variant="citrus"
        className="h-11 min-h-11 gap-1.5"
        onClick={() => handleOpenChange(true)}
      >
        <PlusIcon className="size-4" aria-hidden />
        New reservation
      </Button>
      <FastBookDialog
        open={open}
        onOpenChange={handleOpenChange}
        onCreated={() => {
          // StayHubProvider writeUrl already drops `new` and sets `booking`.
          skipUrlWriteRef.current = true;
        }}
        {...form}
      />
    </>
  );
}
