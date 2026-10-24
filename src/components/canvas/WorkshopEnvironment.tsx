/* ============================================================================
 * AEROFORGE — Daylight Studio environment: open infinity cyclorama
 * (NO enclosing walls — the camera can never be occluded), NASA-white
 * cleanroom floor, precision CNC turntable pedestal, bright aerospace tool
 * carts for the scavengeable modules, and a photorealistic high-key studio
 * lighting rig. Floating tags appear ONLY on hover.
 * ==========================================================================*/

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ContactShadows, Float, Grid } from '@react-three/drei';
import { machineById } from '../../data/machinesData';
import { useGame } from '../../state/gameStore';
import { sound } from '../../audio/SoundEngine';
import { circleLines, damp, spokeLines } from '../../lib/curves';
import { casingMat, PALETTE } from '../../lib/materials';
import { HoverPill } from './FX';
import { RocketPart } from './ProceduralRocket';
import { V8Part } from './ProceduralV8Engine';
import { DronePart } from './ProceduralDrone';

export const BENCH_TOP = 0.55;
export const STUDIO_BG = '#f2f4f8';

/* ── canvas-texture floor decal (zero external assets) ───────────────────── */

function makeFloorDecal(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 1024, 1024);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.16)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(512, 512, 430, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(512, 512, 300, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
  ctx.font = 'bold 54px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AEROFORGE', 512, 480);
  ctx.font = '600 30px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
  ctx.fillText('TEST RANGE 01 · HOW IT WORKS', 512, 534);
  ctx.fillStyle = 'rgba(255, 85, 0, 0.85)';
  ctx.fillRect(432, 570, 160, 10);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ═════════════════════════════════════════════════════════════════════════
 * THE OPEN CYCLORAMA STUDIO — floor + fog + high-key light rig
 * ════════════════════════════════════════════════════════════════════════*/

export function StudioRoom() {
  const decal = useMemo(() => makeFloorDecal(), []);
  const ringGeos = useMemo(() => [2.3, 3.1, 3.9, 4.7].map((r) => circleLines(r, 0.002)), []);
  const spokes = useMemo(() => spokeLines(4.7, 0.002, 24, 0.4), []);
  const turntable = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (turntable.current) turntable.current.rotation.y += dt * 0.04;
  });

  return (
    <group>
      {/* matte light-grey architectural epoxy floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[46, 72]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.04} roughness={0.72} />
      </mesh>
      {/* subtle architectural grid */}
      <Grid
        position={[0, 0.012, 0]}
        args={[30, 30]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#cbd5e1"
        sectionSize={2.5}
        sectionThickness={0.8}
        sectionColor="#b9c4d2"
        fadeDistance={26}
        fadeStrength={1.6}
        infiniteGrid={false}
      />
      {/* floor range decal */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
        <planeGeometry args={[11, 11]} />
        <meshBasicMaterial map={decal} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* ── high-key studio light rig ── */}
      <ambientLight intensity={1.5} color="#ffffff" />
      <hemisphereLight intensity={1.2} color="#ffffff" groundColor="#cbd5e1" />
      <directionalLight
        position={[8, 15, 10]}
        intensity={2.4}
        color="#fffdf9"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[-8, 10, -6]} intensity={1.4} color="#e0f2fe" />
      <directionalLight position={[0, 6, 12]} intensity={1.0} color="#ffffff" />
    </group>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
 * CAD STUDIO — clean daylight void for blueprint inspection
 * ════════════════════════════════════════════════════════════════════════*/

export function CadStudio() {
  const rings = useMemo(() => [2.2, 3.2, 4.2, 5.2].map((r) => circleLines(r, 0.001)), []);
  const spokes = useMemo(() => spokeLines(5.2, 0.001, 24, 0.12), []);
  const disc = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (disc.current) disc.current.rotation.z += dt * 0.05;
  });
  return (
    <group>
      <mesh ref={disc} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
        <circleGeometry args={[5.6, 72]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.1} roughness={0.55} />
      </mesh>
      {rings.map((g, i) => (
        <lineSegments key={i} geometry={g} position={[0, 0.005, 0]}>
          <lineBasicMaterial color="#94a3b8" transparent opacity={0.55} />
        </lineSegments>
      ))}
      <lineSegments geometry={spokes} position={[0, 0.005, 0]}>
        <lineBasicMaterial color="#b9c4d2" transparent opacity={0.4} />
      </lineSegments>
      <Grid
        position={[0, 0.002, 0]}
        args={[14, 14]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#cbd5e1"
        sectionSize={2.5}
        sectionThickness={0.9}
        sectionColor="#aab6c6"
        fadeDistance={16}
        infiniteGrid={false}
      />
      <ambientLight intensity={1.5} color="#ffffff" />
      <hemisphereLight intensity={1.1} color="#ffffff" groundColor="#cbd5e1" />
      <directionalLight position={[6, 12, 6]} intensity={2.2} color="#fffdf9" castShadow />
      <directionalLight position={[-7, 8, -5]} intensity={1.2} color="#e0f2fe" />
      <pointLight position={[0, 6, 0]} intensity={30} color="#ffffff" distance={18} />
    </group>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
 * PRECISION CNC TURNTABLE PEDESTAL (workbench / launch mount)
 * ════════════════════════════════════════════════════════════════════════*/

export function HoloBench() {
  const rings = useMemo(() => [2.35, 1.7, 1.05].map((r) => circleLines(r, BENCH_TOP + 0.016)), []);
  const spokes = useMemo(() => spokeLines(2.35, BENCH_TOP + 0.016, 24, 0.5), []);
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.04;
  });
  return (
    <group>
      {/* white ceramic base */}
      <mesh position={[0, BENCH_TOP / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.45, 2.6, BENCH_TOP, 64]} />
        <meshStandardMaterial color="#ffffff" metalness={0.08} roughness={0.3} />
      </mesh>
      {/* brushed aluminium bevel ring */}
      <mesh position={[0, BENCH_TOP - 0.045, 0]}>
        <torusGeometry args={[2.46, 0.035, 12, 72]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.22} />
      </mesh>
      {/* machined turntable top */}
      <mesh position={[0, BENCH_TOP + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.42, 64]} />
        <meshStandardMaterial color="#fafbfc" metalness={0.15} roughness={0.24} />
      </mesh>
      {/* rotating measurement rings */}
      <group ref={spin} position={[0, 0, 0]}>
        {rings.map((g, i) => (
          <lineSegments key={i} geometry={g}>
            <lineBasicMaterial color="#94a3b8" transparent opacity={0.4} />
          </lineSegments>
        ))}
        <lineSegments geometry={spokes}>
          <lineBasicMaterial color="#b9c4d2" transparent opacity={0.35} />
        </lineSegments>
      </group>
      {/* international-orange safety chevrons around the rim */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const long = i % 3 === 0;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 2.52, BENCH_TOP + 0.008, Math.sin(a) * 2.52]}
            rotation={[-Math.PI / 2, 0, -a + Math.PI / 2]}
          >
            <planeGeometry args={[long ? 0.34 : 0.16, 0.07]} />
            <meshStandardMaterial color="#ff5500" roughness={0.5} metalness={0.1} />
          </mesh>
        );
      })}
      {/* datum pucks */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.95, BENCH_TOP + 0.03, Math.sin(a) * 1.95]}>
            <cylinderGeometry args={[0.09, 0.11, 0.05, 16]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.3} />
          </mesh>
        );
      })}
      <ContactShadows position={[0, 0.02, 0]} opacity={0.35} scale={22} blur={2.2} far={6} color="#334155" />
    </group>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
 * BRIGHT AEROSPACE TOOL CARTS (module display racks + plinth lighting)
 * ════════════════════════════════════════════════════════════════════════*/

