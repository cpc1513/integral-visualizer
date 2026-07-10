#!/usr/bin/env python3
"""Extract the integral question collection from DOCX into browser-safe JSON.

The source stores equations as Office Math (OMML).  Microsoft Office ships an
OMML -> MathML stylesheet; this script applies that stylesheet and converts the
small MathML vocabulary used by the collection into KaTeX-compatible LaTeX.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from lxml import etree


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
OMML_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"
MATHML_NS = "http://www.w3.org/1998/Math/MathML"
NS = {"w": W_NS, "m": OMML_NS, "mml": MATHML_NS}

DEFAULT_XSL = Path(r"C:\Program Files\Microsoft Office\root\Office16\OMML2MML.XSL")

GREEK = {
    "α": r"\alpha",
    "β": r"\beta",
    "γ": r"\gamma",
    "δ": r"\delta",
    "ε": r"\varepsilon",
    "θ": r"\theta",
    "λ": r"\lambda",
    "μ": r"\mu",
    "ρ": r"\rho",
    "σ": r"\sigma",
    "φ": r"\varphi",
    "ω": r"\omega",
    "Γ": r"\Gamma",
    "Δ": r"\Delta",
    "Σ": r"\Sigma",
    "Ω": r"\Omega",
}

OPERATORS = {
    "−": "-",
    "±": r"\pm ",
    "∓": r"\mp ",
    "×": r"\times ",
    "⋅": r"\cdot ",
    "·": r"\cdot ",
    "÷": r"\div ",
    "≤": r"\leq ",
    "≥": r"\geq ",
    "≠": r"\neq ",
    "≈": r"\approx ",
    "≡": r"\equiv ",
    "→": r"\to ",
    "∞": r"\infty ",
    "∂": r"\partial ",
    "∇": r"\nabla ",
    "∫": r"\int ",
    "∬": r"\iint ",
    "∭": r"\iiint ",
    "∮": r"\oint ",
    "∑": r"\sum ",
    "∏": r"\prod ",
    "∈": r"\in ",
    "∉": r"\notin ",
    "⊂": r"\subset ",
    "∪": r"\cup ",
    "∩": r"\cap ",
    " ": r"\,",
    " ": r"\,",
}

NORMAL_WORDS = {
    "sin": r"\sin ",
    "cos": r"\cos ",
    "tan": r"\tan ",
    "cot": r"\cot ",
    "sec": r"\sec ",
    "csc": r"\csc ",
    "ln": r"\ln ",
    "log": r"\log ",
    "lim": r"\lim ",
    "max": r"\max ",
    "min": r"\min ",
}


def local_name(node: etree._Element) -> str:
    return etree.QName(node).localname


def text_operator(value: str) -> str:
    if value in GREEK:
        return GREEK[value]
    if value in OPERATORS:
        return OPERATORS[value]
    return value.replace("&", r"\&").replace("#", r"\#")


def mathml_to_latex(node: etree._Element) -> str:
    """Convert the MathML emitted by Office's stylesheet into LaTeX."""

    tag = local_name(node)
    children = [child for child in node if isinstance(child.tag, str)]

    if tag in {"math", "mrow", "mstyle", "semantics", "mtd"}:
        value = "".join(mathml_to_latex(child) for child in children)
    elif tag in {"mi", "mn", "mo", "mtext"}:
        raw = "".join(node.itertext())
        if tag == "mi" and raw in GREEK:
            value = GREEK[raw]
        elif tag == "mi" and node.get("mathvariant") == "normal":
            value = "".join(rf"\mathrm{{{text_operator(ch)}}}" for ch in raw)
        else:
            value = "".join(text_operator(ch) for ch in raw)
    elif tag == "mfrac" and len(children) >= 2:
        value = rf"\frac{{{mathml_to_latex(children[0])}}}{{{mathml_to_latex(children[1])}}}"
    elif tag == "msqrt":
        value = rf"\sqrt{{{''.join(mathml_to_latex(child) for child in children)}}}"
    elif tag == "mroot" and len(children) >= 2:
        value = rf"\sqrt[{mathml_to_latex(children[1])}]{{{mathml_to_latex(children[0])}}}"
    elif tag == "msup" and len(children) >= 2:
        value = rf"{{{mathml_to_latex(children[0])}}}^{{{mathml_to_latex(children[1])}}}"
    elif tag == "msub" and len(children) >= 2:
        value = rf"{{{mathml_to_latex(children[0])}}}_{{{mathml_to_latex(children[1])}}}"
    elif tag == "msubsup" and len(children) >= 3:
        value = (
            rf"{{{mathml_to_latex(children[0])}}}_{{{mathml_to_latex(children[1])}}}"
            rf"^{{{mathml_to_latex(children[2])}}}"
        )
    elif tag == "mover" and len(children) >= 2:
        base = mathml_to_latex(children[0])
        accent = "".join(children[1].itertext())
        command = {"¯": "overline", "→": "vec", "^": "hat", "˙": "dot"}.get(accent)
        value = rf"\{command}{{{base}}}" if command else rf"\overset{{{text_operator(accent)}}}{{{base}}}"
    elif tag == "munder" and len(children) >= 2:
        value = rf"\underset{{{mathml_to_latex(children[1])}}}{{{mathml_to_latex(children[0])}}}"
    elif tag == "munderover" and len(children) >= 3:
        value = (
            rf"\underset{{{mathml_to_latex(children[1])}}}"
            rf"{{\overset{{{mathml_to_latex(children[2])}}}{{{mathml_to_latex(children[0])}}}}}"
        )
    elif tag == "mtable":
        rows = [mathml_to_latex(row) for row in children if local_name(row) == "mtr"]
        value = r"\begin{matrix}" + r" \\ ".join(rows) + r"\end{matrix}"
    elif tag == "mtr":
        cells = [mathml_to_latex(cell) for cell in children if local_name(cell) == "mtd"]
        value = " & ".join(cells)
    elif tag == "mfenced":
        opening = node.get("open", "(")
        closing = node.get("close", ")")
        body = "".join(mathml_to_latex(child) for child in children)
        value = rf"\left{opening}{body}\right{closing}"
    elif tag in {"annotation", "annotation-xml", "none", "mprescripts"}:
        value = ""
    else:
        value = "".join(mathml_to_latex(child) for child in children)

    return value


