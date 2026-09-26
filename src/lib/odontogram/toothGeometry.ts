/**
 * Procedural anatomical geometry for the 3D odontogram.
 *
 * Every tooth is a lofted solid: tapered root -> cervical neck -> crown with an
 * occlusal surface sculpted per tooth class (incisal edge, canine cusp, two
 * premolar cusps, four molar cusps).
 *
 * Want photoreal scanned dentition instead? Drop a GLB in `public/models/` and
 * see `src/components/odontogram/ToothMesh.tsx` (GLB SLOT comment) — the tooth
 * component is the only place that needs to change.
 */
import * as THREE from "three";
import type { ToothKind } from "./fdi";

/** Rounded-square cross-section (superellipse) sample. */
function sectionPoint(u: number, rx: number, rz: number, k: number) {
  const c = Math.cos(u);
  const s = Math.sin(u);
  return {
    x: Math.sign(c) * Math.pow(Math.abs(c), k) * rx,
    z: Math.sign(s) * Math.pow(Math.abs(s), k) * rz,
  };
}

function gauss(d: number, sigma: number) {
  return Math.exp(-(d * d) / (2 * sigma * sigma));
}

interface ToothDims {
  width: number;
  depth: number;
  crownHeight: number;
  rootLength: number;
}

/** Occlusal / incisal relief in local crown space. */
function occlusalHeight(kind: ToothKind, x: number, z: number, dims: ToothDims) {
  const { width: w, depth: d, crownHeight: h } = dims;
  const nx = (2 * x) / w;
  const nz = (2 * z) / d;

  switch (kind) {
    case "incisor": {
      // Chisel: flat edge along x, sloping away bucco-lingually
      const edge = 1 - Math.pow(Math.abs(nz), 1.7);
      const mamelons = 0.02 * Math.cos(nx * Math.PI * 3);
      return h - 0.16 * d * (1 - edge) + mamelons * (1 - Math.abs(nx));
    }
    case "canine": {
      const tip = gauss(nx, 0.52) * gauss(nz, 0.5);
      return h - 0.1 * d * Math.pow(Math.abs(nz), 1.6) + 0.34 * w * tip;
    }
    case "premolar": {
      const buccal = gauss(nz - 0.5, 0.36) * gauss(nx, 0.85);
      const lingual = gauss(nz + 0.5, 0.36) * gauss(nx, 0.85);
      const fossa = -0.06 * w * gauss(nz, 0.28);
      return h - 0.05 * w + 0.22 * w * (buccal + lingual * 0.86) + fossa;
    }
    case "molar":
    default: {
      let cusps = 0;
      const spots: Array<[number, number, number]> = [
        [-0.52, 0.5, 1.0],
        [0.52, 0.5, 0.92],
        [-0.52, -0.5, 0.95],
        [0.52, -0.5, 0.8],
      ];
      for (const [cx, cz, amp] of spots) {
        cusps += amp * gauss(nx - cx, 0.42) * gauss(nz - cz, 0.42);
      }
      const fissure = -0.05 * w * (gauss(nz, 0.2) + gauss(nx, 0.18));
      return h - 0.06 * w + 0.17 * w * cusps + fissure;
    }
  }
}

/** Radial scale of the loft at height parameter t (0 = root apex, 1 = crown top). */
function profileScale(t: number, kind: ToothKind) {
  if (t < 0.5) {
    // root: apex -> cervical
    const r = t / 0.5;
    return 0.12 + 0.82 * Math.pow(r, 0.55);
  }
  const c = (t - 0.5) / 0.5; // 0 at cervical, 1 at crown top
  const bulge = kind === "molar" || kind === "premolar" ? 0.16 : 0.2;
  return 0.94 + bulge * Math.sin(Math.PI * Math.min(c * 1.15, 1)) - 0.12 * c * c;
}

function heightAt(t: number, dims: ToothDims) {
  if (t < 0.5) return -dims.rootLength * (1 - t / 0.5);
  return (t - 0.5) * 2 * dims.crownHeight * 0.92;
}

