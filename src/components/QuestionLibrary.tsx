import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronDown, ChevronRight, ArrowLeft, Eye } from 'lucide-react'
import { Latex } from './Latex'
import { CATEGORIES, type BankKey, type Question, type QuestionCategory } from '@/types/question'

const GROUP_ORDER = ['二重积分', '三重积分', '曲线积分', '曲面积分', '积分定理', '综合'] as const

const BANKS: { key: BankKey | null; label: string }[] = [
  { key: null, label: '全部来源' },
  { key: 'past', label: '期末真题' },
  { key: 'computer', label: '机考题库' },
]

export function QuestionLibrary({
  questions,
  selected,
  onSelect,
}: {
  questions: Question[]
  selected: Question | null
  onSelect: (q: Question | null) => void
}) {
  const [query, setQuery] = useState('')
  const [activeBank, setActiveBank] = useState<BankKey | null>(null)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [activeCat, setActiveCat] = useState<QuestionCategory | null>(null)

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (activeBank && q.bank !== activeBank) return false
      if (activeCat && q.category !== activeCat) return false
      if (activeGroup && !activeCat) {
        const meta = CATEGORIES.find((c) => c.key === q.category)
        if (meta?.group !== activeGroup) return false
      }
      if (query.trim()) {
        const t = query.trim().toLowerCase()
        const hay = `${q.statement} ${q.tags.join(' ')} ${q.year} ${CATEGORIES.find((c) => c.key === q.category)?.label ?? ''}`.toLowerCase()
        if (!hay.includes(t)) return false
      }
      return true
    })
  }, [questions, query, activeBank, activeGroup, activeCat])

  const grouped = useMemo(() => {
    const map = new Map<string, Question[]>()
    for (const g of GROUP_ORDER) map.set(g, [])
    for (const q of filtered) {
      const meta = CATEGORIES.find((c) => c.key === q.category)
      if (meta) map.get(meta.group)?.push(q)
    }
    return map
  }, [filtered])

  const bankCount = useMemo(() => {
    const m = new Map<BankKey, number>()
    for (const q of questions) m.set(q.bank, (m.get(q.bank) ?? 0) + 1)
    return m
  }, [questions])

  return (
    <div className="flex flex-col h-full min-h-0">
      <AnimatePresence mode="wait" initial={false}>
        {selected ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col h-full min-h-0"
          >
            <QuestionDetail q={selected} onBack={() => onSelect(null)} />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col h-full min-h-0"
          >
            {/* 搜索 */}
            <div className="px-4 pt-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索题目、标签、学年…"
                  className="w-full h-9 rounded-lg bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500/60 focus:outline-none pl-9 pr-3 text-[13px] text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                />
              </div>
            </div>

            {/* 来源切换 */}
            <div className="px-4 pt-3">
              <div className="flex gap-1 rounded-lg bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 p-1">
                {BANKS.map((b) => (
                  <button
                    key={b.label}
                    onClick={() => setActiveBank(b.key)}
                    className={`flex-1 h-7 rounded-md text-[11px] transition-colors ${
                      activeBank === b.key
                        ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-medium'
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    {b.label}
                    <span className="ml-1 text-[10px] opacity-70">
                      {b.key ? bankCount.get(b.key) ?? 0 : questions.length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 分类筛选 */}
            <div className="px-4 pt-2.5 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <FilterChip active={activeGroup === null && activeCat === null} onClick={() => { setActiveGroup(null); setActiveCat(null) }}>
                  全部
                </FilterChip>
                {GROUP_ORDER.map((g) => (
                  <FilterChip
                    key={g}
                    active={activeGroup === g && !activeCat}
                    onClick={() => { setActiveGroup(activeGroup === g ? null : g); setActiveCat(null) }}
                  >
                    {g}
                  </FilterChip>
                ))}
              </div>
              {activeGroup && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex flex-wrap gap-1.5 overflow-hidden">
                  {CATEGORIES.filter((c) => c.group === activeGroup).map((c) => (
                    <FilterChip
                      key={c.key}
                      small
                      active={activeCat === c.key}
                      onClick={() => setActiveCat(activeCat === c.key ? null : c.key)}
                    >
                      {c.label}
                    </FilterChip>
                  ))}
                </motion.div>
              )}
            </div>

            {/* 题目列表 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
              {filtered.length === 0 && (
                <div className="text-center text-zinc-400 dark:text-zinc-600 text-sm pt-10">没有匹配的题目</div>
              )}
              {GROUP_ORDER.map((g) => {
                const list = grouped.get(g) ?? []
                if (list.length === 0) return null
                return (
                  <div key={g}>
                    <div className="text-[11px] font-medium text-zinc-500 tracking-widest mb-2 flex items-center gap-2">
                      <span className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
                      {g} · {list.length} 题
                      <span className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                    <div className="space-y-2">
                      {list.map((q) => (
                        <QuestionCard key={q.id} q={q} onClick={() => onSelect(q)} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FilterChip({ active, onClick, children, small }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  small?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border transition-colors ${
        small ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      } ${
        active
          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-700 dark:text-cyan-300'
          : 'bg-white/60 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}

function hasViz(q: Question) {
  return q.viz.scene.kind !== 'none' || !!q.viz.region2d
}

function QuestionCard({ q, onClick }: { q: Question; onClick: () => void }) {
  const cat = CATEGORIES.find((c) => c.key === q.category)
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 hover:border-cyan-500/40 p-3 transition-colors group"
    >
      <div className="flex items-center gap-2 mb-1.5 text-[11px]">
        <span className="text-cyan-700 dark:text-cyan-400/90 font-medium">{cat?.group} · {cat?.label}</span>
        {q.choice && <span className="px-1 rounded bg-violet-500/15 text-violet-700 dark:text-violet-300 text-[10px]">选择</span>}
        <span className="text-zinc-400 dark:text-zinc-600">{q.year}</span>
        {q.score != null && <span className="ml-auto text-amber-600 dark:text-amber-400/80">{q.score} 分</span>}
      </div>
      <div className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-3 [&_.katex-display]:my-1 [&_.katex]:text-[0.95em]">
        <Latex>{q.statement}</Latex>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        {q.tags.slice(0, 3).map((t) => (
          <span key={t} className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500">{t}</span>
        ))}
        {hasViz(q) && (
          <span className="ml-auto text-[11px] text-cyan-500/0 group-hover:text-cyan-700 dark:group-hover:text-cyan-400/90 transition-colors flex items-center gap-1">
            <Eye size={12} /> 可视化
          </span>
        )}
      </div>
    </button>
  )
}

function QuestionDetail({ q, onBack }: { q: Question; onBack: () => void }) {
  const cat = CATEGORIES.find((c) => c.key === q.category)
  return (
    <>
      <div className="px-4 pt-3 pb-2 border-b border-zinc-200 dark:border-zinc-800/80">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors mb-2">
          <ArrowLeft size={13} /> 返回题库
        </button>
        <div className="flex flex-wrap items-center gap-2 text-[11px] mb-1.5">
          <span className="text-cyan-700 dark:text-cyan-400/90 font-medium">{cat?.group} · {cat?.label}</span>
          {q.choice && <span className="px-1 rounded bg-violet-500/15 text-violet-700 dark:text-violet-300 text-[10px]">选择题</span>}
          <span className="text-zinc-400 dark:text-zinc-600">{q.year === '机考' ? '机考题库' : `${q.year} 学年`}</span>
          {q.score != null && <span className="text-amber-600 dark:text-amber-400/80">{q.score} 分</span>}
          <span className="ml-auto text-zinc-400 dark:text-zinc-600 font-mono">{q.id}</span>
        </div>
        <div className="text-[14px] text-zinc-800 dark:text-zinc-200 leading-relaxed [&_.katex-display]:my-2 [&_.katex-display]:overflow-x-auto">
          <Latex>{q.statement}</Latex>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {q.tags.map((t) => (
            <span key={t} className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500">{t}</span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {q.solution.length > 0 ? (
          <>
            <div className="text-[11px] font-medium text-zinc-500 tracking-widest mb-2">分步解析</div>
            <div className="space-y-2">
              {q.solution.map((s, i) => (
                <SolutionStep key={i} index={i} step={s} defaultOpen={i === 0} />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40 p-3 text-[12px] text-zinc-500">
            机考选择题暂无分步解析，可结合右侧可视化理解积分区域。
          </div>
        )}

        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-3">
          <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400/90 tracking-widest mb-1.5">
            {q.choice ? '正确答案' : '最终答案'}
          </div>
          <div className="text-zinc-900 dark:text-zinc-100 [&_.katex-display]:my-1 [&_.katex]:text-[1.05em]">
            <Latex>{q.answer}</Latex>
          </div>
        </div>
      </div>
    </>
  )
}

function SolutionStep({ index, step, defaultOpen }: {
  index: number
  step: { title: string; latex: string }
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <span className="w-5 h-5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 text-[11px] flex items-center justify-center font-mono shrink-0">
          {index + 1}
        </span>
        <span className="text-[13px] text-zinc-700 dark:text-zinc-300">{step.title}</span>
        {open
          ? <ChevronDown size={14} className="ml-auto text-zinc-400 dark:text-zinc-600 shrink-0" />
          : <ChevronRight size={14} className="ml-auto text-zinc-400 dark:text-zinc-600 shrink-0" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed border-t border-zinc-200/80 dark:border-zinc-800/60 [&_.katex-display]:my-2 [&_.katex-display]:overflow-x-auto">
              <Latex>{step.latex}</Latex>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
