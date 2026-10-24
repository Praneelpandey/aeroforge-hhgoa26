/* ============================================================================
 * AEROFORGE — LEVEL 2 · "Apex-V8 Powertrain"
 * Fully procedural twin-turbo V8: cross-plane crankshaft, 8 pistons on true
 * slider-crank kinematics, DOHC heads with timed valves, spark/injector
 * flashes, twin turbos with spinning wheels — plus live dyno telemetry,
 * mechanical seizure and knock-blowout failure simulations.
 * ==========================================================================*/

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { machineById } from '../../data/machinesData';
import { useGame, useTelemetry } from '../../state/gameStore';
import { sound } from '../../audio/SoundEngine';
import { fxBus } from '../../lib/fxBus';
import { damp, clamp, degToRad, tube } from '../../lib/curves';
import { casingMat, PALETTE } from '../../lib/materials';
import { FlowParticles, HoverPill, SmokeColumn } from './FX';

const DEF = machineById('v8');
const BENCH_TOP = 0.55;
const ENGINE_Y = BENCH_TOP + 0.58;
const EXPLODE_GAP = 0.8;

/* ── geometry constants ── */
const BANK = degToRad(32);
const CRANK_R = 0.095;
const ROD_L = 0.3;
const BORE_R = 0.088;
const CYL_SPACING = 0.34;
const Z0 = -0.51;

interface Cyl {
  bank: 'R' | 'L';
  i: number;
  z: number;
  phase: number; // degrees of crank phase offset
}
const CYLS: Cyl[] = [];
{
  const phasesR = [0, 180, 90, 270];
  const phasesL = [90, 270, 0, 180];
  for (let i = 0; i < 4; i++) {
    CYLS.push({ bank: 'R', i, z: Z0 + i * CYL_SPACING + 0.08, phase: phasesR[i] });
    CYLS.push({ bank: 'L', i, z: Z0 + i * CYL_SPACING - 0.08, phase: phasesL[i] });
  }
}
const uR = new THREE.Vector2(Math.sin(BANK), Math.cos(BANK));
const uL = new THREE.Vector2(-Math.sin(BANK), Math.cos(BANK));

const ASSEMBLED_POS: Record<string, [number, number, number]> = {
  block: [0, 0, 0],
  crank: [0, 0, 0],
  pistons: [0, 0, 0],
  heads: [0, 0, 0],
  spark: [0, 0, 0],
  turbo: [0, 0.16, -1.02],
};

const CYCLE_COLORS = {
  intake: '#3b82f6',
  compression: '#facc15',
  power: '#fb923c',
  exhaust: '#9ca3af',
} as const;

/* ═════════════════════════════════════════════════════════════════════════
 * PART BUILDERS
 * ════════════════════════════════════════════════════════════════════════*/

function Block({ xray, ghost }: { xray: boolean; ghost: boolean }) {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.66, 0.34, 1.42]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.castIron)} />
      </mesh>
      {(['R', 'L'] as const).map((bank) => (
        <group key={bank} rotation={[0, 0, bank === 'R' ? -BANK : BANK]} position={[0, 0.05, 0]}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[0.3, 0.72, 1.42]} />
            <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.castIron)} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.26, 0]} castShadow>
        <boxGeometry args={[0.5, 0.2, 1.3]} />
        <meshStandardMaterial {...casingMat(xray, ghost, { color: '#7c8aa0', metalness: 0.75, roughness: 0.35 })} />
      </mesh>
      {CYLS.map((c, idx) => {
        const u = c.bank === 'R' ? uR : uL;
        return (
          <mesh
            key={idx}
            position={[u.x * 0.36, u.y * 0.36, c.z]}
            rotation={[0, 0, c.bank === 'R' ? -BANK : BANK]}
          >
            <cylinderGeometry args={[BORE_R + 0.012, BORE_R + 0.012, 0.6, 20, 1, true]} />
            <meshStandardMaterial
              {...casingMat(xray, ghost, {
                color: '#12151b',
                metalness: 0.4,
                roughness: 0.35,
                side: THREE.DoubleSide,
              })}
            />
          </mesh>
        );
      })}
      {[-0.5, -0.17, 0.17, 0.5].map((z, i) => (
        <mesh key={i} position={[0, -0.19, z]}>
          <boxGeometry args={[0.3, 0.1, 0.1]} />
          <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.forged)} />
        </mesh>
      ))}
    </group>
  );
}

