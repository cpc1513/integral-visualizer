import { useMemo } from 'react'
import type { Region2D } from '@/types/question'

/** 二维积分区域 SVG 图：网格 + 坐标轴 + 区域填充 + 边界线 */
export function Region2DView({ region, caption }: { region: Region2D; caption?: string }) {
  const W = 300
  const H = 240
  const pad = 30

  const model = useMemo(() => buildModel(region), [region])

  const [x0, x1] = model.xRange
  const [y0, y1] = model.yRange
  const sx = (W - pad * 2) / (x1 - x0)
  const sy = (H - pad * 2) / (y1 - y0)
  const px = (x: number) => pad + (x - x0) * sx
  const py = (y: number) => H - pad - (y - y0) * sy

  // 网格线
  const gridX: number[] = []
  const gridY: number[] = []
  const step = model.gridStep
  for (let x = Math.ceil(x0 / step) * step; x <= x1 + 1e-9; x += step) gridX.push(x)
  for (let y = Math.ceil(y0 / step) * step; y <= y1 + 1e-9; y += step) gridY.push(y)

  return (
    <div className="rounded-xl border border-zinc-300/80 dark:border-zinc-700/60 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-sm p-3 shadow-2xl w-[324px]">
      <div className="text-[11px] tracking-widest text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400/80" />
        积分区域 D
      </div>
      <svg width={W} height={H} className="block">
        <defs>
          <linearGradient id="regionFill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.10" />
          </linearGradient>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#f59e0b" strokeOpacity="0.28" strokeWidth="1" />
          </pattern>
        </defs>

        {/* 网格 */}
        {gridX.map((x) => (
          <line key={`gx${x}`} x1={px(x)} y1={pad} x2={px(x)} y2={H - pad} stroke="var(--r2d-grid)" strokeWidth="1" />
        ))}
        {gridY.map((y) => (
          <line key={`gy${y}`} x1={pad} y1={py(y)} x2={W - pad} y2={py(y)} stroke="var(--r2d-grid)" strokeWidth="1" />
        ))}

        {/* 坐标轴 */}
        {y0 <= 0 && y1 >= 0 && (
          <line x1={pad} y1={py(0)} x2={W - pad} y2={py(0)} stroke="var(--r2d-axis)" strokeWidth="1.4" />
        )}
        {x0 <= 0 && x1 >= 0 && (
          <line x1={px(0)} y1={pad} x2={px(0)} y2={H - pad} stroke="var(--r2d-axis)" strokeWidth="1.4" />
        )}
        {/* 轴箭头 */}
        {y0 <= 0 && y1 >= 0 && (
          <polygon points={`${W - pad},${py(0)} ${W - pad - 7},${py(0) - 4} ${W - pad - 7},${py(0) + 4}`} fill="var(--r2d-axis)" />
        )}
        {x0 <= 0 && x1 >= 0 && (
          <polygon points={`${px(0)},${pad} ${px(0) - 4},${pad + 7} ${px(0) + 4},${pad + 7}`} fill="var(--r2d-axis)" />
        )}
        <text x={W - pad + 4} y={py(0) + 4} fill="var(--r2d-label)" fontSize="11" fontStyle="italic">x</text>
        <text x={px(0) + 6} y={pad - 6} fill="var(--r2d-label)" fontSize="11" fontStyle="italic">y</text>

        {/* 刻度 */}
        {gridX.filter((x) => Math.abs(x) > 1e-9).map((x) => (
          <text key={`tx${x}`} x={px(x)} y={py(0) + 14} fill="var(--r2d-axis)" fontSize="9" textAnchor="middle">{trim(x)}</text>
        ))}
        {gridY.filter((y) => Math.abs(y) > 1e-9).map((y) => (
          <text key={`ty${y}`} x={px(0) - 6} y={py(y) + 3} fill="var(--r2d-axis)" fontSize="9" textAnchor="end">{trim(y)}</text>
        ))}

        {/* 区域填充 */}
        {model.fillPath && (
          <>
            <path d={model.fillPath(px, py)} fill="url(#regionFill)" />
            <path d={model.fillPath(px, py)} fill="url(#hatch)" />
          </>
        )}

        {/* 边界曲线 */}
        {model.curves.map((c, i) => (
          <path key={i} d={c.path(px, py)} fill="none" stroke={c.color} strokeWidth="2" />
        ))}

        {/* 边界标签 */}
        {model.labels.map((l, i) => (
          <text key={i} x={px(l.x)} y={py(l.y)} fill={l.color} fontSize="11" fontStyle="italic">{l.text}</text>
        ))}
      </svg>
      {caption && <div className="text-[11px] text-zinc-500 mt-1.5 leading-snug">{caption}</div>}
    </div>
  )
}

function trim(n: number): string {
  return Number(n.toFixed(2)).toString()
}

type Pt = (v: number) => number

interface Model {
  xRange: [number, number]
  yRange: [number, number]
  gridStep: number
  fillPath?: (px: Pt, py: Pt) => string
  curves: { path: (px: Pt, py: Pt) => string; color: string }[]
  labels: { x: number; y: number; text: string; color: string }[]
}

