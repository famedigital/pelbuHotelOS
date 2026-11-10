"use client";

import React, { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import type { Mesh } from "three";

function Controls() {
  const { invalidate } = useThree();
  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.06}
      onChange={() => {
        invalidate();
      }}
    />
  );
}

function FlagshipBlock({ reducedMotion }: { reducedMotion: boolean }) {
  const mesh = useRef<Mesh>(null);
  const { invalidate } = useThree();

  useFrame((_, delta) => {
    if (reducedMotion || !mesh.current) return;
    mesh.current.rotation.y += delta * 0.18;
    mesh.current.rotation.x += delta * 0.05;
    invalidate();
  });

  return (
    <mesh ref={mesh} castShadow receiveShadow>
      <boxGeometry args={[1.8, 1, 1.2]} />
      <meshStandardMaterial
        color="#6366f1"
        metalness={0.35}
        roughness={0.25}
        envMapIntensity={0.8}
      />
      <Html position={[0, 0.9, 0]} center distanceFactor={6}>
        <div className="pointer-events-none whitespace-nowrap rounded-lg border border-white/20 bg-slate-950/90 px-2 py-1 text-[10px] font-semibold text-amber-400 shadow-lg backdrop-blur-sm">
          Flagship ROI +12% RevPAR
        </div>
      </Html>
    </mesh>
  );
}

export function V2FlagshipScene() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <Canvas
      frameloop="demand"
      shadows
      className="h-full w-full"
      camera={{ position: [2.8, 1.8, 2.8], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={(state) => {
        state.invalidate();
      }}
    >
      <color attach="background" args={["#030712"]} />
      <ambientLight intensity={0.35} />
      <directionalLight castShadow position={[5, 8, 4]} intensity={1.15} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.65, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#0f172a" metalness={0.1} roughness={0.85} />
      </mesh>
      <FlagshipBlock reducedMotion={reducedMotion} />
      <Controls />
    </Canvas>
  );
}