function Crank({
  xray,
  ghost,
  throwRefs,
}: {
  xray: boolean;
  ghost: boolean;
  throwRefs: React.MutableRefObject<(THREE.Group | null)[]>;
}) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 1.5, 16]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.forged)} />
      </mesh>
      {CYLS.map((c, idx) => (
        <group
          key={idx}
          ref={(el) => {
            throwRefs.current[idx] = el;
          }}
          position={[0, 0, c.z]}
        >
          <mesh position={[0, 0, -0.055]}>
            <boxGeometry args={[0.09, 0.24, 0.045]} />
            <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.forged)} />
          </mesh>
          <mesh position={[0, 0, 0.055]}>
            <boxGeometry args={[0.09, 0.24, 0.045]} />
            <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.forged)} />
          </mesh>
          <mesh position={[0, CRANK_R, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.042, 0.042, 0.14, 14]} />
            <meshStandardMaterial {...casingMat(xray, ghost, { ...PALETTE.forged, roughness: 0.15 })} />
          </mesh>
          <mesh position={[0, -0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.1, 20, 1, false, -Math.PI / 2 + 0.5, Math.PI - 1]} />
            <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.forged)} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0, 0.82]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.06, 24]} />
        <meshStandardMaterial {...casingMat(xray, ghost, { color: '#ff5500', metalness: 0.2, roughness: 0.45 })} />
      </mesh>
      <mesh position={[0, 0, -0.82]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.05, 32]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.forged)} />
      </mesh>
      <mesh position={[0, 0, -0.82]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.225, 0.016, 6, 48]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.steel)} />
      </mesh>
    </group>
  );
}

