/* ============================================================================
 * AEROFORGE — Machine encyclopedia: educational copy, live physics math and
 * assembly validation rules for all three playable levels.
 * ==========================================================================*/

import type { FailureDiagnostic, MachineDef, PartDef, Readout } from '../types/engineering';

const R = (label: string, value: string, hint?: string): Readout => ({ label, value, hint });
const g0 = 9.80665; // standard gravity, m/s²

/* ═══════════════════════════════════════════════════════════════════════════
 * LEVEL 1 — Ares-V Orbital Cryogenic Rocket
 * ══════════════════════════════════════════════════════════════════════════*/

const rocketNozzle: PartDef = {
  id: 'nozzle',
  name: 'De Laval Thrust Nozzle',
  short: 'Thrust Nozzle',
  tag: 'Propulsion',
  accent: '#8b98ab',
  massKg: 460,
  buildHeight: 0.92,
  eli10:
    "This is the rocket's megaphone. Hot gas from the engine squeezes through a tiny throat, then blasts into the flaring bell — and by expanding, the gas speeds up to over 4 football fields per second! The bell's job is to point all that screaming speed straight down. Push one way, and Newton's third law pushes the rocket the other way. That's thrust.",
  pro:
    'A converging–diverging De Laval nozzle chokes the flow to Mach 1 at the throat, then expands the hot gas isentropically, converting enthalpy into directed kinetic energy. Expansion ratio ε = Ae/At sets the exit pressure; ideally pe ≈ ambient (0 at vacuum). Under-expanded flow wastes energy, over-expanded flow separates from the wall and causes dangerous side loads.',
  whatIfGone:
    'Without the bell, the chamber just sprays gas in every direction — thrust collapses to ~15% and the rocket sits on the pad, burning.',
  formula: 'vₑ = √( 2γ/(γ−1) · R_s·T_c · (1 − (pₑ/p_c)^((γ−1)/γ) ) )   ·   I_sp = vₑ / g₀',
  params: [
    { id: 'pc', label: 'Chamber Pressure', symbol: 'P_c', min: 5, max: 25, step: 0.5, value: 20, unit: 'MPa' },
    { id: 'er', label: 'Expansion Ratio', symbol: 'ε', min: 10, max: 80, step: 1, value: 40, unit: ':1' },
    { id: 'mdot', label: 'Mass Flow', symbol: 'ṁ', min: 120, max: 420, step: 5, value: 260, unit: 'kg/s' },
  ],
  compute: (p) => {
    const gam = 1.22;
    const Rs = 378; // J/(kg·K) hot exhaust (M ≈ 22 g/mol)
    const Tc = 3500; // K
    // pe/pc = ε^(−γ/(γ−1))  →  (pe/pc)^((γ−1)/γ) = 1/ε
    const ve = Math.sqrt(((2 * gam) / (gam - 1)) * Rs * Tc * (1 - 1 / p.er));
    const isp = ve / g0;
    const F = p.mdot * ve; // ideal, matched exit
    const gamTerm = Math.sqrt(gam / (Rs * Tc)) * Math.pow(2 / (gam + 1), (gam + 1) / (2 * (gam - 1)));
    const At = p.mdot / (p.pc * 1e6 * gamTerm);
    return [
      R('Exhaust velocity vₑ', `${fmt(ve, 0)} m/s`, 'supersonic hot core'),
      R('Specific impulse I_sp', `${fmt(isp, 0)} s`, 'per kg of propellant'),
      R('Ideal thrust F', `${fmt(F / 1000, 0)} kN`, 'ṁ·vₑ at matched exit'),
      R('Throat Ø', `${fmt(Math.sqrt((4 * At) / Math.PI) * 1000, 0)} mm`, 'Mach 1 station'),
    ];
  },
};

const rocketJacket: PartDef = {
  id: 'jacket',
  name: 'Regenerative Cooling Jacket',
  short: 'Cooling Jacket',
  tag: 'Thermal',
  accent: '#d98e4a',
  massKg: 310,
  buildHeight: 0.34,
  eli10:
    "Wrap hundreds of metres of pipes around the hottest part of the engine, then push the icy-cold rocket fuel (−253 °C!) through them before it burns. The fuel drinks up the heat so the metal walls don't melt like a candle. It's like drinking a slushie to keep your mouth from burning on hot soup — recycling the heat instead of wasting it.",
  pro:
    'Regenerative cooling routes cryogenic propellant through milled channels around the throat and nozzle wall before injection. Wall heat flux at the throat reaches 40–160 MW/m². The absorbed energy is recovered as propellant enthalpy ("regenerative"), raising injector inlet temperature and overall efficiency. Copper alloys (NARloy-Z) are used for their λ ≈ 300 W/m·K conductivity.',
  whatIfGone:
    'The 3,300 °C exhaust is hotter than the melting point of every metal in the chamber — within ~8 seconds the nozzle glows, sags and bursts. Total vehicle loss.',
  formula: 'q″ = h_g·(T_gas − T_wall)   ·   ΔT_coolant = Q / (ṁ·c_p)',
  params: [
    { id: 'flow', label: 'Coolant Flow (LH2)', symbol: 'ṁ_c', min: 80, max: 500, step: 5, value: 240, unit: 'kg/s' },
    { id: 'q', label: 'Throat Heat Flux', symbol: 'q″', min: 20, max: 160, step: 5, value: 85, unit: 'MW/m²' },
    { id: 'ath', label: 'Hot Area', symbol: 'A_hot', min: 0.15, max: 0.6, step: 0.01, value: 0.26, unit: 'm²' },
  ],
  compute: (p) => {
    const cp = 14100; // J/kg·K LH2 — the best coolant known
    const Q = p.q * 1e6 * p.ath;
    const dT = Q / (p.flow * cp);
    const wall = 950 - (p.flow - 80) * 1.1; // heuristic wall-temperature margin model
    return [
      R('Absorbed heat Q̇', `${fmt(Q / 1e6, 0)} MW`, 'regenerated into propellant'),
      R('Coolant ΔT', `${fmt(Math.max(18, dT), 0)} K`, 'still deeply cryogenic'),
      R('Wall temp margin', `${fmt(wall, 0)} K`, 'to NARloy-Z limit 950 K'),
      dT > 210 ? R('STATUS', '⚠ MARGIN THIN', 'increase coolant flow') : R('STATUS', 'NOMINAL', 'healthy margins'),
    ];
  },
};

