"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MenuItem } from "@/lib/menu";
import { formatBtn } from "@/lib/pricing";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

export type MenuLineExtras = {
  lineNotes?: string;
  seatNo?: number;
  isNc?: boolean;
};

const SEATS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function sellSizeLabel(size: MenuItem["sell_size"]): string | null {
  if (size === "pek") return "Single pour (pek)";
  if (size === "bottle") return "Full bottle";
  if (size === "case") return "Case";
  if (size === "single") return "Single";
  return null;
}

export function MenuTile({
  item,
  onAdd,
  onConfigure,
}: {
  item: MenuItem;
  onAdd: () => void;
  onConfigure: (extras: MenuLineExtras) => void;
}) {
  const soldOut = Boolean(item.sold_out);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const sizeLabel = sellSizeLabel(item.sell_size);
  const stockText = soldOut
    ? "Sold out"
    : item.stock_mode !== "untracked" &&
        (item.stock_label || item.stock_on_hand != null)
      ? (item.stock_label ?? `${item.stock_on_hand} left`)
      : "Stock not tracked";

  return (
    <div className="flex min-w-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={soldOut}
        onClick={onAdd}
        className="h-auto min-h-14 min-w-0 flex-1 flex-col items-stretch justify-center gap-0.5 whitespace-normal rounded-r-none px-2.5 py-1.5 text-left"
        aria-label={
          soldOut
            ? `${item.name}, sold out`
            : `Add ${item.name}, ${formatBtn(item.price_btn)}`
        }
      >
        <span className="line-clamp-2 text-sm font-medium leading-snug">
          {item.name}
        </span>
        <span className="text-xs tabular-nums leading-tight text-muted-foreground">
          {formatBtn(item.price_btn)}
        </span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-auto w-8 shrink-0 self-stretch rounded-l-none border-l-0"
            aria-label={`Details for ${item.name}`}
          >
            <ChevronDownIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{item.name}</DropdownMenuLabel>
          {item.image_src ? (
            <div className="px-2 pb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image_src}
                alt=""
                className="h-16 w-full rounded-md object-cover"
              />
            </div>
          ) : null}
          <DropdownMenuItem disabled>
            {stockText}
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <span className="flex w-full items-center justify-between gap-2">
              GST
              <Badge variant="outline">
                {item.gst_applicable ? "On" : "Off"}
              </Badge>
            </span>
          </DropdownMenuItem>
          {item.is_popular ? (
            <DropdownMenuItem disabled>Popular</DropdownMenuItem>
          ) : null}
          {sizeLabel ? (
            <DropdownMenuItem disabled>{sizeLabel}</DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={soldOut}
            onSelect={() => {
              setNote("");
              setNoteOpen(true);
            }}
          >
            Add note
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={soldOut}>
              Seat
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {SEATS.map((seat) => (
                <DropdownMenuItem
                  key={seat}
                  onSelect={() => onConfigure({ seatNo: seat })}
                >
                  Seat {seat}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            disabled={soldOut}
            onSelect={() => onConfigure({ isNc: true })}
          >
            No charge
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Note · {item.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`note-${item.id}`}>Line note</Label>
            <Input
              id={`note-${item.id}`}
              value={note}
              maxLength={280}
              onChange={(e) => setNote(e.target.value)}
              placeholder="No onion, less spicy"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNoteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const lineNotes = note.trim();
                if (!lineNotes) return;
                onConfigure({ lineNotes });
                setNoteOpen(false);
              }}
            >
              Add with note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