export function buildToothGeometry(
  kind: ToothKind,
  dims: ToothDims,
  radialSegments = 28,
): THREE.BufferGeometry {
  const rings = 26;
  const capRings = 5;
  const k = kind === "incisor" ? 0.62 : kind === "molar" ? 0.72 : 0.68;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const rx = dims.width / 2;
  const rz = dims.depth / 2;

  const rowStart: number[] = [];

  // Body rows (root + crown walls)
  for (let j = 0; j <= rings; j++) {
    const t = j / rings;
    const s = profileScale(t, kind);
    const y = heightAt(t, dims);
    rowStart.push(positions.length / 3);
    for (let i = 0; i <= radialSegments; i++) {
      const u = (i / radialSegments) * Math.PI * 2;
      const p = sectionPoint(u, rx * s, rz * s, k);
      positions.push(p.x, y, p.z);
      uvs.push(i / radialSegments, t);
    }
  }

  // Occlusal cap rows: shrink the top section toward its center, heights from relief
  const topScale = profileScale(1, kind);
  const topY = heightAt(1, dims);
  for (let j = 1; j <= capRings; j++) {
    const f = 1 - j / capRings; // 1 -> 0
    rowStart.push(positions.length / 3);
    for (let i = 0; i <= radialSegments; i++) {
      const u = (i / radialSegments) * Math.PI * 2;
      const p = sectionPoint(u, rx * topScale * f, rz * topScale * f, k);
      const relief = occlusalHeight(kind, p.x, p.z, dims);
      // blend the rim toward the wall height so there is no seam
      const blend = j === capRings ? 1 : 1 - Math.pow(f, 2.2) * 0.25;
      const y = THREE.MathUtils.lerp(topY, relief, Math.min(1, blend));
      positions.push(p.x, y, p.z);
      uvs.push(i / radialSegments, 1 + j / capRings);
    }
  }

  // Stitch rows
  for (let r = 0; r < rowStart.length - 1; r++) {
    const a = rowStart[r]!;
    const b = rowStart[r + 1]!;
    for (let i = 0; i < radialSegments; i++) {
      indices.push(a + i, b + i, a + i + 1);
      indices.push(a + i + 1, b + i, b + i + 1);
    }
  }

  // Root apex fan
  const apexIndex = positions.length / 3;
  positions.push(0, heightAt(0, dims) - 0.04, 0);
  uvs.push(0.5, 0);
  for (let i = 0; i < radialSegments; i++) {
    indices.push(apexIndex, rowStart[0]! + i + 1, rowStart[0]! + i);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/* ------------------------------------------------------------------ *
 * Soft tissue: gingiva, palate, tongue
 * ------------------------------------------------------------------ */

export interface ArchSample {
  x: number;
  z: number;
  /** outward (buccal) normal in the xz plane */
  nx: number;
  nz: number;
  /** 0..1 along the whole arch */
  t: number;
}

export function sampleArch(rx: number, rz: number, steps = 160): ArchSample[] {
  const out: ArchSample[] = [];
  const span = Math.PI * 1.45; // from back-right, around the front, to back-left
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = -span / 2 + span * t;
    const x = rx * Math.sin(theta);
    const z = rz * Math.cos(theta);
    // outward normal of the ellipse
    let nx = Math.sin(theta) / rx;
    let nz = Math.cos(theta) / rz;
    const l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    out.push({ x, z, nx, nz, t });
  }
  return out;
}

/**
 * Gingiva: a closed ridge swept along the arch, with scalloped interdental
 * papillae at the margin so teeth appear to emerge from the tissue.
 */
export function buildGumGeometry(rx: number, rz: number, scallops = 16): THREE.BufferGeometry {
  const samples = sampleArch(rx, rz, 200);
  // cross-section in (radial offset, height); closed loop
  const section: Array<[number, number]> = [
    [-0.6, -0.95],
    [-0.56, -0.35],
    [-0.48, 0.02],
    [-0.28, 0.24],
    [0.0, 0.3],
    [0.3, 0.22],
    [0.52, -0.02],
    [0.6, -0.4],
    [0.64, -0.95],
  ];

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const cols = samples.length;
  const rowsN = section.length;

  for (let c = 0; c < cols; c++) {
    const s = samples[c]!;
    const scallop = 0.1 * Math.cos(s.t * Math.PI * 2 * scallops);
    const widen = 1 + 0.18 * Math.pow(Math.abs(s.t - 0.5) * 2, 2); // thicker toward molars
    for (let r = 0; r < rowsN; r++) {
      const [off, hRaw] = section[r]!;
      const h = hRaw > 0 ? hRaw + scallop : hRaw;
      positions.push(s.x + s.nx * off * widen, h, s.z + s.nz * off * widen);
      uvs.push(s.t * 6, r / (rowsN - 1));
    }
  }

  for (let c = 0; c < cols - 1; c++) {
    for (let r = 0; r < rowsN - 1; r++) {
      const a = c * rowsN + r;
      const b = (c + 1) * rowsN + r;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    // close the bottom (last -> first)
    const a = c * rowsN + rowsN - 1;
    const b = (c + 1) * rowsN + rowsN - 1;
    indices.push(a, b, c * rowsN, c * rowsN, b, (c + 1) * rowsN);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Hard + soft palate: concave vault filling the inside of the upper arch. */
export function buildPalateGeometry(rx: number, rz: number): THREE.BufferGeometry {
  const radial = 64;
  const rings = 22;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const innerX = rx * 0.82;
  const innerZ = rz * 0.86;

  for (let j = 0; j <= rings; j++) {
    const v = j / rings; // 0 center, 1 rim
    for (let i = 0; i <= radial; i++) {
      const u = (i / radial) * Math.PI * 2;
      const x = Math.cos(u) * innerX * v;
      const z = Math.sin(u) * innerZ * v - rz * 0.06 * (1 - v);
      // vault: deepest (highest, since this sits in the upper arch space) in the middle
      const dome = 0.62 * (1 - v * v);
      // rugae ripples near the front
      const rugae = 0.035 * Math.sin(z * 6.5) * Math.max(0, 1 - v) * Math.max(0, z);
      positions.push(x, dome + rugae + 0.05, z);
      uvs.push(i / radial, v);
    }
  }

  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < radial; i++) {
      const a = j * (radial + 1) + i;
      const b = (j + 1) * (radial + 1) + i;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Tongue: flattened, tapered body with a median sulcus. */
export function buildTongueGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 56, 40);
  const pos = geo.attributes['position']!;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const zn = v.z;
    const taper = 1 - 0.42 * Math.max(0, zn) ** 2 - 0.12 * Math.max(0, -zn) ** 2;
    let x = v.x * 1.45 * taper;
    let y = v.y * 0.6 * (1 - 0.25 * Math.max(0, zn));
    const z = zn * 2.15;
    // median sulcus on the dorsum
    if (v.y > 0) {
      y -= 0.1 * Math.exp(-(x * x) / 0.08) * (0.4 + 0.6 * Math.max(0, 1 - zn));
    }
    // slightly flatter tip
    if (zn > 0.7) y *= 0.8;
    x *= 1;
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ *
 * Procedural textures
 * ------------------------------------------------------------------ */

function makeCanvas(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  return canvas;
}

export function createTissueTexture(base: string, speckle: string, dots = 2600) {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < dots; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 4;
    ctx.globalAlpha = 0.04 + Math.random() * 0.1;
    ctx.fillStyle = speckle;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createEnamelTexture() {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * size;
    ctx.globalAlpha = 0.05 + Math.random() * 0.08;
    ctx.strokeStyle = i % 3 === 0 ? "#d9cdb4" : "#ffffff";
    ctx.lineWidth = 0.6 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() - 0.5) * 30, size);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
