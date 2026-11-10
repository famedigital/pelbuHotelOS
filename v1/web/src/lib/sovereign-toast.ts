"use client";

import { toast as sonnerToast, type ExternalToast } from "sonner";
import { formatGuestBtn } from "@/lib/pricing";

export interface SovereignToastOptions extends ExternalToast {
  subtitle?: string;
  badge?: string;
}

/**
 * Sovereign Glass Toast Dispatcher
 * Provides high-speed, tactile, micro-animated notifications tailored for Hotel OS Bhutan.
 */
export const sovereignToast = {
  /** Standard success notification with Himalayan emerald glow */
  success(title: string, options?: SovereignToastOptions) {
    return sonnerToast.success(title, {
      description: options?.description || options?.subtitle,
      ...options,
    });
  },

  /** Standard error notification with ruby crimson glow */
  error(title: string, options?: SovereignToastOptions) {
    return sonnerToast.error(title, {
      description: options?.description || options?.subtitle,
      ...options,
    });
  },

  /** Informational note with sapphire cyan glow */
  info(title: string, options?: SovereignToastOptions) {
    return sonnerToast.info(title, {
      description: options?.description || options?.subtitle,
      ...options,
    });
  },

  /** Warning alert with saffron topaz glow */
  warning(title: string, options?: SovereignToastOptions) {
    return sonnerToast.warning(title, {
      description: options?.description || options?.subtitle,
      ...options,
    });
  },

  /** Loading spinner with Himalayan spring animation */
  loading(title: string, options?: SovereignToastOptions) {
    return sonnerToast.loading(title, {
      description: options?.description || options?.subtitle,
      ...options,
    });
  },

  /** Promise resolution with automatic loading -> success / error transitions */
  promise<T>(
    promise: Promise<T> | (() => Promise<T>),
    data: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
      description?: string;
    }
  ) {
    return sonnerToast.promise(promise, data);
  },

  /**
   * Hotel Front-Desk Stay Notification
   * Features high-contrast room badge and guest attribution.
   */
  stay(params: {
    roomLabel?: string | null;
    guestName?: string | null;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
  }) {
    const room = params.roomLabel ? `Room ${params.roomLabel}` : "Front Desk";
    const guest = params.guestName ? ` · ${params.guestName}` : "";

    return sonnerToast.success(params.title, {
      description: params.description || `${room}${guest}`,
      action: params.actionLabel && params.onAction
        ? {
            label: params.actionLabel,
            onClick: params.onAction,
          }
        : undefined,
    });
  },

  /**
   * Hotel Financial / Money Notification
   * Features formatted Nu. currency with high-impact tabular figures.
   */
  money(params: {
    amountBtn: number;
    title: string;
    description?: string;
    isCredit?: boolean;
  }) {
    const formatted = `Nu. ${formatGuestBtn(params.amountBtn)}`;
    const prefix = params.isCredit ? "+ " : "";

    return sonnerToast.success(`${params.title}: ${prefix}${formatted}`, {
      description: params.description || "Folio ledger updated in real-time.",
    });
  },

  /** Dismiss toast by ID or dismiss all */
  dismiss(toastId?: string | number) {
    return sonnerToast.dismiss(toastId);
  },
};

// Re-export base toast from sonner for drop-in compatibility
export { sonnerToast as toast };
