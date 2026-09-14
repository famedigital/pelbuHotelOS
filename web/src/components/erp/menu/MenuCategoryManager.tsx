"use client";

import {
  archiveMenuCategory,
  saveMenuCategory,
  type MenuCategoryState,
} from "@/app/actions/erp-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

const initial: MenuCategoryState = { ok: false };

export type MenuCategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export function MenuCategoryManager({
  categories,
}: {
  categories: MenuCategoryRow[];
}) {
  const router = useRouter();
  const [saveState, saveAction, savePending] = useActionState(
    saveMenuCategory,
    initial,
  );
  const [archState, archAction, archPending] = useActionState(
    archiveMenuCategory,
    initial,
  );
  useActionToast(saveState, {
    successMessage: saveState.message ?? "Category saved",
  });
  useActionToast(archState, {
    successMessage: archState.message ?? "Category archived",
  });
  useEffect(() => {
    if (saveState.ok || archState.ok) router.refresh();
  }, [saveState.ok, saveState.message, archState.ok, archState.message, router]);

  const active = categories.filter((c) => c.is_active);
  const archived = categories.filter((c) => !c.is_active);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
      <section className="rounded-xl border bg-card p-4 md:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Categories
        </p>
        <h2 className="mt-1 text-lg font-semibold">Hotel menu categories</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Used on the catalog form and POS grouping. Rename updates existing
          items with the old label.
        </p>
        <ul className="mt-4 space-y-2">
          {active.length === 0 ? (
            <li className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              No categories yet — add Spirits, Beer, Mains…
            </li>
          ) : (
            active.map((cat) => (
              <li
                key={cat.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{cat.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Sort {cat.sort_order}
                  </p>
                </div>
                <form action={archAction}>
                  <input type="hidden" name="category_id" value={cat.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={archPending}
                    className="text-xs"
                  >
                    Archive
                  </Button>
                </form>
              </li>
            ))
          )}
        </ul>
        {archived.length > 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {archived.length} archived (
            {archived.map((c) => c.name).join(", ")})
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border bg-card p-4 md:p-5">
        <h2 className="text-lg font-semibold">Add category</h2>
        <form action={saveAction} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              name="name"
              required
              maxLength={40}
              placeholder="House pours"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-sort">Sort order</Label>
            <Input
              id="cat-sort"
              name="sort_order"
              type="number"
              min={0}
              max={9999}
              defaultValue={0}
            />
          </div>
          {saveState.error ? (
            <Alert variant="destructive">
              <AlertDescription>{saveState.error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" variant="citrus" disabled={savePending} className="w-full">
            {savePending ? "Saving…" : "Add category"}
          </Button>
        </form>
      </section>
    </div>
  );
}
