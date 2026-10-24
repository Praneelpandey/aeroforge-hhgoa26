/* ============================================================================
 * AEROFORGE — Experience: everything inside the <Canvas>.
 * Mode switching (Room / AR / CAD), camera rig, drag-and-snap controller,
 * keyboard flight input, camera shake and per-level machine assembly.
 * ==========================================================================*/

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { machineById } from '../../data/machinesData';
import { useGame } from '../../state/gameStore';
import { sound } from '../../audio/SoundEngine';
import { flightInput } from '../../lib/fxBus';
import { damp } from '../../lib/curves';
import { ShakeGroup } from './FX';
import { CadStudio, HoloBench, PartsTray, ScatteredParts, StudioRoom, STUDIO_BG } from './WorkshopEnvironment';
import { RocketAssembly } from './ProceduralRocket';
import { V8Assembly } from './ProceduralV8Engine';
import { DroneAssembly } from './ProceduralDrone';

/* ── world-space snap anchor for the next part (per machine) ────────────── */

function ghostAnchor(level: string, stackH: number, stackLen: number, exploded: number): THREE.Vector3 {
  if (level === 'rocket') {
    return new THREE.Vector3(0, 0.55 + stackH + exploded * 0.6 * stackLen + 0.45, 0);
  }
  if (level === 'v8') {
    return new THREE.Vector3(0, 1.13 + exploded * 0.8 * (stackLen + 0.4), 0);
  }
  return new THREE.Vector3(0, 0.97 + exploded * 0.62 * (stackLen + 0.4) + 0.25, 0);
}

/* ── camera rig: smooth preset transitions on level / mode change ───────── */

function CameraRig() {
  const { s } = useGame();
  const { camera } = useThree();
  const controls = useThree((st) => st.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const def = machineById(s.level);
  const anim = useRef(1);
  const from = useRef(new THREE.Vector3());
  const fromT = useRef(new THREE.Vector3());
  const to = useRef(new THREE.Vector3());
  const toT = useRef(new THREE.Vector3());

  useEffect(() => {
    const pos =
      s.viewMode === 'room' ? def.camera.room : s.viewMode === 'cad' ? def.camera.cad : def.camera.ar;
    const tgt = s.viewMode === 'cad' ? def.camera.cadTarget : def.camera.target;
    from.current.copy(camera.position);
    if (controls) fromT.current.copy(controls.target);
    else fromT.current.set(0, 1.5, 0);
    to.current.set(...pos);
    toT.current.set(...tgt);
    anim.current = 0;
  }, [s.level, s.viewMode, camera, controls, def]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (anim.current >= 1) return;
    anim.current = Math.min(1, anim.current + dt / 1.5);
    const e = 1 - Math.pow(1 - anim.current, 3);
    camera.position.lerpVectors(from.current, to.current, e);
    if (controls) {
      controls.target.lerpVectors(fromT.current, toT.current, e);
      controls.update();
    }
  });
  return null;
}

/* ── keyboard flight input for the Helios-X ─────────────────────────────── */

function FlightInput() {
  const { s } = useGame();
  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      switch (e.code) {
        case 'KeyW':
          flightInput.fwd = 1;
          break;
        case 'KeyS':
          flightInput.fwd = -1;
          break;
        case 'KeyA':
          flightInput.side = -1;
          break;
        case 'KeyD':
          flightInput.side = 1;
          break;
        case 'ArrowUp':
          flightInput.lift = 1;
          break;
        case 'ArrowDown':
          flightInput.lift = -1;
          break;
        case 'ArrowLeft':
          flightInput.yaw = 1;
          break;
        case 'ArrowRight':
          flightInput.yaw = -1;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          flightInput.boost = true;
          break;
        default:
          return;
      }
      if (e.code.startsWith('Arrow')) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'KeyS':
          flightInput.fwd = 0;
          break;
        case 'KeyA':
        case 'KeyD':
          flightInput.side = 0;
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          flightInput.lift = 0;
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
          flightInput.yaw = 0;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          flightInput.boost = false;
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      flightInput.reset();
    };
  }, []);
  void s;
  return null;
}

/* ── drag-and-snap controller (3D drag onto the green ghost) ────────────── */

interface DragState {
  id: string;
  pos: THREE.Vector3;
  moved: boolean;
}

