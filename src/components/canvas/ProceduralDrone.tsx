/* ============================================================================
 * AEROFORGE — LEVEL 3 · "Helios-X Autonomous Drone"
 * Fully procedural coaxial rotorcraft: carbon core, LiPo pack, ESC/flight
 * computer, dual outrunner stack and counter-rotating props — with live
 * WASD flight, LiDAR scanning, electrical-pulse x-ray and the Newton's-3rd-
 * law torque spinout failure simulation.
 * ==========================================================================*/

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { machineById } from '../../data/machinesData';
import { useGame, useTelemetry } from '../../state/gameStore';
import { sound } from '../../audio/SoundEngine';
import { fxBus, flightInput } from '../../lib/fxBus';
import { damp, clamp, seg, tube } from '../../lib/curves';
import { casingMat, PALETTE } from '../../lib/materials';
import { FlowParticles, HoverPill, SmokeColumn } from './FX';

const DEF = machineById('drone');
const BENCH_TOP = 0.55;
const HOVER_Y = 1.75;
const EXPLODE_GAP = 0.62;

const ASSEMBLED_POS: Record<string, [number, number, number]> = {
  core: [0, 0, 0],
  battery: [0, 0.13, 0],
  esc: [0, 0.3, 0],
  motors: [0, 0.44, 0],
  props: [0, 0.74, 0],
};

/* ═════════════════════════════════════════════════════════════════════════
 * PART BUILDERS
 * ════════════════════════════════════════════════════════════════════════*/

function Core({ xray, ghost }: { xray: boolean; ghost: boolean }) {
  return (
    <group>
      {/* main tub — gold thermal mylar foil */}
      <mesh castShadow>
        <boxGeometry args={[0.42, 0.24, 0.6]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.gold)} />
      </mesh>
      {/* bevel shell plates — brushed silver */}
      <mesh position={[0, 0.13, 0]} castShadow>
        <boxGeometry args={[0.38, 0.05, 0.56]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.titanium)} />
      </mesh>
      {/* sensor gimbal */}
      <mesh position={[0, -0.1, 0.32]} castShadow>
        <sphereGeometry args={[0.07, 18, 14]} />
        <meshStandardMaterial {...casingMat(xray, ghost, { color: '#111318', metalness: 0.5, roughness: 0.3 })} />
      </mesh>
      <mesh position={[0, -0.1, 0.375]}>
        <cylinderGeometry args={[0.028, 0.028, 0.03, 14]} />
        <meshStandardMaterial
          color="#0e7490"
          emissive="#0071e3"
          emissiveIntensity={1.4}
          metalness={0.2}
          roughness={0.2}
        />
      </mesh>
      {/* landing gear */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <group key={i} position={[sx * 0.19, -0.2, sz * 0.24]}>
          <mesh rotation={[0, 0, sx * 0.3]} castShadow>
            <cylinderGeometry args={[0.014, 0.014, 0.24, 8]} />
            <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.titanium)} />
          </mesh>
          <mesh position={[sx * 0.045, -0.13, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.011, 0.011, 0.12, 8]} />
            <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.titanium)} />
          </mesh>
        </group>
      ))}
      {/* nav lights */}
      {[
        [-0.22, 0, 0.28, '#ef4444'],
        [0.22, 0, 0.28, '#ef4444'],
        [-0.22, 0, -0.28, '#22c55e'],
        [0.22, 0, -0.28, '#22c55e'],
      ].map(([x, y, z, c], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial
            color={c as string}
            emissive={c as string}
            emissiveIntensity={2}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

function Battery({ xray, ghost }: { xray: boolean; ghost: boolean }) {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.3, 0.16, 0.44]} />
        <meshStandardMaterial {...casingMat(xray, ghost, { color: '#eef2f7', metalness: 0.3, roughness: 0.4 })} />
      </mesh>
      {/* cell stripes */}
      {[-0.15, -0.05, 0.05, 0.15].map((x, i) => (
        <mesh key={i} position={[x, 0, 0]}>
          <boxGeometry args={[0.008, 0.162, 0.442]} />
          <meshStandardMaterial {...casingMat(xray, ghost, { color: '#cbd5e1', metalness: 0.4, roughness: 0.45 })} />
        </mesh>
      ))}
      {/* positive terminal */}
      <mesh position={[0.1, 0.1, 0.2]}>
        <boxGeometry args={[0.06, 0.05, 0.08]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={0.7}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
      {/* status strip */}
      <mesh position={[0, 0.081, 0]}>
        <boxGeometry args={[0.22, 0.004, 0.3]} />
        <meshStandardMaterial
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={1.1}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  );
}

function EscBoard({ xray, ghost }: { xray: boolean; ghost: boolean }) {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.34, 0.035, 0.5]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.pcb)} />
      </mesh>
      {/* FET banks */}
      {[-0.13, 0, 0.13].map((z, i) => (
        <group key={i} position={[0, 0.024, z - 0.08]}>
          {[-0.1, -0.033, 0.033, 0.1].map((x, j) => (
            <mesh key={j} position={[x, 0, 0]}>
              <boxGeometry args={[0.05, 0.016, 0.05]} />
              <meshStandardMaterial {...casingMat(xray, ghost, { color: '#0b0d10', metalness: 0.5, roughness: 0.5 })} />
            </mesh>
          ))}
        </group>
      ))}
      {/* MCU can */}
      <mesh position={[0, 0.03, 0.16]}>
        <boxGeometry args={[0.09, 0.02, 0.09]} />
        <meshStandardMaterial {...casingMat(xray, ghost, { color: '#111318', metalness: 0.7, roughness: 0.35 })} />
      </mesh>
      {/* electrolytic caps */}
      {[-0.12, 0.12].map((x, i) => (
        <mesh key={i} position={[x, 0.035, 0.19]}>
          <cylinderGeometry args={[0.02, 0.02, 0.04, 12]} />
          <meshStandardMaterial {...casingMat(xray, ghost, { color: '#1d4ed8', metalness: 0.6, roughness: 0.4 })} />
        </mesh>
      ))}
      {/* LED indicators */}
      {['#0071e3', '#f472b6', '#facc15'].map((c, i) => (
        <mesh key={i} position={[-0.12 + i * 0.12, 0.02, -0.22]}>
          <boxGeometry args={[0.02, 0.006, 0.02]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={2} />
        </mesh>
      ))}
    </group>
  );
}