function Pistons({
  xray,
  ghost,
  pistonRefs,
  rodRefs,
  highlightRef,
}: {
  xray: boolean;
  ghost: boolean;
  pistonRefs: React.MutableRefObject<(THREE.Group | null)[]>;
  rodRefs: React.MutableRefObject<(THREE.Mesh | null)[]>;
  highlightRef?: React.RefObject<THREE.MeshStandardMaterial | null>;
}) {
  return (
    <group>
      {CYLS.map((c, idx) => (
        <group key={idx}>
          <group
            ref={(el) => {
              pistonRefs.current[idx] = el;
            }}
            rotation={[0, 0, c.bank === 'R' ? -BANK : BANK]}
          >
            <mesh castShadow>
              <cylinderGeometry args={[BORE_R - 0.004, BORE_R - 0.004, 0.14, 20]} />
              <meshStandardMaterial
                ref={idx === 2 ? highlightRef : undefined}
                {...casingMat(xray, ghost, {
                  color: '#dbe3ec',
                  metalness: 0.9,
                  roughness: 0.3,
                })}
              />
            </mesh>
            {[0.035, 0.055].map((dy, i) => (
              <mesh key={i} position={[0, dy, 0]}>
                <cylinderGeometry args={[BORE_R - 0.001, BORE_R - 0.001, 0.012, 20, 1, true]} />
                <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.steel)} />
              </mesh>
            ))}
            <mesh position={[0, -0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.028, 0.028, 0.1, 10]} />
              <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.steel)} />
            </mesh>
          </group>
          <mesh
            ref={(el) => {
              rodRefs.current[idx] = el;
            }}
          >
            <boxGeometry args={[0.045, ROD_L, 0.028]} />
            <meshStandardMaterial {...casingMat(xray, ghost, { color: '#dbe3ec', metalness: 0.92, roughness: 0.12 })} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Heads({
  xray,
  ghost,
  camRefs,
  valveRefs,
}: {
  xray: boolean;
  ghost: boolean;
  camRefs: React.MutableRefObject<(THREE.Group | null)[]>;
  valveRefs: React.MutableRefObject<(THREE.Mesh | null)[]>;
}) {
  return (
    <group>
      {(['R', 'L'] as const).map((bank, bi) => (
        <group key={bank} rotation={[0, 0, bank === 'R' ? -BANK : BANK]}>
          <mesh position={[0, 0.74, 0]} castShadow>
            <boxGeometry args={[0.32, 0.18, 1.42]} />
            <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.castIron)} />
          </mesh>
          <mesh position={[0, 0.9, 0]} castShadow>
            <boxGeometry args={[0.26, 0.1, 1.36]} />
            <meshPhysicalMaterial
              color={ghost || xray ? '#94a3b8' : '#dc2626'}
              metalness={0.4}
              roughness={0.15}
              clearcoat={1}
              clearcoatRoughness={0.12}
              wireframe={false}
              transparent={ghost || xray}
              opacity={ghost || xray ? 0.18 : 1}
              depthWrite={!(ghost || xray)}
            />
          </mesh>
          {/* camshafts: outer group aims the axis, inner mesh spins on it */}
          {[-0.06, 0.06].map((x, ci) => (
            <group
              key={ci}
              ref={(el) => {
                camRefs.current[bi * 2 + ci] = el;
              }}
              position={[x, 0.84, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <mesh>
                <cylinderGeometry args={[0.022, 0.022, 1.3, 12]} />
                <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.steel)} />
              </mesh>
              {[0, 1, 2, 3].map((i) => (
                <mesh key={i} position={[0, Z0 + i * CYL_SPACING + (bank === 'R' ? 0.08 : -0.08), 0.03]} rotation={[0, 0, 0.4]}>
                  <cylinderGeometry args={[0.036, 0.036, 0.03, 10]} />
                  <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.forged)} />
                </mesh>
              ))}
            </group>
          ))}
          <mesh position={[0, 0.98, 0]} castShadow>
            <boxGeometry args={[0.3, 0.12, 1.3]} />
            <meshStandardMaterial {...casingMat(xray, ghost, { color: '#334155', metalness: 0.75, roughness: 0.35 })} />
          </mesh>
          {/* valves (x-ray only, timed lift) */}
          <group visible={xray && !ghost}>
            {CYLS.filter((c) => c.bank === bank).map((c) =>
              [-0.045, 0.045].map((x, vi) => {
                const idx = CYLS.indexOf(c) * 2 + vi;
                return (
                  <mesh
                    key={idx}
                    ref={(el) => {
                      valveRefs.current[idx] = el;
                    }}
                    position={[x, 0.66, c.z]}
                  >
                    <cylinderGeometry args={[0.016, 0.024, 0.12, 8]} />
                    <meshStandardMaterial
                      color="#e2e8f0"
                      emissive="#94a3b8"
                      emissiveIntensity={0.35}
                      metalness={0.8}
                      roughness={0.3}
                    />
                  </mesh>
                );
              }),
            )}
          </group>
        </group>
      ))}
      <mesh position={[0, 0.92, 0]} castShadow>
        <boxGeometry args={[0.34, 0.16, 1.34]} />
        <meshStandardMaterial {...casingMat(xray, ghost, { color: '#1f2937', metalness: 0.7, roughness: 0.4 })} />
      </mesh>
    </group>
  );
}

