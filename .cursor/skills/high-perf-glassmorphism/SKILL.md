---
name: high-perf-glassmorphism
description: >-
  Enterprise 3D & modern glassmorphism UI guidelines for Hotel OS.
  Provides high-framerate, GPU-accelerated glass aesthetics for public booking
  and zero-latency, high-contrast acrylic ergonomics for front-desk ERP operations.
  Use when editing UI components, styles, 3D scenes, or visual design tokens.
---

# High-Performance 3D & Glassmorphism Design System

Hotel OS requires a dual-tier UI architecture: **immersive visual elegance** for public booking guests (`/book`, `/`) and **uncompromising 60 FPS speed** for desk operators (`/erp`, `/staff`).

---

## 1. The Dual-Tier Rule

| Surface | Allowed Glass & 3D | Performance Rule |
| :--- | :--- | :--- |
| **Public Booking (`/book`, `/`)** | Full 3D room exploration, frosted glass cards, subtle specular reflections, dynamic depth gradients | Lazy-loaded Three.js (`ssr: false`), `frameloop="demand"`, GPU hardware acceleration |
| **Desk ERP (`/erp`, `/staff`)** | "Cold Acrylic" — translucent elevated headers, action sheets, floating bars | **NEVER** apply `backdrop-filter: blur()` to data tables, calendar racks (`/erp/calendar`), or POS grids |

---

## 2. Core Glass Design Tokens (`globals.css`)

Always use hardware-composited CSS variables. Do not hardcode arbitrary `backdrop-blur-[24px]` utility chains.

```css
:root {
  /* High-Performance Cold Glass Tokens */
  --glass-surface-light: rgba(255, 255, 255, 0.72);
  --glass-surface-dark: rgba(18, 22, 28, 0.65);
  --glass-border-light: rgba(255, 255, 255, 0.45);
  --glass-border-dark: rgba(255, 255, 255, 0.08);
  --glass-specular-light: inset 0 1px 1px 0 rgba(255, 255, 255, 0.6);
  --glass-specular-dark: inset 0 1px 1px 0 rgba(255, 255, 255, 0.12);
  --glass-blur-radius: 12px;
}

/* Glass Utility Classes */
.glass-panel {
  background: var(--glass-surface-light);
  border: 1px solid var(--glass-border-light);
  box-shadow: var(--glass-specular-light), 0 8px 32px 0 rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(var(--glass-blur-radius));
  -webkit-backdrop-filter: blur(var(--glass-blur-radius));
  transform: translateZ(0); /* Force GPU compositing */
}

.dark .glass-panel {
  background: var(--glass-surface-dark);
  border: 1px solid var(--glass-border-dark);
  box-shadow: var(--glass-specular-dark), 0 8px 32px 0 rgba(0, 0, 0, 0.35);
}
```

---

## 3. High-Performance 3D Guidelines (`@react-three/fiber`)

When rendering 3D spatial room models or suites:
1. **Dynamic Import Only:** Never import Three.js components directly into SSR bundles.
   ```tsx
   import dynamic from "next/dynamic";
   const RoomCanvas3D = dynamic(() => import("@/components/book/RoomCanvas3D"), {
     ssr: false,
     loading: () => <div className="h-[380px] w-full animate-pulse rounded-2xl bg-muted/20" />
   });
   ```
2. **On-Demand Rendering:** Set `frameloop="demand"` so the WebGL context only redraws when props, state, or controls change:
   ```tsx
   <Canvas frameloop="demand" dpr={[1, 1.5]} gl={{ powerPreference: "high-performance", antialias: true }}>
     <ambientLight intensity={0.7} />
     <directionalLight position={[10, 10, 5]} intensity={1.2} />
     <Suspense fallback={null}>
       <Model />
     </Suspense>
     <OrbitControls enableZoom={false} autoRotate={false} />
   </Canvas>
   ```
3. **Cap DPR:** Keep device pixel ratio capped at `dpr={[1, 1.5]}` to prevent GPU lag on high-density Retina displays.

---

## 4. Accessibility & Low-Spec Fallbacks

Enterprise apps must work across older tablets and battery saver modes:
1. **Reduced Transparency:** Respect users who turn off transparency:
   ```css
   @media (prefers-reduced-transparency: reduce) {
     .glass-panel {
       backdrop-filter: none !important;
       -webkit-backdrop-filter: none !important;
       background: var(--paper-0) !important;
     }
   }
   ```
2. **WCAG 2.1 AA Contrast:** Never place thin low-contrast text over translucent blurred backgrounds. Check contrast ratio ($\ge 4.5:1$) against both the glass layer and the background behind it.
