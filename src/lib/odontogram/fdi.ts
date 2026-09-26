/**
 * FDI tooth definitions and dental arch layout.
 *
 * This module is pure data/math (no React, no three.js scene objects) so it can
 * be reused by an existing odontogram (2D chart, forms, API payloads).
 */

export type ToothKind = "incisor" | "canine" | "premolar" | "molar";

export type ToothState =
  | "sano"
  | "tratado"
  | "caries"
  | "ausente"
  | "endodoncia"
  | "corona";

export const TOOTH_STATES: ToothState[] = [
  "sano",
  "tratado",
  "caries",
  "ausente",
  "endodoncia",
  "corona",
];

export const TOOTH_STATE_META: Record<
  ToothState,
  { label: string; color: string; description: string }
> = {
  sano: { label: "Sano", color: "#f2ead9", description: "Sin hallazgos" },
  tratado: { label: "Tratado", color: "#3f9fd4", description: "Obturación / restauración" },
  caries: { label: "Caries", color: "#9a5a22", description: "Lesión activa" },
  ausente: { label: "Ausente", color: "#8a8f98", description: "Pieza no presente" },
  endodoncia: { label: "Endodoncia", color: "#c0512f", description: "Tratamiento de conducto" },
  corona: { label: "Corona", color: "#d9b45b", description: "Prótesis fija / corona" },
};

export interface ToothDef {
  /** FDI number, e.g. 11, 26, 38 */
  fdi: number;
  kind: ToothKind;
  /** Upper (maxilar) or lower (mandibular) arch */
  arch: "upper" | "lower";
  /** Patient side */
  side: "right" | "left";
  /** 1 = central incisor ... 8 = third molar */
  position: number;
  name: string;
  /** mesio-distal width (scene units) */
  width: number;
  /** bucco-lingual depth */
  depth: number;
  crownHeight: number;
  rootLength: number;
}

const KIND_BY_POSITION: ToothKind[] = [
  "incisor", // 1 central
  "incisor", // 2 lateral
  "canine", // 3
  "premolar", // 4
  "premolar", // 5
  "molar", // 6
  "molar", // 7
  "molar", // 8
];

const NAME_BY_POSITION = [
  "Incisivo central",
  "Incisivo lateral",
  "Canino",
  "Primer premolar",
  "Segundo premolar",
  "Primer molar",
  "Segundo molar",
  "Tercer molar",
];

// Upper / lower morphology per position (scene units, ~1 unit = 1 cm)
const UPPER_DIMS = [
  { w: 0.86, d: 0.72, ch: 1.05, rl: 1.25 },
  { w: 0.68, d: 0.66, ch: 0.92, rl: 1.2 },
  { w: 0.78, d: 0.8, ch: 1.08, rl: 1.6 },
  { w: 0.71, d: 0.9, ch: 0.85, rl: 1.35 },
  { w: 0.69, d: 0.9, ch: 0.82, rl: 1.3 },
  { w: 1.05, d: 1.1, ch: 0.78, rl: 1.35 },
  { w: 0.99, d: 1.08, ch: 0.74, rl: 1.3 },
  { w: 0.9, d: 1.0, ch: 0.7, rl: 1.1 },
];

const LOWER_DIMS = [
  { w: 0.54, d: 0.6, ch: 0.9, rl: 1.15 },
  { w: 0.6, d: 0.64, ch: 0.94, rl: 1.2 },
  { w: 0.7, d: 0.76, ch: 1.06, rl: 1.5 },
  { w: 0.71, d: 0.8, ch: 0.84, rl: 1.3 },
  { w: 0.73, d: 0.84, ch: 0.82, rl: 1.35 },
  { w: 1.12, d: 1.04, ch: 0.76, rl: 1.4 },
  { w: 1.05, d: 1.0, ch: 0.74, rl: 1.32 },
  { w: 0.95, d: 0.94, ch: 0.7, rl: 1.1 },
];

