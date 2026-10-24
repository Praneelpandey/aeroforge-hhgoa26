/* ============================================================================
 * AEROFORGE — shared procedural FX: explosions, smoke, flow particles,
 * camera shake, pulse rings. All pure THREE / r3f, zero external assets.
 * ==========================================================================*/

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { fxBus } from '../../lib/fxBus';
import { damp } from '../../lib/curves';

/* ─────────────────────────────────────────────────────────────────────────
 * ExplosionFX — 200+ additive spark particles + buoyant smoke puffs +
 * decaying point-light flash. Re-fires whenever `trigger` token changes.
 * ────────────────────────────────────────────────────────────────────────*/

interface PSpark {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export function ExplosionFX({
  position,
  trigger,
  scale = 1,
}: {
  position: [number, number, number];
  trigger: number;
  scale?: number;
}) {
  const SPARKS = 220;
  const SMOKE = 90;
  const sparkGeo = useRef<THREE.BufferGeometry>(null);
  const smokeGeo = useRef<THREE.BufferGeometry>(null);
  const light = useRef<THREE.PointLight>(null);
  const sparks = useRef<PSpark[]>([]);
  const smokes = useRef<PSpark[]>([]);
  const clock = useRef(0);
  const active = useRef(false);

  const sparkPos = useMemo(() => new Float32Array(SPARKS * 3), []);
  const smokePos = useMemo(() => new Float32Array(SMOKE * 3), []);
  const smokeSize = useMemo(() => new Float32Array(SMOKE), []);

  useEffect(() => {
    if (trigger === 0) return;
    const origin = new THREE.Vector3(...position);
    sparks.current = [];
    smokes.current = [];
    for (let i = 0; i < SPARKS; i++) {
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 1.4 - 0.3,
        Math.random() * 2 - 1,
      ).normalize();
      const speed = (2.4 + Math.random() * 7.5) * scale;
      sparks.current.push({
        pos: origin.clone(),
        vel: dir.multiplyScalar(speed),
        life: 0.6 + Math.random() * 1.5,
        maxLife: 0.6 + Math.random() * 1.5,
      });
    }
    for (let i = 0; i < SMOKE; i++) {
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 0.9,
        Math.random() * 2 - 1,
      ).normalize();
      smokes.current.push({
        pos: origin.clone().addScaledVector(dir, 0.2 * scale),
        vel: dir.multiplyScalar((0.5 + Math.random() * 1.4) * scale),
        life: 2.4 + Math.random() * 2.8,
        maxLife: 2.4 + Math.random() * 2.8,
      });
      smokeSize[i] = 0.4 + Math.random() * 0.7;
    }
    active.current = true;
    clock.current = 0;
    fxBus.requestShake(1.4 * scale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (!active.current) return;
    clock.current += dt;
    let aliveS = 0;
    let aliveM = 0;
    const arrS = sparks.current;
    for (let i = 0; i < arrS.length; i++) {
      const p = arrS[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y -= 7.5 * dt;
      p.vel.multiplyScalar(1 - 1.1 * dt);
      p.pos.addScaledVector(p.vel, dt);
      const floorY = position[1] - 0.55 * scale;
      if (p.pos.y < floorY) {
        p.pos.y = floorY;
        p.vel.y = Math.abs(p.vel.y) * 0.32;
      }
      sparkPos[i * 3] = p.pos.x;
      sparkPos[i * 3 + 1] = p.pos.y;
      sparkPos[i * 3 + 2] = p.pos.z;
      aliveS++;
    }
    const arrM = smokes.current;
    for (let i = 0; i < arrM.length; i++) {
      const p = arrM[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y += 1.15 * dt; // buoyancy
      p.vel.multiplyScalar(1 - 0.9 * dt);
      p.pos.addScaledVector(p.vel, dt);
      smokePos[i * 3] = p.pos.x;
      smokePos[i * 3 + 1] = p.pos.y;
      smokePos[i * 3 + 2] = p.pos.z;
      aliveM++;
    }
    if (sparkGeo.current) {
      sparkGeo.current.setDrawRange(0, arrS.length);
      (sparkGeo.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
    if (smokeGeo.current) {
      smokeGeo.current.setDrawRange(0, arrM.length);
      (smokeGeo.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
    if (light.current) {
      light.current.intensity = Math.max(0, 320 * scale * Math.exp(-clock.current * 3.2));
    }
    if (aliveS === 0 && aliveM === 0 && clock.current > 1) active.current = false;
  });

  return (
    <group position={position}>
      <points frustumCulled={false}>
        <bufferGeometry ref={sparkGeo}>
          <bufferAttribute attach="attributes-position" args={[sparkPos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.085 * scale}
          color="#ffb347"
          sizeAttenuation
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points frustumCulled={false}>
        <bufferGeometry ref={smokeGeo}>
          <bufferAttribute attach="attributes-position" args={[smokePos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.85 * scale}
          color="#4a4a52"
          sizeAttenuation
          transparent
          opacity={0.42}
          depthWrite={false}
        />
      </points>
      <pointLight ref={light} color="#ff9433" distance={26 * scale} decay={2} intensity={0} />
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * SmokeColumn — continuous black/grey smoke while `active` (engine blowout).
 * ────────────────────────────────────────────────────────────────────────*/

export function SmokeColumn({
  position,
  active,
  color = '#202024',
  height = 2.4,
  count = 70,
}: {
  position: [number, number, number];
  active: boolean;
  color?: string;
  height?: number;
  count?: number;
}) {
  const geo = useRef<THREE.BufferGeometry>(null);
  const state = useMemo(() => {
    return {
      t: new Float32Array(count).map(() => Math.random()),
      drift: Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 0.3,
        z: (Math.random() - 0.5) * 0.3,
        w: 0.6 + Math.random(),
      })),
    };
  }, [count]);
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const wasActive = useRef(false);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (!geo.current) return;
    if (active && !wasActive.current) {
      // reset column offsets on ignition of the column
      state.t.fill(0);
    }
    wasActive.current = active;
    if (!active) {
      geo.current.setDrawRange(0, 0);
      return;
    }
    geo.current.setDrawRange(0, count);
    for (let i = 0; i < count; i++) {
      state.t[i] = (state.t[i] + dt * 0.22 * state.drift[i].w) % 1;
      const t = state.t[i];
      const sway = Math.sin(t * 9 + i) * 0.12 * t;
      positions[i * 3] = position[0] + state.drift[i].x * t + sway;
      positions[i * 3 + 1] = position[1] + t * height;
      positions[i * 3 + 2] = position[2] + state.drift[i].z * t;
    }
    (geo.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points frustumCulled={false} position={position}>
      <bufferGeometry ref={geo}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.65}
        color={color}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </points>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * FlowParticles — glowing points streaming along a THREE.Curve.
 * Used for LOX/LH2 feedlines, coolant helix, electrical pulses.
 * ────────────────────────────────────────────────────────────────────────*/

export function FlowParticles({
  curve,
  count = 26,
  color = '#38bdf8',
  size = 0.05,
  speed = 0.25,
  active = true,
  jitter = 0.012,
}: {
  curve: THREE.Curve<THREE.Vector3>;
  count?: number;
  color?: string;
  size?: number;
  speed?: number;
  active?: boolean;
  jitter?: number;
}) {
  const geo = useRef<THREE.BufferGeometry>(null);
  const offs = useMemo(() => new Float32Array(count).map(() => Math.random()), [count]);
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const tmp = useRef(new THREE.Vector3());

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (!geo.current) return;
    geo.current.setDrawRange(0, active ? count : 0);
    if (!active) return;
    for (let i = 0; i < count; i++) {
      offs[i] = (offs[i] + dt * speed) % 1;
      curve.getPoint(offs[i], tmp.current);
      positions[i * 3] = tmp.current.x + (Math.random() - 0.5) * jitter * 2;
      positions[i * 3 + 1] = tmp.current.y + (Math.random() - 0.5) * jitter * 2;
      positions[i * 3 + 2] = tmp.current.z + (Math.random() - 0.5) * jitter * 2;
    }
    (geo.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geo}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        color={color}
        sizeAttenuation
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * PulseRing — expanding ring burst (collect / mount feedback).
 * ────────────────────────────────────────────────────────────────────────*/

export function PulseRing({
  position,
  trigger,
  color = '#0071e3',
  maxR = 1.4,
}: {
  position: [number, number, number];
  trigger: number;
  color?: string;
  maxR?: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const t = useRef(99);
  const prev = useRef(trigger);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (trigger !== prev.current) {
      prev.current = trigger;
      t.current = 0;
    }
    if (!mesh.current) return;
    t.current += dt;
    const k = Math.min(1, t.current / 0.7);
    if (k >= 1) {
      mesh.current.visible = false;
      return;
    }
    mesh.current.visible = true;
    const r = 0.12 + k * maxR;
    mesh.current.scale.set(r, r, r);
    const m = mesh.current.material as THREE.MeshBasicMaterial;
    m.opacity = 0.75 * (1 - k);
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={position} visible={false}>
      <ringGeometry args={[0.86, 1, 48]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.7}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * ShakeGroup — wraps world content; consumes fxBus shake each frame.
 * ────────────────────────────────────────────────────────────────────────*/

export function ShakeGroup({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  const cur = useRef(0);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (!g.current) return;
    const requested = fxBus.consumeShake();
    cur.current = Math.max(cur.current * Math.exp(-4.2 * dt), requested);
    const k = cur.current;
    if (k < 0.002) {
      g.current.position.set(0, 0, 0);
      return;
    }
    g.current.position.set(
      (Math.random() - 0.5) * 0.24 * k,
      (Math.random() - 0.5) * 0.2 * k,
      (Math.random() - 0.5) * 0.24 * k,
    );
  });
  return <group ref={g}>{children}</group>;
}

/* ─────────────────────────────────────────────────────────────────────────
 * HoverPill — minimal frosted-white tooltip rendered only for the single
 * hovered 3D part (replaces all permanently visible floating tags).
 * ────────────────────────────────────────────────────────────────────────*/

export function HoverPill({
  label,
  action,
  accent = 'blue',
  position = [0, 0, 0],
}: {
  label: string;
  action?: string;
  accent?: 'blue' | 'orange';
  position?: [number, number, number];
}) {
  return (
    <Html center distanceFactor={8} position={position} zIndexRange={[40, 0]}>
      <div className="hover-pill">
        {label}
        {action && (
          <>
            {' '}
            <span className={accent === 'orange' ? 'hp-accent-orange' : 'hp-accent'}>▸ {action}</span>
          </>
        )}
      </div>
    </Html>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * HoloRings — concentric circle + spoke line segments (turntable detailing).
 * ────────────────────────────────────────────────────────────────────────*/

export function HoloRings({
  y = 0,
  maxR = 2.3,
  rings = 5,
  color = '#94a3b8',
  opacity = 0.28,
  spokes = 16,
  spin = 0.06,
}: {
  y?: number;
  maxR?: number;
  rings?: number;
  color?: string;
  opacity?: number;
  spokes?: number;
  spin?: number;
}) {
  const g = useRef<THREE.Group>(null);
  const geos = useMemo(() => {
    const list: THREE.BufferGeometry[] = [];
    for (let i = 1; i <= rings; i++) {
      list.push(circleLinesGeo((maxR * i) / rings));
    }
    return list;
    function circleLinesGeo(r: number): THREE.BufferGeometry {
      const pos: number[] = [];
      const seg = 72;
      for (let s = 0; s < seg; s++) {
        const a0 = (s / seg) * Math.PI * 2;
        const a1 = ((s + 1) / seg) * Math.PI * 2;
        pos.push(Math.cos(a0) * r, 0, Math.sin(a0) * r);
        pos.push(Math.cos(a1) * r, 0, Math.sin(a1) * r);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      return geo;
    }
  }, [rings, maxR]);

  const spokeGeo = useMemo(() => {
    const pos: number[] = [];
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      pos.push(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25);
      pos.push(Math.cos(a) * maxR, 0, Math.sin(a) * maxR);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return geo;
  }, [spokes, maxR]);

  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * spin;
  });

  return (
    <group ref={g} position={[0, y, 0]}>
      {geos.map((geo, i) => (
        <lineSegments key={i} geometry={geo}>
          <lineBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        </lineSegments>
      ))}
      <lineSegments geometry={spokeGeo}>
        <lineBasicMaterial color={color} transparent opacity={opacity * 0.5} depthWrite={false} />
      </lineSegments>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * GlowSprite — soft additive sprite used for status glows.
 * ────────────────────────────────────────────────────────────────────────*/

export function GlowSprite({
  position,
  color = '#ffffff',
  size = 0.5,
  pulse = true,
}: {
  position: [number, number, number];
  color?: string;
  size?: number;
  pulse?: boolean;
}) {
  const mat = useRef<THREE.SpriteMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current && pulse) {
      mat.current.opacity = 0.2 + Math.sin(clock.elapsedTime * 2.4) * 0.1;
    }
  });
  return (
    <sprite position={position} scale={[size, size, size]}>
      <spriteMaterial ref={mat} color={color} transparent opacity={0.25} depthWrite={false} />
    </sprite>
  );
}

/** Smoothly animated emissive intensity helper for failure heat glow. */
export function useHeatGlow(ref: React.RefObject<THREE.MeshStandardMaterial | null>, heat: number) {
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.emissiveIntensity = damp(ref.current.emissiveIntensity, heat, 3, Math.min(dt, 0.05));
  });
}
