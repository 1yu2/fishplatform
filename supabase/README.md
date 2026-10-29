# 连接 Studio 数据库(Supabase)

Studio(`/studio`)里的待办、学习清单和笔记都存在 Supabase(免费版够用)。下面的步骤只需要做一次。
账号、密码和密钥都由你自己创建和保管,不要发给任何人。

## 1. 创建项目
1. 打开 <https://supabase.com>,注册并登录。
2. **New project**:名字随意(比如 `fishbloom`),Region 选离你近的(如 Tokyo / Singapore),设置一个数据库密码(自己保存好)。
3. 等项目创建完成(约 1 分钟)。

## 2. 建表
1. 左侧 **SQL Editor** → **New query**。
2. 把 `supabase/schema.sql` 的全部内容粘贴进去 → **Run**。看到 `Success` 即可。
3. (可选)再新建一个 query,粘贴 `supabase/seed.sql` → **Run**,导入原来花园里的几条示例数据。

## 3. 创建你自己的登录账号(只有你)
1. 左侧 **Authentication** → **Sign In / Providers**:确认 **Email** 已开启;
   然后把 **Allow new users to sign up** 关掉(这样别人无法注册)。
2. **Authentication** → **Users** → **Add user** → **Create new user**:填你的邮箱和一个登录密码,勾选 **Auto Confirm User**。
3. 回到 **SQL Editor**,运行(把邮箱换成你刚才填的):
   ```sql
   insert into public.app_owner (owner_id)
   select id from auth.users where email = 'you@example.com';
   ```
   这一步让这个账号成为「站点主人」,只有它能写入数据。

## 4. 把连接信息填到网站
1. 左侧 **Project Settings** → **API Keys**(或 **Data API**),复制:
   - **Project URL**(形如 `https://xxxx.supabase.co`)
   - **anon / publishable key**(公开密钥;**不要**用 `service_role` / secret key)
2. **本地**:在项目根目录新建 `.env`(可复制 `supabase/.env.example`;`.env` 已在 .gitignore 里,不会被提交):
   ```
   PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=你的 anon / publishable key
   ```
3. **线上**:Vercel → 项目 → **Settings** → **Environment Variables**,添加同样两个变量(Production 和 Preview 都勾上),然后重新部署一次。

> anon / publishable key 本来就是给浏览器用的公开密钥。数据安全靠 `schema.sql` 里的行级权限(RLS):
> 访客只能读「公开」的待办 / 学习条目和「已发布」的笔记;只有 `app_owner` 里的账号能新增、修改、删除。

## 5. 开始用
- 打开 `https://fishplatform.vercel.app/studio`(本地是 `http://localhost:4322/studio`),用第 3 步的邮箱和密码登录。
- **待办**:输入一行回车就保存;点圆点改优先级;「公开」的会显示在首页和博客旁边,完成后保留 7 天。
- **学习清单**:粘贴 GitHub 地址回车,名字、星数、简介自动填好;设置重要程度、状态,写笔记。
- **写作**:Markdown 编辑器,可直接粘贴 / 拖入图片;右侧填摘要、标签、语言、URL 名称,并勾选关联的学习条目、项目、待办;点「发布到博客」立即出现在博客里(无需重新部署)。