function SparkAndInjectors({
  xray,
  ghost,
  sparkRefs,
}: {
  xray: boolean;
  ghost: boolean;
  sparkRefs: React.MutableRefObject<(THREE.Mesh | null)[]>;
}) {
  return (
    <group>
      {CYLS.map((c, idx) => {
        const u = c.bank === 'R' ? uR : uL;
        return (
          <group
            key={idx}
            position={[u.x * 0.94, u.y * 0.94, c.z]}
            rotation={[0, 0, c.bank === 'R' ? -BANK : BANK]}
          >
            <mesh castShadow>
              <cylinderGeometry args={[0.02, 0.02, 0.1, 8]} />
              <meshStandardMaterial
                {...casingMat(xray, ghost, { color: '#d9d9de', metalness: 0.85, roughness: 0.3 })}
              />
            </mesh>
            <mesh position={[0, 0.07, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.06, 8]} />
              <meshStandardMaterial {...casingMat(xray, ghost, { color: '#f5f5f4', metalness: 0.1, roughness: 0.6 })} />
            </mesh>
          </group>
        );
      })}
      {/* combustion flash spheres (x-ray only, driven imperatively) */}
      <group visible={xray && !ghost}>
        {CYLS.map((c, idx) => {
          const u = c.bank === 'R' ? uR : uL;
          return (
            <mesh
              key={idx}
              ref={(el) => {
                sparkRefs.current[idx] = el;
              }}
              position={[u.x * 0.5, u.y * 0.5, c.z]}
            >
              <sphereGeometry args={[0.055, 12, 10]} />
              <meshStandardMaterial
                color="#fff7cc"
                emissive="#ffdd66"
                emissiveIntensity={0}
                transparent
                opacity={0.9}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** One turbo: volute + wheels + housings. `side` = −1 left / +1 right. */
function TurboBody({
  xray,
  ghost,
  side,
  glowRef,
  wheelRef,
}: {
  xray: boolean;
  ghost: boolean;
  side: -1 | 1;
  glowRef?: (el: THREE.MeshStandardMaterial | null) => void;
  wheelRef?: (el: THREE.Group | null) => void;
}) {
  return (
    <group position={[side * 0.42, 0.1, 0]}>
      <mesh castShadow>
        <torusGeometry args={[0.11, 0.055, 14, 30]} />
        <meshStandardMaterial ref={glowRef} {...casingMat(xray, ghost, PALETTE.copper)} />
      </mesh>
      <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.16, 16]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.steel)} />
      </mesh>
      <mesh position={[0, 0, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.115, 0.115, 0.1, 22]} />
        <meshStandardMaterial {...casingMat(xray, ghost, { color: '#64748b', metalness: 0.85, roughness: 0.25 })} />
      </mesh>
      <group
        ref={(el) => {
          if (wheelRef) wheelRef(el);
        }}
        position={[0, 0, 0.02]}
      >
        {Array.from({ length: 9 }).map((_, i) => {
          const a = (i / 9) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0]} rotation={[0, -a, 0.42]}>
              <boxGeometry args={[0.055, 0.02, 0.016]} />
              <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.forged)} />
            </mesh>
          );
        })}
      </group>
      <mesh position={[0, -0.2, -0.06]} rotation={[0.35, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.06, 0.34, 14]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.steel)} />
      </mesh>
    </group>
  );
}

function TwinTurbo({
  xray,
  ghost,
  wheelRefs,
  glowRefs,
  running,
}: {
  xray: boolean;
  ghost: boolean;
  wheelRefs: React.MutableRefObject<(THREE.Group | null)[]>;
  glowRefs: React.MutableRefObject<(THREE.MeshStandardMaterial | null)[]>;
  running: boolean;
}) {
  const manifoldR = useMemo(
    () => tube([[0.36, 0.25, 0.45], [0.5, 0.3, 0.2], [0.56, 0.32, -0.2], [0.5, 0.28, -0.72], [0.44, 0.22, -0.92]]),
    [],
  );
  const manifoldL = useMemo(
    () => tube([[-0.36, 0.25, 0.45], [-0.5, 0.3, 0.2], [-0.56, 0.32, -0.2], [-0.5, 0.28, -0.72], [-0.44, 0.22, -0.92]]),
    [],
  );
  const pipeR = useMemo(() => tube([[0.44, 0.35, -0.95], [0.3, 0.62, -0.7], [0.12, 0.86, -0.2], [0.05, 0.95, 0.3]]), []);
  const pipeL = useMemo(() => tube([[-0.44, 0.35, -0.95], [-0.3, 0.62, -0.7], [-0.12, 0.86, -0.2], [-0.05, 0.95, 0.3]]), []);

  return (
    <group position={ASSEMBLED_POS.turbo}>
      <TurboBody
        xray={xray}
        ghost={ghost}
        side={-1}
        glowRef={(el) => {
          glowRefs.current[0] = el;
        }}
        wheelRef={(el) => {
          wheelRefs.current[0] = el;
        }}
      />
      <TurboBody
        xray={xray}
        ghost={ghost}
        side={1}
        glowRef={(el) => {
          glowRefs.current[1] = el;
        }}
        wheelRef={(el) => {
          wheelRefs.current[1] = el;
        }}
      />
      <mesh>
        <tubeGeometry args={[manifoldR, 40, 0.032, 8, false]} />
        <meshStandardMaterial {...casingMat(xray, ghost, { color: '#9a7b52', metalness: 0.85, roughness: 0.4 })} />
      </mesh>
      <mesh>
        <tubeGeometry args={[manifoldL, 40, 0.032, 8, false]} />
        <meshStandardMaterial {...casingMat(xray, ghost, { color: '#9a7b52', metalness: 0.85, roughness: 0.4 })} />
      </mesh>
      <mesh>
        <tubeGeometry args={[pipeR, 40, 0.03, 8, false]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.steel)} />
      </mesh>
      <mesh>
        <tubeGeometry args={[pipeL, 40, 0.03, 8, false]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.steel)} />
      </mesh>
      {xray && !ghost && running && (
        <>
          <FlowParticles curve={manifoldR} count={12} color="#9ca3af" size={0.03} speed={0.35} />
          <FlowParticles curve={pipeR} count={12} color="#fb923c" size={0.03} speed={0.35} />
        </>
      )}
    </group>
  );
}

