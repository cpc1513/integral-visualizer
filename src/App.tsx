import { useEffect, useState } from 'react'
import { BookOpen, Keyboard, Crosshair, Sigma, Sun, Moon } from 'lucide-react'
import { Scene3D } from '@/components/viz3d/Scene3D'
import { Region2DView } from '@/components/Region2D'
import { FormulaEditor } from '@/components/FormulaEditor'
import { QuestionLibrary } from '@/components/QuestionLibrary'
import type { Question, QuestionBankFile, VizSpec } from '@/types/question'

const DEFAULT_VIZ: VizSpec = {
  scene: { kind: 'none' },
  camera: { position: [5, 4, 5], target: [0, 0, 0] },
  caption: '从左侧题库选择一道题，此处将渲染对应的积分区域 / 曲面 / 曲线',
}

type PanelTab = 'library' | 'editor'
type Theme = 'dark' | 'light'

const THEME_KEY = 'ivp-theme'
/** 题库分片数（与 scripts/pack-questions.mjs 输出保持一致） */
const DATA_PARTS = 7

function initialTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export default function App() {
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<PanelTab>('library')
  const [selected, setSelected] = useState<Question | null>(null)
  const [cameraTick, setCameraTick] = useState(0)
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* 隐私模式下忽略 */
    }
  }, [theme])

  useEffect(() => {
    // 题库分片以 gzip+base64 存储（1.6MB → 7 片共约 280KB），运行时并行拉取解压合并
    // 分片数由 scripts/pack-questions.mjs 输出决定，改动后需同步 DATA_PARTS
    const loadPart = async (i: number): Promise<QuestionBankFile> => {
      const r = await fetch(`${import.meta.env.BASE_URL}data/questions.part${i}.json.gz.b64`)
      if (!r.ok) throw new Error(`part${i} HTTP ${r.status}`)
      const b64 = (await r.text()).trim()
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const stream = new DecompressionStream('gzip')
      const text = await new Response(
        new Blob([bin]).stream().pipeThrough(stream),
      ).text()
      return JSON.parse(text)
    }
    Promise.all(Array.from({ length: DATA_PARTS }, (_, i) => loadPart(i)))
      .then((parts) => setQuestions(parts.flatMap((d) => d.questions)))
      .catch((e) => setLoadError(String(e)))
  }, [])

  const viz = selected?.viz ?? DEFAULT_VIZ
  // 移动端仅在选中题目时展示 3D 视窗（顶部 38vh），题库浏览时全屏列表
  const showSceneMobile = selected !== null && tab === 'library'

  const handleSelect = (q: Question | null) => {
    setSelected(q)
    if (q) setCameraTick((t) => t + 1) // 触发相机动画
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f4f6f9] dark:bg-[#0a0d13] text-zinc-800 dark:text-zinc-200 flex flex-col md:flex-row font-sans">
      {/* 左侧固定控制面板（移动端为下方滚动区） */}
      <aside className="order-2 md:order-1 w-full md:w-[420px] shrink-0 flex-1 min-h-0 md:h-full flex flex-col border-t md:border-t-0 md:border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#0d1117]">
        {/* 头部 */}
        <header className="px-4 pt-4 pb-3 border-b border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/25 to-blue-600/25 border border-cyan-500/30 flex items-center justify-center">
              <Sigma size={17} className="text-cyan-700 dark:text-cyan-300" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">积分可视化学习平台</h1>
              <p className="text-[11px] text-zinc-500">高等数学（下册）· 期末真题 84 + 机考题库 133</p>
            </div>
            <button
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
              aria-label="切换明暗主题"
              className="ml-auto w-8 h-8 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/70 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-300 hover:border-amber-400/60 dark:hover:border-amber-500/50 transition-colors"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
          {/* 标签页 */}
          <div className="flex gap-1 mt-3 p-0.5 rounded-lg bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800">
            <TabButton active={tab === 'library'} onClick={() => setTab('library')} icon={<BookOpen size={14} />}>
              真题库
            </TabButton>
            <TabButton active={tab === 'editor'} onClick={() => setTab('editor')} icon={<Keyboard size={14} />}>
              公式编辑器
            </TabButton>
          </div>
        </header>

        <div className="flex-1 min-h-0">
          {tab === 'library' ? (
            questions ? (
              <QuestionLibrary questions={questions} selected={selected} onSelect={handleSelect} />
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-400 dark:text-zinc-600 text-sm">
                {loadError ? `题库加载失败：${loadError}` : '题库加载中…'}
              </div>
            )
          ) : (
            <FormulaEditor />
          )}
        </div>
      </aside>

      {/* 右侧全屏 3D 视窗（移动端选题后显示在顶部） */}
      <main
        className={`order-1 md:order-2 relative bg-[radial-gradient(ellipse_at_center,#ffffff_0%,#eef1f5_70%)] dark:bg-[radial-gradient(ellipse_at_center,#10151f_0%,#0a0d13_70%)] md:flex-1 md:h-full md:block ${
          showSceneMobile ? 'w-full h-[38vh] shrink-0 border-b border-zinc-200 dark:border-zinc-800/80' : 'hidden'
        }`}
      >
        <Scene3D viz={viz} tick={cameraTick} />

        {/* 二维积分区域叠加 */}
        {viz.region2d && (
          <div className="absolute top-4 left-4 z-10 origin-top-left scale-[0.68] md:scale-100">
            <Region2DView region={viz.region2d} caption={viz.caption} />
          </div>
        )}

        {/* 场景说明（无 2D 区域时显示在左上） */}
        {!viz.region2d && (
          <div className="absolute top-4 left-4 z-10 max-w-[62vw] md:max-w-sm">
            <div className="rounded-xl border border-zinc-300/80 dark:border-zinc-700/60 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-sm px-4 py-3 shadow-2xl">
              <div className="text-[11px] tracking-widest text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-400/80" />
                当前场景
              </div>
              <div className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-snug">{viz.caption}</div>
            </div>
          </div>
        )}

        {/* 视窗工具条 */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            onClick={() => setCameraTick((t) => t + 1)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300/80 dark:border-zinc-700/60 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-sm px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:text-cyan-700 dark:hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
          >
            <Crosshair size={13} /> 最佳视角
          </button>
        </div>

        {/* 操作提示（按设备切换） */}
        <div className="absolute bottom-4 right-4 z-10 rounded-lg border border-zinc-200/80 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm px-3 py-2 text-[11px] text-zinc-500 space-x-3 hidden md:block">
          <span>左键拖动 · 旋转</span>
          <span>右键拖动 · 平移</span>
          <span>滚轮 · 缩放</span>
        </div>
        <div className="absolute bottom-3 right-3 z-10 rounded-lg border border-zinc-200/80 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm px-2.5 py-1.5 text-[11px] text-zinc-500 space-x-3 md:hidden">
          <span>单指拖动 · 旋转</span>
          <span>双指 · 缩放/平移</span>
        </div>

        {/* 未选题时的引导 */}
        {!selected && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5]">
            <div className="text-center">
              <div className="text-zinc-400 dark:text-zinc-600 text-sm">在左侧题库中点击题目卡片</div>
              <div className="text-zinc-400 dark:text-zinc-700 text-xs mt-1">3D 场景将自动渲染对应的积分区域，并动画切换到最佳观测角度</div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function TabButton({ active, onClick, icon, children }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 h-8 rounded-md text-xs flex items-center justify-center gap-1.5 transition-colors ${
        active ? 'bg-zinc-100 dark:bg-zinc-800 text-cyan-700 dark:text-cyan-300 border border-zinc-300 dark:border-zinc-700' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
