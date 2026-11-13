import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type { Room, Stay } from "../lib/front-office-store";

function activeStayForRoom(
  roomId: string,
  stays: Stay[],
  today: string,
): Stay | undefined {
  return (
    stays.find(
      (s) =>
        s.roomId === roomId &&
        !["cancelled", "no_show", "checked_out"].includes(s.status) &&
        s.checkIn <= today &&
        today < s.checkOut,
    ) ??
    stays.find(
      (s) =>
        s.roomId === roomId &&
        ["confirmed", "held"].includes(s.status) &&
        s.checkIn === today,
    )
  );
}

export type DeskRoomRailProps = {
  rooms: Room[];
  stays: Stay[];
  today: string;
  onOpenStay: (stayId: string) => void;
};

type RailItem = {
  room: Room;
  stay?: Stay;
};

type MenuKind = "assigned" | "empty" | null;

function RailMenuPortal({
  open,
  anchorRef,
  children,
  onClose,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  onClose: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }
    const place = () => {
      const r = anchorRef.current!.getBoundingClientRect();
      setPos({
        top: r.bottom + 4,
        right: Math.max(8, window.innerWidth - r.right),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) {
        onClose();
        return;
      }
      if (
        t.closest("[data-hos-desk-rail-menu]") ||
        t.closest("[data-hos-desk-rail-trigger]")
      ) {
        return;
      }
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="listbox"
      data-hos-desk-rail-menu
      className="hos-desk-room-rail-menu hos-desk-room-rail-menu--portal"
      style={{ top: pos.top, right: pos.right }}
    >
      {children}
    </div>,
    document.body,
  );
}

/**
 * Compact floor inventory — Assigned / Empty only.
 * Check-in chips live on the Desk KPI strip → modal (fewer horizontal rows).
 */
export function DeskRoomRail({
  rooms,
  stays,
  today,
  onOpenStay,
}: DeskRoomRailProps) {
  const [menu, setMenu] = useState<MenuKind>(null);
  const assignedBtnRef = useRef<HTMLButtonElement | null>(null);
  const emptyBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  const assignedRooms: RailItem[] = [];
  const emptyRooms: RailItem[] = [];

  const occupiedRoomIds = new Set<string>();

  for (const room of rooms) {
    const stay = activeStayForRoom(room.id, stays, today);
    if (
      stay &&
      ["confirmed", "held"].includes(stay.status) &&
      stay.checkIn === today &&
      stay.roomId
    ) {
      /* Due check-in — shown via Desk KPI modal, not this rail */
      occupiedRoomIds.add(room.id);
      continue;
    }
    if (stay?.status === "checked_in") {
      assignedRooms.push({ room, stay });
      occupiedRoomIds.add(room.id);
      continue;
    }
    if (stay) {
      occupiedRoomIds.add(room.id);
    }
  }

  for (const room of rooms) {
    if (occupiedRoomIds.has(room.id)) continue;
    if (room.hkStatus === "ooo") continue;
    emptyRooms.push({ room });
  }

  assignedRooms.sort((a, b) => a.room.number.localeCompare(b.room.number));
  emptyRooms.sort((a, b) => {
    const rank = (r: Room) =>
      r.hkStatus === "inspected" || r.hkStatus === "clean"
        ? 0
        : r.hkStatus === "dirty"
          ? 1
          : 2;
    const d = rank(a.room) - rank(b.room);
    return d !== 0 ? d : a.room.number.localeCompare(b.room.number);
  });

  if (assignedRooms.length === 0 && emptyRooms.length === 0) {
    return null;
  }

  return (
    <div
      data-tour="floormap"
      className="hos-desk-room-rail hos-board-chrome shrink-0"
    >
      {assignedRooms.length > 0 ? (
        <div className="hos-desk-room-rail-details">
          <button
            ref={assignedBtnRef}
            type="button"
            data-hos-desk-rail-trigger
            aria-expanded={menu === "assigned"}
            aria-haspopup="listbox"
            className="hos-desk-room-rail-summary hos-desk-room-rail-summary--assigned"
            onClick={() =>
              setMenu((m) => (m === "assigned" ? null : "assigned"))
            }
          >
            Assigned ({assignedRooms.length})
          </button>
          <RailMenuPortal
            open={menu === "assigned"}
            anchorRef={assignedBtnRef}
            onClose={closeMenu}
          >
            {assignedRooms.map(({ room, stay }) => (
              <button
                key={room.id}
                type="button"
                role="option"
                onClick={() => {
                  closeMenu();
                  if (stay) onOpenStay(stay.id);
                }}
                className="hos-desk-room-rail-menu-item"
              >
                <span className="font-mono tabular-nums font-bold">
                  {room.number}
                </span>
                <span className="truncate text-[var(--hos-ink-2)]">
                  {stay?.guestName ?? "In-house"}
                </span>
              </button>
            ))}
          </RailMenuPortal>
        </div>
      ) : null}

      {emptyRooms.length > 0 ? (
        <div className="hos-desk-room-rail-details">
          <button
            ref={emptyBtnRef}
            type="button"
            data-hos-desk-rail-trigger
            aria-expanded={menu === "empty"}
            aria-haspopup="listbox"
            className="hos-desk-room-rail-summary hos-desk-room-rail-summary--empty"
            onClick={() => setMenu((m) => (m === "empty" ? null : "empty"))}
          >
            Empty ({emptyRooms.length})
          </button>
          <RailMenuPortal
            open={menu === "empty"}
            anchorRef={emptyBtnRef}
            onClose={closeMenu}
          >
            {emptyRooms.map(({ room }) => {
              const dirty = room.hkStatus === "dirty";
              return (
                <button
                  key={room.id}
                  type="button"
                  role="option"
                  onClick={() => {
                    closeMenu();
                    toast.message(`Room ${room.number}`, {
                      description: room.hkStatus,
                    });
                  }}
                  className="hos-desk-room-rail-menu-item"
                >
                  <span className="font-mono tabular-nums font-bold">
                    {room.number}
                  </span>
                  <span className="truncate text-[var(--hos-ink-2)]">
                    {dirty ? "Empty · dirty" : room.hkStatus}
                  </span>
                </button>
              );
            })}
          </RailMenuPortal>
        </div>
      ) : null}
    </div>
  );
}