function ToolCart({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* body */}
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.84, 1.0]} />
        <meshStandardMaterial color="#ffffff" metalness={0.15} roughness={0.35} />
      </mesh>
      {/* silver worktop */}
      <mesh position={[0, 0.86, 0]} castShadow>
        <boxGeometry args={[1.76, 0.06, 1.06]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.85} roughness={0.28} />
      </mesh>
      {/* orange identity stripe + label plate */}
      <mesh position={[0, 0.58, 0.505]}>
        <boxGeometry args={[1.72, 0.1, 0.012]} />
        <meshStandardMaterial color="#ff5500" roughness={0.45} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.3, 0.505]}>
        <boxGeometry args={[0.7, 0.22, 0.012]} />
        <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* chrome push handle */}
      <mesh position={[0, 1.02, -0.56]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.028, 0.028, 1.5, 12]} />
        <meshStandardMaterial {...casingMat(false, false, PALETTE.steel)} />
      </mesh>
      {/* drawer lines */}
      {[0.18, 0.34].map((y, i) => (
        <mesh key={i} position={[0, y, 0.502]}>
          <boxGeometry args={[1.5, 0.015, 0.014]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* caster wheels */}
      {[
        [-0.7, -0.36],
        [0.7, -0.36],
        [-0.7, 0.36],
        [0.7, 0.36],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.07, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.05, 14]} />
          <meshStandardMaterial color="#334155" metalness={0.3} roughness={0.6} />
        </mesh>
      ))}
      {/* soft studio plinth light */}
      <pointLight position={[0, 1.7, 0]} intensity={9} distance={4.4} color="#ffffff" decay={2} />
    </group>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
 * SCAVENGEABLE MODULES — hover-only tooltip, click to collect
 * ════════════════════════════════════════════════════════════════════════*/

