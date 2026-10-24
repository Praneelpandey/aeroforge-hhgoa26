/* ============================================================================
 * AEROFORGE — LEVEL 1 · "Ares-V Propulsion Stack"
 * Fully procedural cryogenic rocket: bell nozzle, regen cooling jacket,
 * turbopump powerhead, cryo tank with internal fluids, lattice interstage
 * with deploying grid fins, ogive fairing — plus launch physics, thermal
 * meltdown and structural buckling failure simulations.
 * ==========================================================================*/

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { machineById } from '../../data/machinesData';
import { useGame, useTelemetry } from '../../state/gameStore';
import { sound } from '../../audio/SoundEngine';
import { fxBus } from '../../lib/fxBus';
import { bellProfile, ogiveProfile, HelixCurve, damp, clamp, tube } from '../../lib/curves';
import { casingMat, internalMat, PALETTE } from '../../lib/materials';
import { ExplosionFX, FlowParticles, HoverPill, SmokeColumn } from './FX';

const DEF = machineById('rocket');
const BENCH_TOP = 0.55;
const EXPLODE_GAP = 0.6;

const heightOf = (id: string): number => DEF.parts.find((p) => p.id === id)?.buildHeight ?? 0.5;

/* ═════════════════════════════════════════════════════════════════════════
 * PART MESH BUILDERS (each with its base at local y = 0)
 * ════════════════════════════════════════════════════════════════════════*/

function Nozzle({ xray, ghost, heatRef }: { xray: boolean; ghost: boolean; heatRef?: React.RefObject<THREE.MeshStandardMaterial | null> }) {
  const profile = useMemo(() => bellProfile(0.16, 0.55, 0.92), []);
  const ribs = useMemo(() => [0.32, 0.45, 0.58, 0.72, 0.86], []);
  const ribR = (t: number) => 0.16 + (0.55 - 0.16) * Math.pow((t - 0.28) / 0.72, 1.7);
  return (
    <group>
      <mesh castShadow>
        <latheGeometry args={[profile, 48]} />
        <meshStandardMaterial
          ref={heatRef}
          {...casingMat(xray, ghost, { ...PALETTE.darkTitanium, side: THREE.DoubleSide })}
        />
      </mesh>
      {ribs.map((t, i) => (
        <mesh key={i} position={[0, t * 0.92, 0]} castShadow>
          <torusGeometry args={[ribR(t) + 0.012, 0.016, 8, 40]} />
          <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.titanium)} />
        </mesh>
      ))}
      {/* throat actuator ring */}
      <mesh position={[0, 0.24, 0]}>
        <torusGeometry args={[0.19, 0.02, 8, 32]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.steel)} />
      </mesh>
      {/* fuel inlet elbows */}
      {[0, Math.PI].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.2, 0.86, Math.sin(a) * 0.2]} rotation={[Math.PI / 2, 0, a]}>
          <cylinderGeometry args={[0.035, 0.035, 0.14, 10]} />
          <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.copper)} />
        </mesh>
      ))}
    </group>
  );
}

function CoolingJacket({ xray, ghost }: { xray: boolean; ghost: boolean }) {
  const helix = useMemo(() => new HelixCurve(0.185, 0.3, 7, 0.02), []);
  return (
    <group>
      <mesh castShadow>
        <tubeGeometry args={[helix, 160, 0.02, 8, false]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.copper)} />
      </mesh>
      <mesh position={[0, 0.31, 0]}>
        <torusGeometry args={[0.205, 0.026, 10, 36]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.copper)} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <torusGeometry args={[0.19, 0.026, 10, 36]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.copper)} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.24, 0.17, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.022, 0.022, 0.12, 10]} />
          <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.copper)} />
        </mesh>
      ))}
      {xray && !ghost && (
        <FlowParticles curve={helix} count={22} color="#0071e3" size={0.035} speed={0.5} />
      )}
    </group>
  );
}

