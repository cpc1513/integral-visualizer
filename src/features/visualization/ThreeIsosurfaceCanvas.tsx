import { useEffect, useRef } from "react";
import type { ThreeScalarField } from "./plotSpec";
import { clipTriangleSoup } from "./clipTriangleSoup";

interface ThreeIsosurfaceCanvasProps {
  field: ThreeScalarField;
  onReady: () => void;
  onError: (error: Error) => void;
  registerReset: (reset: (() => void) | null) => void;
}

const BLUE = 0x2563eb;
const NAVY = 0x102a4c;
const GRID = 0xdce4ef;
const CANVAS = 0xf8fafc;

export function ThreeIsosurfaceCanvas({
  field,
  onReady,
  onError,
  registerReset,
}: ThreeIsosurfaceCanvasProps) {
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
      import("three/addons/objects/MarchingCubes.js"),
      import("three/addons/controls/OrbitControls.js"),
    ])
      .then(([THREE, { MarchingCubes }, { OrbitControls }]) => {
        if (cancelled) return;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(CANVAS, 1);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.03;
        renderer.domElement.className = "three-region-canvas";
        host.replaceChildren(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(CANVAS);
        const camera = new THREE.PerspectiveCamera(42, 1, 0.001, 10000);
        camera.up.set(0, 0, 1);

        const [xRange, yRange, zRange] = field.ranges;
        const spans = field.ranges.map((range) => range.upper - range.lower) as [number, number, number];
        const centers = field.ranges.map((range) => (range.upper + range.lower) / 2) as [number, number, number];
        const maxSpan = Math.max(...spans);
        camera.near = Math.max(maxSpan / 1000, 0.001);
        camera.far = Math.max(maxSpan * 100, 100);
        camera.updateProjectionMatrix();

        const material = new THREE.MeshStandardMaterial({
          color: BLUE,
          roughness: 0.62,
          metalness: 0.02,
          side: THREE.DoubleSide,
        });
        const maxPolyCount = Math.max(120000, field.resolution * field.resolution * 36);
        const marching = new MarchingCubes(field.resolution, material, false, false, maxPolyCount);
        marching.isolation = field.isoLevel;
        marching.field.set(field.values);
        marching.update();

        let surface: InstanceType<typeof THREE.Mesh> = marching;
        if (field.clipFields?.length) {
          const sourcePosition = marching.geometry.getAttribute("position");
          const sourceNormal = marching.geometry.getAttribute("normal");
          const drawCount = marching.geometry.drawRange.count;
          const clipped = clipTriangleSoup(
            sourcePosition.array,
            sourceNormal.array,
            drawCount,
            field.resolution,
            field.clipFields,
          );
          if (clipped.triangleCount === 0) throw new Error("当前范围内没有可显示的隐式曲面网格");
          const clippedGeometry = new THREE.BufferGeometry();
          clippedGeometry.setAttribute("position", new THREE.BufferAttribute(clipped.positions, 3));
          clippedGeometry.setAttribute("normal", new THREE.BufferAttribute(clipped.normals, 3));
          surface = new THREE.Mesh(clippedGeometry, material);
          marching.geometry.dispose();
        }

        const marchingScale = field.resolution / (field.resolution - 1);
        surface.scale.set(
          (spans[0] / 2) * marchingScale,
          (spans[1] / 2) * marchingScale,
          (spans[2] / 2) * marchingScale,
        );
        surface.position.set(
          centers[0] + spans[0] / (2 * (field.resolution - 1)),
          centers[1] + spans[1] / (2 * (field.resolution - 1)),
          centers[2] + spans[2] / (2 * (field.resolution - 1)),
        );
        scene.add(surface);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x9eb4d5, 2.05));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.35);
        keyLight.position.set(centers[0] + maxSpan * 1.4, centers[1] - maxSpan * 0.7, centers[2] + maxSpan * 1.8);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0x9dbbff, 1.15);
        fillLight.position.set(centers[0] - maxSpan, centers[1] + maxSpan, centers[2] + maxSpan * 0.35);
        scene.add(fillLight);

        const gridSize = maxSpan * 1.08;
        const grid = new THREE.GridHelper(gridSize, 10, GRID, GRID);
        grid.rotation.x = Math.PI / 2;
        grid.position.set(centers[0], centers[1], Math.min(Math.max(0, zRange.lower), zRange.upper));
        const gridMaterial = grid.material as InstanceType<typeof THREE.LineBasicMaterial>;
        gridMaterial.transparent = true;
        gridMaterial.opacity = 0.48;
        scene.add(grid);

        const x0 = Math.min(Math.max(0, xRange.lower), xRange.upper);
        const y0 = Math.min(Math.max(0, yRange.lower), yRange.upper);
        const z0 = Math.min(Math.max(0, zRange.lower), zRange.upper);
        const axisGeometry = new THREE.BufferGeometry();
        axisGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
          xRange.lower, y0, z0, xRange.upper, y0, z0,
          x0, yRange.lower, z0, x0, yRange.upper, z0,
          x0, y0, zRange.lower, x0, y0, zRange.upper,
        ], 3));
        const axes = new THREE.LineSegments(axisGeometry, new THREE.LineBasicMaterial({ color: NAVY, transparent: true, opacity: 0.52 }));
        scene.add(axes);

        const makeLabel = (text: string, position: [number, number, number]) => {
          const labelCanvas = document.createElement("canvas");
          labelCanvas.width = 128;
          labelCanvas.height = 64;
          const context = labelCanvas.getContext("2d");
          if (!context) return null;
          context.clearRect(0, 0, 128, 64);
          context.fillStyle = "#102a4c";
          context.font = "600 34px Inter, Microsoft YaHei, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(text, 64, 32);
          const texture = new THREE.CanvasTexture(labelCanvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
          sprite.position.set(...position);
          sprite.scale.set(maxSpan * 0.11, maxSpan * 0.055, 1);
          scene.add(sprite);
          return { sprite, texture };
        };
        const labels = [
          makeLabel(xRange.variable, [xRange.upper, y0, z0]),
          makeLabel(yRange.variable, [x0, yRange.upper, z0]),
          makeLabel(zRange.variable, [x0, y0, zRange.upper]),
        ].filter((label): label is NonNullable<typeof label> => Boolean(label));

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.screenSpacePanning = true;
        controls.target.set(centers[0], centers[1], centers[2]);
        controls.minDistance = maxSpan * 0.35;
        controls.maxDistance = maxSpan * 8;

        const resetView = () => {
          const distance = maxSpan * 1.72;
          camera.position.set(
            centers[0] + distance * 0.88,
            centers[1] - distance * 0.92,
            centers[2] + distance * 0.68,
          );
          controls.target.set(centers[0], centers[1], centers[2]);
          controls.update();
        };
        resetView();
        callbacksRef.current.registerReset(resetView);

        const resize = () => {
          const width = Math.max(host.clientWidth, 1);
          const height = Math.max(host.clientHeight, 1);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        resize();
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);

        let frame = 0;
        const animate = () => {
          frame = window.requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();
        callbacksRef.current.onReady();

        cleanup = () => {
          window.cancelAnimationFrame(frame);
          resizeObserver.disconnect();
          callbacksRef.current.registerReset(null);
          controls.dispose();
          labels.forEach(({ sprite, texture }) => {
            texture.dispose();
            (sprite.material as InstanceType<typeof THREE.SpriteMaterial>).dispose();
          });
          scene.traverse((object) => {
            const mesh = object as InstanceType<typeof THREE.Mesh>;
            if (mesh.geometry && mesh !== marching) mesh.geometry.dispose();
            const objectMaterial = mesh.material;
            if (Array.isArray(objectMaterial)) objectMaterial.forEach((item) => item.dispose());
            else if (objectMaterial && objectMaterial !== material) objectMaterial.dispose();
          });
          marching.geometry.dispose();
          material.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
        };
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        callbacksRef.current.onError(reason instanceof Error ? reason : new Error(String(reason)));
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [field]);

  return <div ref={hostRef} className="three-region-host" aria-hidden="true" />;
}