const CARTS: { pos: [number, number, number]; rotY: number }[] = [
  { pos: [-4.4, 0, -4.6], rotY: 0.55 },
  { pos: [4.6, 0, -3.8], rotY: -0.45 },
  { pos: [-4.8, 0, 3.9], rotY: -0.15 },
  { pos: [4.9, 0, 4.3], rotY: 0.35 },
];

/* module anchor spots: floating above cart worktops */
const ROOM_SPOTS: { pos: [number, number, number]; rotY: number; cart: number }[] = [
  { pos: [-4.7, 1.42, -4.35], rotY: 0.4, cart: 0 },
  { pos: [-4.05, 1.42, -4.9], rotY: -0.3, cart: 0 },
  { pos: [4.9, 1.42, -3.55], rotY: -0.4, cart: 1 },
  { pos: [4.3, 1.42, -4.1], rotY: 0.5, cart: 1 },
  { pos: [-4.55, 1.42, 4.2], rotY: -0.2, cart: 2 },
  { pos: [-5.1, 1.42, 3.55], rotY: 0.3, cart: 2 },
  { pos: [4.6, 1.42, 4.6], rotY: 0.4, cart: 3 },
  { pos: [5.2, 1.42, 4.0], rotY: -0.4, cart: 3 },
];

function arSpot(i: number): { pos: [number, number, number]; rotY: number } {
  const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
  return { pos: [Math.cos(a) * 3.4, 1.35 + (i % 3) * 0.55, Math.sin(a) * 3.4], rotY: -a };
}

function MachinePartMesh({ partId, level }: { partId: string; level: string }) {
  if (level === 'rocket') return <RocketPart partId={partId} />;
  if (level === 'v8') return <V8Part partId={partId} />;
  return <DronePart partId={partId} />;
}