const rocketTurbopump: PartDef = {
  id: 'turbopump',
  name: 'Turbopump & Combustion Chamber',
  short: 'Turbopump',
  tag: 'Powerhead',
  accent: '#c9d4e3',
  massKg: 1250,
  buildHeight: 0.78,
  eli10:
    "Fuel tanks are lazy — the liquid just sits there. The turbopump is a super-strong water-pump powered by a tiny turbine spinning at 30,000+ RPM (a car engine redlines at 7,000!). It grabs fuel and oxygen and squeezes them into the combustion chamber with the force of 1,000 firehoses, so the fire never goes hungry.",
  pro:
    'The staged-combustion powerhead drives separate LH2/LOX impellers from a gas generator turbine, raising propellants from tank pressure (~0.3 MPa) to 22+ MPa injector pressure — over 100× in a single stage. Turbine energy comes from burning ~2% of the flow; the exhausted gas feeds the main injector, squeezing out 1–2% more Isp than gas-generator cycles.',
  whatIfGone:
    'Chamber pressure falls to tank-head pressure — the engine produces a sad blue flame and about 4% of rated thrust. Compare: without the pump you built a very expensive water fountain.',
  formula: 'P_shaft = ṁ·Δp / (ρ·η_p)   ·   u_tip = π·D·N',
  params: [
    { id: 'pw', label: 'Shaft Power', symbol: 'P', min: 4000, max: 60000, step: 500, value: 57000, unit: 'kW' },
    { id: 'rpm', label: 'Turbine Speed', symbol: 'N', min: 5000, max: 36000, step: 500, value: 30000, unit: 'rpm' },
    { id: 'dp', label: 'Rise (LOX)', symbol: 'Δp', min: 12, max: 24, step: 0.5, value: 22, unit: 'MPa' },
  ],
  compute: (p) => {
    const eta = 0.78;
    const rhoLox = 1141;
    const mdot = (p.pw * 1000 * eta) / ((p.dp * 1e6) / rhoLox);
    const tip = (Math.PI * 0.26 * p.rpm) / 60;
    return [
      R('LOX delivered', `${fmt(mdot, 0)} kg/s`, 'at injector inlet'),
      R('Equivalent power', `${fmt(p.pw * 1.341, 0)} hp`, '≈ 60 Corvette engines'),
      R('Impeller tip speed', `${fmt(tip, 0)} m/s`, 'keep < 340 to stay subsonic'),
      tip > 335 ? R('STATUS', '⚠ TIP SONIC', 'reduce N or grow D') : R('STATUS', 'NOMINAL', ''),
    ];
  },
};

const rocketTank: PartDef = {
  id: 'tank',
  name: 'Cryogenic LH2/LOX Main Tank',
  short: 'Main Tank',
  tag: 'Structures',
  accent: '#e8edf4',
  massKg: 4200,
  buildHeight: 2.62,
  eli10:
    "Two giant thermos bottles stacked as one: orange juice-sized... no — swimming-pool-sized! The top half holds liquid hydrogen (−253 °C, so cold it could freeze air solid), the bottom holds liquid oxygen (−183 °C). They do NOT mix in the tank — mixing happens later, in the fire. 6 parts oxygen for every 1 part hydrogen burns the hottest.",
  pro:
    'Common-barrel cryogenic tank with an ellipsoidal intertank diaphragm. LH2 (ρ = 71 kg/m³) is volumetrically punishing: at MR = 6.0 the hydrogen occupies ~68% of tank volume for ~26% of mass. Aluminium-lithium 2195 skins, friction-stir welded, 3 mm walls carry 4 bar ullage plus 1.6g flight axial loads via monocoque membrane action.',
  whatIfGone:
    'No propellant, no fire. Worse: the stack above loses its compression member and the whole vehicle crumples like an empty can under a boot.',
  formula: 'MR = ṁ_LOX / ṁ_LH2 ≈ 6.0 : 1   ·   m = ρ·V   ·   t_burn = m_prop / ṁ_total',
  params: [
    { id: 'vol', label: 'Tank Volume', symbol: 'V', min: 400, max: 1600, step: 20, value: 840, unit: 'm³' },
    { id: 'mr', label: 'Mixture Ratio', symbol: 'MR', min: 5.2, max: 6.8, step: 0.1, value: 6.0, unit: ':1' },
  ],
  compute: (p) => {
    const rhoLh2 = 71;
    const rhoLox = 1141;
    // V = m_ox/ρ_ox + m_f/ρ_f  with m_ox = MR·m_f
    const mF = p.vol / (p.mr / rhoLox + 1 / rhoLh2);
    const mO = mF * p.mr;
    const total = mF + mO;
    const burn = total / 260;
    return [
      R('LOX loaded', `${fmt(mO / 1000, 1)} t`, `${fmt((p.vol * (mO / total)) / mO, 0)} m³ — denser`),
      R('LH2 loaded', `${fmt(mF / 1000, 1)} t`, `${fmt(p.vol - (mO / rhoLox), 0)} m³ — bulky`),
      R('Total propellant', `${fmt(total / 1000, 1)} t`, 'at 87% fill fraction'),
      R('Burn time', `${fmt(burn, 0)} s`, 'at ṁ = 260 kg/s'),
    ];
  },
};

const rocketInterstage: PartDef = {
  id: 'interstage',
  name: 'Interstage & Grid Fins',
  short: 'Interstage',
  tag: 'Aero-control',
  accent: '#39424f',
  massKg: 820,
  buildHeight: 0.52,
  eli10:
    "A super-strong carbon-fibre wedding ring that joins the rocket stages — plus four honeycomb walls (grid fins) that steer the rocket like feathers steer a dart. During the climb the air tries to bend the rocket like a twig; this ring laughs at 40 tonnes of squeeze.",
  pro:
    'Carbon-fibre composite lattice cylinder transferring 3,800 kN compressive load between stages. Four titanium grid fins provide bodylift control at Mach 0.8–5 where conventional flaps would shake apart — grid cells are shock-stable at transonic regimes, trading ~2% drag for controllability during descent and boost steer.',
  whatIfGone:
    'The upper stack becomes a stack of coffee cans: aerodynamic load at max-Q snaps the joint and the vehicle tumbles within seconds. Fins gone = no steering on descent.',
  formula: 'F_steer = q∞·A_fin·C_N   ·   q_max = ½ρv² ≈ 33 kPa',
  params: [
    { id: 'afa', label: 'Fin Area (total)', symbol: 'A_f', min: 0.4, max: 1.6, step: 0.05, value: 0.9, unit: 'm²' },
    { id: 'q', label: 'Dynamic Pressure', symbol: 'q∞', min: 20, max: 48, step: 1, value: 33, unit: 'kPa' },
  ],
  compute: (p) => {
    const steer = p.q * 1000 * p.afa * 1.42;
    const axial = p.q * 1000 * 10.7 * 0.65 + 3800e3 * 0.4;
    return [
      R('Fin steering force', `${fmt(steer / 1000, 0)} kN`, 'C_N ≈ 1.4 grid'),
      R('Joint axial load', `${fmt(axial / 1e6, 1)} MN`, 'at max-Q + thrust'),
      R('Bending margin', `${fmt(1.9 - p.q / 60, 2)}×`, 'vs 1.25 required'),
      p.q > 44 ? R('STATUS', '⚠ MAX-Q HIGH', 'throttle-down recommended') : R('STATUS', 'NOMINAL', ''),
    ];
  },
};

