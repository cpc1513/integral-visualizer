import { useMemo, useRef, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Grid, Html, Line } from '@react-three/drei'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import type { VizSpec, ParamSurface } from '@/types/question'

// 数学惯例：z 轴向上（R3F 默认 y-up，这里显式设置 up=[0,0,1]）

const AXIS_COLORS = { x: '#ef4444', y: '#22c55e', z: '#3b82f6' }

export function Scene3D({ viz, tick }: { viz: VizSpec; tick: number }) {
  return (
    <Canvas
      camera={{ position: [5, 4, 5], up: [0, 0, 1], fov: 45, near: 0.1, far: 200 }}
      style={{ background: 'transparent' }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 6, 10]} intensity={1.1} />
      <directionalLight position={[-6, -4, 6]} intensity={0.35} />

      {/* 坐标网格地面 */}
      <Grid
        rotation={[Math.PI / 2, 0, 0]}
        args={[20, 20]}
        cellSize={0.5}
        cellColor="#1e2430"
        sectionSize={2}
        sectionColor="#2c3648"
        fadeDistance={26}
        fadeStrength={1.6}
        infiniteGrid
        position={[0, 0, -0.002]}
      />

      <Axes length={2.6} />
      <SceneContent viz={viz} />
      <CameraRig viz={viz} tick={tick} />
    </Canvas>
  )
}

// ---------- 坐标轴（带箭头） ----------
function Axes({ length }: { length: number }) {
  const axes: { dir: [number, number, number]; color: string; label: string }[] = [
    { dir: [1, 0, 0], color: AXIS_COLORS.x, label: 'x' },
    { dir: [0, 1, 0], color: AXIS_COLORS.y, label: 'y' },
    { dir: [0, 0, 1], color: AXIS_COLORS.z, label: 'z' },
  ]
  return (
    <group>
      {axes.map(({ dir, color, label }) => {
        const end = new THREE.Vector3(...dir).multiplyScalar(length)
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(...dir),
        )
        return (
          <group key={label}>
            <Line points={[[0, 0, 0], end.toArray()]} color={color} lineWidth={2} />
            <mesh position={end.toArray()} quaternion={quat}>
              <coneGeometry args={[0.055, 0.18, 12]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <Html position={end.clone().multiplyScalar(1.14).toArray()} center zIndexRange={[10, 0]}>
              <span style={{ color, fontStyle: 'italic', fontSize: 15, fontFamily: 'Georgia, serif', textShadow: '0 0 6px rgba(0,0,0,.9)' }}>
                {label}
              </span>
            </Html>
            {/* 原点反向的短虚线，帮助定位 */}
            <Line
              points={[[0, 0, 0], end.clone().multiplyScalar(-0.45).toArray()]}
              color={color}
              lineWidth={1}
              dashed
              dashSize={0.08}
              gapSize={0.06}
              transparent
              opacity={0.35}
            />
          </group>
        )
      })}
    </group>
  )
}

// ---------- 场景内容 ----------
function SceneContent({ viz }: { viz: VizSpec }) {
  const { scene } = viz
  if (scene.kind === 'none') return <OriginMarker />
  if (scene.kind === 'paramCurve') return <ParamCurveMesh points={scene.points} direction={scene.direction} />
  return (
    <group>
      {scene.surfaces.map((s, i) => (
        <ParamSurfaceMesh key={i} surf={s} />
      ))}
      {scene.latheProfile && <LatheFill profile={scene.latheProfile} />}
      {scene.sphereFillR && <SphereFill r={scene.sphereFillR} />}
    </group>
  )
}

function OriginMarker() {
  return (
    <mesh>
      <sphereGeometry args={[0.04, 16, 16]} />
      <meshBasicMaterial color="#94a3b8" />
    </mesh>
  )
}

// ---------- 预采样参数曲面 ----------
/** 由行主序点网格直接构建 BufferGeometry。
 *  注意：采样数据实际是 (nu+1)×(nv+1) 网格，nu/nv 记录的是四边形数；
 *  环绕曲面的末列与首列完全重合。必须按真实行距 nv+1 读取——
 *  若误用 nv，每行错位一个点，会在曲面上形成螺旋状三角剖分痕迹。 */
