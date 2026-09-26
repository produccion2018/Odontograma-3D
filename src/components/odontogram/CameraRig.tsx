import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type CameraView = "anterior" | "oclusal" | "derecha" | "izquierda";

export const CAMERA_VIEWS: Record<
  CameraView,
  { label: string; position: [number, number, number]; target: [number, number, number] }
> = {
  // +x is the patient's left, so the patient's right side is viewed from -x.
  anterior: { label: "Anterior", position: [0, 0.6, 15.5], target: [0, 0, 0] },
  oclusal: { label: "Oclusal", position: [0, 15, 0.9], target: [0, 0, 0] },
  derecha: { label: "Derecha", position: [-14.5, 0.8, 3], target: [0, 0, 0] },
  izquierda: { label: "Izquierda", position: [14.5, 0.8, 3], target: [0, 0, 0] },
};

export function CameraRig({ view, nonce }: { view: CameraView; nonce: number }) {
  const controls = useRef<any>(null);
  const desired = useRef(new THREE.Vector3());
  const desiredTarget = useRef(new THREE.Vector3());
  const animating = useRef(false);

  useEffect(() => {
    const v = CAMERA_VIEWS[view];
    desired.current.set(...v.position);
    desiredTarget.current.set(...v.target);
    animating.current = true;
  }, [view, nonce]);

  useFrame(({ camera }, delta) => {
    if (!animating.current || !controls.current) return;
    const k = 1 - Math.exp(-6 * delta);
    camera.position.lerp(desired.current, k);
    controls.current.target.lerp(desiredTarget.current, k);
    controls.current.update();
    if (camera.position.distanceTo(desired.current) < 0.02) animating.current = false;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={30}
      onStart={() => {
        animating.current = false;
      }}
    />
  );
}