function Turbopump({ xray, ghost, running }: { xray: boolean; ghost: boolean; running: boolean }) {
  const turbine = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (turbine.current) turbine.current.rotation.y += dt * (running ? 26 : 3.4);
  });
  return (
    <group>
      {/* combustion chamber — brushed aerospace silver */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.185, 0.16, 0.55, 28]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.titanium)} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.185, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.titanium)} />
      </mesh>
      {/* gimbal block */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <boxGeometry args={[0.18, 0.12, 0.18]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.steel)} />
      </mesh>
      {/* twin side pumps */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.29, 0.26, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.085, 0.085, 0.4, 20]} />
            <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.steel)} />
          </mesh>
          <mesh position={[0, 0.23, 0]}>
            <torusGeometry args={[0.1, 0.032, 10, 26]} />
            <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.steel)} />
          </mesh>
        </group>
      ))}
      {/* feedline pipes to chamber */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.14, 0.52, 0]} rotation={[0, 0, -s * 0.5]}>
          <cylinderGeometry args={[0.028, 0.028, 0.26, 10]} />
          <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.copper)} />
        </mesh>
      ))}
      {/* ── internal mechanism (x-ray only) ── */}
      <group visible={xray && !ghost}>
        <group ref={turbine} position={[0, 0.3, 0]}>
          <mesh>
            <cylinderGeometry args={[0.12, 0.12, 0.03, 20]} />
            <meshStandardMaterial {...internalMat({ color: '#e2b04a' })} />
          </mesh>
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1]} rotation={[0, -a, 0.5]}>
                <boxGeometry args={[0.05, 0.012, 0.024]} />
                <meshStandardMaterial {...internalMat({ color: '#fde68a' })} />
              </mesh>
            );
          })}
        </group>
        {/* injector orifice ring */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.11, 0.585, Math.sin(a) * 0.11]}>
              <cylinderGeometry args={[0.014, 0.014, 0.05, 8]} />
              <meshStandardMaterial {...internalMat({ color: '#67e8f9' })} />
            </mesh>
          );
        })}
        {/* combustion kernel */}
        <mesh position={[0, 0.36, 0]}>
          <sphereGeometry args={[0.1, 16, 12]} />
          <meshStandardMaterial
            color="#ff9433"
            emissive="#ff6b1a"
            emissiveIntensity={running ? 3.2 : 0.8}
            transparent
            opacity={0.85}
          />
        </mesh>
      </group>
    </group>
  );
}

function CryoTank({ xray, ghost }: { xray: boolean; ghost: boolean }) {
  const lox = useRef<THREE.Mesh>(null);
  const lh2 = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const p = 1 + Math.sin(clock.elapsedTime * 1.8) * 0.015;
    if (lox.current) lox.current.scale.set(p, 1, p);
    if (lh2.current) lh2.current.scale.set(2 - p, 1, 2 - p);
  });
  return (
    <group>
      {/* barrel — satin aerospace white */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 2.1, 36]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.satinWhite)} />
      </mesh>
      {/* domes */}
      <mesh position={[0, 0.14, 0]}>
        <sphereGeometry args={[0.5, 32, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.satinWhite)} />
      </mesh>
      <mesh position={[0, 2.46, 0]}>
        <sphereGeometry args={[0.5, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.satinWhite)} />
      </mesh>
      {/* intertank band — international orange */}
      <mesh position={[0, 1.32, 0]}>
        <cylinderGeometry args={[0.515, 0.515, 0.22, 36]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.nasaOrange)} />
      </mesh>
      {/* dark gunmetal stringer ribs */}
      {[0.45, 0.95, 1.75, 2.25].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <torusGeometry args={[0.505, 0.014, 8, 40]} />
          <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.gunmetal)} />
        </mesh>
      ))}
      {/* cable raceway */}
      <mesh position={[0.53, 1.3, 0]}>
        <boxGeometry args={[0.06, 2.1, 0.1]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.gunmetal)} />
      </mesh>
      {/* ── internal cryo fluids (x-ray only) ── */}
      <group visible={xray && !ghost}>
        <mesh ref={lox} position={[0, 0.72, 0]}>
          <cylinderGeometry args={[0.42, 0.42, 0.95, 24]} />
          <meshStandardMaterial
            color="#fb923c"
            emissive="#f97316"
            emissiveIntensity={0.55}
            transparent
            opacity={0.42}
          />
        </mesh>
        <mesh ref={lh2} position={[0, 1.95, 0]}>
          <cylinderGeometry args={[0.44, 0.44, 0.85, 24]} />
          <meshStandardMaterial
            color="#60a5fa"
            emissive="#3b82f6"
            emissiveIntensity={0.55}
            transparent
            opacity={0.4}
          />
        </mesh>
        {/* centre feedline */}
        <mesh position={[0, 1.3, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 2.2, 12]} />
          <meshStandardMaterial {...internalMat({ color: '#7dd3fc', emissiveIntensity: 0.5 })} />
        </mesh>
      </group>
    </group>
  );
}

