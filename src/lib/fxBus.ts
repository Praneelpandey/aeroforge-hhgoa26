/* ============================================================================
 * Tiny imperative FX bus — 3D systems trigger camera shake / screen flash
 * without threading callbacks through React state.
 * ==========================================================================*/

export const fxBus = {
  /** 0..1+ requested shake intensity; Experience decays it every frame. */
  shake: 0,
  requestShake(v: number): void {
    this.shake = Math.max(this.shake, v);
  },
  consumeShake(): number {
    const s = this.shake;
    this.shake = 0;
    return s;
  },
};

/** Keyboard flight input for the Helios-X drone (polled by the 3D scene). */
export const flightInput = {
  fwd: 0,
  side: 0,
  yaw: 0,
  lift: 0,
  boost: false,
  reset(): void {
    this.fwd = 0;
    this.side = 0;
    this.yaw = 0;
    this.lift = 0;
    this.boost = false;
  },
};
