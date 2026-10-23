# fishplatform — 个人网站 / 作品集

个人站(Astro,三语 EN/日本語/中文)。首页首屏是 WebGL 粒子球(浅紫主题),下接工作室介绍、服务卡片、联系 CTA;另有 About 页和博客。
目前是「粗版可用」阶段,后续要对着参考录屏把动画打磨到位,并把占位文案换成真实作品集内容。

## 线上 / 部署
- 线上地址:https://fishplatform.vercel.app/
- 仓库:https://github.com/1yu2/fishplatform （main 分支）
- 部署链路:改代码 → `git push` 到 main → Vercel 自动部署（Vercel↔GitHub 已配好）
- **Astro(大部分页面预构建,博客 / 学习页按请求渲染,用 `@astrojs/vercel` 适配器)**:`vercel.json` 里写明 framework=astro、`npm run build`、输出 `dist/`,并把旧的 `/about.html`、`/index.html` 301 到新地址。
- 大改动先在分支上做:推分支会生成 Vercel 预览地址,确认后再合到 main。

## 技术栈 / 文件
- **Astro 5.18.2**(本机 Node 22.19;Astro 7 需要 Node ≥ 22.22,升级 Node 后再考虑升 Astro)。
- 页面路由 `src/pages/[...locale]/…`:同一份模板生成 `/`(英文)、`/ja/`、`/zh/`;`localeStaticPaths()` 见 `src/i18n/utils.ts`。
- 界面文案全部在 `src/i18n/ui.ts`(en / ja / zh 三份字典),页面里用 `t('key')`。**新增文案要三种语言一起加。**
- `src/components/Home.astro` / `About.astro`:原 index.html / about.html 搬过来的,CSS(`<style is:global>`)和动画脚本(`<script is:inline>`)保持原样,只把文字换成 `t()`。首页 intro 的防闪 boot 脚本在 `[...locale]/index.astro` 的 head slot 里。
- `src/components/Nav.astro`:共享导航 + 语言切换(记住选择,`/` 会把选过 ja/zh 的访客送回对应语言)。
- 博客:`src/content.config.ts`(schema)、`src/content/blog/<slug>/index.md`、列表 `[...locale]/blog/index.astro`、文章 `[...locale]/blog/[slug].astro`;内容页公共样式 `src/styles/site.css`。
- 项目:`src/content/projects/<slug>/index.md`(status building/shipped/paused、stack、repo/demo、cover、featured),工具函数 `src/lib/projects.ts`;列表 `[...locale]/projects/index.astro`(玻璃卡片 + 状态筛选,同一 `translationKey` 只出一张卡、优先当前语言),详情 `[...locale]/projects/[slug].astro`。
- **Studio(`/studio`,只有站点主人能登录)**:用户要的三个功能,数据在 Supabase(Postgres + 登录 + 图片存储)。
  - **待办** `todos`:快速添加、优先级 1–3、截止日期、进行中/完成、可关联学习条目或项目;`is_public` 默认私密,勾「公开」才上网站。
  - **学习清单** `learning`:粘贴 GitHub 地址自动填名字/星数/简介/语言(浏览器直接调 GitHub API);重要程度、状态 想学/在学/学完、标签、笔记。
  - **写作** `notes`:单栏所见即所得编辑器(TipTap v3 + `tiptap-markdown`,正文仍以 Markdown 字符串存库;扩展配置在 `src/studio/tiptap.ts`):表格可拖边框调列宽(有列宽/单元格对齐时序列化成 HTML 表格,否则是 GFM)、文字对齐(顶层段落/标题序列化成 `<div style="text-align:…">`)、折叠块、任务列表;粘贴/拖入图片(传到 Storage 的 `studio` bucket);图表/思维导图是 `#diagram-xxx`/`#mindmap-xxx` 占位图片,点开 draw.io / mind-elixir 编辑,存成 `.drawio.svg`/`.mindmap.svg`,尺寸与裁剪写在图片链接 `#w=60;c=t,r,b,l;n=比例` 里(`src/lib/diagram.ts`,博客渲染时转成样式);拖四角缩放、拖边裁剪;摘要、标签、语言、slug;关联 learning_ids / todo_ids / projects;「发布到博客」= status published,**无需重新部署**。自动保存(1.2s 防抖)。
  - 代码:`src/studio/*.tsx`(Preact,`client:only`)、`src/pages/studio.astro`、`src/lib/supabase.ts`、`src/lib/studio-types.ts`。界面是中文(只给主人用)。
  - 数据库:`supabase/schema.sql`(表 + RLS:访客只读公开/已发布的行,只有 `app_owner` 能写)、`supabase/seed.sql`(原花园数据)、`supabase/README.md`(用户自己建项目、建账号、填密钥的步骤)。
  - 环境变量:`PUBLIC_SUPABASE_URL`、`PUBLIC_SUPABASE_ANON_KEY`(本地 `.env`,线上 Vercel 环境变量;都是公开密钥,安全靠 RLS)。**不要**用 service_role key。没配置时网站照常运行,只是没有 Studio 数据。