function MotorStack({ xray, ghost, spinRefs }: { xray: boolean; ghost: boolean; spinRefs: React.MutableRefObject<(THREE.Group | null)[]> }) {
  return (
    <group>
      {/* mast */}
      <mesh castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.5, 12]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.carbon)} />
      </mesh>
      {/* lower outrunner bell */}
      <group position={[0, -0.1, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.09, 22]} />
          <meshStandardMaterial {...casingMat(xray, ghost, { color: '#94a3b8', metalness: 0.9, roughness: 0.2 })} />
        </mesh>
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.088, 0, Math.sin(a) * 0.088]} rotation={[0, -a, 0]}>
              <boxGeometry args={[0.02, 0.06, 0.01]} />
              <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.steel)} />
            </mesh>
          );
        })}
      </group>
      {/* upper outrunner bell + spinning mount */}
      <group position={[0, 0.14, 0]}>
        <group
          ref={(el) => {
            spinRefs.current[0] = el;
          }}
        >
          <mesh castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.07, 22]} />
            <meshStandardMaterial {...casingMat(xray, ghost, { color: '#d1d5db', metalness: 0.9, roughness: 0.18 })} />
          </mesh>
        </group>
      </group>
      {/* lower rotor hub spinner */}
      <group
        ref={(el) => {
          spinRefs.current[1] = el;
        }}
        position={[0, -0.055, 0]}
      >
        <mesh>
          <cylinderGeometry args={[0.03, 0.03, 0.03, 10]} />
          <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.forged)} />
        </mesh>
      </group>
    </group>
  );
}

function PropDisc({
  dir,
  span = 0.62,
  color = '#20242c',
}: {
  dir: 1 | -1;
  span?: number;
  color?: string;
}) {
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          rotation={[0, (i / 3) * Math.PI * 2, 0]}
          position={[Math.cos((i / 3) * Math.PI * 2) * span * 0.3, 0, -Math.sin((i / 3) * Math.PI * 2) * span * 0.3]}
          castShadow
        >
          <boxGeometry args={[span, 0.008, 0.07]} />
          <meshStandardMaterial color={color} metalness={0.45} roughness={0.5} />
        </mesh>
      ))}
      <mesh rotation={[0, dir * 0.4, 0]}>
        <boxGeometry args={[0.12, 0.01, 0.05]} />
        <meshStandardMaterial color="#ff5500" emissive="#ff5500" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