def normalize_latex(value: str) -> str:
    value = value.replace("\u200b", "").replace("\ufeff", "")
    for symbol, command in {**GREEK, **OPERATORS}.items():
        value = value.replace(symbol, command)
    for word, command in NORMAL_WORDS.items():
        expanded = "".join(rf"\mathrm{{{letter}}}" for letter in word)
        value = value.replace(expanded, command)
    value = re.sub(r"\\mathrm\{([A-Za-z])\}", r"\\mathrm{\1}", value)
    value = re.sub(r"[ \t]+", " ", value)
    value = value.replace(r"\int  ", r"\int ")
    return value.strip()


class FormulaConverter:
    def __init__(self, stylesheet: Path) -> None:
        if not stylesheet.exists():
            raise FileNotFoundError(f"OMML stylesheet not found: {stylesheet}")
        self.transform = etree.XSLT(etree.parse(str(stylesheet)))
        self.count = 0

    def convert(self, node: etree._Element) -> str:
        result = self.transform(node)
        root = result.getroot()
        self.count += 1
        return normalize_latex(mathml_to_latex(root))


def append_segment(segments: list[dict[str, Any]], segment: dict[str, Any]) -> None:
    if not segment["value"]:
        return
    if (
        segments
        and segment["type"] == "text"
        and segments[-1]["type"] == "text"
        and not segments[-1].get("display", False)
    ):
        segments[-1]["value"] += segment["value"]
    else:
        segments.append(segment)


def paragraph_segments(paragraph: etree._Element, converter: FormulaConverter) -> list[dict[str, Any]]:
    segments: list[dict[str, Any]] = []

    def walk(node: etree._Element, display_math: bool = False) -> None:
        tag = local_name(node)
        namespace = etree.QName(node).namespace
        if namespace == OMML_NS and tag == "oMathPara":
            for formula in node.xpath("./m:oMath", namespaces=NS):
                append_segment(
                    segments,
                    {"type": "math", "value": converter.convert(formula), "display": True},
                )
            return
        if namespace == OMML_NS and tag == "oMath":
            append_segment(
                segments,
                {"type": "math", "value": converter.convert(node), "display": display_math},
            )
            return
        if namespace == W_NS and tag == "t":
            append_segment(segments, {"type": "text", "value": node.text or ""})
            return
        if namespace == W_NS and tag == "tab":
            append_segment(segments, {"type": "text", "value": "\t"})
            return
        if namespace == W_NS and tag in {"br", "cr"}:
            append_segment(segments, {"type": "text", "value": "\n"})
            return
        if namespace == W_NS and tag in {"pPr", "rPr", "sectPr"}:
            return
        for child in node:
            if isinstance(child.tag, str):
                walk(child, display_math)

    for child in paragraph:
        if isinstance(child.tag, str):
            walk(child)
    return segments


def plain_text(segments: list[dict[str, Any]]) -> str:
    parts = [segment["value"] if segment["type"] == "text" else " [公式] " for segment in segments]
    return re.sub(r"\s+", " ", "".join(parts)).strip()


def strip_prefix(segments: list[dict[str, Any]], prefix: str) -> list[dict[str, Any]]:
    copied = [dict(segment) for segment in segments]
    remaining = prefix
    for segment in copied:
        if segment["type"] != "text" or not remaining:
            continue
        text = segment["value"]
        if text.startswith(remaining):
            segment["value"] = text[len(remaining) :].lstrip()
            remaining = ""
        elif remaining.startswith(text):
            remaining = remaining[len(text) :]
            segment["value"] = ""
        else:
            break
    return [segment for segment in copied if segment["value"]]


