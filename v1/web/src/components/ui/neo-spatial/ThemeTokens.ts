/**
 * Hotel OS Bhutan v2 - Neo-Spatial Theme Tokens
 * Hyper-modern design system tokens optimized for GPU rasterization.
 *
 * Implements:
 * - Obsidian Void (Ultra-Deep Pitch Dark #030712)
 * - Liquid Ceramic (Pure High-Index Alabaster #FAFAFC)
 * - Specular sub-pixel 1px laser borders and hardware-accelerated ambient glows.
 */

export const NeoSpatialTokens = {
  colors: {
    // Canvas Bases
    obsidianVoid: "#030712",
    obsidianElevated: "#080B14",
    obsidianGlass: "rgba(10, 14, 26, 0.65)",
    
    ceramicBase: "#FAFAFC",
    ceramicElevated: "#FFFFFF",
    ceramicGlass: "rgba(255, 255, 255, 0.82)",

    // Luminous Jewel Accents (GPU Blended)
    laserIndigo: "#6366F1",
    laserViolet: "#8B5CF6",
    hyperEmerald: "#10B981",
    luminousAmber: "#F59E0B",
    neonCrimson: "#F43F5E",
    saffronGold: "#FBBF24",
  },
  
  glass: {
    // Inset 1px laser border with top specular highlight
    darkBorder: "border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]",
    lightBorder: "border border-slate-200/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]",
    
    // Multi-tier elevation drop shadows
    darkElevation: "shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)]",
    lightElevation: "shadow-[0_12px_32px_-8px_rgba(15,23,42,0.08)]",
    
    // GPU Compositing filter
    blurStyle: "backdrop-blur-2xl backdrop-saturate-[180%]",
  },

  springs: {
    snappy: { stiffness: 400, damping: 25 },
    fluid: { stiffness: 350, damping: 28 },
    gentle: { stiffness: 220, damping: 24 },
  },
} as const;