/** 安全求值：仅允许 x、数字、运算符与 Math 函数 */
function makeFn(expr: string): (x: number) => number {
  if (!/^[0-9x+\-*/().\s,a-z]*$/i.test(expr)) throw new Error('bad expr')
  // pi → PI（with(Math) 中只有大写 PI）；一元负号在 ** 前是 JS 语法错误，前置 0 消除
  const body = expr
    .replace(/\bpi\b/g, 'PI')
    .replace(/\^/g, '**')
    .replace(/(^|\()\s*-/g, '$10-')
  try {
    const fn = new Function('x', `with(Math){ return (${body}); }`) as (x: number) => number
    fn(0.1234) // 探测语法/作用域错误
    return (x) => {
      const v = fn(x)
      return Number.isFinite(v) ? v : NaN
    }
  } catch {
    return () => NaN
  }
}

/** 把 JS 表达式美化成数学记号：x**2 → x²，sqrt( → √(，pi → π */
export function prettyExpr(expr: string): string {
  return expr
    .replace(/\*\*2(?![0-9.])/g, '²')
    .replace(/\*\*3(?![0-9.])/g, '³')
    .replace(/\*\*(\d+)/g, '^$1')
    .replace(/sqrt\(/g, '√(')
    .replace(/\bpi\b/g, 'π')
    .replace(/\*(?=[a-zx(√π0-9])/gi, '·')
}

function buildModel(region: Region2D): Model {
  switch (region.type) {
    case 'between': {
      const f = makeFn(region.f)
      const g = makeFn(region.g)
      const { xMin, xMax } = region
      const N = 80
      const topPts: [number, number][] = []
      const botPts: [number, number][] = []
      let yMax = -Infinity
      let yMin = Infinity
      for (let i = 0; i <= N; i++) {
        const x = xMin + ((xMax - xMin) * i) / N
        const yf = f(x)
        const yg = g(x)
        if (!Number.isFinite(yf) || !Number.isFinite(yg)) continue
        const hi = Math.max(yf, yg)
        const lo = Math.min(yf, yg)
        topPts.push([x, hi])
        botPts.push([x, lo])
        yMax = Math.max(yMax, hi)
        yMin = Math.min(yMin, lo)
      }
      const mx = (xMax - xMin) * 0.35
      const my = Math.max((yMax - yMin) * 0.3, 0.4)

      const pathOf = (pts: [number, number][], close?: [number, number][]) =>
        (px: Pt, py: Pt) => {
          let d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${px(x)},${py(y)}`).join(' ')
          if (close) {
            d += ' ' + close.map(([x, y]) => `L${px(x)},${py(y)}`).join(' ') + ' Z'
          }
          return d
        }

      return {
        xRange: [xMin - mx, xMax + mx],
        yRange: [yMin - my * 0.6, yMax + my],
        gridStep: 0.5,
        fillPath: (px, py) => pathOf(topPts, [...botPts].reverse())(px, py),
        curves: [
          { path: pathOf(topPts), color: '#38bdf8' },
          { path: pathOf(botPts), color: '#34d399' },
        ],
        labels: [
          { x: xMax + 0.06, y: f(xMax), text: region.fLabel ?? `y=${prettyExpr(region.f)}`, color: '#38bdf8' },
          { x: xMax + 0.06, y: g(xMax), text: region.gLabel ?? `y=${prettyExpr(region.g)}`, color: '#34d399' },
        ],
      }
    }
    case 'disk': {
      const r = region.r
      const [a0, a1] = region.sector ?? [0, Math.PI * 2]
      const N = 72
      const arcPts: [number, number][] = []
      for (let i = 0; i <= N; i++) {
        const t = a0 + ((a1 - a0) * i) / N
        arcPts.push([r * Math.cos(t), r * Math.sin(t)])
      }
      const isFull = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6
      return {
        xRange: [-r * 1.45, r * 1.45],
        yRange: [-r * 1.35, r * 1.35],
        gridStep: r <= 1 ? 0.5 : 1,
        fillPath: (px, py) => {
          let d = isFull ? '' : `M${px(0)},${py(0)} `
          d += arcPts.map(([x, y], i) => `${!isFull || i > 0 ? 'L' : 'M'}${px(x)},${py(y)}`).join(' ')
          return d + ' Z'
        },
        curves: [
          {
            path: (px, py) => arcPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${px(x)},${py(y)}`).join(' '),
            color: '#38bdf8',
          },
        ],
        labels: [{ x: r * 0.72, y: r * 0.72, text: `r=${r}`, color: '#38bdf8' }],
      }
    }
    case 'triangle': {
      const pts = region.points
      const xs = pts.map((p) => p[0])
      const ys = pts.map((p) => p[1])
      const mx = (Math.max(...xs) - Math.min(...xs)) * 0.4 || 0.5
      const my = (Math.max(...ys) - Math.min(...ys)) * 0.4 || 0.5
      return {
        xRange: [Math.min(...xs) - mx, Math.max(...xs) + mx],
        yRange: [Math.min(...ys) - my, Math.max(...ys) + my],
        gridStep: 0.5,
        fillPath: (px, py) =>
          pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${px(x)},${py(y)}`).join(' ') + ' Z',
        curves: [
          {
            path: (px, py) =>
              pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${px(x)},${py(y)}`).join(' ') + ' Z',
            color: '#38bdf8',
          },
        ],
        labels: [],
      }
    }
  }
}
