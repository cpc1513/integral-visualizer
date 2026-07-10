# 积分视界

面向大学高等数学复习的静态积分可视化网站。首页是可直接编辑 LaTeX 的积分计算台，支持普通积分、二重积分、三重积分、曲线积分和曲面积分；三维图形可以拖动旋转。原 Word 文档中的 85 道题被完整保存在源数据中，网页只发布其中已经逐题校验、能够一键载入真实积分区域的题目。

## 本地运行

```bash
pnpm install
pnpm dev
```

质量检查：

```bash
pnpm test
pnpm build
```

## 计算与数据

- 浏览器内通过 Pyodide 运行 Python，优先使用 SymPy 求精确值，必要时用 SciPy 数值积分。
- Plotly 绘制二维或三维积分区域，不需要后端服务。
- 真题数据位于 `src/data/questions.generated.json`，保留了原文中的缺题、待核对等提示。
- 如需从源文档重新生成数据，请安装 Python 的 `lxml`，然后运行：

```bash
python scripts/extract_questions.py "F:/download/高等数学下_积分真题汇编 (1).docx" --output src/data/questions.generated.json
```

## GitHub Pages

项目已使用相对资源路径和 HashRouter，并包含 Pages 工作流。推送到 GitHub 后，在仓库的 **Settings → Pages → Source** 选择 **GitHub Actions**；之后推送 `main` 分支即可自动构建并发布。
