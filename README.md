# 积分可视化学习平台

面向大学高等数学（下册）复习的交互式积分可视化网站。收录东北大学历年期末真题与机考题共 217 道，每题附分步解析，并为可画图的题目渲染对应的积分区域 / 曲面 / 曲线，三维场景可拖动旋转、自动切换最佳视角。内置所见即所得公式编辑器（MathLive），支持明暗双主题。

线上地址：https://cpc1513.github.io/integral-visualizer/

## 功能

- **真题库**：期末真题 84 + 机考题库 133，按来源 / 分类 / 学年筛选，支持关键词搜索
- **分步解析**：每题推导步骤折叠展示，KaTeX 渲染公式
- **三维可视化**：Three.js 渲染积分区域、参数曲面、空间曲线，自动匹配最佳观测角度
- **二维区域图**：二重积分区域的 SVG 示意图
- **公式编辑器**：MathLive 所见即所得输入，符号面板 + 虚拟键盘，右键菜单全中文
- **明暗主题**：一键切换，选择记忆在本地

## 本地开发

```bash
npm install   # postinstall 会自动把 mathlive 字体拷到 public/fonts/mathlive
npm run dev
```

## 构建与部署

```bash
npm run build   # 产物在 dist/
```

推送到 `main` 分支后由 GitHub Actions 自动构建并部署到 GitHub Pages。

## 技术栈

React 19 · TypeScript · Vite · Tailwind CSS · Three.js · KaTeX · MathLive
