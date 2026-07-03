"use client";

import { Canvas } from "@react-three/fiber";
import { MeshDistortMaterial, Sphere } from "@react-three/drei";

/**
 * Purely decorative abstract 3D visual for the landing page — a slowly
 * rotating, distorted sphere in purple tones. No interaction, no data.
 */
export default function HeroOrb() {
  return (
    <div className="pointer-events-none h-64 w-64 sm:h-80 sm:w-80" aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 4] }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 2, 2]} intensity={1.2} color="#e9d5ff" />
        <directionalLight position={[-2, -1, -2]} intensity={0.6} color="#7e22ce" />
        <Sphere args={[1.4, 128, 128]}>
          <MeshDistortMaterial
            color="#9333ea"
            attach="material"
            distort={0.45}
            speed={1.8}
            roughness={0.15}
            metalness={0.3}
          />
        </Sphere>
      </Canvas>
    </div>
  );
}
