const FUNCTION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\\arcsin/g, " asin"],
  [/\\arccos/g, " acos"],
  [/\\arctan/g, " atan"],
  [/\\sinh/g, " sinh"],
  [/\\cosh/g, " cosh"],
  [/\\sin/g, " sin"],
  [/\\cos/g, " cos"],
  [/\\tan/g, " tan"],
  [/\\cot/g, " cot"],
  [/\\ln/g, " log"],
  [/\\log/g, " log"],
  [/\\exp/g, " exp"],
];

function replaceSimpleFractions(value: string): string {
  let output = value;
  const fractionPattern = /\\frac\{([^{}]+)\}\{([^{}]+)\}/g;
  for (let pass = 0; pass < 12 && fractionPattern.test(output); pass += 1) {
    fractionPattern.lastIndex = 0;
    output = output.replace(fractionPattern, "(($1)/($2))");
  }
  return output;
}

function replaceRoots(value: string): string {
  let output = value;
  const rootPattern = /\\sqrt\{([^{}]+)\}/g;
  for (let pass = 0; pass < 8 && rootPattern.test(output); pass += 1) {
    rootPattern.lastIndex = 0;
    output = output.replace(rootPattern, "sqrt($1)");
  }
  return output.replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, "(($2)^(1/($1)))");
}

export function latexToExpression(latex: string): string {
  let output = latex
    .replace(/\\left|\\right/g, "")
    .replace(/\\operatorname\{([^{}]+)\}/g, "$1")
    .replace(/\\mathrm\{([^{}]+)\}/g, "$1")
    .replace(/\\,|\\!|\\;|\\quad|\\qquad/g, " ")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\pi/g, "pi")
    .replace(/π/g, "pi")
    .replace(/−/g, "-");
  for (let pass = 0; pass < 8; pass += 1) {
    const previous = output;
    output = replaceSimpleFractions(output);
    output = replaceRoots(output);
    if (output === previous) break;
  }
  for (const [pattern, replacement] of FUNCTION_REPLACEMENTS) output = output.replace(pattern, replacement);
  output = output
    .replace(/\|([^|]+)\|/g, "abs($1)")
    .replace(/\b(asin|acos|atan|sinh|cosh|sin|cos|tan|cot|log|exp)\s+([A-Za-z])/g, "$1($2)")
    .replace(/([A-Za-z0-9)])\s+(?=(?:asin|acos|atan|sinh|cosh|sin|cos|tan|cot|log|exp)\()/g, "$1*")
    .replace(/([0-9)])pi\b/g, "$1*pi");
  return output
    .replace(/[{}]/g, (token) => (token === "{" ? "(" : ")"))
    .replace(/\s*([+\-*/])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