const rocketFairing: PartDef = {
  id: 'fairing',
  name: 'Avionics & Payload Fairing Nose Cone',
  short: 'Fairing',
  tag: 'Avionics',
  accent: '#67e8f9',
  massKg: 950,
  buildHeight: 0.95,
  eli10:
    "The rocket's pointed hat and its brain-box. Inside the cone sits the satellite, protected from wind, rain and dust; inside the ring below it, flight computers scream 'GO! GO! GO!' 500 times a second. When the rocket reaches space, the hat splits in half and falls away — the satellite's moment to shine.",
  pro:
    'Ogive composite fairing (λ = 2.4) sheds 340 kN of aero-heating and acoustic loads up to 164 dB during transonic flight. The avionics ring hosts triple-redundant flight computers running 500 Hz guidance ( Powered Explicit Guidance ), TVC gimbal mixing and telemetry downlink at 20 Mbps through S-band phased arrays.',
  whatIfGone:
    'Payload shredded by 6× the force of a hurricane within 40 seconds of liftoff. Without avionics the rocket is a very tall, very expensive firework with no brain.',
  formula: 'C_D(ogive) ≈ 0.22   ·   V_payload = 0.62·(πD²/4)·L',
  params: [
    { id: 'dia', label: 'Base Diameter', symbol: 'D', min: 4.2, max: 5.4, step: 0.1, value: 5.0, unit: 'm' },
    { id: 'len', label: 'Fairing Length', symbol: 'L', min: 12, max: 22, step: 0.5, value: 18, unit: 'm' },
  ],
  compute: (p) => {
    const vol = 0.62 * (Math.PI * Math.pow(p.dia / 2, 2)) * p.len;
    const dragA = Math.PI * Math.pow(p.dia / 2, 2);
    return [
      R('Usable payload vol.', `${fmt(vol, 0)} m³`, '≈ 2 school buses'),
      R('Frontal area', `${fmt(dragA, 1)} m²`, 'C_D ≈ 0.22 ogive'),
      R('Max-Q drag', `${fmt(0.22 * 33000 * dragA / 1000, 0)} kN`, 'at 33 kPa'),
      R('Telemetry rate', '20 Mbps', 'S-band phased array'),
    ];
  },
};

const meltdown = (rule: string, eli: string, pro: string): FailureDiagnostic => ({
  type: 'thermal-meltdown',
  title: 'THERMAL MELTDOWN',
  severity: 'CRITICAL',
  ruleBroken: rule,
  eli10: eli,
  pro,
  fixHint: 'Reorder so the Cooling Jacket sits directly between the Nozzle and the Turbopump — cooling always hugs the hottest metal.',
});

const buckle = (rule: string, eli: string, pro: string): FailureDiagnostic => ({
  type: 'structural-buckle',
  title: 'STRUCTURAL BUCKLING',
  severity: 'CRITICAL',
  ruleBroken: rule,
  eli10: eli,
  pro,
  fixHint: 'Rebuild strictly bottom-to-top: the aerodynamic nose can never carry the tank — loads must flow down, not up.',
});

