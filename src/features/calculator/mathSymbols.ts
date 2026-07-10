export type SymbolCategoryId = "common" | "integral" | "function" | "letter" | "vector";

export interface MathSymbolDefinition {
  label: string;
  latex: string;
  preview?: string;
}

export interface MathSymbolCategory {
  id: SymbolCategoryId;
  label: string;
  symbols: readonly MathSymbolDefinition[];
}

export const mathSymbolCategories: readonly MathSymbolCategory[] = [
  {
    id: "common",
    label: "常用",
    symbols: [
      { label: "加号", latex: "+" },
      { label: "减号", latex: "-" },
      { label: "乘号", latex: "\\times" },
      { label: "除号", latex: "\\div" },
      { label: "分数", latex: "\\frac{#0}{#1}", preview: "\\frac{x}{y}" },
      { label: "幂", latex: "^{#0}", preview: "x^n" },
      { label: "根号", latex: "\\sqrt{#0}", preview: "\\sqrt{x}" },
      { label: "圆括号", latex: "\\left(#0\\right)", preview: "(x)" },
      { label: "绝对值", latex: "\\left|#0\\right|", preview: "|x|" },
      { label: "等号", latex: "=" },
      { label: "小于等于", latex: "\\le" },
      { label: "大于等于", latex: "\\ge" },
      { label: "不等于", latex: "\\ne" },
      { label: "正负号", latex: "\\pm" },
    ],
  },
  {
    id: "integral",
    label: "积分",
    symbols: [
      { label: "积分", latex: "\\int" },
      { label: "二重积分", latex: "\\iint" },
      { label: "三重积分", latex: "\\iiint" },
      { label: "闭合积分", latex: "\\oint" },
      { label: "曲面积分", latex: "\\iint_{\\Sigma}", preview: "\\iint_{\\Sigma}" },
      { label: "带上下限积分", latex: "\\int_{#0}^{#1}", preview: "\\int_a^b" },
      { label: "dx", latex: "\\,dx", preview: "dx" },
      { label: "dy", latex: "\\,dy", preview: "dy" },
      { label: "dz", latex: "\\,dz", preview: "dz" },
      { label: "dt", latex: "\\,dt", preview: "dt" },
      { label: "积分区域 D", latex: "D" },
      { label: "积分区域 Omega", latex: "\\Omega" },
      { label: "曲线 C", latex: "C" },
      { label: "曲面 Sigma", latex: "\\Sigma" },
    ],
  },
  {
    id: "function",
    label: "函数",
    symbols: [
      { label: "正弦", latex: "\\sin\\left(#0\\right)", preview: "\\sin x" },
      { label: "余弦", latex: "\\cos\\left(#0\\right)", preview: "\\cos x" },
      { label: "正切", latex: "\\tan\\left(#0\\right)", preview: "\\tan x" },
      { label: "余切", latex: "\\cot\\left(#0\\right)", preview: "\\cot x" },
      { label: "反正弦", latex: "\\arcsin\\left(#0\\right)", preview: "\\arcsin x" },
      { label: "反余弦", latex: "\\arccos\\left(#0\\right)", preview: "\\arccos x" },
      { label: "反正切", latex: "\\arctan\\left(#0\\right)", preview: "\\arctan x" },
      { label: "自然对数", latex: "\\ln\\left(#0\\right)", preview: "\\ln x" },
      { label: "常用对数", latex: "\\log\\left(#0\\right)", preview: "\\log x" },
      { label: "指数函数", latex: "e^{#0}", preview: "e^x" },
      { label: "双曲正弦", latex: "\\sinh\\left(#0\\right)", preview: "\\sinh x" },
      { label: "双曲余弦", latex: "\\cosh\\left(#0\\right)", preview: "\\cosh x" },
    ],
  },
  {
    id: "letter",
    label: "字母",
    symbols: [
      { label: "变量 x", latex: "x" },
      { label: "变量 y", latex: "y" },
      { label: "变量 z", latex: "z" },
      { label: "参数 t", latex: "t" },
      { label: "参数 u", latex: "u" },
      { label: "参数 v", latex: "v" },
      { label: "圆周率", latex: "\\pi" },
      { label: "自然常数", latex: "e" },
      { label: "角度变量 theta", latex: "\\theta" },
      { label: "极径 rho", latex: "\\rho" },
      { label: "角度变量 phi", latex: "\\varphi" },
      { label: "常量 R", latex: "R" },
    ],
  },
  {
    id: "vector",
    label: "向量",
    symbols: [
      { label: "偏导符号", latex: "\\partial" },
      { label: "偏导数", latex: "\\frac{\\partial #0}{\\partial #1}", preview: "\\frac{\\partial f}{\\partial x}" },
      { label: "二阶偏导", latex: "\\frac{\\partial^2 #0}{\\partial #1^2}", preview: "\\frac{\\partial^2 f}{\\partial x^2}" },
      { label: "梯度", latex: "\\nabla" },
      { label: "散度", latex: "\\nabla\\cdot" },
      { label: "旋度", latex: "\\nabla\\times" },
      { label: "点乘", latex: "\\cdot" },
      { label: "叉乘", latex: "\\times" },
      { label: "向量箭头", latex: "\\vec{#0}", preview: "\\vec{F}" },
      { label: "向量模", latex: "\\left\\lVert#0\\right\\rVert", preview: "\\lVert F\\rVert" },
      { label: "单位法向量", latex: "\\vec{n}" },
      { label: "拉普拉斯算子", latex: "\\Delta" },
    ],
  },
] as const;