/**
 * Public single-module renderer for ghost silhouettes, scattered parts and
 * the tray. Locally-owned animation refs are created unconditionally; the
 * live assembly passes its own holders in so the frame loop can drive them.
 */
export function V8Part({
  partId,
  xray = false,
  ghost = false,
  throwRefs,
  pistonRefs,
  rodRefs,
  camRefs,
  valveRefs,
  sparkRefs,
  wheelRefs,
  glowRefs,
  highlightRef,
  running = false,
}: {
  partId: string;
  xray?: boolean;
  ghost?: boolean;
  throwRefs?: React.MutableRefObject<(THREE.Group | null)[]>;
  pistonRefs?: React.MutableRefObject<(THREE.Group | null)[]>;
  rodRefs?: React.MutableRefObject<(THREE.Mesh | null)[]>;
  camRefs?: React.MutableRefObject<(THREE.Group | null)[]>;
  valveRefs?: React.MutableRefObject<(THREE.Mesh | null)[]>;
  sparkRefs?: React.MutableRefObject<(THREE.Mesh | null)[]>;
  wheelRefs?: React.MutableRefObject<(THREE.Group | null)[]>;
  glowRefs?: React.MutableRefObject<(THREE.MeshStandardMaterial | null)[]>;
  highlightRef?: React.RefObject<THREE.MeshStandardMaterial | null>;
  running?: boolean;
}) {
  const localThrow = useRef<(THREE.Group | null)[]>([]);
  const localPiston = useRef<(THREE.Group | null)[]>([]);
  const localRod = useRef<(THREE.Mesh | null)[]>([]);
  const localCam = useRef<(THREE.Group | null)[]>([]);
  const localValve = useRef<(THREE.Mesh | null)[]>([]);
  const localSpark = useRef<(THREE.Mesh | null)[]>([]);
  const localWheel = useRef<(THREE.Group | null)[]>([]);
  const localGlow = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const tR = throwRefs ?? localThrow;
  const pR = pistonRefs ?? localPiston;
  const rR = rodRefs ?? localRod;
  const cR = camRefs ?? localCam;
  const vR = valveRefs ?? localValve;
  const sR = sparkRefs ?? localSpark;
  const wR = wheelRefs ?? localWheel;
  const gR = glowRefs ?? localGlow;

  switch (partId) {
    case 'block':
      return <Block xray={xray} ghost={ghost} />;
    case 'crank':
      return <Crank xray={xray} ghost={ghost} throwRefs={tR} />;
    case 'pistons':
      return <Pistons xray={xray} ghost={ghost} pistonRefs={pR} rodRefs={rR} highlightRef={highlightRef} />;
    case 'heads':
      return <Heads xray={xray} ghost={ghost} camRefs={cR} valveRefs={vR} />;
    case 'spark':
      return <SparkAndInjectors xray={xray} ghost={ghost} sparkRefs={sR} />;
    case 'turbo':
      return <TwinTurbo xray={xray} ghost={ghost} wheelRefs={wR} glowRefs={gR} running={running} />;
    default:
      return null;
  }
}

/* ═════════════════════════════════════════════════════════════════════════
 * 3D FLY-IN MOUNT WRAPPER
 * ════════════════════════════════════════════════════════════════════════*/

