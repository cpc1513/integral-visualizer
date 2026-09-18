// 题库打包：public/data/questions.json → public/data/questions.part{N}.json.gz.b64
// 题库 1.6MB。为便于经 API 分次提交到仓库（单次提交体量受限），按压缩后体量
// 均衡切成若干片（每片约 50-60KB 文本）；运行时由前端并行拉取解压合并。
// 用法：node scripts/pack-questions.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 单片 gzip+base64 后的目标上限（字节）
const TARGET = 56 * 1024
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'public', 'data', 'questions.json')

const bank = JSON.parse(readFileSync(src, 'utf8'))
const { meta, questions } = bank

// 清理历史产物（单文件与旧分片）
rmSync(join(root, 'public', 'data', 'questions.json.gz.b64'), { force: true })
for (let i = 0; i < 20; i++) {
  rmSync(join(root, 'public', 'data', `questions.part${i}.json.gz.b64`), { force: true })
}

// 贪心切片：逐题估算 gzip+b64 后的累积体量，超过阈值开新片
// （用 JSON 长度的 0.22 倍近似 gzip+b64 后体量，实测题库压缩率约 16%）
const RATIO = 0.22
const parts = []
let cur = []
let curSize = 0
for (const q of questions) {
  const s = JSON.stringify(q).length * RATIO
  if (cur.length > 0 && curSize + s > TARGET) {
    parts.push(cur)
    cur = []
    curSize = 0
  }
  cur.push(q)
  curSize += s
}
if (cur.length > 0) parts.push(cur)

let total = 0
parts.forEach((slice, i) => {
  const payload = JSON.stringify({ meta, questions: slice })
  const b64 = gzipSync(payload, { level: 9 }).toString('base64')
  const dest = join(root, 'public', 'data', `questions.part${i}.json.gz.b64`)
  writeFileSync(dest, b64)
  total += b64.length
  console.log(`[pack-questions] part${i}: ${slice.length} 题 → ${b64.length} 字节`)
})
console.log(`[pack-questions] 共 ${questions.length} 题，${parts.length} 片合计 ${total} 字节`)
console.log(`[pack-questions] PART_COUNT=${parts.length}（需同步到 App.tsx 的 DATA_PARTS）`)
