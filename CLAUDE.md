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
2. **第二屏**:粒子球**变形成六边形线框结构**,配第二句大标题。✅ 已做:滚动驱动 uMorph,粒子+线框在 shader 里 mix 到朝向镜头的空心六边形环(MORPH 段):外层六边形网 + 内层圆环(~28% 粒子 + `innerWire` 环面线框),背景同心圆淡入。
3. **服务区**:三张玻璃卡片,各嵌一个发光 3D 几何体(圆环 / 三角 / 菱形)。✅ 已做:`initGlyphs()` 每张卡一个小 three.js 场景,淡紫透明挤出层(`GLASS_OPACITY`=0.5,哑光、低亮度,用户要求不要反光)+ VSM 柔影;卡片底色 token `--card-1 / --card-2` 略深以衬出图形;进入视口从细线「长出」,层间错开,hover 展开。SVG 保留为无 WebGL 时的回退。
- 火焰/火花效果试过,用户不要,已移除(别再加回)。
- **开场动画(intro)**:参考 ref2.mov(AI 生成的牡丹绽放实拍,无原片,所以做成风格化粒子版)。`initIntro()`:~12k 粒子在暮紫背景(`--intro-1/--intro-2`,用户要求比初版浅一半)上从散点聚成花苞,然后**循环**:绽放 → 停留 → 合拢回花苞(周期 7s,`bloomAt()`);花茎直立可见(只有花头 `uTilt` 朝镜头倾斜),花比初版小一点。直到访客点 Enter / 点击 / 滚轮 / 触摸滑动 / Esc·Enter·空格才消散淡出到页面。每次访问只出现一次(sessionStorage `fp-intro`),reduced-motion 不播;head 里的 boot 脚本先加 `intro-on` 防闪,6s 兜底(intro 启动后取消)。
- 服务区以面板形式盖上粒子场景(`.services::before`),粒子球同时上移缩小淡出(exitP)。
- 优化重点:粒子变形节奏、第二屏六边形形态、滚动联动的顺滑度;让球在浅色下更「实」(密度/亮度)。

## About 页(about.html)
- 独立页面,**和首页同一套浅紫主题**(用户明确:不要黑底、不要画框,花要融进页面)。
- 花:`assets/bloom.mp4`(ref2.mov 截出的干净 8s 循环:花苞 → 盛开,360×418,H.264,1.9MB,用 macOS `avconvert` 截取,无需 ffmpeg)。视频本身是黑→石板灰渐变底,**在 WebGL 里实时抠掉**:
  - 背景是固定的竖向渐变,按行测得 32 个色标(`BG` 数组,从花苞帧左边缘采样),像素与之接近即透明;花是暖色、背景是冷色,用 r-b 暖度辅助区分。
  - 调色:亮度渐变映射 `--ink`(紫)→ `--ink-2`(丁香)→ `--petal`(白),暗部做开方拉伸让花苞褶皱可见;只有「亮且饱和」的颜色(金色花蕊)保留原色;暗部略透明(像丁香色玻璃)。
  - 四边羽化:贴边的花瓣和花茎底部淡入页面。
  - 参数是先用 Python 原型对比各阶段帧调出来的,改阈值前最好也这样对照花苞(很暗)和盛开两个阶段。
- 布局:桌面端花固定在右侧(像首页的球),滚到 Story 时上移淡出;手机端在标题上方随文档流。花外有 2D canvas 花粉微粒和丁香光晕。
- 循环:两个隐藏 `<video>` 作为纹理源,结尾前 1.2s 在 shader 里交叉淡化到另一份,避免「盛开 → 花苞」硬切。reduced-motion / 播放被拒(后台标签页、iOS 低电量)时显示抠好的 `assets/bloom-open.jpg` 静帧,被拒的情况下标签页可见或首次交互时会重试播放。
- 360 宽的源视频放大后会略软,别再放得更大;有更高清原片可直接替换 mp4(背景色标需重新测)。
- 文案目前是占位(成长/时间线/技能),等用户提供真实内容。

## 待办 / Next
- [ ] 对照录屏优化动画(见上)
- [ ] 把占位文案(品牌名 NOVARA、AI agency 文案)换成真实作品集:关于我 / 精选作品 / 技能栈 / 联系方式
- [ ] (可选)绑定自定义域名(Vercel Settings → Domains),之后再决定要不要上 Cloudflare

## 约定
- 保持单文件 index.html(除非要拆分资源)。
- 颜色一律走 `:root` 的 token,别写死十六进制。
- 改完本地验证后再 push;push 即上线,注意别把半成品推到 main。