function MountWrapper3D({
  target,
  spawn,
  partId,
  partName,
  selected,
  onSelect,
  children,
}: {
  target: THREE.Vector3;
  spawn: boolean;
  partId: string;
  partName: string;
  selected: boolean;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}) {
  const g = useRef<THREE.Group>(null);
  const t = useRef(2);
  const cur = useRef(target.clone());
  const [hovered, setHovered] = useState(false);
  const start = useMemo(() => new THREE.Vector3(2.6, 3.6, 2.8), []);
  const ctrl = useMemo(() => new THREE.Vector3(), []);
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
      ctrl.set(target.x * 0.4 + 0.6, target.y + 2.2, target.z * 0.4 + 0.6);
      tmp.copy(start).multiplyScalar((1 - e) * (1 - e));
      tmp.addScaledVector(ctrl, 2 * (1 - e) * e);
      tmp.addScaledVector(target, e * e);
      cur.current.copy(tmp);
      g.current.position.copy(cur.current);
      g.current.rotation.y = (1 - e) * 2.4;
    } else {
      cur.current.x = damp(cur.current.x, target.x, 6, dt);
      cur.current.y = damp(cur.current.y, target.y, 6, dt);
      cur.current.z = damp(cur.current.z, target.z, 6, dt);
      g.current.position.copy(cur.current);
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
      {hovered && !selected && <HoverPill label={partName.toUpperCase()} action="INSPECT" position={[0, 0.75, 0]} />}
      {selected && (
        <mesh position={[0, -0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.6, 0.68, 40]} />
          <meshBasicMaterial color="#0071e3" transparent opacity={0.75} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
 * V8 ASSEMBLY — master component for Level 2
 * ════════════════════════════════════════════════════════════════════════*/

export function V8Assembly() {
  const { s, d } = useGame();
  const { push } = useTelemetry();
  const stack = s.stacks.v8;
  const xray = s.xray;

  const throwRefs = useRef<(THREE.Group | null)[]>([]);
  const pistonRefs = useRef<(THREE.Group | null)[]>([]);
  const rodRefs = useRef<(THREE.Mesh | null)[]>([]);
  const camRefs = useRef<(THREE.Group | null)[]>([]);
  const valveRefs = useRef<(THREE.Mesh | null)[]>([]);
  const sparkRefs = useRef<(THREE.Mesh | null)[]>([]);
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const glowRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const gasRefs = useRef<(THREE.Mesh | null)[]>([]);
  const highlightRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const theta = useRef(0);
  const omegaVis = useRef(0);
  const rpmCur = useRef(0);
  const seizureClank = useRef(false);
  const knockSoundDone = useRef(false);
  const overRevT = useRef(0);
  const knockActiveT = useRef(0);
  const pushAcc = useRef(0);
  const [smokeOn, setSmokeOn] = useState(false);

  const failType = s.failure?.type ?? null;
  const seizure = s.phase === 'failure' && failType === 'mechanical-seizure';
  const knockFail = s.phase === 'failure' && failType === 'engine-knock';
  const dyno = s.phase === 'climax';
  const testing = s.phase === 'testing';

  /* engine sound lifecycle */
  useEffect(() => {
    if (dyno || testing) sound.startEngine();
    else sound.stopEngine();
    return () => sound.stopEngine();
  }, [dyno, testing]);

  useEffect(() => {
    if (knockFail && !knockSoundDone.current) {
      knockSoundDone.current = true;
      sound.knock();
      sound.klaxon(3);
    }
    if (!knockFail) knockSoundDone.current = false;
  }, [knockFail]);

  useEffect(() => {
    if (!seizure) seizureClank.current = false;
  }, [seizure]);

  /* fly-in spawn detection */
  const prevStack = useRef<string[]>(stack);
  const spawnIds = useMemo(() => {
    const newly = stack.filter((id) => !prevStack.current.includes(id));
    return new Set(newly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack]);

  const targets = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    stack.forEach((id, i) => {
      const base = ASSEMBLED_POS[id] ?? [0, 0, 0];
      map.set(id, new THREE.Vector3(base[0], base[1] + s.exploded * EXPLODE_GAP * (i + 0.4), base[2]));
    });
    return map;
  }, [stack, s.exploded]);

  const nextPart = useMemo(() => DEF.parts.find((p) => !stack.includes(p.id)) ?? null, [stack]);

  const torqueAt = (rpm: number) => {
    const x = clamp((rpm - 700) / 7800, 0, 1);
    return 980 * (0.42 + 0.58 * Math.sin(Math.PI * Math.pow(x, 0.86)));
  };

  /* ── master frame loop: kinematics + dyno + failures ── */
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);

    let targetRpm = 0;
    if (seizure) targetRpm = 0;
    else if (knockFail) targetRpm = 1100;
    else if (dyno) targetRpm = s.throttleRpm;
    else if (testing) targetRpm = 950;
    rpmCur.current = damp(rpmCur.current, targetRpm, seizure ? 9 : 2.2, dt);

    const canRun = stack.includes('crank') && !seizure;
    const rpm = canRun ? rpmCur.current : Math.max(0, rpmCur.current * Math.exp(-6 * dt));

    const omegaTarget = (rpm / 60) * Math.PI * 2 * 0.022;
    omegaVis.current = damp(omegaVis.current, omegaTarget, 4, dt);
    theta.current += omegaVis.current * dt;
    const th = theta.current;
    const thDeg = (th * 180) / Math.PI;

    for (let i = 0; i < CYLS.length; i++) {
      const g = throwRefs.current[i];
      if (g) g.rotation.z = -(th + degToRad(CYLS[i].phase));
    }
    for (const cam of camRefs.current) if (cam) cam.rotation.y = th / 2;

    const wheelSpeed = rpm * 0.028;
    for (const w of wheelRefs.current) if (w) w.rotation.z += wheelSpeed * dt;

    const boost = clamp((rpm - 2400) / 4800, 0, 1) * 18;
    const glowK = boost / 18;
    for (const g of glowRefs.current) {
      if (!g) continue;
      g.emissive.setRGB(glowK * 0.9, glowK * 0.12, 0);
      g.emissiveIntensity = glowK * 1.4;
    }

    const crankMounted = stack.includes('crank');
    for (let i = 0; i < CYLS.length; i++) {
      const c = CYLS[i];
      const u = c.bank === 'R' ? uR : uL;
      const a = crankMounted ? th + degToRad(c.phase) : 1.2;
      const pinX = CRANK_R * Math.sin(a);
      const pinY = CRANK_R * Math.cos(a);
      const dProd = u.x * pinX + u.y * pinY;
      const sPos =
        dProd + Math.sqrt(Math.max(0.0004, ROD_L * ROD_L - (pinX * pinX + pinY * pinY) + dProd * dProd));

      const pg = pistonRefs.current[i];
      if (pg) pg.position.set(u.x * sPos, u.y * sPos, c.z);
      const rod = rodRefs.current[i];
      if (rod) {
        const px = u.x * sPos;
        const py = u.y * sPos;
        rod.position.set((px + pinX) / 2, (py + pinY) / 2, c.z);
        rod.rotation.z = Math.atan2(py - pinY, px - pinX) - Math.PI / 2;
        if (seizure && i === 2) {
          rod.rotation.z += Math.sin(performance.now() * 0.02) * 0.14;
        }
      }

      const cyc = ((thDeg + c.phase) % 720 + 720) % 720;
      const gas = gasRefs.current[i];
      if (gas) {
        const m = gas.material as THREE.MeshStandardMaterial;
        let col: string;
        let em = 0.35;
        if (cyc < 180) col = CYCLE_COLORS.intake;
        else if (cyc < 360) col = CYCLE_COLORS.compression;
        else if (cyc < 540) {
          col = CYCLE_COLORS.power;
          em = cyc < 415 ? 2.8 : 0.9;
        } else col = CYCLE_COLORS.exhaust;
        m.color.set(col);
        m.emissive.set(col);
        m.emissiveIntensity = em;
      }
      const sp = sparkRefs.current[i];
      if (sp) {
        const m = sp.material as THREE.MeshStandardMaterial;
        const flash = cyc >= 358 && cyc < 372 ? 1 : 0;
        m.emissiveIntensity = flash * 4.5;
        sp.scale.setScalar(flash ? 1.6 : 0.6);
      }
      for (let v = 0; v < 2; v++) {
        const vm = valveRefs.current[i * 2 + v];
        if (vm) {
          const open =
            v === 0
              ? cyc < 200
                ? Math.sin((cyc / 200) * Math.PI)
                : 0
              : cyc >= 520
                ? Math.sin(((cyc - 520) / 200) * Math.PI)
                : 0;
          vm.position.y = 0.66 - open * 0.035;
        }
      }
    }

    if (highlightRef.current) {
      const on = seizure ? (Math.sin(performance.now() * 0.02) > 0 ? 1 : 0.2) : 0;
      highlightRef.current.emissive.setRGB(on, 0.05, 0.05);
      highlightRef.current.emissiveIntensity = on * 1.6;
    }
    if (seizure && omegaVis.current < 0.35 && !seizureClank.current && stack.length > 0) {
      seizureClank.current = true;
      sound.clank();
      sound.klaxon(3);
      fxBus.requestShake(0.9);
    }
    if (knockFail) fxBus.requestShake(0.18);

    if (dyno) {
      const r = Math.round(rpm);
      let hp = (torqueAt(r) * r) / 5252;
      let knock = 0;
      if (r > 8200) overRevT.current += dt;
      else overRevT.current = Math.max(0, overRevT.current - dt * 0.8);
      const wasSmoking = knockActiveT.current > 0;
      if (overRevT.current > 2.5) {
        knockActiveT.current = 2.2;
        overRevT.current = 1.2; // keep the pressure on but don't retrigger every frame
        sound.knock();
        d({ t: 'toast', text: 'DETONATION — sustained over-rev knock. Ease below 8,200 rpm.', kind: 'bad' });
      }
      if (knockActiveT.current > 0) {
        knockActiveT.current = Math.max(0, knockActiveT.current - dt);
        hp *= 0.68;
        knock = 1;
        if (!wasSmoking) setSmokeOn(true);
        if (knockActiveT.current === 0) setSmokeOn(false);
      }
      sound.setEngineRpm(r, clamp((r - 800) / 7700, 0, 1));
      pushAcc.current += dt;
      if (pushAcc.current > 0.1) {
        pushAcc.current = 0;
        push({
          rpm: r,
          hp: Math.round(hp),
          torqueNm: Math.round(torqueAt(r)),
          boostPsi: boost,
          knock,
        });
      }
    } else if (testing) {
      sound.setEngineRpm(Math.round(rpm), 0.15);
    }
  });

  return (
    <group position={[0, ENGINE_Y, 0]}>
      {stack.map((id) => (
        <MountWrapper3D
          key={id}
          partId={id}
          partName={DEF.parts.find((p) => p.id === id)?.short ?? id}
          target={targets.get(id) ?? new THREE.Vector3()}
          spawn={spawnIds.has(id)}
          selected={s.selectedPart === id}
          onSelect={(pid) => d({ t: 'select', part: pid })}
        >
          <V8Part
            partId={id}
            xray={xray}
            throwRefs={throwRefs}
            pistonRefs={pistonRefs}
            rodRefs={rodRefs}
            camRefs={camRefs}
            valveRefs={valveRefs}
            sparkRefs={sparkRefs}
            wheelRefs={wheelRefs}
            glowRefs={glowRefs}
            highlightRef={highlightRef}
            running={dyno || testing}
          />
        </MountWrapper3D>
      ))}

      {/* combustion gas volumes with 4-stroke cycle colours (x-ray) */}
      {stack.includes('pistons') && xray && (
        <group>
          {CYLS.map((c, i) => {
            const u = c.bank === 'R' ? uR : uL;
            return (
              <mesh
                key={i}
                ref={(el) => {
                  gasRefs.current[i] = el;
                }}
                position={[u.x * 0.42, u.y * 0.42, c.z]}
                rotation={[0, 0, c.bank === 'R' ? -BANK : BANK]}
              >
                <cylinderGeometry args={[BORE_R - 0.008, BORE_R - 0.008, 0.3, 18]} />
                <meshStandardMaterial
                  color={CYCLE_COLORS.intake}
                  emissive={CYCLE_COLORS.intake}
                  emissiveIntensity={0.35}
                  transparent
                  opacity={0.34}
                  depthWrite={false}
                />
              </mesh>
            );
          })}
        </group>
      )}

      {/* next-part snap ghost */}
      {nextPart && s.phase === 'play' && (
        <group position={[0, s.exploded * EXPLODE_GAP * (stack.length + 0.4), 0]}>
          <V8Part partId={nextPart.id} ghost />
          <mesh position={[0, -0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.66, 0.74, 44]} />
            <meshBasicMaterial color="#0071e3" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* failure + abuse smoke */}
      {knockFail && (
        <>
          <SmokeColumn position={[uR.x * 0.8, uR.y * 0.8 + 0.3, -0.2]} active color="#18181b" height={2.6} />
          <SmokeColumn position={[uL.x * 0.8, uL.y * 0.8 + 0.3, 0.2]} active color="#18181b" height={2.6} />
        </>
      )}
      {dyno && <SmokeColumn position={[0, 1.3, -0.4]} active={smokeOn} color="#27272a" height={2} count={40} />}
    </group>
  );
}
