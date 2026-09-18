import { useEffect, useMemo, useRef, useState } from 'react'
import { MathfieldElement } from 'mathlive'
import { Delete, Eraser, Keyboard, Copy, Check } from 'lucide-react'

// 字体与按键音：字体走本地 public 目录，按键音禁用（避免 404）
// 用 BASE_URL 拼路径，兼容 GitHub Pages 子路径部署（/integral-visualizer/）
MathfieldElement.fontsDirectory = `${import.meta.env.BASE_URL}fonts/mathlive`
MathfieldElement.soundsDirectory = null

// 右键菜单/提示中文化。注意必须用小写 'zh-cn'（内置词条表的键），
// 大写 'zh-CN' 匹配不到会回落英文。内置 zh-cn 表缺 Insert 子菜单词条，在此补齐。
MathfieldElement.locale = 'zh-cn'
MathfieldElement.strings = {
  'zh-cn': {
    'tooltip.menu': '菜单',
    'tooltip.cut to clipboard': '剪切到剪贴板',
    'tooltip.paste from clipboard': '从剪贴板粘贴',
    'menu.insert': '插入',
    'menu.insert.abs': '绝对值',
    'menu.insert.nth-root': 'n 次方根',
    'menu.insert.log-base': '对数（底 a）',
    'menu.insert.heading-calculus': '微积分',
    'menu.insert.derivative': '导数',
    'menu.insert.nth-derivative': 'n 阶导数',
    'menu.insert.integral': '积分',
    'menu.insert.sum': '求和',
    'menu.insert.product': '乘积',
    'menu.insert.heading-complex-numbers': '复数',
    'menu.insert.modulus': '模',
    'menu.insert.argument': '辐角',
    'menu.insert.real-part': '实部',
    'menu.insert.imaginary-part': '虚部',
    'menu.insert.conjugate': '共轭',
    'menu.copy-as-typst': '复制为 Typst',
  },
}

interface SymbolButton {
  label: string // 按钮显示文本
  insert: string // 插入的 LaTeX（空 {} 会成为可跳转的占位框，#? 为落点）
}

interface SymbolGroup {
  name: string
  buttons: SymbolButton[]
}

const GROUPS: SymbolGroup[] = [
  {
    name: '积分号',
    buttons: [
      { label: '∫', insert: '\\int_{#?}^{#0}' },
      { label: '∬', insert: '\\iint_{#?}' },
      { label: '∭', insert: '\\iiint_{#?}' },
      { label: '∮', insert: '\\oint_{#?}' },
      { label: '∯', insert: '\\oiint_{#?}' },
      { label: '∫ₐᵇ', insert: '\\int_{a}^{b}#?' },
    ],
  },
  {
    name: '微分',
    buttons: [
      { label: 'dx', insert: '\\,\\mathrm{d}x' },
      { label: 'dy', insert: '\\,\\mathrm{d}y' },
      { label: 'dz', insert: '\\,\\mathrm{d}z' },
      { label: 'dσ', insert: '\\,\\mathrm{d}\\sigma' },
      { label: 'dV', insert: '\\,\\mathrm{d}V' },
      { label: 'ds', insert: '\\,\\mathrm{d}s' },
      { label: 'dS', insert: '\\,\\mathrm{d}S' },
      { label: 'dydz', insert: '\\,\\mathrm{d}y\\mathrm{d}z' },
      { label: '∂', insert: '\\partial' },
    ],
  },
  {
    name: '结构',
    buttons: [
      { label: 'a/b', insert: '\\frac{#?}{#0}' },
      { label: 'x²', insert: '^{#?}' },
      { label: 'xᵢ', insert: '_{#?}' },
      { label: '√', insert: '\\sqrt{#?}' },
      { label: 'ⁿ√', insert: '\\sqrt[#?]{#0}' },
      { label: 'Σ', insert: '\\sum_{i=1}^{n}#?' },
      { label: 'lim', insert: '\\lim_{x\\to 0}#?' },
      { label: '( )', insert: '\\left(#?\\right)' },
    ],
  },
  {
    name: '希腊字母',
    buttons: [
      { label: 'π', insert: '\\pi' },
      { label: 'θ', insert: '\\theta' },
      { label: 'ρ', insert: '\\rho' },
      { label: 'φ', insert: '\\varphi' },
      { label: 'σ', insert: '\\sigma' },
      { label: 'Ω', insert: '\\Omega' },
      { label: 'Σ', insert: '\\Sigma' },
      { label: 'Γ', insert: '\\Gamma' },
      { label: 'α', insert: '\\alpha' },
      { label: 'λ', insert: '\\lambda' },
    ],
  },
  {
    name: '函数',
    buttons: [
      { label: 'sin', insert: '\\sin ' },
      { label: 'cos', insert: '\\cos ' },
      { label: 'tan', insert: '\\tan ' },
      { label: 'ln', insert: '\\ln ' },
      { label: 'log', insert: '\\log_{#?}' },
      { label: 'eˣ', insert: 'e^{#?}' },
      { label: 'arctan', insert: '\\arctan ' },
    ],
  },
  {
    name: '关系与运算',
    buttons: [
      { label: '≤', insert: '\\le ' },
      { label: '≥', insert: '\\ge ' },
      { label: '≠', insert: '\\ne ' },
      { label: '±', insert: '\\pm ' },
      { label: '×', insert: '\\times ' },
      { label: '·', insert: '\\cdot ' },
      { label: '→', insert: '\\to ' },
      { label: '∞', insert: '\\infty' },
      { label: '∈', insert: '\\in ' },
      { label: '⇒', insert: '\\Rightarrow ' },
      { label: '⇔', insert: '\\Leftrightarrow ' },
      { label: '≈', insert: '\\approx ' },
    ],
  },
]

