import { useMemo } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";

import {
  LOWER_ARCH,
  TEETH_BY_FDI,
  UPPER_ARCH,
  computePlacements,
  type ToothState,
} from "@/lib/odontogram/fdi";
import {
  buildGumGeometry,
  buildPalateGeometry,
  buildTongueGeometry,
  createEnamelTexture,
  createTissueTexture,
} from "@/lib/odontogram/toothGeometry";
import { ToothMesh } from "./ToothMesh";

interface MouthSceneProps {
  chart: Record<number, ToothState>;
  selected: number | null;
  hovered: number | null;
  onSelect: (fdi: number) => void;
  onHover: (fdi: number | null) => void;
}

/** Vertical separation of the arches — the mouth is held wide open. */
const OPEN_GAP = 1.95;
const UPPER_TILT = -0.5;
const LOWER_TILT = 0.5;

export function MouthScene({ chart, selected, hovered, onSelect, onHover }: MouthSceneProps) {
  const enamelMap = useMemo(() => createEnamelTexture(), []);
  const gumMap = useMemo(() => createTissueTexture("#c9526a", "#8f2f45"), []);
  const tongueMap = useMemo(() => createTissueTexture("#c25a68", "#93313f", 4200), []);

  const upperGum = useMemo(() => buildGumGeometry(UPPER_ARCH.rx, UPPER_ARCH.rz), []);
  const lowerGum = useMemo(() => buildGumGeometry(LOWER_ARCH.rx, LOWER_ARCH.rz), []);
  const palate = useMemo(() => buildPalateGeometry(UPPER_ARCH.rx, UPPER_ARCH.rz), []);
  const tongue = useMemo(() => buildTongueGeometry(), []);

  const upperPlacements = useMemo(() => computePlacements("upper"), []);
  const lowerPlacements = useMemo(() => computePlacements("lower"), []);

  const renderArch = (arch: "upper" | "lower") => {
    const isUpper = arch === "upper";
    const placements = isUpper ? upperPlacements : lowerPlacements;
    const gumGeo = isUpper ? upperGum : lowerGum;

    return (
      <group
        position={[0, isUpper ? OPEN_GAP : -OPEN_GAP, 0]}
        rotation={[isUpper ? UPPER_TILT : LOWER_TILT, 0, 0]}
      >
        {/* rotation-x = PI flips the arch so upper teeth point down */}
        <group rotation={[isUpper ? Math.PI : 0, 0, 0]}>
          {/* The upper arch is mirrored front-to-back by the rotation above,
              so its soft tissue is rotated to match the tooth placements. */}
          <group rotation={[0, isUpper ? Math.PI : 0, 0]}>
          <mesh geometry={gumGeo} castShadow receiveShadow>
            <meshPhysicalMaterial
              map={gumMap}
              color="#d0616f"
              side={THREE.DoubleSide}
              roughness={0.45}
              clearcoat={0.55}
              clearcoatRoughness={0.4}
              sheen={0.8}
              sheenColor="#ff9aa6"
            />
          </mesh>

          {isUpper && (
            <mesh geometry={palate} receiveShadow>
              <meshPhysicalMaterial
                map={gumMap}
                color="#c8606d"
                side={THREE.DoubleSide}
                roughness={0.55}
                clearcoat={0.4}
                sheen={0.6}
                sheenColor="#ff9aa6"
              />
            </mesh>
          )}
          </group>

          {placements.map((p) => {
            const def = TEETH_BY_FDI[p.fdi]!;
            const local = isUpper ? [p.position[0], 0, -p.position[2]] : p.position;
            const yaw = isUpper ? -p.yaw : p.yaw;
            return (
              <group
                key={p.fdi}
                position={[local[0]!, 0.06, local[2]!]}
                rotation={[p.tilt * 0.6, yaw, p.tilt]}
              >
                <ToothMesh
                  def={def}
                  state={chart[p.fdi] ?? "sano"}
                  selected={selected === p.fdi}
                  hovered={hovered === p.fdi}
                  enamelMap={enamelMap}
                  onSelect={onSelect}
                  onHover={onHover}
                />
                {selected === p.fdi && (
                  <Html
                    position={[0, def.crownHeight + 0.55, 0]}
                    center
                    distanceFactor={9}
                    zIndexRange={[20, 0]}
                  >
                    <div className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground shadow-lg">
                      {p.fdi}
                    </div>
                  </Html>
                )}
              </group>
            );
          })}
        </group>
      </group>
    );
  };

  return (
    <group>
      {renderArch("upper")}
      {renderArch("lower")}

      {/* Tongue, resting in the floor of the mouth */}
      <mesh
        geometry={tongue}
        position={[0, -OPEN_GAP - 0.55, -0.3]}
        rotation={[0.42, 0, 0]}
        scale={1.02}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          map={tongueMap}
          color="#c4626e"
          roughness={0.62}
          clearcoat={0.5}
          clearcoatRoughness={0.45}
          sheen={0.9}
          sheenColor="#ff9fa9"
        />
      </mesh>

      {/* Oral cavity / throat backdrop so the opening reads as depth, not a hole */}
      <mesh position={[0, -0.3, -4.2]} rotation={[0, 0, 0]}>
        <sphereGeometry args={[4.6, 40, 28]} />
        <meshStandardMaterial color="#4a1d26" roughness={0.95} side={THREE.BackSide} />
      </mesh>

      {/* Soft floor of the mouth */}
      <mesh position={[0, -OPEN_GAP - 0.95, -0.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[3.2, 48]} />
        <meshStandardMaterial map={gumMap} color="#b35262" roughness={0.7} />
      </mesh>
    </group>
  );
}
