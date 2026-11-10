/** Desk cold acrylic — ivory / espresso / brass (aligned with Innora desk tokens). */
export const NeoSpatialTokens = {
  colors: {
    ivory: "#F8FAFC",
    ivorySoft: "#FFFFFF",
    ivoryDeep: "#E2E8F0",
    espresso: "#0F172A",
    espressoSoft: "#1E293B",
    espressoMute: "#64748B",
    brass: "#D97706",
    brassSoft: "#F59E0B",
    emerald: "#059669",
    crimson: "#DC2626",
    lapis: "#2563EB",
    // legacy aliases (avoid purple)
    obsidianVoid: "#0F172A",
    obsidianElevated: "#1E293B",
    laserIndigo: "#2563EB",
    laserViolet: "#2563EB",
    hyperEmerald: "#059669",
    luminousAmber: "#D97706",
    neonCrimson: "#DC2626",
    saffronGold: "#F59E0B",
  },
  springs: {
    snappy: { stiffness: 400, damping: 25 },
    fluid: { stiffness: 350, damping: 28 },
    gentle: { stiffness: 220, damping: 24 },
  },
  layout: {
    headerPx: 56,
    railPx: 64,
    drawerPx: 420,
    grid: 8,
  },
} as const;