function Props({
  xray,
  ghost,
  spinRefs,
  spinRate,
}: {
  xray: boolean;
  ghost: boolean;
  spinRefs: React.MutableRefObject<(THREE.Group | null)[]>;
  spinRate: React.MutableRefObject<number>;
}) {
  const upper = useRef<THREE.Group>(null);
  const lower = useRef<THREE.Group>(null);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (upper.current) upper.current.rotation.y += spinRate.current * dt;
    if (lower.current) lower.current.rotation.y -= spinRate.current * dt; // COUNTER-ROTATING
  });
  void spinRefs;
  return (
    <group>
      {/* lower rotor (CCW, orange hub) */}
      <group ref={lower} position={[0, -0.06, 0]}>
        <PropDisc dir={-1} span={1.24} color="#272c36" />
      </group>
      {/* upper rotor (CW, blue hub) */}
      <group ref={upper} position={[0, 0.1, 0]}>
        <PropDisc dir={1} span={1.3} color="#20242c" />
      </group>
      {/* hub cap */}
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 0.05, 12]} />
        <meshStandardMaterial {...casingMat(xray, ghost, PALETTE.forged)} />
      </mesh>
    </group>
  );
}

/** Public single-module renderer for ghost / scattered / tray usage. */
export function DronePart({
  partId,
  xray = false,
  ghost = false,
  spinRefs,
  spinRate,
}: {
  partId: string;
  xray?: boolean;
  ghost?: boolean;
  spinRefs?: React.MutableRefObject<(THREE.Group | null)[]>;
  spinRate?: React.MutableRefObject<number>;
}) {
  const localSpin = useRef<(THREE.Group | null)[]>([]);
  const localRate = useRef(4);
  const sR = spinRefs ?? localSpin;
  const rR = spinRate ?? localRate;
  switch (partId) {
    case 'core':
      return <Core xray={xray} ghost={ghost} />;
    case 'battery':
      return <Battery xray={xray} ghost={ghost} />;
    case 'esc':
      return <EscBoard xray={xray} ghost={ghost} />;
    case 'motors':
      return <MotorStack xray={xray} ghost={ghost} spinRefs={sR} />;
    case 'props':
      return <Props xray={xray} ghost={ghost} spinRefs={sR} spinRate={rR} />;
    default:
      return null;
  }
}

/* ═════════════════════════════════════════════════════════════════════════
 * FLY-IN WRAPPER
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
  const start = useMemo(() => new THREE.Vector3(2.4, 3.2, 2.6), []);
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
      ctrl.set(target.x * 0.4 + 0.5, target.y + 1.8, target.z * 0.4 + 0.5);
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
      {hovered && !selected && <HoverPill label={partName.toUpperCase()} action="INSPECT" position={[0, 0.55, 0]} />}
      {selected && (
        <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.52, 0.6, 40]} />
          <meshBasicMaterial color="#0071e3" transparent opacity={0.75} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
 * LiDAR sweep — rotating wedge + expanding floor ring + ray lines
 * ════════════════════════════════════════════════════════════════════════*/