- **公开页面怎么读数据**:
  - 博客列表可切换「按时间 / 按标签 / 按项目」三种分组(`blog/index.astro`,标签筛选对三种视图都生效,选择记在 localStorage);Studio 笔记关联的项目用于按项目分组。文章页目录可显示/隐藏(记在 localStorage `fp-toc`,窄屏默认收起)。Studio 写作页工具栏有「目录」按钮,显示文档大纲、点击跳转。
  - 博客列表和文章页 `[...locale]/blog/*` 改为**按请求渲染**(`prerender = false`,CDN 缓存 60s):仓库里的 Markdown 文章 + Studio 已发布笔记合并显示(`src/lib/public-data.ts` 的 `blogEntries()`;笔记用 `@astrojs/markdown-remark` 渲染,和文件文章同一套高亮)。文章页底部「相关」列出笔记关联的学习条目 / 项目 / 公开待办。
  - `/learning`(公开的学习清单,按 在学/想学/学完 分组)和 `/learning/<id>`(笔记、为它写过的文章、相关待办)也是按请求渲染。
  - 首页 004「现在」区块 + 博客侧栏:`src/components/now/NowStrip.astro`,浏览器直接请求 Supabase REST(只拿公开行):公开待办 + 在学的条目,按优先级排,完成的待办 7 天后自动消失(`KEEP_DONE_DAYS`)。
  - 首页 002 工作室区块的三个数字是实时的(文章数 = 仓库文章 + 已发布笔记、在学仓库数、已完成公开待办数);003 服务区三张卡片(保留 3D 图形)分别链接 写作 / 学习清单 / 项目。
  - 404 页按请求渲染(`Astro.rewrite('/404')` 要求),状态码 404。
- 已移除:Garden(花园)和 `/admin`(Sveltia CMS);`/now`、`/garden`、`/admin` 旧链接在 `vercel.json` 里重定向到 `/learning` / `/studio`。
- 文章/项目正文样式 `.prose` 在 `src/styles/site.css`(博客和项目共用);状态色 token `--st-shipped/--st-building/--st-paused`。
- Nav 8 个链接在 frontmatter 的 `links` 数组里(桌面横排和手机菜单共用):≤1180px 时横排隐藏 Studio/Services 和 Contact(`extra`);≤860px 横排整排隐藏,改用汉堡按钮 + 下拉面板(`#nav-menu`,点链接/外部/Esc 关闭,打开时锁滚动 `html.nav-open`)。⚠️ header 有 backdrop-filter,面板只能 absolute 相对 header 定位,不能用 fixed。
- 静态资源在 `public/assets/`(用绝对路径 `/assets/...`)。
- Three.js r128 仍通过 cdnjs 引入;Google Fonts:Archivo / Hanken Grotesk / Space Mono,中日文回退到系统字体。
- 本地:`npm run dev`(开发)/ `npm run build && npm run preview`(看最终产物,端口 4321)。

## 设计方向
- 主题:**浅紫色 / 薰衣草白**(明亮通透),灵感来自一张 "Where Money Grows" 图的上半部分。
- 背景渐变:`#f6f5fd → #eceaf7 → #ddd9ef`(顶部接近白,往下丁香紫)。
- 配色 token(Home/About 组件和 `src/styles/site.css` 的 `:root` 各有一份,改色要同步):
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

