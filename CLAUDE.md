# fishplatform — 个人网站 / 作品集

单页个人站。首屏是一个 WebGL 粒子球(浅紫主题),下接工作室介绍、服务卡片、联系 CTA。
目前是「粗版可用」阶段,后续要对着参考录屏把动画打磨到位,并把占位文案换成真实作品集内容。

## 线上 / 部署
- 线上地址:https://fishplatform.vercel.app/
- 仓库:https://github.com/1yu2/fishplatform （main 分支）
- 部署链路:改代码 → `git push` 到 main → Vercel 自动部署（Vercel↔GitHub 已配好）
- 纯静态,无构建步骤。Vercel 项目设置:Framework = Other,Build Command 留空,Root = ./

## 技术栈 / 文件
- `index.html` —— 全部内容(HTML + CSS + JS)都在这一个文件里,单文件自包含
- Three.js r128,通过 cdnjs 引入:`https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
- Google Fonts:Archivo(标题)/ Hanken Grotesk(正文)/ Space Mono(标签、等宽数字)
- 本地预览:浏览器直接打开 index.html,或 `npx serve .`

## 设计方向
- 主题:**浅紫色 / 薰衣草白**(明亮通透),灵感来自一张 "Where Money Grows" 图的上半部分。
- 背景渐变:`#f6f5fd → #eceaf7 → #ddd9ef`(顶部接近白,往下丁香紫)。
- 配色 token(定义在 index.html `<style>` 顶部 `:root`):
  - `--bg:#e9e8f5` / `--bg-2:#fff`(卡片)/ `--fg:#2b2545`(深紫灰正文)
  - `--accent:#7c4dff`(主紫)/ `--accent-2:#5a2fd0`(深紫,hover/标签)
  - `--accent-soft:#b9a4ff` / `--glow:#9b6bff`
- 单主题(committed light),`color-scheme: light`。标题用紫色渐变文字(background-clip:text)。
- ⚠️ 浅背景下粒子用的是 **NormalBlending**(不是 AdditiveBlending)——additive 在浅色上会被加白糊掉。改渲染时记住这点。

## WebGL 粒子球结构(index.html 底部 `<script>`)
一个 THREE.Group 里包含三部分,都用同一套 GLSL simplex 噪声(SNOISE)做位移:
1. `points` —— ~5200 个粒子(fibonacci 球面分布 + 抖动),ShaderMaterial,噪声沿法线起伏呼吸。
   - ⚠️ `gl_PointSize` 公式:`uSize * aScale * uPix * (1.0/-mv.z)`,其中 `uSize=0.016`、`uPix = dpr*(h/2)` = 0.5×缓冲高度。改大小只动 uSize,别动量级(之前踩过坑:uSize 设成 15 会让粒子糊满屏)。
2. `wire` —— IcosahedronGeometry(1.80, 3) 线框,同样噪声位移,构成「网状」观感。
3. `core` —— 一个 CanvasTexture 径向渐变 Sprite,做中心紫光晕(浅色下较含蓄)。
- 交互:鼠标视差(group 跟随 lerp)、随滚动 scrollP 增大位移幅度、进入服务区时整块 canvas 淡出。
- 已处理:`prefers-reduced-motion`(降幅/不转)、`document.hidden` 时跳过渲染、DPR 上限 2、resize。

## 参考录屏拆解(后续动画优化目标)
参考的是 OPTIMIND(AI 自动化公司)那个录屏,三段:
1. **首屏**:大标题 + 粒子球,球是「暗色网状粒子 + 中心发光内核」,会呼吸、旋转、爆发光点。
2. **第二屏**:粒子球**变形成六边形线框结构**,配第二句大标题。✅ 已做:滚动驱动 uMorph,粒子+线框在 shader 里 mix 到朝向镜头的空心六边形环(MORPH 段),背景同心圆淡入。
3. **服务区**:三张玻璃卡片,各嵌一个发光 3D 几何体(圆环 / 三角 / 菱形)。✅ 已做:`initGlyphs()` 每张卡一个小 three.js 场景,白色半透明挤出层 + 暖色边光 + VSM 柔影;进入视口从细线「长出」,层间错开,hover 展开。SVG 保留为无 WebGL 时的回退。
- 火焰:3 个游走热点(`hotU`)给附近粒子/线框加热变橙,~4% 节点为闪烁余烬,变形过半时 `igniteAll()` 中心爆闪。颜色 token:`--ember / --ember-hot / --ember-deep`。
- 服务区以面板形式盖上粒子场景(`.services::before`),粒子球同时上移缩小淡出(exitP)。
- 优化重点:粒子变形节奏、第二屏六边形形态、滚动联动的顺滑度;让球在浅色下更「实」(密度/亮度)。

## 待办 / Next
- [ ] 对照录屏优化动画(见上)
- [ ] 把占位文案(品牌名 NOVARA、AI agency 文案)换成真实作品集:关于我 / 精选作品 / 技能栈 / 联系方式
- [ ] (可选)绑定自定义域名(Vercel Settings → Domains),之后再决定要不要上 Cloudflare

## 约定
- 保持单文件 index.html(除非要拆分资源)。
- 颜色一律走 `:root` 的 token,别写死十六进制。
- 改完本地验证后再 push;push 即上线,注意别把半成品推到 main。