function LidarSweep({ activeRef, onHit }: { activeRef: React.MutableRefObject<boolean>; onHit: () => void }) {
  const sweep = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringT = useRef(0);
  const rays = useRef<THREE.LineSegments>(null);
  const rayGeo = useMemo(() => {
    const pos: number[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      pos.push(0, 0, 0, Math.cos(a) * 1.9, -1.2, Math.sin(a) * 1.9);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const on = activeRef.current;
    if (sweep.current) {
      sweep.current.visible = on;
      sweep.current.rotation.y = clock.elapsedTime * 2.6;
    }
    if (rays.current) rays.current.visible = on;
    if (ring.current) {
      ring.current.visible = on;
      if (on) {
        const prev = ringT.current;
        ringT.current = (ringT.current + dt * 0.5) % 1;
        if (ringT.current < prev) onHit();
        const r = 0.3 + ringT.current * 3.4;
        ring.current.scale.set(r, r, r);
        (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - ringT.current);
      }
    }
  });

  return (
    <group>
      <group ref={sweep} visible={false}>
        <mesh rotation={[0, 0, 0]}>
          <coneGeometry args={[0.9, 1.15, 3, 1, true]} />
          <meshBasicMaterial
            color="#0071e3"
            transparent
            opacity={0.1}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
      <lineSegments ref={rays} geometry={rayGeo} visible={false}>
        <lineBasicMaterial color="#3b82f6" transparent opacity={0.4} depthWrite={false} />
      </lineSegments>
      <mesh ref={ring} position={[0, -1.22, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.94, 1, 56]} />
        <meshBasicMaterial
          color="#0071e3"
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
 * DRONE ASSEMBLY — master component for Level 3
 * ════════════════════════════════════════════════════════════════════════*/

export function DroneAssembly() {
  const { s, d } = useGame();
  const { push } = useTelemetry();
  const stack = s.stacks.drone;
  const xray = s.xray;

  const spinRefs = useRef<(THREE.Group | null)[]>([]);
  const spinRate = useRef(0);

  const machine = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(0, BENCH_TOP + 0.42, 0));
  const vel = useRef(new THREE.Vector3());
  const yaw = useRef(0);
  const battery = useRef(100);
  const lidarActive = useRef(false);
  const lidarHits = useRef(0);
  const pushAcc = useRef(0);

  /* spinout failure sequence state */
  const spinoutT = useRef(0);
  const spinoutCrash = useRef(false);
  const spinoutWhoosh = useRef(false);

  const failType = s.failure?.type ?? null;
  const spinout = s.phase === 'failure' && (failType === 'torque-spinout' || failType === 'generic');
  const flying = s.phase === 'climax';
  const testing = s.phase === 'testing';

  /* rotor + audio lifecycle */
  useEffect(() => {
    if (flying) {
      sound.startDrone();
      lidarActive.current = true;
      return () => {
        sound.stopDrone();
        lidarActive.current = false;
      };
    }
    lidarActive.current = false;
    return;
  }, [flying]);

  useEffect(() => {
    if (!spinout) {
      spinoutT.current = 0;
      spinoutCrash.current = false;
      spinoutWhoosh.current = false;
    }
  }, [spinout]);

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

  /* electrical paths (x-ray) */
  const wire1 = useMemo(() => seg([0, 0.2, 0.1], [0, 0.34, 0.05]), []);
  const wire2 = useMemo(() => tube([[0, 0.36, 0.05], [0.05, 0.48, 0.03], [0, 0.58, 0]]), []);
  const wire3 = useMemo(() => tube([[0, 0.36, -0.05], [-0.05, 0.34, -0.03], [0, 0.34, 0]]), []);

  /* ── master frame loop: hover flight / spinout / rotors ── */
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const g = machine.current;
    if (!g) return;

    const bob = Math.sin(clock.elapsedTime * 2.1) * 0.03;

    if (flying) {
      /* ── free flight: WASD + arrows ── */
      const boost = flightInput.boost ? 1.7 : 1;
      const acc = new THREE.Vector3(
        flightInput.side * 5.5 * boost,
        flightInput.lift * 3.4 * boost,
        -flightInput.fwd * 5.5 * boost,
      );
      vel.current.addScaledVector(acc, dt);
      vel.current.multiplyScalar(Math.max(0, 1 - 2.6 * dt));
      pos.current.addScaledVector(vel.current, dt);
      pos.current.x = clamp(pos.current.x, -6.4, 6.4);
      pos.current.z = clamp(pos.current.z, -6.4, 6.4);
      pos.current.y = clamp(pos.current.y, BENCH_TOP + 0.3, 6.4);
      yaw.current += flightInput.yaw * 1.8 * dt;

      g.position.set(pos.current.x, pos.current.y + bob, pos.current.z);
      g.rotation.set(
        damp(g.rotation.x, clamp(vel.current.z * 0.09, -0.3, 0.3), 5, dt),
        damp(g.rotation.y, yaw.current, 5, dt),
        damp(g.rotation.z, clamp(-vel.current.x * 0.09, -0.3, 0.3), 5, dt),
      );

      const speed = vel.current.length();
      spinRate.current = damp(spinRate.current, 26 + speed * 1.4, 4, dt);
      sound.setDroneThrottle(clamp(0.45 + speed * 0.09, 0, 1));
      battery.current = Math.max(0, battery.current - dt * 0.14);

      pushAcc.current += dt;
      if (pushAcc.current > 0.1) {
        pushAcc.current = 0;
        push({
          droneX: pos.current.x,
          droneY: pos.current.y,
          droneZ: pos.current.z,
          droneSpeed: speed,
          batteryPct: battery.current,
          lidarHits: lidarHits.current,
        });
      }
    } else if (spinout) {
      /* ── Newton's 3rd law failure: rise, counter-spin, crash ── */
      spinoutT.current += dt;
      const t = spinoutT.current;
      if (t < 0.9) {
        pos.current.y = BENCH_TOP + 0.42 + t * 0.9;
        g.position.set(0, pos.current.y, 0);
        spinRate.current = 34;
        g.rotation.y -= dt * (2 + t * 9); // body spins OPPOSITE to upper rotor
      } else if (t < 2.3) {
        if (!spinoutWhoosh.current) {
          spinoutWhoosh.current = true;
          sound.klaxon(4);
        }
        g.rotation.y -= dt * 13;
        g.position.x = Math.sin(t * 7) * 0.5;
        g.position.z = Math.cos(t * 6) * 0.4;
        g.position.y = BENCH_TOP + 0.42 + Math.max(0, 1.4 - (t - 0.9) * 1.6);
        g.rotation.z = (t - 0.9) * 0.5;
        spinRate.current = Math.max(0, 34 - (t - 0.9) * 22);
        fxBus.requestShake(0.25);
      } else if (!spinoutCrash.current) {
        spinoutCrash.current = true;
        sound.crash();
        fxBus.requestShake(1.1);
      } else {
        g.position.y = damp(g.position.y, BENCH_TOP + 0.34, 8, dt);
        g.rotation.z = damp(g.rotation.z, 0.42, 5, dt);
        g.rotation.y += dt * 1.4;
        spinRate.current = damp(spinRate.current, 0, 3, dt);
      }
    } else {
      /* on the bench — gentle idle or hover-trial spool */
      const targetY = BENCH_TOP + 0.42 + (testing ? 0.5 + bob : 0);
      pos.current.set(0, damp(pos.current.y, targetY, 4, dt), 0);
      g.position.copy(pos.current);
      g.rotation.x = damp(g.rotation.x, 0, 4, dt);
      g.rotation.y = damp(g.rotation.y, 0, 4, dt);
      g.rotation.z = damp(g.rotation.z, 0, 4, dt);
      spinRate.current = damp(spinRate.current, testing ? 30 : stack.length === DEF.parts.length ? 3.5 : 0, 3, dt);
      if (testing) {
        pushAcc.current += dt;
        if (pushAcc.current > 0.12) {
          pushAcc.current = 0;
          push({ batteryPct: battery.current, lidarHits: lidarHits.current });
        }
      }
    }
  });

  const propsMounted = stack.includes('props');

  return (
    <group ref={machine} position={[0, BENCH_TOP + 0.42, 0]}>
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
          {id === 'props' ? (
            <DronePart partId="props" xray={xray} spinRefs={spinRefs} spinRate={spinRate} />
          ) : (
            <DronePart partId={id} xray={xray} />
          )}
        </MountWrapper3D>
      ))}

      {/* electrical pulses (x-ray) */}
      {stack.length === DEF.parts.length && xray && s.exploded < 0.05 && (
        <group>
          <FlowParticles curve={wire1} count={8} color="#0071e3" size={0.03} speed={0.8} />
          <FlowParticles curve={wire2} count={10} color="#0071e3" size={0.03} speed={0.6} />
          <FlowParticles curve={wire3} count={8} color="#7c3aed" size={0.028} speed={0.6} />
        </group>
      )}

      {/* downward airflow vectors when airborne */}
      {(flying || testing) && propsMounted && (
        <AirflowArrows spinRate={spinRate} />
      )}

      {/* LiDAR while flying */}
      {flying && propsMounted && (
        <LidarSweep
          activeRef={lidarActive}
          onHit={() => {
            lidarHits.current += Math.floor(4 + Math.random() * 9);
          }}
        />
      )}

      {/* next-part snap ghost */}
      {nextPart && s.phase === 'play' && (
        <group position={[0, s.exploded * EXPLODE_GAP * (stack.length + 0.4), 0]}>
          <group position={ASSEMBLED_POS[nextPart.id] ?? [0, 0, 0]}>
            <DronePart partId={nextPart.id} ghost />
          </group>
          <mesh position={[0, -0.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.6, 0.68, 44]} />
            <meshBasicMaterial color="#0071e3" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* crash smoke after spinout impact */}
      {spinout && spinoutCrash.current && (
        <SmokeColumn position={[0, -0.3, 0]} active color="#3f3f46" height={1.6} count={36} />
      )}
    </group>
  );
}

/* ── animated airflow cones under the rotor discs ── */
function AirflowArrows({ spinRate }: { spinRate: React.MutableRefObject<number> }) {
  const ARROWS = 4;
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const phases = useRef<number[]>([0.1, 0.4, 0.7, 0.95]);
  const spots: [number, number][] = [
    [-0.55, -0.6],
    [0.55, -0.6],
    [-0.55, 0.6],
    [0.55, 0.6],
  ];
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const speed = 0.5 + spinRate.current * 0.02;
    for (let i = 0; i < ARROWS; i++) {
      const m = meshes.current[i];
      if (!m) continue;
      phases.current[i] = (phases.current[i] + dt * speed) % 1;
      const p = phases.current[i];
      m.position.y = -0.25 - p * 1.1;
      const s = 0.5 + p * 0.9;
      m.scale.set(s, s * 1.6, s);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - p);
    }
  });
  return (
    <group>
      {spots.map(([x, z], i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          position={[x, -0.5, z]}
        >
          <coneGeometry args={[0.14, 0.3, 10, 1, true]} />
          <meshBasicMaterial
            color="#0071e3"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
