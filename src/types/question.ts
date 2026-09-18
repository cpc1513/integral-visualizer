// 真题与可视化规格的类型定义
// 数据：public/data/questions.json（期末真题 85 + 机考选择题 133）

export type QuestionCategory =
  | 'double-cartesian'   // 二重积分·直角坐标
  | 'double-polar'       // 二重积分·极坐标
  | 'double-swap'        // 二重积分·交换积分次序
  | 'double-concept'     // 二重积分·概念性质
  | 'double-app'         // 二重积分·应用（面积/体积/质量）
  | 'triple-cartesian'   // 三重积分·直角坐标
  | 'triple-cylindrical' // 三重积分·柱坐标
  | 'triple-spherical'   // 三重积分·球坐标
  | 'triple-concept'     // 三重积分·概念性质
  | 'triple-app'         // 三重积分·应用（体积/质心）
  | 'line-1'             // 曲线积分·第一类
  | 'line-2'             // 曲线积分·第二类
  | 'green'              // 格林公式
  | 'surface-1'          // 曲面积分·第一类
  | 'surface-2'          // 曲面积分·第二类
  | 'gauss'              // 高斯公式
  | 'stokes'             // 斯托克斯公式
  | 'misc'               // 其他（级数/微分方程等综合）

export type BankKey = 'past' | 'computer'

export interface CategoryMeta {
  key: QuestionCategory
  label: string
  group: '二重积分' | '三重积分' | '曲线积分' | '曲面积分' | '积分定理' | '综合'
}

export const CATEGORIES: CategoryMeta[] = [
  { key: 'double-cartesian', label: '直角坐标', group: '二重积分' },
  { key: 'double-polar', label: '极坐标', group: '二重积分' },
  { key: 'double-swap', label: '交换积分次序', group: '二重积分' },
  { key: 'double-concept', label: '概念与性质', group: '二重积分' },
  { key: 'double-app', label: '应用（面积/体积）', group: '二重积分' },
  { key: 'triple-cartesian', label: '直角坐标', group: '三重积分' },
  { key: 'triple-cylindrical', label: '柱坐标', group: '三重积分' },
  { key: 'triple-spherical', label: '球坐标', group: '三重积分' },
  { key: 'triple-concept', label: '概念与性质', group: '三重积分' },
  { key: 'triple-app', label: '应用（体积/质心）', group: '三重积分' },
  { key: 'line-1', label: '第一类（对弧长）', group: '曲线积分' },
  { key: 'line-2', label: '第二类（对坐标）', group: '曲线积分' },
  { key: 'green', label: '格林公式', group: '积分定理' },
  { key: 'surface-1', label: '第一类（对面积）', group: '曲面积分' },
  { key: 'surface-2', label: '第二类（对坐标）', group: '曲面积分' },
  { key: 'gauss', label: '高斯公式', group: '积分定理' },
  { key: 'stokes', label: '斯托克斯公式', group: '积分定理' },
  { key: 'misc', label: '其他综合', group: '综合' },
]

export const CATEGORY_LABELS: Record<QuestionCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label]),
) as Record<QuestionCategory, string>

// ---------- 可视化规格 ----------

/** 二维积分区域（SVG 叠加层） */
export type Region2D =
  | { type: 'between'; f: string; g: string; xMin: number; xMax: number; fLabel?: string; gLabel?: string }
  | { type: 'disk'; r: number; sector?: [number, number] }     // sector: 弧度范围
  | { type: 'triangle'; points: [number, number][] }

/** 预采样参数曲面：nu×nv 网格点（行主序），运行端直接建 BufferGeometry */
export interface ParamSurface {
  nu: number
  nv: number
  points: [number, number, number][]
  color: string
}

/** 三维场景 */
export type SceneSpec =
  | { kind: 'none' }
  | {
      kind: 'parametric'
      surfaces: ParamSurface[]
      /** 绕 z 轴旋转体的轮廓 [r, z][]（可选，用于填充体积） */
      latheProfile?: [number, number][]
      /** 球体填充半径（可选，如单位球内部） */
      sphereFillR?: number
      camera: { position: [number, number, number]; target: [number, number, number] }
    }
  | {
      kind: 'paramCurve'
      points: [number, number, number][]
      direction?: boolean
      camera: { position: [number, number, number]; target: [number, number, number] }
    }

export interface VizSpec {
  scene: SceneSpec
  /** 二维积分区域（存在时在视窗左上角叠加 SVG 图） */
  region2d?: Region2D | null
  /** 最佳观测机位 */
  camera: { position: [number, number, number]; target: [number, number, number] }
  /** 场景一句话说明 */
  caption: string
}

// ---------- 真题 ----------

export interface SolutionStep {
  title: string
  latex: string
}

export interface Question {
  id: string
  bank: BankKey
  category: QuestionCategory
  /** 学年（如 "2023-2024"）或 "机考" */
  year: string
  /** 分值；机考题无分值则为 null */
  score: number | null
  tags: string[]
  /** 题干，LaTeX（选择题含选项） */
  statement: string
  /** 最终答案：真题为 LaTeX，选择题为选项字母 */
  answer: string
  /** 选择题标记 */
  choice?: boolean
  /** 分步解析；机考题多为空数组 */
  solution: SolutionStep[]
  /** 可视化联动规格 */
  viz: VizSpec
}

export interface QuestionBankFile {
  meta: {
    title: string
    version: string
    note: string
    banks: Record<BankKey, string>
  }
  questions: Question[]
}
