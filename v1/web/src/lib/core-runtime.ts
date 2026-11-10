import "server-only";

import { configureCore } from "@hotel-os/core/runtime";
import { verifyManagerPinForProperty } from "@/lib/manager-pin";

/**
 * Registers Innora services that `@hotel-os/core` cannot own (manager PIN
 * verification needs Next env + staff auth). Imported for side effect by every
 * server shim that re-exports core money code, so period-lock overrides keep
 * working exactly as before the move.
 */
configureCore({ verifyManagerPin: verifyManagerPinForProperty });
