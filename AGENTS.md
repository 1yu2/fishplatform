# AGENTS.md

项目说明见 [CLAUDE.md](CLAUDE.md)。本文件给自动审查用(agent-autoloop 的 PR 交付流程会读下面这一节)。

## 审查要点

只报真实会出问题的地方，每条写清文件、行号、触发条件和后果。

1. **三语文案**:`src/i18n/ui.ts` 新增或改动的 key,en / ja / zh 三份字典必须一起改;页面里不能写死只有一种语言的界面文字。
2. **路由和重定向**:页面放在 `src/pages/[...locale]/` 下，并且三种语言都能生成;改了路径要在 `vercel.json` 里给旧地址加 301,不能让已有链接 404。
3. **渲染方式**:读 Studio 数据库(Supabase)的页面必须 `prerender = false`;其余页面保持预构建。不要把按请求渲染的页面改成预构建，否则 Studio 发布的内容会看不到。
4. **密钥**:前端只能用 `PUBLIC_SUPABASE_URL`、`PUBLIC_SUPABASE_ANON_KEY`,绝不能出现 service_role key 或其他私密密钥;安全靠 `supabase/schema.sql` 里的 RLS,改表时必须同步改 RLS,访客只能读公开或已发布的行。
5. **Studio 权限**:`/studio` 只能站点主人写入;不能出现绕过登录、或者让访客看到私密待办和笔记的改动。
6. **WebGL**:浅色背景上的粒子用 NormalBlending,不要改成 AdditiveBlending;`gl_PointSize` 只调 `uSize`,不要改量级;要保留 `prefers-reduced-motion`、`document.hidden` 时跳过渲染、DPR 上限 2 这些处理。用户明确不要的效果(火焰、火花)不要加回来。
7. **构建**:`npm run build` 必须通过;不要升级到需要 Node ≥ 22.22 的 Astro 大版本(CI 用 Node 22.19)。
8. **`/health.json`**:必须一直返回 `{"ok":true,"commit":"<40 位 sha>"}`,交付流程靠它确认上线。