function ScatteredPart({
  partId,
  level,
  spot,
  name,
  onCollect,
}: {
  partId: string;
  level: string;
  spot: { pos: [number, number, number]; rotY: number };
  name: string;
  onCollect: () => void;
}) {
  const scale = level === 'rocket' ? 0.42 : level === 'v8' ? 0.72 : 0.78;
  const g = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const s = useRef(scale);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (!g.current) return;
    s.current = damp(s.current, hovered ? scale * 1.06 : scale, 10, dt);
    g.current.scale.setScalar(s.current);
  });

  return (
    <Float speed={1.6} rotationIntensity={0.3} floatIntensity={0.42}>
      <group
        ref={g}
        position={spot.pos}
        rotation={[0, spot.rotY, 0]}
        scale={scale}
        onClick={(e) => {
          if (e.delta > 7) return;
          e.stopPropagation();
          onCollect();
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
        <MachinePartMesh partId={partId} level={level} />
        {/* generous invisible pick collider — tiny hollow parts stay easy to hover/click */}
        <mesh>
          <sphereGeometry args={[0.62, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
        {/* quiet display plinth disc */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
          <circleGeometry args={[0.42, 36]} />
          <meshStandardMaterial color="#ffffff" metalness={0.1} roughness={0.4} transparent opacity={0.9} />
        </mesh>
        {hovered && (
          <HoverPill
            label={name}
            action="COLLECT"
            accent="orange"
            position={[0, 1.15 / scale, 0]}
          />
        )}
      </group>
    </Float>
  );
}

export function ScatteredParts() {
  const { s, d } = useGame();
  const def = machineById(s.level);
  const uncollected = def.parts.filter((p) => !s.collected[s.level].includes(p.id));
  const isAR = s.viewMode === 'ar';
  const isCAD = s.viewMode === 'cad';

  if (isCAD) return null;

  const usedCarts = new Set(ROOM_SPOTS.slice(0, uncollected.length).map((sp) => sp.cart));

  return (
    <group>
      {!isAR &&
        CARTS.filter((_, i) => usedCarts.has(i)).map((c, i) => (
          <ToolCart key={i} position={c.pos} rotationY={c.rotY} />
        ))}
      {uncollected.map((p, i) => (
        <ScatteredPart
          key={p.id}
          partId={p.id}
          level={s.level}
          spot={isAR ? arSpot(i) : ROOM_SPOTS[i % ROOM_SPOTS.length]}
          name={p.short.toUpperCase()}
          onCollect={() => {
            sound.collect();
            sound.speak(`${p.name} acquired.`, { interrupt: false });
            d({ t: 'collect', part: p.id });
            d({ t: 'toast', text: `RECOVERED ▸ ${p.name}`, kind: 'good' });
          }}
        />
      ))}
    </group>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
 * PARTS TRAY — collected modules docked on white ceramic pedestals;
 * hover tooltip only, click to mount (fly-in), drag to snap
 * ════════════════════════════════════════════════════════════════════════*/

export function traySlot(i: number): { pos: [number, number, number]; rotY: number } {
  const a = -0.5 + i * 0.42;
  return { pos: [Math.cos(a) * 3.35, 1.06, Math.sin(a) * 3.35], rotY: -a + Math.PI / 2 };
}

function TrayPart({
  partId,
  level,
  slot,
  name,
  onMount,
  dragging,
  onDragStart,
}: {
  partId: string;
  level: string;
  slot: { pos: [number, number, number]; rotY: number };
  name: string;
  onMount: () => void;
  dragging: { id: string; pos: THREE.Vector3 } | null;
  onDragStart: (id: string) => void;
}) {
  const g = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const isDragged = dragging?.id === partId;
  const scale = level === 'rocket' ? 0.4 : level === 'v8' ? 0.66 : 0.7;
  const s = useRef(scale);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (!g.current) return;
    if (isDragged && dragging) {
      g.current.position.lerp(dragging.pos, 1 - Math.exp(-18 * dt));
      s.current = damp(s.current, scale * 1.08, 10, dt);
    } else {
      g.current.position.x = damp(g.current.position.x, slot.pos[0], 4, dt);
      g.current.position.y = damp(g.current.position.y, slot.pos[1], 4, dt);
      g.current.position.z = damp(g.current.position.z, slot.pos[2], 4, dt);
      s.current = damp(s.current, hovered ? scale * 1.06 : scale, 10, dt);
    }
    g.current.scale.setScalar(s.current);
  });

  return (
    <group>
      {/* white ceramic pedestal */}
      <mesh position={[slot.pos[0], slot.pos[1] - 0.66, slot.pos[2]]}>
        <cylinderGeometry args={[0.15, 0.19, 0.26, 18]} />
        <meshStandardMaterial color="#ffffff" metalness={0.1} roughness={0.3} />
      </mesh>
      <mesh position={[slot.pos[0], slot.pos[1] - 0.52, slot.pos[2]]}>
        <torusGeometry args={[0.16, 0.014, 8, 28]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.85} roughness={0.25} />
      </mesh>
      <group
        ref={g}
        position={slot.pos}
        rotation={[0, slot.rotY, 0]}
        scale={scale}
        onClick={(e) => {
          if (e.delta > 7) return;
          e.stopPropagation();
          onMount();
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onDragStart(partId);
        }}
        onPointerOver={() => {
          setHovered(true);
          document.body.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <MachinePartMesh partId={partId} level={level} />
        {/* generous invisible pick collider */}
        <mesh>
          <sphereGeometry args={[0.55, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
        {hovered && !isDragged && (
          <HoverPill label={name} action="MOUNT" position={[0, 0.85 / scale, 0]} />
        )}
      </group>
    </group>
  );
}

export function PartsTray({
  dragging,
  onMount,
  onDragStart,
}: {
  dragging: { id: string; pos: THREE.Vector3 } | null;
  onMount: (id: string) => void;
  onDragStart: (id: string) => void;
}) {
  const { s } = useGame();
  const def = machineById(s.level);
  const inTray = def.parts.filter(
    (p) => s.collected[s.level].includes(p.id) && !s.stacks[s.level].includes(p.id),
  );
  return (
    <group>
      {inTray.map((p, i) => (
        <TrayPart
          key={p.id}
          partId={p.id}
          level={s.level}
          slot={traySlot(i)}
          name={p.short.toUpperCase()}
          onMount={() => onMount(p.id)}
          onDragStart={onDragStart}
          dragging={dragging}
        />
      ))}
    </group>
  );
}