def classify_integral(knowledge: str, prompt_text: str) -> str:
    detail = knowledge.split("_")[-1] if knowledge else ""
    haystack = detail + " " + prompt_text
    if "总结" in haystack or "汇总" in haystack:
        return "summary"
    if "曲线积分" in haystack or "格林公式" in haystack:
        return "line"
    if "曲面积分" in haystack or "高斯公式" in haystack or "斯托克斯" in haystack:
        return "surface"
    if "三重积分" in haystack:
        return "triple"
    if "二重积分" in haystack or "累次积分" in haystack or "积分次序" in haystack:
        return "double"
    if any(term in haystack for term in ("定积分", "不定积分", "反常积分", "积分")):
        return "ordinary"
    return "other"


@dataclass
class QuestionDraft:
    year: str
    ordinal: int
    labels: list[str] = field(default_factory=list)
    knowledge: str = ""
    prompt: list[list[dict[str, Any]]] = field(default_factory=list)
    solution: list[list[dict[str, Any]]] = field(default_factory=list)
    mode: str = "metadata"


def build_question(draft: QuestionDraft) -> dict[str, Any]:
    prompt_plain = " ".join(plain_text(block) for block in draft.prompt)
    solution_plain = " ".join(plain_text(block) for block in draft.solution)
    all_plain = " ".join([*draft.labels, draft.knowledge, prompt_plain, solution_plain])
    warnings = sorted(
        {
            marker
            for marker in ("原题暂缺", "题目暂缺", "需重新核对", "需进一步验证", "需根据积分区域具体分析")
            if marker in all_plain
        }
    )
    quality: list[str] = []
    if not prompt_plain:
        quality.append("missing-prompt")
    if warnings:
        quality.append("source-warning")

    label = draft.labels[0] if draft.labels else f"第{draft.ordinal}题"
    score_match = re.search(r"[（(](\d+)分[）)]", " ".join(draft.labels))
    integral_type = classify_integral(draft.knowledge, prompt_plain)
    return {
        "id": f"{draft.year}-q{draft.ordinal:02d}",
        "academicYear": draft.year,
        "ordinal": draft.ordinal,
        "sourceLabel": label,
        "score": int(score_match.group(1)) if score_match else None,
        "knowledge": draft.knowledge,
        "integralType": integral_type,
        "prompt": draft.prompt,
        "solution": draft.solution,
        "warnings": warnings,
        "quality": quality,
    }


def extract_questions(document_xml: bytes, converter: FormulaConverter) -> tuple[list[dict[str, Any]], dict[str, int]]:
    root = etree.fromstring(document_xml)
    paragraphs = root.xpath(".//w:body/w:p", namespaces=NS)
    questions: list[dict[str, Any]] = []
    counts: dict[str, int] = {}
    current_year = ""
    draft: QuestionDraft | None = None

    def finish() -> None:
        nonlocal draft
        if draft is not None:
            questions.append(build_question(draft))
            counts[draft.year] = counts.get(draft.year, 0) + 1
        draft = None

    for paragraph in paragraphs:
        segments = paragraph_segments(paragraph, converter)
        text = plain_text(segments)
        if not text:
            continue
        style_values = paragraph.xpath("./w:pPr/w:pStyle/@w:val", namespaces=NS)
        paragraph_style = style_values[0] if style_values else ""

        year_match = re.fullmatch(r"(20\d{2}-20\d{2})学年\s+积分类真题", text)
        if year_match:
            finish()
            current_year = year_match.group(1)
            continue

        question_match = re.fullmatch(r"第(\d+)题", text)
        if question_match and current_year and paragraph_style == "FirstParagraph":
            finish()
            draft = QuestionDraft(current_year, int(question_match.group(1)))
            continue

        if draft is None:
            continue

        if text.startswith("知识点:"):
            draft.knowledge = text.split(":", 1)[1].strip()
            continue
        if text.startswith("题目:"):
            draft.mode = "prompt"
            stripped = strip_prefix(segments, "题目:")
            if stripped:
                draft.prompt.append(stripped)
            continue
        if text.startswith("解答:"):
            draft.mode = "solution"
            stripped = strip_prefix(segments, "解答:")
            if stripped:
                draft.solution.append(stripped)
            continue
        if text == "总结" and draft.mode == "metadata":
            draft.mode = "prompt"

        if draft.mode == "prompt":
            draft.prompt.append(segments)
        elif draft.mode == "solution":
            draft.solution.append(segments)
        else:
            draft.labels.append(text)

    finish()
    return questions, counts


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--xsl", type=Path, default=DEFAULT_XSL)
    args = parser.parse_args()

    converter = FormulaConverter(args.xsl)
    with zipfile.ZipFile(args.source) as archive:
        document_xml = archive.read("word/document.xml")
    questions, counts = extract_questions(document_xml, converter)

    payload = {
        "meta": {
            "title": "高等数学（下）期末积分真题汇编",
            "sourceFile": args.source.name,
            "extractedCount": len(questions),
            "formulaCount": converter.count,
            "countsByAcademicYear": counts,
        },
        "questions": questions,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(payload["meta"], ensure_ascii=False, indent=2))
    if len(questions) != 85:
        print(f"Expected 85 questions, extracted {len(questions)}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
