import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const source = process.argv[2] ?? path.resolve("..", "1766137194_第八章", "可视化积分区域题目汇总.md");
const output = process.argv[3] ?? path.resolve("src", "data", "computerExams.generated.json");
const markdown = await readFile(source, "utf8");

function richBlocks(value) {
  return value.trim().split(/\n\s*\n/).filter(Boolean).map((paragraph) => {
    const segments = [];
    const pattern = /(\$\$[\s\S]*?\$\$|\$[^$]+\$|\\\[[\s\S]*?\\\])/g;
    let cursor = 0;
    for (const match of paragraph.matchAll(pattern)) {
      if (match.index > cursor) segments.push({ type: "text", value: paragraph.slice(cursor, match.index).replace(/\n/g, " ") });
      const raw = match[0];
      const display = raw.startsWith("$$") || raw.startsWith("\\[");
      segments.push({
        type: "math",
        value: raw.replace(/^\$\$?|\$\$?$/g, "").replace(/^\\\[|\\\]$/g, "").trim(),
        ...(display ? { display: true } : {}),
      });
      cursor = match.index + raw.length;
    }
    if (cursor < paragraph.length) segments.push({ type: "text", value: paragraph.slice(cursor).replace(/\n/g, " ") });
    return segments;
  });
}

function field(block, name, nextNames) {
  const next = nextNames.map((item) => `\\n\\*\\*${item}：\\*\\*`).join("|");
  const match = block.match(new RegExp(`\\*\\*${name}：\\*\\*\\s*([\\s\\S]*?)(?=${next}|$)`));
  return match?.[1]?.trim() ?? "";
}

function integralType(label, region) {
  if (label.includes("三重积分")) return "triple";
  if (label.includes("曲线积分") || label.includes("斯托克斯")) return "line";
  if (label.includes("曲面积分")) return "surface";
  if (label.includes("二重积分")) return "double";
  if (/\\Gamma|\\widehat|\bL\s*=/.test(region)) return "line";
  if (/\\Sigma|\bS\s*=/.test(region)) return "surface";
  return null;
}

function unwrapRegion(raw) {
  let value = raw.trim().replace(/^\$|\$$/g, "").trim();
  const marker = value.match(/\\mid|\|/);
  if (!marker?.index) return null;
  value = value.slice(marker.index + marker[0].length);
  return value.replace(/\\?\}\s*$/, "").replace(/\\left|\\right/g, "").trim();
}

function normalizeConstraints(raw) {
  if (!raw || /\\begin|\\cup|\\text|\bor\b/i.test(raw)) return null;
  const pieces = raw.split(/(?<!\\),\s*(?![^()]*\))/).map((item) => item.trim()).filter(Boolean);
  const constraints = [];
  for (const piece of pieces) {
    const cleaned = piece.replace(/\\\s+/g, " ").replace(/[；。]$/, "").replace(/≤/g, "\\le").replace(/≥/g, "\\ge").trim();
    const chained = cleaned.match(/^(.+?)\\leq?\s*([xyz])\s*\\leq?\s*(.+)$/);
    if (chained) {
      constraints.push(`${chained[2]}\\ge ${chained[1]}`, `${chained[2]}\\le ${chained[3]}`);
      continue;
    }
    if (!/(\\leq?|\\geq?|<=|>=|=|<|>)/.test(cleaned)) return null;
    constraints.push(cleaned);
  }
  return constraints;
}

function freeSymbols(constraints) {
  const compact = constraints.join(" ")
    .replace(/\\(?:leq?|geq?|sqrt|frac|pi|left|right|cdot|times|sin|cos|tan|ln|exp)\b/g, " ")
    .replace(/\\[;,!]/g, " ");
  return [...new Set(compact.match(/[A-Za-z]+/g) ?? [])].filter((token) => !["x", "y", "z", "e"].includes(token));
}

function scanRanges(constraints, variables) {
  const numbers = constraints.join(" ").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [1];
  const extent = Math.min(50, Math.max(2, ...numbers.map((value) => Math.abs(value))) + 1);
  return variables.map((variable) => ({ variable, lower: String(-extent), upper: String(extent) }));
}

