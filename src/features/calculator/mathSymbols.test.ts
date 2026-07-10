import { describe, expect, it } from "vitest";
import { mathSymbolCategories } from "./mathSymbols";

describe("grouped math symbol keyboard", () => {
  it("provides five focused categories with unique accessible labels", () => {
    expect(mathSymbolCategories.map((category) => category.id)).toEqual([
      "common",
      "integral",
      "function",
      "letter",
      "vector",
    ]);
    for (const category of mathSymbolCategories) {
      expect(category.symbols.length).toBeGreaterThanOrEqual(12);
      expect(new Set(category.symbols.map((symbol) => symbol.label)).size).toBe(
        category.symbols.length,
      );
    }
  });

  it("includes placeholder templates for structured input", () => {
    const symbols = mathSymbolCategories.flatMap((category) => category.symbols);
    expect(symbols.find((symbol) => symbol.label === "分数")?.latex).toContain("#0");
    expect(symbols.find((symbol) => symbol.label === "带上下限积分")?.latex).toContain("#1");
    expect(symbols.find((symbol) => symbol.label === "偏导数")?.latex).toContain("\\partial");
  });
});
