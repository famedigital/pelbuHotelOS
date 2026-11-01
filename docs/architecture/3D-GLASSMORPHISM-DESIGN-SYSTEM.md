# 3D Glassmorphism Enterprise Design System (VisionOS × Himalayan Modern)

> **Audience:** Cursor Composer, UI Implementers, Frontend Engineers.  
> **Scope:** Entire Hotel OS suite — Public Booking (`/book`, `/`), Desk ERP (`/erp`), Staff Portal (`/staff`), Agent Portal (`/agents`).  
> **Design Philosophy:** **"VisionOS spatial depth meets Himalayan jewel tones, engineered with industrial Bloomberg-grade legibility."**

---

## 1. Visual Architecture & 3D Spatial Hierarchy

The interface is built on **4 spatial depth tiers** using hardware-accelerated CSS transforms and specular lighting:

```
┌────────────────────────────────────────────────────────────────────────┐
│ LEVEL 3: 3D SPATIAL & TILT LAYER                                      │
│ • Interactive 3D Room Canvases (Three.js / R3F)                        │
│ • Dynamic 3D Card Hover Tilt (perspective: 1000px)                     │
│ • Floating Action Pills & Contextual Glass Popovers                    │
├────────────────────────────────────────────────────────────────────────┤
│ LEVEL 2: ELEVATED ACRYLIC SHEETS & MODALS                              │
│ • StayHub Drawer, POS Checkout Sheet, Guest Registration Dialog        │
│ • Frosted blur: 20px, specular rim light, ambient chromatic glow       │
├────────────────────────────────────────────────────────────────────────┤
│ LEVEL 1: STRUCTURAL GLASS PANELS & WIDGETS                             │
│ • KPI Metric Cards, Sidebar Navigation Rail, Module Tabs               │
│ • Frosted blur: 12px, tinted refraction border, high text contrast     │
├────────────────────────────────────────────────────────────────────────┤
│ LEVEL 0: AMBIENT DEEP CANVAS                                           │
│ • Dark Himalayan Dusk gradient (Rich Obsidian to Deep Sapphire-Slate)  │
│ • Subtle chromatic radial mesh lights (Gold, Emerald, Lapis glow)     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Vibrant Enterprise Color Palette (Himalayan Jewel Ramps)

Enterprise glassmorphism must **never look washed out or grey**. We use saturated Himalayan chromatic accents with glowing glass boundaries:

| Color Identity | Hex / HSL | Glass Border Accent | Enterprise Usage |
| :--- | :--- | :--- | :--- |
| **Sovereign Gold / Brass** | `#F59E0B` / `#D97706` | `rgba(245, 158, 11, 0.35)` | VIP guests, agreed agent rates, primary CTA buttons |
| **Emerald Pine (Success)** | `#10B981` / `#059669` | `rgba(16, 185, 129, 0.35)` | Clean room status, settled folios, positive cashflow |
| **Himalayan Lapis (Brand)**| `#3B82F6` / `#1D4ED8` | `rgba(59, 130, 246, 0.35)` | In-house stays, direct bookings, system metrics |
| **Punakha Ruby (Alert)**   | `#EF4444` / `#DC2626` | `rgba(239, 68, 68, 0.40)` | Dirty rooms, overdue folios, failed payments |
| **Dusk Violet (Executive)**| `#8B5CF6` / `#6D28D9` | `rgba(139, 92, 246, 0.35)` | Tour operator groups, night audit summaries |
| **Obsidian Slate (Base)**  | `#0A0E17` / `#111827` | `rgba(255, 255, 255, 0.08)`| Background foundation and data card base |

---

## 3. Production CSS Tokens (`web/src/app/globals.css`)

Add these production-ready tokens and utility classes:

```css
@layer base {
  :root {
    /* --- 3D Glass Light Theme --- */
    --glass-bg: rgba(255, 255, 255, 0.75);
    --glass-border: rgba(255, 255, 255, 0.6);
    --glass-specular: inset 0 1px 1px 0 rgba(255, 255, 255, 0.85);
    --glass-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.03);
    --glass-blur: 16px;

    /* Chromatic Ambient Light Mesh */
    --ambient-glow-brand: radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.12) 0%, transparent 60%);
    --ambient-glow-gold: radial-gradient(circle at 100% 100%, rgba(245, 158, 11, 0.08) 0%, transparent 50%);
  }

  .dark {
    /* --- 3D Glass Dark Theme (Himalayan Dusk) --- */
    --glass-bg: rgba(15, 23, 42, 0.68);
    --glass-border: rgba(255, 255, 255, 0.12);
    --glass-specular: inset 0 1px 1px 0 rgba(255, 255, 255, 0.2);
    --glass-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
    --glass-blur: 18px;

    --ambient-glow-brand: radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.18) 0%, transparent 65%);
    --ambient-glow-gold: radial-gradient(circle at 100% 100%, rgba(245, 158, 11, 0.12) 0%, transparent 55%);
  }
}

/* =========================================================================
   Universal 3D Glass Utility Classes
   ========================================================================= */

/* Primary Glass Card (Panels, KPIs, Summaries) */
.glass-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-specular), var(--glass-shadow);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-radius: 1rem;
  transform: translateZ(0); /* Hardware accelerated */
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;
}

.glass-card:hover {
  box-shadow: var(--glass-specular), 0 20px 40px -10px rgba(0, 0, 0, 0.18), 0 0 20px rgba(59, 130, 246, 0.15);
}

/* Elevated Glass (Modals, StayHub Drawer, Floating Toolbars) */
.glass-elevated {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-specular), 0 25px 60px -15px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 1.25rem;
  transform: translateZ(0);
}

/* Glowing Status Badges */
.glass-badge-clean {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: #10B981;
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.2);
}

.glass-badge-dirty {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #EF4444;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.2);
}

.glass-badge-vip {
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.45);
  color: #F59E0B;
  box-shadow: 0 0 14px rgba(245, 158, 11, 0.25);
}
```

---

## 4. Micro-3D Interactive Tilt Effect (Reusable React Component)

For cards on `/book`, dashboard KPI widgets, and marketing rooms, use this ultra-smooth 60 FPS tilt component (`web/src/components/ui/GlassTiltCard.tsx`):

```tsx
"use client";

import React, { useRef, useState } from "react";

interface GlassTiltCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: "gold" | "brand" | "emerald" | "ruby";
}

export function GlassTiltCard({ children, className = "", glowColor = "brand" }: GlassTiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const glowStyles = {
    brand: "hover:border-blue-500/40 hover:shadow-blue-500/20",
    gold: "hover:border-amber-500/40 hover:shadow-amber-500/20",
    emerald: "hover:border-emerald-500/40 hover:shadow-emerald-500/20",
    ruby: "hover:border-red-500/40 hover:shadow-red-500/20",
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Subtle 3D tilt (max 8 degrees)
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;

    setRotate({ x: rotateX, y: rotateY });
    setGlare({ x: (x / rect.width) * 100, y: (y / rect.height) * 100, opacity: 0.18 });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
    setGlare({ x: 50, y: 50, opacity: 0 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) translateZ(0)`,
        transition: "transform 0.15s ease-out, box-shadow 0.2s ease",
      }}
      className={`glass-card relative overflow-hidden transition-all duration-300 ${glowStyles[glowColor]} ${className}`}
    >
      {/* Specular Glare Overlay */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.4) 0%, transparent 65%)`,
          opacity: glare.opacity,
        }}
      />
      {children}
    </div>
  );
}
```

---

## 5. Enterprise Guardrail: The "High-Density Data" Exception

Hoteliers cannot read blurry numbers on a busy Friday night. Follow this strict operational rule:

1. **Calendar Rack Cells & Ledger Tables (`/erp/calendar`, `/erp/invoices`):**
   - **DO NOT** make individual table cells or rows translucent glass.
   - The outer container, header tabs, and floating summary pills are glass.
   - The cell bodies remain **opaque high-contrast surfaces** with distinct status borders (clean/dirty/occupied) so text is 100% legible under bright sunlight or dim night shifts.
2. **Text Contrast Guarantee:**
   - Any text rendered on a glass panel must have an explicit opacity-compensated color (e.g. `text-slate-900 dark:text-white` with `font-medium` or `font-semibold`). Thin/hairline gray fonts over glass are **strictly forbidden**.