function GridFin({ deployed }: { deployed: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) {
      g.current.rotation.x = damp(g.current.rotation.x, deployed ? 0 : -Math.PI / 2, 4, Math.min(dt, 0.05));
    }
  });
  const bars: React.ReactNode[] = [];
  for (let i = 0; i < 4; i++) {
    bars.push(
      <mesh key={`h${i}`} position={[0, -0.14 + i * 0.09, 0]}>
        <boxGeometry args={[0.3, 0.014, 0.02]} />
      </mesh>,
    );
  }
  for (let i = 0; i < 4; i++) {
    bars.push(
      <mesh key={`v${i}`} position={[-0.12 + i * 0.08, 0, 0]}>
        <boxGeometry args={[0.014, 0.3, 0.022]} />
      </mesh>,
    );
  }
  return (
    <group ref={g}>
      <group position={[0, 0.14, 0]}>{bars}</group>
    </group>
  );
}

function Interstage({ xray, ghost, deployed }: { xray: boolean; ghost: boolean; deployed: boolean }) {
  return (
    <group>
      {/* lattice cylinder — silver structural lattice */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.5, 24, 1, true]} />
        <meshStandardMaterial
          {...casingMat(xray, ghost, { color: '#e8edf4', metalness: 0.55, roughness: 0.35, side: THREE.DoubleSide })}
        />
      </mesh>
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.51, 0.25, Math.sin(a) * 0.51]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.03, 0.5, 0.014]} />
            <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.gunmetal)} />
          </mesh>
        );
      })}
      {[0.04, 0.25, 0.46].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <torusGeometry args={[0.505, 0.016, 8, 40]} />
          <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.titanium)} />
        </mesh>
      ))}
      {/* 4 grid fins with international-orange leading edges */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <group key={i} position={[Math.cos(a) * 0.56, 0.44, Math.sin(a) * 0.56]} rotation={[0, -a, 0]}>
            <GridFin deployed={deployed} />
            <mesh>
              <cylinderGeometry args={[0.03, 0.03, 0.08, 10]} />
              <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.nasaOrange)} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Fairing({ xray, ghost }: { xray: boolean; ghost: boolean }) {
  const profile = useMemo(() => ogiveProfile(0.5, 0.95), []);
  const ring = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.emissiveIntensity = 1.1 + Math.sin(clock.elapsedTime * 3) * 0.7;
  });
  return (
    <group>
      <mesh castShadow>
        <latheGeometry args={[profile, 40]} />
        <meshStandardMaterial {...casingMat(xray, ghost, { ...PALETTE.titanium, side: THREE.DoubleSide })} />
      </mesh>
      {/* tip band — international orange */}
      <mesh position={[0, 0.83, 0]}>
        <cylinderGeometry args={[0.11, 0.16, 0.14, 24]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.nasaOrange)} />
      </mesh>
      {/* telemetry ring — emerald */}
      <mesh position={[0, 0.06, 0]}>
        <torusGeometry args={[0.49, 0.02, 10, 44]} />
        <meshStandardMaterial
          ref={ring}
          color="#065f46"
          emissive="#10b981"
          emissiveIntensity={1.2}
          metalness={0.3}
          roughness={0.3}
        />
      </mesh>
      {/* access hatch */}
      <mesh position={[0.42, 0.4, 0]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.1, 0.22, 0.14]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.gunmetal)} />
      </mesh>
    </group>
  );
}