## 植物循环动画(博客 / 学习页左下角)
- 源:`ref3.mov`(橙色羽毛状植物 + 紫色缎带叶 + 卷须,灰色渐变底)。**离线**处理(Python/OpenCV):去掉前 100 帧播放器画面和左右黑边;用低饱和像素建背景板,按颜色距离 + 饱和度抠出 alpha;调色:暖色羽穗 → 紫/丁香/近白,冷色缎带 → 深靛紫;60→30fps;**首尾 1.5s 交叉淡化烘进视频**,所以 `<video loop>` 无缝。
- 输出 `public/assets/plants.mp4`:左半彩色、右半 alpha 并排(460×360,H.264,1.6MB,avconvert `PresetAppleM4VWiFi`,输出须用 .m4v 再改名);`plants-still.png` 是静帧回退。
- 组件 `src/components/plants/PlantLoop.astro`:固定在视口左下角、内容后面(z-index 1,不透明度 .62),WebGL 小 shader 合成两半;reduced-motion / 无 WebGL / 播放被拒显示静帧;≤760px 隐藏。用在 `blog/index`、`learning/index`、`learning/[id]`。

## 路线图:内容站(已和用户确认;第 ① 期已完成:Astro + 三语 + 博客;第 ② 期 projects 已做;待办 / 学习清单 / 写作 由 Studio + Supabase 实现,见上)
- **框架:迁到 Astro**(Vercel Framework 改为 Astro,有构建步骤)。现有首页/About 页及其动画原样搬入,不改视觉。迁移后「单文件 index.html」约定作废。
- **三语界面:English / 日本語 / 中文**,Astro i18n 路由:`/`(英文默认)、`/ja/…`、`/zh/…`;nav 语言切换并记住选择;界面文案每种语言一个字典文件。**文章不自动翻译**:每篇有 `lang`,译文用 `translationKey` 关联;单语文章在三种语言列表里都出现并带语言标记。
- **内容集合**(每类一个文件夹,Markdown/YAML):
  - `blog`:title / date / tags / summary / lang / `canonical`(原平台链接)。年份分组 + 标签筛选,文章页带目录和代码高亮。
  - `projects`:状态 building / shipped / paused、技术栈、repo、demo、封面。玻璃卡片 + 详情页。
  - `leetcode`:题号、标题、难度、标签、语言、日期;正文 = 思路 + 代码 + 复杂度。看板:难度环形图、练习日历热力图、可筛选题目表。
  - `radar.yaml`(学习雷达):只写 `owner/name` + 为什么值得学 + 状态 to learn / learning / done;星数、语言、简介构建时用 GitHub API 拉取。三列卡片墙。
  - ~~`now.yaml` / 学习雷达~~ → 由 Studio 的「待办」「学习清单」取代(见上)。
  - 首页在现有动画区块下加「最新文章 / 正在做 / 最近刷题」条。
- **旧文章搬运**,统一输出 `content/blog/<slug>/index.md` + 同目录图片:飞书用 `feishu2md`(需用户自己在飞书开放平台建应用拿 app id/secret,凭据由用户处理)或导出 Word 再转;CSDN 按 URL 列表抓取转 Markdown,**图片必须下载到本地**(CSDN 防盗链);Notion 用自带 Markdown & CSV 导出再规整;语雀/本地 md 补 front matter。保留 `canonical` 指回原文。
- **分期**:① 迁 Astro(视觉不变)+ i18n 骨架 + blog,导入 1–2 篇示例 → ② projects + now → ③ leetcode 看板 + 学习雷达 → ④ 批量导入、站内搜索(Pagefind)、RSS、评论(giscus)。

## 待办 / Next
- [ ] 对照录屏优化动画(见上)
- [ ] 把占位文案(品牌名已定为 Fishbloom(`src/site.ts`),AI agency 文案仍是占位)换成真实作品集:关于我 / 精选作品 / 技能栈 / 联系方式
- [ ] (可选)绑定自定义域名(Vercel Settings → Domains),之后再决定要不要上 Cloudflare

## 约定
- 页面文字一律走 `src/i18n/ui.ts`,不要在模板里写死某一种语言。
- 颜色一律走 `:root` 的 token,别写死十六进制。
- 改完本地验证后再 push;push 即上线,注意别把半成品推到 main。