function makeSpec(type, constraints, id) {
  const variables = type === "double" ? ["x", "y"] : ["x", "y", "z"];
  const equalityCount = constraints.filter((item) => /(?<![<>])=(?!=)/.test(item)).length;
  if (type === "line" && equalityCount < 2) return null;
  if (type === "surface" && equalityCount < 1) return null;
  const region = { constraints, ranges: scanRanges(constraints, variables) };
  if (type === "double" || type === "triple") {
    const bounds = variables.map((variable, index) => ({ variable, lower: "-1", upper: "1", label: index === 0 ? "内层" : "外层" }));
    return {
      type, exampleName: `机考题 ${id}`, integrand: "1",
      latex: type === "double" ? "\\iint_D 1\\,dA" : "\\iiint_\\Omega 1\\,dV",
      bounds, regionMode: "constraints", constraintRegion: region, preferredComputeMode: "numeric",
    };
  }
  if (type === "line") return {
    type, exampleName: `机考题 ${id}`, mode: "scalar", integrand: "1", latex: "\\int_C 1\\,ds",
    parameter: { variable: "t", lower: "0", upper: "2\\pi", label: "参数范围" },
    path: { x: "\\cos t", y: "\\sin t", z: "0" }, vectorField: { p: "0", q: "0", r: "0" },
    regionMode: "constraints", constraintRegion: region,
  };
  return {
    type, exampleName: `机考题 ${id}`, mode: "scalar", integrand: "1", latex: "\\iint_\\Sigma 1\\,dS",
    parameters: [
      { variable: "u", lower: "-1", upper: "1", label: "参数一" },
      { variable: "v", lower: "-1", upper: "1", label: "参数二" },
    ],
    surface: { x: "u", y: "v", z: "0" }, vectorField: { p: "0", q: "0", r: "0" }, orientation: 1,
    regionMode: "constraints", constraintRegion: region,
  };
}

const topicMatches = [...markdown.matchAll(/^## (.+)$/gm)];
const questions = [];
const exclusions = {};
const topicCounts = {};
for (let topicIndex = 0; topicIndex < topicMatches.length; topicIndex += 1) {
  const topic = topicMatches[topicIndex][1].trim();
  const start = topicMatches[topicIndex].index + topicMatches[topicIndex][0].length;
  const end = topicMatches[topicIndex + 1]?.index ?? markdown.length;
  const section = markdown.slice(start, end);
  const questionMatches = [...section.matchAll(/^### 题号 (.+)$/gm)];
  for (let index = 0; index < questionMatches.length; index += 1) {
    const heading = questionMatches[index][1].trim();
    const blockStart = questionMatches[index].index + questionMatches[index][0].length;
    const blockEnd = questionMatches[index + 1]?.index ?? section.length;
    const block = section.slice(blockStart, blockEnd);
    const headingMatch = heading.match(/^(\d+)（第 (\d+) 页 · (.+)）$/);
    const rawRegion = field(block, "区域", ["答案", "解析"]);
    const type = integralType(headingMatch?.[3] ?? topic, rawRegion);
    const body = unwrapRegion(rawRegion);
    const constraints = body ? normalizeConstraints(body) : null;
    let reason = "";
    if (!headingMatch) reason = "题号标题无法解析";
    else if (!type) reason = "积分类型无法识别";
    else if (!body) reason = "区域集合格式无法解析";
    else if (!constraints?.length) reason = "约束无法标准化";
    else if (constraints.some((item) => /\$|[，。；（）]|\\sqrt(?:\(|\[)|\\frac(?:\(|\[)/.test(item))) reason = "区域表达需要人工解释";
    else if (constraints.some((item) => /\\(?:sqrt|ln|log)/.test(item))) reason = "扫描范围内含非全域函数";
    else if (constraints.some((item) =>
      /^\\(?:leq?|geq?)/.test(item)
      || item.includes("\\frac")
      || (item.match(/\\(?:leq?|geq?)|<=|>=|(?<![<>])=/g) ?? []).length > 1
    )) reason = "约束关系不完整";
    else if (freeSymbols(constraints).length) reason = `含自由参数:${freeSymbols(constraints).join(",")}`;
    const id = `computer-${topic.split(" ")[0]}-${headingMatch?.[1] ?? index + 1}`;
    if (!reason && id === "computer-9.2.2-35") reason = "扫描范围无法安全推导";
    const spec = !reason ? makeSpec(type, constraints, id) : null;
    if (!reason && !spec) reason = "区域不能唯一确定该积分对象";
    if (reason) {
      exclusions[reason] = (exclusions[reason] ?? 0) + 1;
      continue;
    }
    questions.push({
      id, topic, topicCode: topic.split(" ")[0], ordinal: Number(headingMatch[1]), page: Number(headingMatch[2]),
      integralType: type, prompt: richBlocks(field(block, "题干", ["区域", "答案", "解析"])),
      region: [[{ type: "math", value: rawRegion.replace(/^\$|\$$/g, "").trim(), display: true }]], answer: field(block, "答案", ["解析"]),
      solution: richBlocks(field(block, "解析", [])), visualizationSpec: spec,
    });
    topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;
  }
}

const dataset = {
  meta: {
    title: "机考题库", sourceFile: path.basename(source), sourceCount: (markdown.match(/^### 题号 /gm) ?? []).length,
    importedCount: questions.length, excludedCount: Object.values(exclusions).reduce((sum, count) => sum + count, 0),
    topicCounts, exclusions,
  },
  questions,
};
await writeFile(output, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
console.log(JSON.stringify(dataset.meta, null, 2));
