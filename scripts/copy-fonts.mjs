// postinstall：把 mathlive 包自带的 KaTeX 字体拷到 public/fonts/mathlive。
// 字体是二进制，不进 git；clone 后 npm install 会自动执行本脚本恢复。
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'mathlive', 'fonts')
const dest = join(root, 'public', 'fonts', 'mathlive')

if (!existsSync(src)) {
  console.warn('[copy-fonts] 未找到 node_modules/mathlive/fonts，跳过（公式编辑器字体将回退 CDN）')
  process.exit(0)
}
mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true })
console.log('[copy-fonts] mathlive 字体已就位 → public/fonts/mathlive')
