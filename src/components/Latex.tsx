import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

/** 通用 LaTeX 渲染组件：自动识别 $...$ / $$...$$ 与纯文本混排 */
export function Latex({ children, block = false, className = '' }: {
  children: string
  block?: boolean
  className?: string
}) {
  const html = useMemo(() => renderMixed(children), [children])
  if (block) {
    return <div className={`latex-block ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
  }
  return <span className={`latex-inline ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}

function renderMixed(src: string): string {
  // 依次切分 $$...$$ 与 $...$，其余作为普通文本（保留换行）
  const parts: string[] = []
  let rest = src
  while (rest.length > 0) {
    const di = rest.indexOf('$$')
    const si = rest.indexOf('$')
    if (di === -1 && si === -1) {
      parts.push(escapeText(rest))
      break
    }
    if (di !== -1 && di === si) {
      // display math
      const end = rest.indexOf('$$', di + 2)
      if (end === -1) {
        parts.push(escapeText(rest))
        break
      }
      parts.push(escapeText(rest.slice(0, di)))
      parts.push(katex.renderToString(rest.slice(di + 2, end), { displayMode: true, throwOnError: false }))
      rest = rest.slice(end + 2)
    } else {
      // inline math
      const end = rest.indexOf('$', si + 1)
      if (end === -1) {
        parts.push(escapeText(rest))
        break
      }
      parts.push(escapeText(rest.slice(0, si)))
      parts.push(katex.renderToString(rest.slice(si + 1, end), { displayMode: false, throwOnError: false }))
      rest = rest.slice(end + 1)
    }
  }
  return parts.join('')
}

function escapeText(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
}

/** 纯公式渲染（编辑器实时预览用） */
export function LatexPreview({ source }: { source: string }) {
  const { html, error } = useMemo(() => {
    if (!source.trim()) return { html: '', error: '' }
    try {
      return {
        html: katex.renderToString(stripDelims(source), { displayMode: true, throwOnError: true }),
        error: '',
      }
    } catch (e) {
      return { html: '', error: e instanceof Error ? e.message.replace(/^KaTeX parse error: /, '') : '解析错误' }
    }
  }, [source])

  if (!source.trim()) {
    return <div className="text-zinc-500 text-sm italic px-1">输入 LaTeX 公式，此处实时预览…</div>
  }
  if (error) {
    return (
      <div className="text-red-400/90 text-xs font-mono px-1 leading-relaxed">
        <span className="text-red-300 font-semibold">语法错误：</span>{error}
      </div>
    )
  }
  return <div className="latex-block px-1" dangerouslySetInnerHTML={{ __html: html }} />
}

function stripDelims(s: string): string {
  let t = s.trim()
  if (t.startsWith('$$') && t.endsWith('$$') && t.length > 4) return t.slice(2, -2)
  if (t.startsWith('$') && t.endsWith('$') && t.length > 2) return t.slice(1, -1)
  return t
}