const INITIAL =
  '\\iint_{D} f(x,y)\\,\\mathrm{d}\\sigma = \\int_{a}^{b}\\mathrm{d}x\\int_{\\varphi_1(x)}^{\\varphi_2(x)} f(x,y)\\,\\mathrm{d}y'

export function FormulaEditor() {
  const hostRef = useRef<HTMLDivElement>(null)
  const mfRef = useRef<MathfieldElement | null>(null)
  const [latex, setLatex] = useState(INITIAL)
  const [copied, setCopied] = useState(false)
  const isTouch = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
    []
  )

  useEffect(() => {
    const mf = new MathfieldElement()
    mf.className = 'formula-input'
    mf.value = INITIAL
    // 触屏设备：聚焦即弹出数学虚拟键盘；桌面端：手动切换
    mf.mathVirtualKeyboardPolicy = isTouch ? 'auto' : 'manual'
    mf.addEventListener('input', () => setLatex(mf.value))
    hostRef.current?.appendChild(mf)
    mfRef.current = mf
    return () => {
      mfRef.current = null
      mf.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const insert = (code: string) => {
    const mf = mfRef.current
    if (!mf) return
    mf.insert(code, { focus: true, selectionMode: 'placeholder' })
    setLatex(mf.value)
  }

  const backspace = () => {
    const mf = mfRef.current
    if (!mf) return
    mf.executeCommand('deleteBackward')
    mf.focus()
    setLatex(mf.value)
  }

  const clearAll = () => {
    const mf = mfRef.current
    if (!mf) return
    mf.value = ''
    mf.focus()
    setLatex('')
  }

  const copyLatex = async () => {
    try {
      await navigator.clipboard.writeText(latex)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 剪贴板不可用时静默 */
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 所见即所得输入区：直接键入（如 \sqrt 自动转换），或点符号/虚拟键盘 */}
      <div className="px-4 pt-3">
        <div ref={hostRef} />
        <div className="flex items-center justify-between mt-1.5 mb-0.5">
          <span className="text-[11px] text-zinc-500">
            直接键入公式，<span className="text-cyan-700 dark:text-cyan-400/80 font-mono">\sqrt</span> 等代码会自动转换
          </span>
          <div className="flex items-center gap-1">
            {!isTouch && (
              <button
                onClick={() => mfRef.current?.executeCommand('toggleVirtualKeyboard')}
                title="屏幕键盘"
                className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Keyboard size={15} />
              </button>
            )}
            <button
              onClick={copyLatex}
              title="复制 LaTeX 源码"
              className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {copied ? <Check size={15} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* 符号面板 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 min-h-0">
        {GROUPS.map((g) => (
          <div key={g.name}>
            <div className="text-[11px] font-medium text-zinc-500 tracking-widest mb-1.5">{g.name}</div>
            <div className="grid grid-cols-6 gap-1.5">
              {g.buttons.map((b, i) => (
                <button
                  key={`${g.name}-${i}`}
                  onClick={() => insert(b.insert)}
                  title={b.insert}
                  className="h-9 rounded-md bg-zinc-100 dark:bg-zinc-800/70 hover:bg-cyan-500/20 hover:text-cyan-700 dark:hover:text-cyan-300 border border-zinc-200 dark:border-zinc-700/50 hover:border-cyan-500/40 text-zinc-800 dark:text-zinc-200 text-sm font-mono transition-colors flex items-center justify-center"
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* 编辑操作 */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={backspace}
            className="flex-1 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800/70 hover:bg-zinc-200 dark:hover:bg-zinc-700/70 border border-zinc-200 dark:border-zinc-700/50 text-zinc-700 dark:text-zinc-300 text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Delete size={14} /> 退格
          </button>
          <button
            onClick={clearAll}
            className="flex-1 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800/70 hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-300 border border-zinc-200 dark:border-zinc-700/50 text-zinc-700 dark:text-zinc-300 text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Eraser size={14} /> 清空
          </button>
        </div>

        {/* LaTeX 源码（只读，供复制核对） */}
        {latex && (
          <div className="rounded-lg bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/60 px-3 py-2">
            <div className="text-[10px] text-zinc-400 dark:text-zinc-600 mb-0.5 tracking-wider">LATEX 源码</div>
            <div className="font-mono text-[11px] leading-relaxed text-zinc-500 break-all select-all">{latex}</div>
          </div>
        )}
      </div>
    </div>
  )
}