const rocketDiagnose = (stack: string[]): FailureDiagnostic | null => {
  const idx = (id: string) => stack.indexOf(id);
  const correct = ['nozzle', 'jacket', 'turbopump', 'tank', 'interstage', 'fairing'];

  if (idx('fairing') !== -1 && idx('fairing') < idx('tank')) {
    return buckle(
      'Payload fairing mounted BELOW the main tank — compression shell loaded upside-down.',
      'You put the hat on the rocket\u2019s belly! The nose cone is a thin eggshell designed to be SQUEEZED from above, not to hold up 400 tonnes of fuel above it. When the engines lit, the whole stack folded like a soda can being stomped.',
      'Euler critical load for the thin-walled ogive shell under reversed load path: P_cr = 2π·r·t²·E/(√(3(1−ν²))·L) ≈ 0.4 MN, vs 3.9 MN transmitted. Elastic buckling initiated at the base ring; the stack pivoted about the crushed section with 28 kN·m of overturning moment.'
    );
  }
  if (!stack.includes('jacket') && (stack.includes('turbopump') || stack.includes('tank'))) {
    return meltdown(
      'Static fire attempted with NO regenerative cooling jacket protecting the nozzle throat.',
      'You forgot the pipe jacket! The exhaust gas (3,300 °C) is hotter than melted steel. With nothing drinking the heat, the nozzle glowed like a barbecue coal, went soft, and burst. Boom — thermal meltdown.',
      'Without regenerative cooling, wall heat flux q″ = 85 MW/m² is unrejected; NARloy-Z wall temperature exceeded 1,350 K within 6.2 s, yield strength collapsed to 12 MPa, and the 22 MPa chamber pressure ruptured the throat section. Total vehicle loss at T+7.4 s.'
    );
  }
  if (idx('jacket') !== -1 && (idx('jacket') < idx('nozzle') || idx('jacket') > idx('turbopump'))) {
    return meltdown(
      'Cooling jacket mounted out of position — nozzle throat left unprotected.',
      'The jacket is on the shelf, not on the HOT PART! Cooling pipes only work when they hug the nozzle throat like a scarf on a cold neck. With the throat bare, the metal melted through and the engine let go.',
      'Jacket installed at a station where local q″ = 9 MW/m² (vs 85 MW/m² at the throat). The unprotected throat wall exceeded material limits; burn-through at T+6.9 s, followed by loss of chamber pressure and rapid unscheduled disassembly.'
    );
  }
  if (stack.join('→') !== correct.join('→')) {
    return buckle(
      'Stack sequence violates the bottom-to-top compression load path.',
      'The rocket was stacked in the wrong order, so weight pushed through parts that were never meant to carry it. Like building a human pyramid with the smallest kid on the bottom — CRUNCH.',
      'Load-path analysis: compressive line of action broken at the mis-stacked joint; eccentric thrust of 1.6 MN about a 0.4 m lever produced 640 kN·m overturning moment exceeding interstage capability. Structural failure at the weak interface.'
    );
  }
  return null;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * LEVEL 2 — Apex-V8 Twin-Turbo Combustion Engine
 * ══════════════════════════════════════════════════════════════════════════*/

const v8Block: PartDef = {
  id: 'block',
  name: 'Cast-Iron V8 Cylinder Block',
  short: 'V8 Block',
  tag: 'Structure',
  accent: '#7b8592',
  massKg: 94,
  buildHeight: 0.9,
  eli10:
    'The engine\u2019s skeleton: a big chunk of metal with 8 smooth round holes (cylinders) drilled in two rows tilted like a V. Eight water-jacketed cannons, arranged in a V so the whole engine stays short and fits under a hood. Everything else bolts onto this.',
  pro:
    'Compacted-graphite-iron block, 90° bank angle, 103 mm bore × 92 mm stroke (6.2 L). Cross-bolted main caps carry crank loads; siamesed water jackets evacuate ~90 kW of waste heat at rated power. The 90° V gives even 90° firing intervals with a shared crank pin per opposing cylinder pair.',
  whatIfGone:
    'Nowhere for the fire to live. No block = no cylinders = no compression = the world\u2019s most expensive pile of bolts.',
  formula: 'V_d = (π/4)·b²·s·n_cyl   ·   90° bank → even 90° firing spacing',
  params: [
    { id: 'bore', label: 'Bore', symbol: 'b', min: 90, max: 110, step: 0.5, value: 103, unit: 'mm' },
    { id: 'stroke', label: 'Stroke', symbol: 's', min: 84, max: 102, step: 0.5, value: 92, unit: 'mm' },
  ],
  compute: (p) => {
    const vd = (Math.PI / 4) * Math.pow(p.bore / 1000, 2) * (p.stroke / 1000) * 8 * 1000;
    const ratio = p.bore / p.stroke;
    return [
      R('Displacement', `${fmt(vd, 1)} L`, 'eight cylinders'),
      R('B/S ratio', fmt(ratio, 2), ratio > 1 ? 'over-square — revs happy' : 'under-square — torquey'),
      R('Total piston area', `${fmt((Math.PI / 4) * Math.pow(p.bore / 10, 2) * 8, 0)} cm²`, 'force collector'),
      R('Firing interval', '90° CA', 'cross-plane crank'),
    ];
  },
};

const v8Crank: PartDef = {
  id: 'crank',
  name: 'Forged Crankshaft',
  short: 'Crankshaft',
  tag: 'Kinematics',
  accent: '#9aa7b8',
  massKg: 29,
  buildHeight: 0.5,
  eli10:
    'The spinny backbone. Every piston pushes it with a hammer-blow of fire, and its clever offset bumps (like a bent bike pedal) turn punching into spinning. That spin is what eventually turns the wheels. It must survive 100 million hammer hits without complaining.',
  pro:
    'Forged 4340 steel, 5 main journals, 4 crank throws shared by opposing cylinder pairs (cross-plane, 90° pin phasing). Mean piston speed v̄ = 2·s·N/60 governs inertia loads: at 8,500 rpm the pistons reverse direction 283 times per second at ~26 m/s — accelerations near 12,000 g at the crown.',
  whatIfGone:
    'Pistons punch nothing but air. It is the only part converting linear fire into rotation — no crank, no rotation, no motion, no glory.',
  formula: 'v̄_piston = 2·s·N / 60   ·   a ≈ ω²·r·(1 + λ⁻¹)',
  params: [
    { id: 'redline', label: 'Redline', symbol: 'N_max', min: 5500, max: 9000, step: 100, value: 7600, unit: 'rpm' },
    { id: 'stroke', label: 'Stroke', symbol: 's', min: 84, max: 102, step: 0.5, value: 92, unit: 'mm' },
  ],
  compute: (p) => {
    const mps = (2 * (p.stroke / 1000) * p.redline) / 60;
    return [
      R('Mean piston speed', `${fmt(mps, 1)} m/s`, `at ${fmt(p.redline, 0)} rpm`),
      mps > 25
        ? R('STATUS', '⚠ > 25 m/s', 'F1 territory — exotic rods needed')
        : R('STATUS', 'NOMINAL', 'forged rods are happy'),
      R('Reversals/sec/cyl', `${fmt((p.redline / 60) / 1, 0)}`, 'full strokes ×2'),
      R('Torsional mode', `${fmt(420 - p.stroke, 0)} Hz`, 'damper tuned below'),
    ];
  },
};

const v8Pistons: PartDef = {
  id: 'pistons',
  name: '8 Pistons & Connecting Rods',
  short: 'Pistons',
  tag: 'Combustion',
  accent: '#aab6c6',
  massKg: 12,
  buildHeight: 0.4,
  eli10:
    'Eight metal drums that play the world\u2019s fastest game of whack-a-mole: fire pushes them DOWN, they spin the crank, then a friend throws them back UP to do it again — 60 times a second each! The rods are the arms connecting drum to crank.',
  pro:
    'Forged 2618 aluminium pistons, 11.5:1 static compression. Otto-cycle thermal efficiency scales as η = 1 − r^(1−γ) with γ ≈ 1.32 — raising r from 9 to 12 buys ~6% relative efficiency but walks the knock limit; direct injection sprays at 250 bar to evaporatively cool the charge and buy back margin.',
  whatIfGone:
    'The cylinders are capped empty rooms. Fire with nowhere to push just heats the head — you built a very expensive kettle.',
  formula: 'η_otto = 1 − r^(1−γ)   ·   γ ≈ 1.32',
  params: [
    { id: 'cr', label: 'Compression Ratio', symbol: 'r', min: 9, max: 14, step: 0.1, value: 11.5, unit: ':1' },
    { id: 'pmax', label: 'Peak cyl. pressure', symbol: 'p_max', min: 60, max: 130, step: 5, value: 95, unit: 'bar' },
  ],
  compute: (p) => {
    const eta = 1 - Math.pow(p.cr, -0.32);
    const force = p.pmax * 1e5 * (Math.PI / 4) * Math.pow(0.103, 2);
    return [
      R('Thermal efficiency', `${fmt(eta * 100, 1)} %`, 'fuel energy → work'),
      R('Peak piston force', `${fmt(force / 1000, 0)} kN`, '≈ 4 family cars on one piston'),
      p.cr > 12.5
        ? R('Knock margin', '⚠ THIN', 'needs 100+ RON or water injection')
        : R('Knock margin', 'HEALTHY', 'with 95 RON + DI cooling'),
      R('Rod tensile load', `${fmt(11 * 8000 * 0.092, 0)} kN`, 'at 8k rpm reversal'),
    ];
  },
};

const v8Heads: PartDef = {
  id: 'heads',
  name: 'DOHC Cylinder Heads & Valvetrain',
  short: 'Cylinder Heads',
  tag: 'Breathing',
  accent: '#8d99ab',
  massKg: 34,
  buildHeight: 0.55,
  eli10:
    'The lungs and doormen of the engine. Each cylinder has its own doors — one lets fresh air IN, one kicks burnt gas OUT — opened at exactly the right millisecond by spinning egg-shaped cams. 32 doors total, opening 60 times a second. Never late, never early.',
  pro:
    'Quad-cam (DOHC per bank), 4 valves/cyl, 11.5 mm lift with 248° duration intake cams. Volumetric efficiency peaks 96% at 6,800 rpm tuned by 420 mm runner Helmholtz resonance. Valve acceleration hits 3,900 m/s² — titanium retainers and dual springs prevent valve float above 8,600 rpm.',
  whatIfGone:
    'Cylinders sealed shut. The engine draws one breath, coughs, and dies. Also: nothing squishes the fire, so compression never happens.',
  formula: 'VE ≈ 0.96 @ resonance   ·   A_valve ≈ 0.28·(πb²/4) per bank',
  params: [
    { id: 'lift', label: 'Valve Lift', symbol: 'l', min: 8, max: 14, step: 0.1, value: 11.5, unit: 'mm' },
    { id: 'valves', label: 'Valve Count', symbol: 'n_v', min: 16, max: 32, step: 8, value: 32, unit: '' },
  ],
  compute: (p) => {
    const ve = Math.min(0.99, 0.62 + (p.lift / 14) * 0.38);
    const cfm = 128 * p.valves * (p.lift / 11.5) * 0.86;
    return [
      R('Volumetric efficiency', `${fmt(ve * 100, 0)} %`, 'at tuned resonance'),
      R('Total flow bench', `${fmt(cfm, 0)} CFM`, 'wide-open throttle'),
      R('Valve events/s @6.8k', `${fmt(32 * 6800 / 60 / 2, 0)}`, 'all 32 valves'),
      R('Valve float limit', `${fmt(8600, 0)} rpm`, 'dual springs, Ti retainers'),
    ];
  },
};

const v8Spark: PartDef = {
  id: 'spark',
  name: 'Spark Plugs & Direct Injectors',
  short: 'Ignition',
  tag: 'Ignition',
  accent: '#facc15',
  massKg: 3,
  buildHeight: 0.3,
  eli10:
    'Tiny lightning machines. Each cylinder gets a storm-cloud-on-a-stick that zaps 30,000 volts across a gap thinner than a hair — BOOM goes the fuel mist, and that boom is timed to the ten-thousandth of a second. The injectors areprecision spray cans firing 250× atmospheric pressure.',
  pro:
    'Iridium plugs, 95 mJ coil-on-plug, spark advance mapped 8–28° BTDC against MBT-spark / knock-limited boundary. Solenoid DI injectors at 250 bar create 18 µm SMD droplets within 4 ms; stratified-charge squish pads accelerate flame kernel to full bore propagation in ~1.8 ms at 6,000 rpm.',
  whatIfGone:
    'Fuel floods in, nothing lights, and the engine hydro-locks or just pumps raw gasoline out the exhaust. No spark = no party.',
  formula: 't_flame ≈ b/u_t   ·   advance ∝ N (MBT)   ·   spray at 250 bar',
  params: [
    { id: 'bar', label: 'Injection Pressure', symbol: 'p_inj', min: 100, max: 350, step: 5, value: 250, unit: 'bar' },
    { id: 'adv', label: 'Spark Advance', symbol: 'SA', min: 8, max: 30, step: 0.5, value: 18, unit: '°BTDC' },
  ],
  compute: (p) => {
    const smd = 34 - (p.bar - 100) * 0.052;
    const tflame = (0.103 / (18 + p.adv * 0.35)) * 1000;
    return [
      R('Droplet size (SMD)', `${fmt(Math.max(8, smd), 0)} µm`, 'finer mist = faster burn'),
      R('Flame travel', `${fmt(tflame, 2)} ms`, 'across 103 mm bore'),
      p.adv > 26
        ? R('Knock risk', '⚠ HIGH', 'end-gas auto-ignites — retard 4°')
        : R('Knock risk', 'LOW', '20 RON margin at 11.5:1'),
      R('Ignition energy', '95 mJ', 'coil-on-plug ×8'),
    ];
  },
};

const v8Turbo: PartDef = {
  id: 'turbo',
  name: 'Twin-Turbocharger & Exhaust Manifold',
  short: 'Twin Turbos',
  tag: 'Forced induction',
  accent: '#f97316',
  massKg: 22,
  buildHeight: 0.45,
  eli10:
    'Two metal snails that recycle garbage! Hot exhaust gas — normally thrown away — spins a fanwheel up to 190,000 RPM. That fan is glued to another fan that RAMS extra air into the engine. More air + more fuel = bigger booms = more power. Free horsepower from trash!',
  pro:
    'Parallel twin-turbo, each 58 mm compressor running 3.1 pressure ratio and 190k rpm shaft speed (tip Mach 1.4 — that\u2019s why they scream). Compressed air exits at 460 K, cooled to 320 K by water charge-coolers; density recovery alone is worth 18% torque. Turbine housings are Inconel 713C to survive 1,050 °C exhaust.',
  whatIfGone:
    'Engine breathes with lungs half the size — naturally aspirated it makes 480 hp instead of 890. The snails are the whole point.',
  formula: 'PR = (p_amb + p_boost)/p_amb   ·   T_out = T_in·PR^0.283',
  params: [
    { id: 'boost', label: 'Boost Pressure', symbol: 'p_b', min: 5, max: 28, step: 0.5, value: 18, unit: 'psi' },
    { id: 'spool', label: 'Spool Target', symbol: 'N_t', min: 90, max: 190, step: 5, value: 165, unit: 'k rpm' },
  ],
  compute: (p) => {
    const pr = (14.7 + p.boost) / 14.7;
    const hp = 480 * pr * 0.92;
    const tout = 298 * Math.pow(pr, 0.283);
    return [
      R('Pressure ratio', fmt(pr, 2), `${fmt(p.boost, 1)} psi gauge`),
      R('Est. crank power', `${fmt(hp, 0)} hp`, 'intercooled, 11.5:1 CR'),
      R('Compressor out temp', `${fmt(tout, 0)} K`, `${fmt(tout - 273, 0)} °C before intercooler`),
      p.spool > 175 ? R('STATUS', '⚠ TIP MACH 1.4', 'ceramic bearings advised') : R('STATUS', 'NOMINAL', ''),
    ];
  },
};

const seizure = (rule: string, eli: string, pro: string): FailureDiagnostic => ({
  type: 'mechanical-seizure',
  title: 'MECHANICAL SEIZURE',
  severity: 'CRITICAL',
  ruleBroken: rule,
  eli10: eli,
  pro,
  fixHint: 'The crankshaft must be installed before the pistons — rods can only attach to journals that exist.',
});

const knock = (rule: string, eli: string, pro: string): FailureDiagnostic => ({
  type: 'engine-knock',
  title: 'ENGINE KNOCK & BLOWOUT',
  severity: 'CRITICAL',
  ruleBroken: rule,
  eli10: eli,
  pro,
  fixHint: 'Heads and spark timing must be installed and phased before turbo boost — combustion management precedes air supply.',
});

const v8Diagnose = (stack: string[]): FailureDiagnostic | null => {
  const idx = (id: string) => stack.indexOf(id);
  const correct = ['block', 'crank', 'pistons', 'heads', 'spark', 'turbo'];

  if (idx('pistons') !== -1 && idx('pistons') < idx('crank')) {
    return seizure(
      'Pistons installed BEFORE the crankshaft — rods have no journals to ride on.',
      'You dropped the pistons into empty holes with no crankshaft under them! When the starter spun, the rods hit… nothing, then everything jammed at once with a horrible CLANK. Metal doesn\u2019t negotiate — the engine seized solid.',
      'Connecting rods require crank pin engagement for kinematic constraint. With the crank absent, rod big-ends floated 4 mm off-axis; starter torque of 180 N·m drove the assembly into a geometric lock (two rods 38° out of phase, both bound against bore walls). Result: instantaneous mechanical seizure, rod bearing material smeared across two bores.'
    );
  }
  if ((idx('spark') !== -1 && idx('spark') < idx('heads')) || (idx('turbo') !== -1 && idx('turbo') < idx('heads'))) {
    return knock(
      'Turbo boost / ignition phasing enabled BEFORE cylinder heads and spark timing were installed.',
      'You gave the engine turbo air and spark before the heads were on and timed! With open cylinders the fire couldn\u2019t be contained — flames spat out the top, unburnt fuel went BANG in the wrong places, and black smoke rolled out like the world\u2019s angriest barbecue.',
      'Without the quench-path heads, effective compression ratio collapsed to 4.2:1; end-gas dwell time tripled and pre-ignition events advanced combustion ~40° BTDC. Pressure spikes of 210 bar (2.2× design) perforated 2 ring lands; unburnt HC ignited in the crankcase breather producing the observed black particulate plume.'
    );
  }
  if (stack.join('→') !== correct.join('→')) {
    return knock(
      'Build sequence violates the firing train: block → crank → pistons → heads → ignition → induction.',
      'The engine was bolted together out of order, so the fire had no tidy path from air to exhaust. It coughed, hammered, and blew black smoke everywhere.',
      'Out-of-sequence assembly desynchronised the cam-to-crank phasing (timing chain indexed to an absent reference) causing valve-event overlap errors up to 61° CA. Compression imbalance across banks triggered torsional resonance through the crank damper; sustained auto-ignition destroyed ring seal integrity.'
    );
  }
  return null;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * LEVEL 3 — Helios-X Mars Coaxial Rotorcraft
 * ══════════════════════════════════════════════════════════════════════════*/

const droneCore: PartDef = {
  id: 'core',
  name: 'Carbon-Fiber Avionics Core & Landing Gear',
  short: 'Avionics Core',
  tag: 'Structure',
  accent: '#64748b',
  massKg: 0.9,
  buildHeight: 0.5,
  eli10:
    'The body and the legs. A featherweight shell woven from carbon thread (5× stronger than steel, but light as a crisp packet) that protects the drone brain, plus springy legs so it can hop and land on rocky Mars dirt without cracking.',
  pro:
    'Monocoque tub in 3K twill prepreg, 1.2 mm wall, integrated IMU/inertial navigation bay with vibration-isolated IMU deck (λ > 40 Hz isolation). 4/4 gear geometry with titanium skids rated for 3.5 m/s touchdown; thermal survive −90 °C night cycles via 8 W RHU heaters.',
  whatIfGone:
    'Everything else is loose electronics in the Martian wind. Also nothing to land on — every flight ends as a crash.',
  formula: 'm_total/m_lift < 0.55   ·   gear stroke ε = v²_touchdown/(2a_max)',
  params: [
    { id: 'wb', label: 'Wheelbase', symbol: 'w', min: 260, max: 380, step: 5, value: 320, unit: 'mm' },
    { id: 'mass', label: 'Core Mass', symbol: 'm', min: 0.6, max: 1.8, step: 0.05, value: 0.9, unit: 'kg' },
  ],
  compute: (p) => {
    const inertia = (p.mass * Math.pow(p.wb / 1000, 2)) / 6;
    return [
      R('Yaw inertia', `${fmt(inertia * 1000, 1)} g·m²`, 'lower = snappier turns'),
      R('Structure mass frac.', `${fmt((p.mass / 6.8) * 100, 0)} %`, 'of 6.8 kg AUW'),
      R('Footprint', `${fmt(p.wb / 1000, 1)} m diag`, 'slope-stable to 15°'),
      R('Night survival', '−90 °C', '8 W RHU heaters'),
    ];
  },
};

const droneBattery: PartDef = {
  id: 'battery',
  name: 'Solid-State LiPo High-Discharge Battery',
  short: 'Battery',
  tag: 'Energy',
  accent: '#4ade80',
  massKg: 1.6,
  buildHeight: 0.34,
  eli10:
    'The lunchbox full of lightning. This battery can dump its whole energy in under 2 minutes flat if asked — that\u2019s what spinning propellers demand. Smart chips watch every cell so it never gets angry (batteries that get angry turn into fireballs).',
  pro:
    '12S1P solid-state LiPo, 16 Ah, 50C continuous (800 A burst capability for 3 s). Pack energy 710 Wh at 3.3 kg system-level — solid-state electrolyte eliminates thermal-runaway propagation; BMS balances 12 cells ±7 mV and derates discharge below −20 °C cell temp.',
  whatIfGone:
    'Motors twitch once and everything goes dark. On Mars: silent fall from 40 metres. Battery IS the flight.',
  formula: 'E = S·3.7 V·Ah   ·   I_max = C·Ah   ·   t_hover = 0.8·Ah·60/Ī',
  params: [
    { id: 'ah', label: 'Capacity', symbol: 'C', min: 5, max: 22, step: 0.5, value: 16, unit: 'Ah' },
    { id: 's', label: 'Cell Count', symbol: 'S', min: 6, max: 12, step: 1, value: 12, unit: 'S' },
    { id: 'crate', label: 'Discharge Rating', symbol: 'C-rate', min: 25, max: 75, step: 5, value: 50, unit: 'C' },
  ],
  compute: (p) => {
    const wh = p.s * 3.7 * p.ah;
    const imax = p.crate * p.ah;
    const hover = ((0.8 * p.ah) / 42) * 60;
    return [
      R('Pack energy', `${fmt(wh, 0)} Wh`, `${fmt(44.4, 1)} V nominal`),
      R('Max continuous I', `${fmt(imax, 0)} A`, 'flight loads draw ~42 A'),
      R('Hover endurance', `${fmt(hover, 0)} min`, 'at 42 A average'),
      R('Energy density', `${fmt(wh / 3.3, 0)} Wh/kg`, 'solid-state, no runaway'),
    ];
  },
};

const droneEsc: PartDef = {
  id: 'esc',
  name: '4-in-1 ESC & Flight Computer',
  short: 'ESC + FC',
  tag: 'Control',
  accent: '#0071e3',
  massKg: 0.2,
  buildHeight: 0.22,
  eli10:
    'The reflexes. This circuit board reads the joystick 48,000 times a second and decides exactly how fast each motor should spin, then fires precise electric pulses to make it so. It\u2019s also the balance-keeper: if a gust tips the drone, it counters before you even notice.',
  pro:
    'F800 32-bit flight controller fused with 4× 120 A BLHeli32 ESCs at 48 kHz PWM. Cascaded PID loop: 8 kHz gyro rate → 4 kHz attitude → 500 Hz navigation. Onboard EKF fuses IMU + optical flow + LiDAR altimetry; failsafe engages attitude-hold within 40 ms of uplink loss.',
  whatIfGone:
    'Motors get raw battery and spin at one crazy speed. The drone flips upside down instantly and digs a hole. No reflexes, no flight.',
  formula: 'PWM @ 48 kHz   ·   PID @ 8 kHz   ·   failsafe < 40 ms',
  params: [
    { id: 'amp', label: 'Current Rating', symbol: 'I', min: 40, max: 240, step: 10, value: 120, unit: 'A' },
    { id: 'pwm', label: 'PWM Frequency', symbol: 'f_pwm', min: 24, max: 96, step: 8, value: 48, unit: 'kHz' },
  ],
  compute: (p) => {
    const pw = 44.4 * p.amp * 0.95;
    return [
      R('Peak bus power', `${fmt(pw / 1000, 1)} kW`, '4 motors combined'),
      R('Control latency', `${fmt(2000 / p.pwm, 2)} ms`, 'command to phase change'),
      R('Loop rates', '8k / 4k / 500 Hz', 'gyro / attitude / nav'),
      R('Failsafe engage', '< 40 ms', 'attitude hold on uplink loss'),
    ];
  },
};

const droneMotors: PartDef = {
  id: 'motors',
  name: 'Brushless Outrunner Motor Stack',
  short: 'Motor Stack',
  tag: 'Actuation',
  accent: '#a78bfa',
  massKg: 0.7,
  buildHeight: 0.42,
  eli10:
    'Two upside-down bucket motors, one above the other. Unlike toy motors there are no brushes to wear out — the outside shell itself spins, packed with super-magnets. Cleaner, tougher, and powerful enough to lift 6 kg on Mars-thin air.',
  pro:
    'Dual stacked 3510 380 KV outrunners, 24 poles / 22 stator slots, 0.12 Ω winding. On Mars (ρ = 0.020 kg/m³, 1% of Earth) rotors must run at high tip Mach to generate the 66 N of combined thrust — motor KV is chosen so electrical frequency stays under the 48 kHz PWM ceiling at 5,900 rpm.',
  whatIfGone:
    'Propellers become decorations. Beautiful, spinning-free decorations that lift nothing.',
  formula: 'N = KV·V   ·   f_elec = N/60·p/2   ·   τ = K_t·I',
  params: [
    { id: 'kv', label: 'Motor KV', symbol: 'KV', min: 80, max: 420, step: 10, value: 230, unit: 'rpm/V' },
    { id: 'poles', label: 'Pole Pairs', symbol: 'p', min: 6, max: 12, step: 1, value: 12, unit: 'pp' },
  ],
  compute: (p) => {
    const rpm = p.kv * 44.4;
    const fe = (rpm / 60) * p.poles;
    return [
      R('Max rpm', `${fmt(rpm, 0)}`, 'at 44.4 V bus'),
      R('Electrical freq', `${fmt(fe / 1000, 1)} kHz`, 'keep < PWM 48 kHz'),
      fe > 48000
        ? R('STATUS', '⚠ OVER PWM', 'lower KV or raise f_pwm')
        : R('STATUS', 'NOMINAL', 'clean sinusoidal drive'),
      R('Stall torque est.', `${fmt(2.4 * 44.4 / p.kv, 1)} N·m`, 'K_t·I at 44 A'),
    ];
  },
};

const droneProps: PartDef = {
  id: 'props',
  name: 'Counter-Rotating Coaxial Propellers',
  short: 'Coax Props',
  tag: 'Aerodynamics',
  accent: '#38bdf8',
  massKg: 0.28,
  buildHeight: 0.55,
  eli10:
    'Two propeller sets on one pole, spinning OPPOSITE ways. Why? Every spinning prop tries to twist the drone the other direction (Newton\u2019s 3rd law!). Spin a second one backwards and the twists cancel out — the drone stops spinning and can actually look where it\u2019s going.',
  pro:
    'Coaxial 1.22 m × 2 rotors, counter-rotating (upper CW / lower CCW) so reaction torque cancels without a tail rotor — critical since aerodynamic control surfaces are useless in Mars\u2010thin CO₂. Momentum theory hover power P = T^1.5/√(2ρA) per rotor; the counter-rotating pair recovers ~4% swirl loss versus a single disc of equal solidity.',
  whatIfGone:
    'With only ONE prop spinning, Newton\u2019s third law takes over: the body spins opposite the blades faster and faster until it crashes. You\u2019ll see exactly this in the failure sim!',
  formula: 'τ_reaction = −Q_rotor   ·   P_hover = T^1.5/√(2ρA)   ·   M_tip < 0.75',
  params: [
    { id: 'dia', label: 'Rotor Diameter', symbol: 'D', min: 0.9, max: 1.6, step: 0.02, value: 1.22, unit: 'm' },
    { id: 'rpm', label: 'Rotor Speed', symbol: 'N', min: 2000, max: 6000, step: 100, value: 4600, unit: 'rpm' },
  ],
  compute: (p) => {
    const rho = 0.020; // Mars atmosphere, kg/m³
    const A = (Math.PI * Math.pow(p.dia / 2, 2));
    const T = 6.8 * 3.71 / 2; // Mars weight split over 2 rotors (g_mars = 3.71)
    const P = 2 * (Math.pow(T, 1.5) / Math.sqrt(2 * rho * A));
    const tip = (Math.PI * p.dia * p.rpm) / 60;
    return [
      R('Disc area (×2)', `${fmt(2 * A, 2)} m²`, 'both rotors'),
      R('Hover power (Mars)', `${fmt(P, 0)} W`, 'ρ = 0.020 kg/m³'),
      R('Tip speed', `${fmt(tip, 0)} m/s`, `Mach ${fmt(tip / 246, 2)} in CO₂`),
      tip / 246 > 0.75
        ? R('STATUS', '⚠ COMPRESSIBLE', 'shock losses on blade tips')
        : R('STATUS', 'NOMINAL', 'subsonic tips'),
    ];
  },
};

const spinout = (rule: string, eli: string, pro: string): FailureDiagnostic => ({
  type: 'torque-spinout',
  title: 'ANGULAR MOMENTUM SPINOUT',
  severity: 'CRITICAL',
  ruleBroken: rule,
  eli10: eli,
  pro,
  fixHint: 'Both counter-rotating rotors must be driven together — powertrain (battery → ESC → motors) before props.',
});

const droneDiagnose = (stack: string[]): FailureDiagnostic | null => {
  const idx = (id: string) => stack.indexOf(id);
  const correct = ['core', 'battery', 'esc', 'motors', 'props'];

  if (idx('props') !== -1 && (idx('props') < idx('motors') || idx('props') < idx('esc') || idx('props') < idx('battery'))) {
    return spinout(
      'Propellers powered WITHOUT the full counter-rotating drivechain — only the upper rotor was driven.',
      'One propeller was spinning all by itself! Remember the twist-rule: a spinning prop twists the drone the other way. Normally a second backwards-spinning prop cancels the twist — but you powered only one. The drone spun faster and faster like a crazy carousel, tipped over, and crashed. That\u2019s Newton\u2019s third law in action!',
      'With only the upper rotor driven, net shaft torque τ = 3.1 N·m reacted on the airframe (I_zz = 0.084 kg·m²), producing yaw acceleration τ/I = 37 rad/s². Within 1.2 s the body reached 44 rad/s; gyroscopic coupling with the 2° tilt produced precessional roll divergence, and angular momentum conservation transferred to the frame until ground impact at 5.8 m/s.'
    );
  }
  if (stack.join('→') !== correct.join('→')) {
    return spinout(
      'Build sequence broke the power path: core → battery → ESC → motors → props.',
      'The power chain was assembled out of order, so the flight computer couldn\u2019t drive both rotors evenly. The unbalanced twist took over and spun the drone into the workbench.',
      'Out-of-sequence power path left one ESC phase unmapped; single-rotor authority produced uncompensated reaction torque exceeding the control margin (τ_avail = 1.6 N·m vs τ_react = 3.1 N·m), guaranteeing yaw divergence at liftoff.'
    );
  }
  return null;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * MACHINE REGISTRY
 * ══════════════════════════════════════════════════════════════════════════*/

export const MACHINES: Record<MachineDef['id'], MachineDef> = {
  rocket: {
    id: 'rocket',
    name: 'Ares-V Propulsion Stack',
    codename: 'SECTOR 01',
    subtitle: 'Orbital Cryogenic Rocket',
    missionBrief:
      'A lockdown protocol has sealed Sector 01 around the Ares-V launch stack. Six critical modules have been scattered across the facility by the decommissioning drones. Recover every module, study how each one defeats fire, cold and vacuum, then stack them bottom-to-top in the true load-and-cool sequence. Pass the static fire and the ceiling hatch will open for your escape — straight up.',
    successTitle: 'ORBITAL INSERTION ACHIEVED',
    successText:
      'The Ares-V cleared the tower at 1.6g and 366 s of specific impulse. Watch the live telemetry — altitude, Mach, G-load — as she rides 1.6 meganewtons of thrust through the ceiling hatch. You have escaped Sector 01 the only way an engineer would: UP.',
    testLabel: 'RUN STATIC FIRE TEST',
    failureBanner: 'STATIC FIRE ANOMALY',
    parts: [rocketNozzle, rocketJacket, rocketTurbopump, rocketTank, rocketInterstage, rocketFairing],
    diagnose: rocketDiagnose,
    camera: {
      room: [8.2, 4.8, 10],
      cad: [7, 4.2, 8.6],
      ar: [6.5, 3.8, 8],
      target: [0, 3.4, 0],
      cadTarget: [0, 3.4, 0],
    },
  },
  v8: {
    id: 'v8',
    name: 'Apex-V8 Powertrain',
    codename: 'SECTOR 02',
    subtitle: 'Twin-Turbo Combustion Engine',
    missionBrief:
      'Sector 02 is the powertrain cell. The Apex-V8 has been torn down to six subsystems and hidden in plain sight across the workshop. Rebuild the firing train in true mechanical order — skeleton, spinner, punchers, lungs, lightning, then the snails — and the dyno cell unlocks. Mount anything out of order and the dyno will happily show you exactly how engines destroy themselves.',
    successTitle: 'DYNO CELL UNLOCKED',
    successText:
      'The Apex-V8 lit off on the first crank. 890 horsepower of twin-turbo thunder is now yours to explore — ride the throttle from the 800 rpm idle purr to the 8,500 rpm scream and watch horsepower and torque curves cross at 5,252 rpm, exactly as physics demands.',
    testLabel: 'RUN DYNO IGNITION TEST',
    failureBanner: 'DYNO TEST FAILURE',
    parts: [v8Block, v8Crank, v8Pistons, v8Heads, v8Spark, v8Turbo],
    diagnose: v8Diagnose,
    camera: {
      room: [4.4, 2.9, 5.2],
      cad: [5.2, 3.4, 6.2],
      ar: [4.4, 2.7, 5.2],
      target: [0, 1.35, 0],
      cadTarget: [0, 1.35, 0],
    },
  },
  drone: {
    id: 'drone',
    name: 'Helios-X Autonomous Drone',
    codename: 'SECTOR 03',
    subtitle: 'Mars Coaxial Rotorcraft',
    missionBrief:
      'Final sector. The Helios-X is a coaxial rotorcraft built for the thin CO₂ skies of Mars — where air is 1% as thick as Earth\u2019s and every gram fights you. Five modules remain hidden in the facility. Assemble the power path in order, and remember the twist-rule: a single spinning rotor twists its mother-ship the other way. Succeed and you get the keys to fly her around the lab yourself.',
    successTitle: 'FLIGHT AUTHORITY GRANTED',
    successText:
      'The Helios-X spooled both counter-rotating rotors to 4,600 rpm and the reaction torques cancelled to within 0.3 N·m. She\u2019s hovering on the pad, LiDAR sweeping. Take the sticks — WASD to fly, arrow keys for yaw and altitude — and scan the whole facility on your way out.',
    testLabel: 'RUN HOVER TRIAL',
    failureBanner: 'FLIGHT TRIAL FAILURE',
    parts: [droneCore, droneBattery, droneEsc, droneMotors, droneProps],
    diagnose: droneDiagnose,
    camera: {
      room: [4.2, 2.6, 5.0],
      cad: [5.0, 3.2, 5.8],
      ar: [4.2, 2.5, 5.0],
      target: [0, 1.5, 0],
      cadTarget: [0, 1.3, 0],
    },
  },
};

export const MACHINE_ORDER: MachineDef['id'][] = ['rocket', 'v8', 'drone'];

export const machineById = (id: MachineDef['id']): MachineDef => MACHINES[id];

/** Formatting helper local to data (kept tiny + shared by HUD). */
function fmt(v: number, digits = 0): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
