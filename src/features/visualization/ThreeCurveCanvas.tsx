import { useEffect, useRef } from "react";
import type { ThreeCurveSpec } from "./plotSpec";

interface ThreeCurveCanvasProps {
  curveSpec: ThreeCurveSpec;
  onReady: () => void;
  onError: (error: Error) => void;
  registerReset: (reset: (() => void) | null) => void;
}

const BLUE = 0x2563eb;
const ARROW_BLUE = 0x0f4ec9;
const NAVY = 0x102a4c;
const GRID = 0xdce4ef;
const CANVAS = 0xf8fafc;

export function ThreeCurveCanvas({ curveSpec, onReady, onError, registerReset }: ThreeCurveCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onReady, onError, registerReset });
  callbacksRef.current = { onReady, onError, registerReset };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let cleanup = () => undefined;

    Promise.all([
      import("three"),
      import("three/addons/controls/OrbitControls.js"),
    ])
      .then(([THREE, { OrbitControls }]) => {
        if (cancelled) return;
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(CANVAS, 1);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.04;
        renderer.domElement.className = "three-region-canvas";
        host.replaceChildren(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(CANVAS);
        const camera = new THREE.PerspectiveCamera(42, 1, 0.001, 10000);
        camera.up.set(0, 0, 1);
        const spans = curveSpec.ranges.map((range) => range.upper - range.lower) as [number, number, number];
        const centers = curveSpec.ranges.map((range) => (range.upper + range.lower) / 2) as [number, number, number];
        const maxSpan = Math.max(...spans);
        camera.near = Math.max(maxSpan / 1000, 0.001);
        camera.far = Math.max(maxSpan * 100, 100);
        camera.updateProjectionMatrix();

        const curveMaterial = new THREE.MeshStandardMaterial({
          color: BLUE,
          roughness: 0.48,
          metalness: 0.03,
        });
        const arrowMaterial = new THREE.MeshStandardMaterial({
          color: ARROW_BLUE,
          roughness: 0.42,
          metalness: 0.04,
        });
        const arrowUp = new THREE.Vector3(0, 1, 0);
        for (const path of curveSpec.paths) {
          if (path.points.length < 2) continue;
          const vectors = path.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
          const curve = new THREE.CatmullRomCurve3(vectors, path.closed, "centripetal", 0.35);
          const tubularSegments = Math.max(160, Math.min(1200, path.points.length * 2));
          const tube = new THREE.Mesh(
            new THREE.TubeGeometry(curve, tubularSegments, curveSpec.tubeRadius, 14, path.closed),
            curveMaterial,
          );
          scene.add(tube);

          const arrowPositions = path.closed ? [0.16, 0.49, 0.82] : [0.28, 0.58, 0.84];
          for (const amount of arrowPositions) {
            const tangent = curve.getTangentAt(amount).normalize();
            const arrowHeight = curveSpec.tubeRadius * 5.5;
            const arrow = new THREE.Mesh(
              new THREE.ConeGeometry(curveSpec.tubeRadius * 2.15, arrowHeight, 18),
              arrowMaterial,
            );
            arrow.position.copy(curve.getPointAt(amount)).addScaledVector(tangent, arrowHeight * 0.18);
            arrow.quaternion.setFromUnitVectors(arrowUp, tangent);
            scene.add(arrow);
          }
        }

        scene.add(new THREE.HemisphereLight(0xffffff, 0x9eb4d5, 2.1));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
        keyLight.position.set(centers[0] + maxSpan * 1.3, centers[1] - maxSpan, centers[2] + maxSpan * 1.7);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0x9dbbff, 1.1);
        fillLight.position.set(centers[0] - maxSpan, centers[1] + maxSpan, centers[2] + maxSpan * 0.4);
        scene.add(fillLight);

        const [xRange, yRange, zRange] = curveSpec.ranges;
        const x0 = Math.min(Math.max(0, xRange.lower), xRange.upper);
        const y0 = Math.min(Math.max(0, yRange.lower), yRange.upper);
        const z0 = Math.min(Math.max(0, zRange.lower), zRange.upper);
        const grid = new THREE.GridHelper(maxSpan * 1.12, 10, GRID, GRID);
        grid.rotation.x = Math.PI / 2;
        grid.position.set(centers[0], centers[1], z0);
        const gridMaterial = grid.material as InstanceType<typeof THREE.LineBasicMaterial>;
        gridMaterial.transparent = true;
        gridMaterial.opacity = 0.48;
        scene.add(grid);

        const axisGeometry = new THREE.BufferGeometry();
        axisGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
          xRange.lower, y0, z0, xRange.upper, y0, z0,
          x0, yRange.lower, z0, x0, yRange.upper, z0,
          x0, y0, zRange.lower, x0, y0, zRange.upper,
        ], 3));
        scene.add(new THREE.LineSegments(
          axisGeometry,
          new THREE.LineBasicMaterial({ color: NAVY, transparent: true, opacity: 0.52 }),
        ));

        const labelTextures: InstanceType<typeof THREE.CanvasTexture>[] = [];
        const makeLabel = (text: string, position: [number, number, number]) => {
          const canvas = document.createElement("canvas");
          canvas.width = 128;
          canvas.height = 64;
          const context = canvas.getContext("2d");
          if (!context) return;
          context.fillStyle = "#102a4c";
          context.font = "600 34px Inter, Microsoft YaHei, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(text, 64, 32);
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          labelTextures.push(texture);
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
          sprite.position.set(...position);
          sprite.scale.set(maxSpan * 0.11, maxSpan * 0.055, 1);
          scene.add(sprite);
        };
        makeLabel(xRange.variable, [xRange.upper, y0, z0]);
        makeLabel(yRange.variable, [x0, yRange.upper, z0]);
        makeLabel(zRange.variable, [x0, y0, zRange.upper]);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.screenSpacePanning = true;
        controls.target.set(...centers);
        controls.minDistance = maxSpan * 0.35;
        controls.maxDistance = maxSpan * 8;
        let frame = 0;
        const render = () => {
          frame = 0;
          if (document.hidden) return;
          controls.update();
          renderer.render(scene, camera);
        };
        const requestRender = () => {
          if (!frame && !document.hidden) frame = window.requestAnimationFrame(render);
        };
        controls.addEventListener("change", requestRender);

        const resetView = () => {
          const distance = maxSpan * 1.72;
          camera.position.set(
            centers[0] + distance * 0.88,
            centers[1] - distance * 0.92,
            centers[2] + distance * 0.68,
          );
          controls.target.set(...centers);
          controls.update();
          requestRender();
        };
        resetView();
        callbacksRef.current.registerReset(resetView);

        const resize = () => {
          const width = Math.max(host.clientWidth, 1);
          const height = Math.max(host.clientHeight, 1);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          requestRender();
        };
        resize();
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        const handleVisibilityChange = () => {
          if (!document.hidden) requestRender();
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        requestRender();
        callbacksRef.current.onReady();

        cleanup = () => {
          window.cancelAnimationFrame(frame);
          document.removeEventListener("visibilitychange", handleVisibilityChange);
          resizeObserver.disconnect();
          callbacksRef.current.registerReset(null);
          controls.removeEventListener("change", requestRender);
          controls.dispose();
          labelTextures.forEach((texture) => texture.dispose());
          scene.traverse((object) => {
            const renderable = object as InstanceType<typeof THREE.Mesh>;
            renderable.geometry?.dispose();
            const material = renderable.material;
            if (Array.isArray(material)) material.forEach((item) => item.dispose());
            else material?.dispose();
          });
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
        };
      })
      .catch((reason: unknown) => {
        if (!cancelled) callbacksRef.current.onError(reason instanceof Error ? reason : new Error(String(reason)));
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [curveSpec]);

  return <div ref={hostRef} className="three-region-host" aria-hidden="true" />;
}