function DragController({
  anchor,
  onMount,
  children,
}: {
  anchor: THREE.Vector3;
  onMount: (id: string) => void;
  children: (dragging: DragState | null, startDrag: (id: string) => void) => React.ReactNode;
}) {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const { camera } = useThree();
  const controls = useThree((st) => st.controls) as unknown as { enabled: boolean } | null;
  const downPx = useRef({ x: 0, y: 0 });
  const raycaster = useRef(new THREE.Raycaster());
  const plane = useRef(new THREE.Plane());
  const ndc = useRef(new THREE.Vector2());
  const hit = useRef(new THREE.Vector3());

  const startDrag = (id: string) => {
    downPx.current = { x: -1, y: -1 };
    const init = anchor.clone().add(new THREE.Vector3(0.4, 0.4, 0.4));
    dragRef.current = { id, pos: init, moved: false };
    setDragging(dragRef.current);
    if (controls) controls.enabled = false;
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const dr = dragRef.current;
      if (!dr) return;
      if (downPx.current.x < 0) {
        downPx.current = { x: e.clientX, y: e.clientY };
      }
      if (Math.hypot(e.clientX - downPx.current.x, e.clientY - downPx.current.y) > 7) dr.moved = true;
      if (!dr.moved) return;
      const el = e.target as HTMLElement | null;
      const rect = (el ?? document.body).getBoundingClientRect();
      ndc.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.current.setFromCamera(ndc.current, camera);
      const n = camera.getWorldDirection(new THREE.Vector3());
      plane.current.setFromNormalAndCoplanarPoint(n, anchor);
      const pt = raycaster.current.ray.intersectPlane(plane.current, hit.current);
      if (pt) dr.pos.copy(pt);
      setDragging({ ...dr, pos: dr.pos.clone() });
    };
    const finish = () => {
      const dr = dragRef.current;
      if (!dr) return;
      dragRef.current = null;
      setDragging(null);
      if (controls) controls.enabled = true;
      if (!dr.moved) {
        onMount(dr.id);
        return;
      }
      if (dr.pos.distanceTo(anchor) < 1.35) {
        sound.snap();
        onMount(dr.id);
      } else {
        sound.unsnap();
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
    };
  }, [anchor, camera, controls, onMount]);

  return <>{children(dragging, startDrag)}</>;
}

/* ── the Experience root ─────────────────────────────────────────────────── */

export function Experience() {
  const { s, d } = useGame();
  const def = machineById(s.level);
  const stack = s.stacks[s.level];

  const anchor = useMemo(() => {
    const stackH = stack.reduce((a, id) => a + (def.parts.find((p) => p.id === id)?.buildHeight ?? 0.4), 0);
    return ghostAnchor(s.level, stackH, stack.length, s.exploded);
  }, [s.level, s.exploded, stack, def]);

  const mount = (id: string) => {
    if (s.phase !== 'play') return;
    d({ t: 'mount', part: id });
    sound.snap();
    const p = def.parts.find((pp) => pp.id === id);
    if (p) sound.speak(`${p.name} mounted.`, { interrupt: false });
  };

  return (
    <>
      {/* background & atmosphere per mode — bright daylight cyclorama */}
      {s.viewMode === 'room' && (
        <>
          <color attach="background" args={[STUDIO_BG]} />
          <fog attach="fog" args={[STUDIO_BG, 20, 48]} />
        </>
      )}
      {s.viewMode === 'cad' && (
        <>
          <color attach="background" args={[STUDIO_BG]} />
          <fog attach="fog" args={[STUDIO_BG, 30, 70]} />
        </>
      )}
      {s.viewMode === 'ar' && (
        <>
          <ambientLight intensity={1.2} color="#ffffff" />
          <hemisphereLight intensity={1.0} color="#ffffff" groundColor="#cbd5e1" />
          <directionalLight position={[6, 12, 8]} intensity={2.0} color="#fffdf9" castShadow />
          <directionalLight position={[-6, 8, -4]} intensity={1.1} color="#e0f2fe" />
        </>
      )}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.09}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2 - 0.04}
        minDistance={3.5}
        maxDistance={16}
        autoRotate={s.viewMode === 'cad'}
        autoRotateSpeed={0.7}
      />
      <CameraRig />
      <FlightInput />

      <ShakeGroup>
        {s.viewMode === 'room' && <StudioRoom />}
        {s.viewMode === 'cad' && <CadStudio />}

        <HoloBench />

        {s.level === 'rocket' && <RocketAssembly />}
        {s.level === 'v8' && <V8Assembly />}
        {s.level === 'drone' && <DroneAssembly />}

        <ScatteredParts />

        <DragController anchor={anchor} onMount={mount}>
          {(dragging, startDrag) => (
            <PartsTray dragging={dragging} onMount={mount} onDragStart={startDrag} />
          )}
        </DragController>
      </ShakeGroup>
    </>
  );
}