/** Public single-module renderer used for ghost silhouettes & scattered parts. */
export function RocketPart({
  partId,
  xray = false,
  ghost = false,
  heatRef,
  running = false,
  deployed = false,
}: {
  partId: string;
  xray?: boolean;
  ghost?: boolean;
  heatRef?: React.RefObject<THREE.MeshStandardMaterial | null>;
  running?: boolean;
  deployed?: boolean;
}) {
  switch (partId) {
    case 'nozzle':
      return <Nozzle xray={xray} ghost={ghost} heatRef={heatRef} />;
    case 'jacket':
      return <CoolingJacket xray={xray} ghost={ghost} />;
    case 'turbopump':
      return <Turbopump xray={xray} ghost={ghost} running={running} />;
    case 'tank':
      return <CryoTank xray={xray} ghost={ghost} />;
    case 'interstage':
      return <Interstage xray={xray} ghost={ghost} deployed={deployed} />;
    case 'fairing':
      return <Fairing xray={xray} ghost={ghost} />;
    default:
      return null;
  }
}

/* ═════════════════════════════════════════════════════════════════════════
 * LAUNCH EXHAUST PLUME
 * ════════════════════════════════════════════════════════════════════════*/

function ExhaustPlume({ intensityRef }: { intensityRef: React.MutableRefObject<number> }) {
  const inner = useRef<THREE.Mesh>(null);
  const outer = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const smoke = useRef<THREE.Points>(null);
  const smokePos = useMemo(() => new Float32Array(60 * 3), []);
  const smokeT = useMemo(() => new Float32Array(60).map(() => Math.random()), []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const k = intensityRef.current;
    const flick = 0.85 + Math.sin(clock.elapsedTime * 31) * 0.1 + Math.random() * 0.08;
    if (inner.current) {
      inner.current.scale.set(k * flick, k * (0.9 + Math.random() * 0.2), k * flick);
      (inner.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * k;
    }
    if (outer.current) {
      outer.current.scale.set(k * 1.15 * flick, k, k * 1.15 * flick);
      (outer.current.material as THREE.MeshBasicMaterial).opacity = 0.3 * k;
    }
    if (light.current) light.current.intensity = 380 * k * flick;
    if (smoke.current) {
      smoke.current.visible = k > 0.05;
      const attr = smoke.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < 60; i++) {
        smokeT[i] = (smokeT[i] + dt * 0.45) % 1;
        const t = smokeT[i];
        const a = (i / 60) * Math.PI * 2 + t * 4;
        smokePos[i * 3] = Math.cos(a) * (0.4 + t * 2.6);
        smokePos[i * 3 + 1] = -t * 0.5;
        smokePos[i * 3 + 2] = Math.sin(a) * (0.4 + t * 2.6);
      }
      attr.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh ref={inner} position={[0, -1.5, 0]}>
        <coneGeometry args={[0.55, 3.4, 24, 1, true]} />
        <meshBasicMaterial color="#fffbeb" transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={outer} position={[0, -1.7, 0]}>
        <coneGeometry args={[0.8, 4.1, 24, 1, true]} />
        <meshBasicMaterial color="#ff5500" transparent opacity={0.34} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight ref={light} position={[0, -1.6, 0]} color="#ff7a33" distance={30} decay={2} />
      <points ref={smoke} position={[0, -2.2, 0]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[smokePos, 3]} />
        </bufferGeometry>
        <pointsMaterial size={1.15} color="#eef2f7" transparent opacity={0.5} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
 * FLY-IN MOUNT WRAPPER — bezier fly-in then damped tracking of target Y
 * ════════════════════════════════════════════════════════════════════════*/

function MountWrapper({
  targetY,
  spawn,
  selected,
  partId,
  partName,
  children,
  onSelect,
}: {
  targetY: number;
  spawn: boolean;
  selected: boolean;
  partId: string;
  partName: string;
  children: React.ReactNode;
  onSelect: (id: string) => void;
}) {
  const g = useRef<THREE.Group>(null);
  const t = useRef(2);
  const y = useRef(0);
  const [hovered, setHovered] = useState(false);
  const start = useMemo(() => new THREE.Vector3(2.6, 4.4, 2.8), []);
  const ctrl = useMemo(() => new THREE.Vector3(0.9, 0, 0.9), []);
  const end = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (spawn) t.current = 0;
  }, [spawn]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (!g.current) return;
    if (t.current < 1) {
      t.current = Math.min(1, t.current + dt / 0.9);
      const u = t.current;
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      end.set(0, targetY, 0);
      ctrl.set(0.8, targetY + 2.4, 0.8);
      // quadratic bezier start → ctrl → end
      tmp.copy(start).multiplyScalar((1 - e) * (1 - e));
      tmp.addScaledVector(ctrl, 2 * (1 - e) * e);
      tmp.addScaledVector(end, e * e);
      g.current.position.copy(tmp);
      y.current = tmp.y;
      g.current.rotation.y = (1 - e) * 2.4;
    } else {
      y.current = damp(y.current, targetY, 6, dt);
      g.current.position.set(0, y.current, 0);
      g.current.rotation.y = damp(g.current.rotation.y, 0, 6, dt);
    }
    const sel = 1 + (selected ? 0.024 : 0) + (hovered ? 0.06 : 0);
    g.current.scale.setScalar(damp(g.current.scale.x, sel, 10, dt));
  });

  return (
    <group
      ref={g}
      onClick={(e) => {
        if (e.delta > 7) return;
        e.stopPropagation();
        onSelect(partId);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {children}
      {hovered && !selected && <HoverPill label={partName.toUpperCase()} action="INSPECT" position={[0.9, 0.5, 0]} />}
      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.72, 0.8, 40]} />
          <meshBasicMaterial color="#0071e3" transparent opacity={0.75} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
 * ROCKET ASSEMBLY — master component for Level 1
 * ════════════════════════════════════════════════════════════════════════*/

export function RocketAssembly() {
  const { s, d } = useGame();
  const { push } = useTelemetry();
  const stack = s.stacks.rocket;
  const xray = s.xray;

  /* fly-in spawn detection */
  const prevStack = useRef<string[]>(stack);
  const spawnIds = useMemo(() => {
    const newly = stack.filter((id) => !prevStack.current.includes(id));
    return new Set(newly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack]);

  /* stack geometry */
  const targets = useMemo(() => {
    const list: { id: string; y: number }[] = [];
    let acc = 0;
    stack.forEach((id, i) => {
      list.push({ id, y: acc + s.exploded * EXPLODE_GAP * i });
      acc += heightOf(id);
    });
    return list;
  }, [stack, s.exploded]);

  const totalH = useMemo(() => stack.reduce((a, id) => a + heightOf(id), 0), [stack]);

  /* next suggested part ghost */
  const nextPart = useMemo(() => {
    const unmounted = DEF.parts.filter((p) => !stack.includes(p.id));
    return unmounted[0] ?? null;
  }, [stack]);
  const ghostBaseY = useMemo(
    () => totalH + s.exploded * EXPLODE_GAP * stack.length,
    [totalH, stack.length, s.exploded],
  );

  /* ── launch physics: T+0…2.5s hold-down static fire, then liftoff ── */
  const rocket = useRef<THREE.Group>(null);
  const plumeI = useRef(0);
  const phys = useRef({ t: 0, v: 0, h: 0, m: 52000, acc: 0 });
  const thrust = 2280000; // N — Ares-V rated liftoff thrust
  const mdot = 623; // kg/s
  const HOLD_DOWN = 2.5; // seconds of static-fire hold-down
  const pushAcc = useRef(0);
  const roarRef = useRef<{ stop: () => void } | null>(null);

  /* ── failure anim state ── */
  const heat = useRef(0);
  const nozzleMat = useRef<THREE.MeshStandardMaterial | null>(null);
  const explodeToken = useRef(0);
  const [explodeTick, setExplodeTick] = useState(0);
  const buckleT = useRef(0);
  const buckleCrunch = useRef(false);
  const testT = useRef(0);

  const failType = s.failure?.type ?? null;
  const meltdown = s.phase === 'failure' && failType === 'thermal-meltdown';
  const buckle = s.phase === 'failure' && failType === 'structural-buckle';
  const charred = useRef(false);

  /* sounds on failure enter */
  useEffect(() => {
    if (s.phase !== 'failure') return;
    if (failType === 'thermal-meltdown') sound.klaxon(4);
    if (failType === 'structural-buckle') {
      /* crunch fires at impact inside the frame loop */
    }
    return () => {
      heat.current = 0;
      charred.current = false;
      buckleT.current = 0;
      buckleCrunch.current = false;
      testT.current = 0;
    };
  }, [s.phase, failType]);

  /* static-fire test rumble */
  useEffect(() => {
    if (s.phase === 'testing') {
      testT.current = 0;
      const h = sound.launchRoar(2.0);
      roarRef.current = h;
      return () => h.stop();
    }
    return;
  }, [s.phase]);

  /* launch roar */
  useEffect(() => {
    if (s.launchState === 'flying') {
      const h = sound.launchRoar(16);
      roarRef.current = h;
      return () => h.stop();
    }
    return;
  }, [s.launchState]);

  /* master frame loop */
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const g = rocket.current;
    if (!g) return;

    /* base position while on pad / flying */
    let baseY = BENCH_TOP;

    if (s.phase === 'testing') {
      testT.current += dt;
      const fire = testT.current < 1.5;
      plumeI.current = damp(plumeI.current, fire ? 0.7 : 0, 5, dt);
      if (fire) fxBus.requestShake(0.3);
    } else if (s.launchState === 'flying') {
      const p = phys.current;
      p.t += dt;
      const hold = p.t < HOLD_DOWN; // static-fire hold-down before release
      const ramp = Math.min(1, p.t / 1.1); // thrust build-up curve
      p.m = Math.max(14000, p.m - mdot * dt);
      p.acc = hold ? 0 : (thrust - p.m * 9.81) / p.m;
      if (!hold) {
        p.v += p.acc * dt;
        p.h += p.v * dt;
      }
      baseY += p.h * 0.13; // visual scale factor
      plumeI.current = damp(plumeI.current, hold ? 1.05 * ramp : p.h < 2600 ? 1 : 0.15, 3, dt);
      fxBus.requestShake(hold ? 0.42 : Math.min(0.9, 14 / (1 + p.h * 0.02)));

      pushAcc.current += dt;
      if (pushAcc.current > 0.08) {
        pushAcc.current = 0;
        push({
          tPlus: p.t,
          altitudeKm: p.h / 1000,
          velocityMs: p.v,
          mach: p.v / 340,
          gforce: hold ? 0.05 : p.acc / 9.81,
          isp: 366,
          thrustKN: (thrust / 1000) * (hold ? ramp : 1),
          massKg: p.m,
        });
      }
      if (p.t > 30 || p.h > 9000) {
        d({ t: 'launch', state: 'done' });
        plumeI.current = 0;
      }
    } else if (s.launchState === 'counting') {
      plumeI.current = damp(plumeI.current, 0, 4, dt);
      /* cryo venting wobble */
      g.rotation.z = Math.sin(state.clock.elapsedTime * 2.2) * 0.0025;
    } else if (s.phase !== 'failure') {
      plumeI.current = damp(plumeI.current, 0, 4, dt);
    }

    /* failure: thermal meltdown */
    if (meltdown) {
      if (heat.current < 1) {
        heat.current = Math.min(1, heat.current + dt / 1.9);
        fxBus.requestShake(heat.current * 0.35);
        if (nozzleMat.current) {
          const k = heat.current;
          nozzleMat.current.color.setRGB(0.18 + k * 0.82, 0.2 + k * 0.35, 0.24 - k * 0.1);
          nozzleMat.current.emissive.setRGB(k, k * 0.35, 0.05);
          nozzleMat.current.emissiveIntensity = k * 2.6;
        }
      } else if (!charred.current) {
        charred.current = true;
        explodeToken.current += 1;
        setExplodeTick(explodeToken.current);
        sound.explosion();
        sound.klaxon(5);
        if (nozzleMat.current) {
          nozzleMat.current.color.set('#1a1412');
          nozzleMat.current.emissive.set('#331105');
          nozzleMat.current.emissiveIntensity = 0.4;
        }
      }
      plumeI.current = damp(plumeI.current, heat.current * 0.4, 3, dt);
    }

    /* failure: structural buckling */
    if (buckle) {
      if (buckleT.current < 1) {
        buckleT.current = Math.min(1, buckleT.current + dt / 1.3);
        const e = buckleT.current;
        const over = 1 - Math.pow(1 - e, 3);
        g.rotation.z = over * 1.32;
        g.position.x = over * 0.5;
        baseY -= over * 0.28;
        if (e > 0.55 && !buckleCrunch.current) {
          buckleCrunch.current = true;
          sound.crunch();
          sound.klaxon(4);
          fxBus.requestShake(1.2);
        }
      }
    } else if (s.launchState !== 'counting') {
      g.rotation.z = damp(g.rotation.z, 0, 3, dt);
      g.position.x = damp(g.position.x, 0, 3, dt);
    }

    if (s.launchState === 'flying') {
      g.rotation.z = Math.sin(phys.current.t * 0.7) * 0.004; // gravity-turn wiggle
    }

    g.position.y = damp(g.position.y, baseY, s.launchState === 'flying' ? 30 : 6, dt);
  });

  /* countdown reset when leaving flying */
  useEffect(() => {
    if (s.launchState === 'idle' || s.launchState === 'counting') {
      phys.current = { t: 0, v: 0, h: 0, m: 52000, acc: 0 };
      if (rocket.current) {
        rocket.current.position.y = BENCH_TOP;
      }
    }
  }, [s.launchState]);

  /* full-stack fluid feedlines (x-ray) */
  const fluidStackComplete = stack.length === DEF.parts.length && s.exploded < 0.05;
  const loxCurve = useMemo(
    () => tube([[0.1, 5.1, 0], [0.16, 4.3, 0.05], [0.12, 3.3, 0], [0.06, 2.2, 0]]),
    [],
  );
  const lh2Curve = useMemo(
    () => tube([[-0.1, 4.9, 0], [-0.18, 4.2, -0.06], [-0.14, 3.2, 0], [-0.07, 2.2, 0]]),
    [],
  );

  return (
    <group ref={rocket} position={[0, BENCH_TOP, 0]}>
      {targets.map(({ id, y }) => {
        const partDef = DEF.parts.find((p) => p.id === id);
        return (
          <MountWrapper
            key={id}
            partId={id}
            partName={partDef?.short ?? id}
            targetY={y}
            spawn={spawnIds.has(id)}
            selected={s.selectedPart === id}
            onSelect={(pid) => d({ t: 'select', part: pid })}
          >
            {id === 'nozzle' ? (
              <RocketPart partId="nozzle" xray={xray} heatRef={nozzleMat} />
            ) : (
              <RocketPart
                partId={id}
                xray={xray}
                running={s.launchState === 'flying' || s.phase === 'testing'}
                deployed={s.launchState === 'flying' || s.launchState === 'done'}
              />
            )}
          </MountWrapper>
        );
      })}

      {/* next-part snap ghost — soft Apple-blue glass silhouette, hover-free */}
      {nextPart && s.phase === 'play' && (
        <group position={[0, ghostBaseY, 0]}>
          <RocketPart partId={nextPart.id} ghost />
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.62, 0.72, 44]} />
            <meshBasicMaterial color="#0071e3" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* plume anchored under the stack base */}
      {stack.length > 0 && (
        <group position={[0, 0, 0]}>
          <ExhaustPlume intensityRef={plumeI} />
        </group>
      )}

      {/* feedline fluid particles */}
      {fluidStackComplete && (xray || s.phase === 'testing' || s.launchState === 'flying') && (
        <group>
          <FlowParticles curve={loxCurve} count={30} color="#3b82f6" size={0.05} speed={0.22} />
          <FlowParticles curve={lh2Curve} count={30} color="#f87171" size={0.05} speed={0.2} />
        </group>
      )}

      {/* failure FX */}
      {explodeTick > 0 && (
        <ExplosionFX position={[0, 0.9, 0]} trigger={explodeTick} scale={1.15} />
      )}
      {meltdown && charred.current && <SmokeColumn position={[0, 1.1, 0]} active color="#2c2c30" height={4.4} />}

      {/* countdown cryo venting */}
      {s.launchState === 'counting' && (
        <SmokeColumn position={[0.55, 1.4, 0.2]} active color="#cfe8ff" height={1.4} count={26} />
      )}
    </group>
  );
}

export const ROCKET_TOTAL_HEIGHT = DEF.parts.reduce((a, p) => a + p.buildHeight, 0);