function gridGeometry(surf: ParamSurface): THREE.BufferGeometry {
  const { nu, nv, points } = surf
  const dist3 = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])

  // 0) 推断真实行距与行数
  const cols = points.length === (nu + 1) * (nv + 1) ? nv + 1 : nv
  const rows = Math.floor(points.length / cols)

  // 1) 剔除完全重复的相邻采样列（零面积三角形会导致法线异常）
  const keep: number[] = []
  for (let j = 0; j < cols; j++) {
    if (keep.length > 0) {
      const prev = keep[keep.length - 1]
      let same = true
      for (let i = 0; i < rows; i++) {
        if (dist3(points[i * cols + j], points[i * cols + prev]) > 1e-6) { same = false; break }
      }
      if (same) continue
    }
    keep.push(j)
  }

  // 2) 环绕曲面的末列与首列重合：去掉末列并直接确认闭合
  let closedData = false
  if (keep.length > 2) {
    const first = keep[0]
    const last = keep[keep.length - 1]
    let same = true
    for (let i = 0; i < rows; i++) {
      if (dist3(points[i * cols + first], points[i * cols + last]) > 1e-6) { same = false; break }
    }
    if (same) {
      keep.pop()
      closedData = true
    }
  }
  const nv2 = keep.length

  // 3) 对无重复末列的数据，投票检测行向是否首尾闭合（旋转面/柱面/球面）：
  //    多数非退化行的首尾点距离与平均采样间距相当时，将末列与首列相连
  let wrapU = closedData
  if (!wrapU) {
    let validRows = 0
    let nearClosed = 0
    for (let i = 0; i < rows; i++) {
      let sp = 0
      for (let k = 0; k < nv2 - 1; k++) sp += dist3(points[i * cols + keep[k]], points[i * cols + keep[k + 1]])
      sp /= nv2 - 1
      if (sp < 1e-9) continue // 退化行（锥顶、球极）
      validRows++
      if (dist3(points[i * cols + keep[0]], points[i * cols + keep[nv2 - 1]]) < sp * 3.5) nearClosed++
    }
    wrapU = validRows > 0 && nearClosed / validRows > 0.6
  }

  const geo = new THREE.BufferGeometry()
  const verts = new Float32Array(rows * nv2 * 3)
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < nv2; j++) {
      const p = points[i * cols + keep[j]]
      const o = (i * nv2 + j) * 3
      verts[o] = p[0]
      verts[o + 1] = p[1]
      verts[o + 2] = p[2]
    }
  }
  const idx: number[] = []
  const jMax = wrapU ? nv2 : nv2 - 1 // 闭合曲面把最后一列连回首列
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < jMax; j++) {
      const j2 = (j + 1) % nv2
      const a = i * nv2 + j
      const a2 = i * nv2 + j2
      const b = (i + 1) * nv2 + j
      const b2 = (i + 1) * nv2 + j2
      idx.push(a, b, a2, b, b2, a2)
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  // 退化三角形（如锥顶、球极）会产生 NaN 法线，替换为竖直方向避免渲染发黑
  const normals = geo.getAttribute('normal')
  for (let i = 0; i < normals.count; i++) {
    const nx = normals.getX(i), ny = normals.getY(i), nz = normals.getZ(i)
    if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) {
      normals.setXYZ(i, 0, 0, 1)
    }
  }
  normals.needsUpdate = true
  return geo
}

function ParamSurfaceMesh({ surf }: { surf: ParamSurface }) {
  const geo = useMemo(() => gridGeometry(surf), [surf])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo}>
      <meshPhysicalMaterial
        color={surf.color}
        transparent
        opacity={0.5}
        roughness={0.35}
        metalness={0.05}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

/** 旋转体轮廓填充（profile: [r, z][]，绕 z 轴） */
function LatheFill({ profile }: { profile: [number, number][] }) {
  const geo = useMemo(() => {
    const pts = profile.map(([r, z]) => new THREE.Vector2(Math.max(r, 1e-4), z))
    const g = new THREE.LatheGeometry(pts, 48)
    g.rotateX(Math.PI / 2) // LatheGeometry 绕 Y 轴 → 转为 z-up
    return g
  }, [profile])
  useEffect(() => () => geo.dispose(), [geo])
  return <FillMesh geo={geo} />
}

/** 球体填充 */
function SphereFill({ r }: { r: number }) {
  const geo = useMemo(() => new THREE.SphereGeometry(r, 40, 28), [r])
  useEffect(() => () => geo.dispose(), [geo])
  return <FillMesh geo={geo} />
}

function FillMesh({ geo }: { geo: THREE.BufferGeometry }) {
  return (
    <mesh geometry={geo}>
      <meshPhysicalMaterial
        color="#fbbf24"
        transparent
        opacity={0.28}
        roughness={0.2}
        side={THREE.DoubleSide}
        depthWrite={false}
        emissive="#b45309"
        emissiveIntensity={0.25}
      />
    </mesh>
  )
}

// ---------- 预采样参数曲线 ----------
function ParamCurveMesh({ points, direction }: { points: [number, number, number][]; direction?: boolean }) {
  const arrowPoses = useMemo(() => {
    if (!direction || points.length < 8) return []
    const poses: { pos: [number, number, number]; quat: THREE.Quaternion }[] = []
    const up = new THREE.Vector3(0, 1, 0)
    for (const frac of [0.2, 0.45, 0.7, 0.95]) {
      const i = Math.floor(points.length * frac)
      const p = new THREE.Vector3(...points[i])
      const q = new THREE.Vector3(...points[Math.min(i + 2, points.length - 1)])
      const tangent = q.clone().sub(p).normalize()
      if (tangent.lengthSq() < 1e-8) continue
      poses.push({ pos: points[i], quat: new THREE.Quaternion().setFromUnitVectors(up, tangent) })
    }
    return poses
  }, [points, direction])

  const closed = useMemo(() => {
    if (points.length < 2) return false
    const a = points[0], b = points[points.length - 1]
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-3
  }, [points])

  return (
    <group>
      <Line points={points} color="#22d3ee" lineWidth={3} />
      {/* 起点标记（闭曲线只标一个） */}
      <mesh position={points[0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#f59e0b" />
      </mesh>
      {!closed && (
        <mesh position={points[points.length - 1]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      )}
      {arrowPoses.map((a, i) => (
        <mesh key={i} position={a.pos} quaternion={a.quat}>
          <coneGeometry args={[0.06, 0.2, 10]} />
          <meshBasicMaterial color="#22d3ee" />
        </mesh>
      ))}
    </group>
  )
}

// ---------- 相机动画：切换到最佳观测角度 ----------
function CameraRig({ viz, tick }: { viz: VizSpec; tick: number }) {
  const controlsRef = useRef<CameraControls>(null)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    camera.up.set(0, 0, 1)
  }, [camera])

  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    const { position, target } = viz.camera
    c.setLookAt(position[0], position[1], position[2], target[0], target[1], target[2], true)
  }, [viz, tick])

  return <CameraControls ref={controlsRef} makeDefault smoothTime={0.9} draggingSmoothTime={0.12} />
}
