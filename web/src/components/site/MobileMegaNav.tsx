"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { MegaMenu } from "@/lib/mega-menu";
import { cn } from "@/lib/utils";
import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type Props = {
  menus: MegaMenu[];
  overHero?: boolean;
  navText?: string;
  className?: string;
};

/** Phone accordion mega — Rooms / Dine / Wellness / Meetings / About. */
export function MobileMegaNav({
  menus,
  overHero,
  navText,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-md transition-colors lg:hidden",
            overHero
              ? "text-inherit hover:bg-white/15"
              : "text-cedar-ink hover:bg-juniper/8",
            className,
          )}
          style={overHero && navText ? { color: navText } : undefined}
          aria-label="Open site menu"
        >
          <MenuIcon className="size-5" aria-hidden />
        </button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-[min(100vw,22rem)] gap-0 border-cedar-rule bg-mist-0 p-0 sm:max-w-sm"
      >
        <SheetHeader className="border-b border-cedar-rule px-5 py-4 text-left">
          <SheetTitle className="font-display text-xl text-cedar-ink">
            Explore Pelbu
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Rooms, dining, wellness, meetings and more.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-2 pb-6 pt-2">
          <Accordion type="multiple" className="w-full">
            {menus.map((menu) => (
              <AccordionItem
                key={menu.label}
                value={menu.label}
                className="border-cedar-rule px-2"
              >
                <AccordionTrigger className="py-3.5 text-[15px] font-semibold text-cedar-ink hover:no-underline">
                  {menu.label}
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <ul className="space-y-0.5">
                    {menu.primary.flatMap((group) =>
                      group.items.map((item) => (
                        <li key={`${menu.label}-${item.href}`}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className="flex min-h-11 items-center rounded-md px-3 text-sm text-foreground hover:bg-mist-1 hover:text-juniper"
                          >
                            {item.title}
                          </Link>
                        </li>
                      )),
                    )}
                    {menu.secondary.flatMap((group) =>
                      group.items.map((item) => (
                        <li key={`${menu.label}-s-${item.href}`}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className="flex min-h-10 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-mist-1 hover:text-juniper"
                          >
                            {item.title}
                          </Link>
                        </li>
                      )),
                    )}
                  </ul>
                  <Link
                    href={menu.feature.href}
                    onClick={() => setOpen(false)}
                    className="mt-3 flex min-h-11 items-center justify-center rounded-md bg-ember px-4 text-sm font-semibold text-white transition-transform hover:bg-ember-deep motion-safe:hover:-translate-y-0.5"
                  >
                    {menu.feature.ctaLabel}
                  </Link>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="mt-auto flex gap-2 border-t border-cedar-rule p-4">
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-cedar-rule bg-white text-sm font-semibold text-cedar-ink"
          >
            Login
          </Link>
          <Link
            href="/book"
            onClick={() => setOpen(false)}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-ember text-sm font-semibold text-white transition-transform hover:bg-ember-deep motion-safe:hover:-translate-y-0.5"
          >
            Book
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