function makeQuadrant(
  quadrantDigit: number,
  arch: "upper" | "lower",
  side: "right" | "left",
): ToothDef[] {
  const dims = arch === "upper" ? UPPER_DIMS : LOWER_DIMS;
  return Array.from({ length: 8 }, (_, i) => {
    const position = i + 1;
    const d = dims[i]!;
    return {
      fdi: quadrantDigit * 10 + position,
      kind: KIND_BY_POSITION[i]!,
      arch,
      side,
      position,
      name: NAME_BY_POSITION[i]!,
      width: d.w,
      depth: d.d,
      crownHeight: d.ch,
      rootLength: d.rl,
    };
  });
}

/** Quadrant 1: upper right, 2: upper left, 3: lower left, 4: lower right */
export const TEETH: ToothDef[] = [
  ...makeQuadrant(1, "upper", "right"),
  ...makeQuadrant(2, "upper", "left"),
  ...makeQuadrant(3, "lower", "left"),
  ...makeQuadrant(4, "lower", "right"),
];

export const TEETH_BY_FDI: Record<number, ToothDef> = Object.fromEntries(
  TEETH.map((t) => [t.fdi, t]),
) as Record<number, ToothDef>;

export const FDI_ROWS = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
  lowerRight: [41, 42, 43, 44, 45, 46, 47, 48],
};

export function defaultChart(): Record<number, ToothState> {
  return Object.fromEntries(TEETH.map((t) => [t.fdi, "sano" as ToothState]));
}

/* ------------------------------------------------------------------ *
 * Arch geometry (elliptical catenary-like arch, arc-length placement)
 * ------------------------------------------------------------------ */

export interface ArchShape {
  rx: number;
  rz: number;
}

export const UPPER_ARCH: ArchShape = { rx: 3.15, rz: 3.85 };
export const LOWER_ARCH: ArchShape = { rx: 2.9, rz: 3.5 };

/**
 * Point on the arch. `theta` = 0 at the midline (front), grows toward the back.
 * Local space: +z is anterior (front, toward the viewer), +x is patient-left.
 */
export function archPoint(shape: ArchShape, theta: number, sign: 1 | -1) {
  return {
    x: sign * shape.rx * Math.sin(theta),
    z: shape.rz * Math.cos(theta),
  };
}

function archArcLength(shape: ArchShape, theta: number, steps = 60) {
  let len = 0;
  let prev = archPoint(shape, 0, 1);
  for (let i = 1; i <= steps; i++) {
    const p = archPoint(shape, (theta * i) / steps, 1);
    len += Math.hypot(p.x - prev.x, p.z - prev.z);
    prev = p;
  }
  return len;
}

/** Invert arc length -> theta (simple bisection, plenty fast for 32 teeth). */
function thetaForArcLength(shape: ArchShape, target: number) {
  let lo = 0;
  let hi = Math.PI * 0.72;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (archArcLength(shape, mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface ToothPlacement {
  fdi: number;
  /** Local arch-space position (crown points +y, root -y) */
  position: [number, number, number];
  /** Yaw so the buccal face points outward along the arch normal */
  yaw: number;
  /** Small mesio-distal inclination for a natural look */
  tilt: number;
}

/** Arc-length placement of every tooth of one arch, side by side, no overlap. */
export function computePlacements(arch: "upper" | "lower"): ToothPlacement[] {
  const shape = arch === "upper" ? UPPER_ARCH : LOWER_ARCH;
  const out: ToothPlacement[] = [];

  for (const sideSign of [1, -1] as const) {
    let cursor = 0;
    const teeth = TEETH.filter(
      (t) => t.arch === arch && (sideSign === 1 ? t.side === "left" : t.side === "right"),
    ).sort((a, b) => a.position - b.position);

    for (const t of teeth) {
      const center = cursor + t.width / 2;
      const theta = thetaForArcLength(shape, center);
      const p = archPoint(shape, theta, sideSign);
      out.push({
        fdi: t.fdi,
        position: [p.x, 0, p.z],
        yaw: sideSign * theta,
        tilt: sideSign * (t.position <= 3 ? 0.06 : -0.04),
      });
      cursor += t.width * 0.99;
    }
  }
  return out;
}
