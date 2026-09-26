import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { TOOTH_STATE_META, type ToothDef, type ToothState } from "@/lib/odontogram/fdi";
import { buildToothGeometry } from "@/lib/odontogram/toothGeometry";

/*
 * GLB SLOT ---------------------------------------------------------------
 * The crown/root shape below is generated procedurally (anatomical loft with
 * per-class occlusal relief). To swap in a scanned/authored model instead:
 *   1. put one GLB per tooth in `public/models/teeth/<fdi>.glb`
 *      (crown pointing +Y, root -Y, origin at the cervical line)
 *   2. replace the <mesh geometry={geometry}> below with:
 *        const { scene } = useGLTF(`/models/teeth/${def.fdi}.glb`)
 *        <primitive object={useMemo(() => scene.clone(), [scene])} />
 *      and keep the same material / event handlers.
 * Nothing else in the odontogram needs to change.
 * ----------------------------------------------------------------------- */

interface ToothMeshProps {
  def: ToothDef;
  state: ToothState;
  selected: boolean;
  hovered: boolean;
  enamelMap: THREE.Texture;
  onSelect: (fdi: number) => void;
  onHover: (fdi: number | null) => void;
}

export function ToothMesh({
  def,
  state,
  selected,
  hovered,
  enamelMap,
  onSelect,
  onHover,
}: ToothMeshProps) {
  const geometry = useMemo(
    () =>
      buildToothGeometry(def.kind, {
        width: def.width,
        depth: def.depth,
        crownHeight: def.crownHeight,
        rootLength: def.rootLength,
      }),
    [def],
  );

  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  const meta = TOOTH_STATE_META[state];
  const missing = state === "ausente";
  const target = useMemo(() => new THREE.Color(meta.color), [meta.color]);
  const emissive = useMemo(
    () => new THREE.Color(selected ? "#2ec5b6" : hovered ? "#1d7f79" : "#000000"),
    [selected, hovered],
  );

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-10 * delta);
    const m = matRef.current;
    if (m) {
      m.color.lerp(target, k);
      m.emissive.lerp(emissive, k);
      const targetOpacity = missing ? 0.14 : 1;
      m.opacity += (targetOpacity - m.opacity) * k;
      m.metalness += ((state === "corona" ? 0.55 : 0.04) - m.metalness) * k;
      m.roughness += ((state === "caries" ? 0.85 : 0.28) - m.roughness) * k;
    }
    const g = groupRef.current;
    if (g) {
      const lift = selected ? 0.16 : hovered ? 0.06 : 0;
      g.position.y += (lift - g.position.y) * k;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect(def.fdi);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(def.fdi);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "auto";
        }}
      >
        <meshPhysicalMaterial
          ref={matRef}
          map={enamelMap}
          color={meta.color}
          transparent
          opacity={missing ? 0.14 : 1}
          roughness={0.28}
          metalness={0.04}
          clearcoat={0.7}
          clearcoatRoughness={0.22}
          sheen={0.4}
          sheenColor="#fff6e8"
          emissiveIntensity={0.38}
          depthWrite={!missing}
        />
      </mesh>
    </group>
  );
}
