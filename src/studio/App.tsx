import { useEffect, useState } from 'preact/hooks';
import type { Session } from '@supabase/supabase-js';
import { studioClient, supabaseConfigured } from '../lib/supabase';
import TodoTab from './TodoTab';
import LearningTab from './LearningTab';
import WritingTab from './WritingTab';
import type { ProjectRef } from './shared';

type Tab = 'todo' | 'learning' | 'writing';
const TABS: { id: Tab; label: string }[] = [
  { id: 'todo', label: '待办' },
  { id: 'learning', label: '学习清单' },
  { id: 'writing', label: '写作' },
];

function readTab(): Tab {
  try {
    const t = (location.hash.slice(1) || localStorage.getItem('studio-tab')) as Tab;
    if (TABS.some((x) => x.id === t)) return t;
  } catch {}
  return 'todo';
}

export default function App({ projects }: { projects: ProjectRef[] }) {
  return supabaseConfigured ? <Studio projects={projects} /> : <NotConfigured />;
}

function Studio({ projects }: { projects: ProjectRef[] }) {
  const sb = studioClient();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isOwner, setIsOwner] = useState<boolean | undefined>(undefined);
  const [tab, setTab] = useState<Tab>(readTab);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // signed in but not listed in app_owner -> writes would be refused; say so instead of failing silently
  useEffect(() => {
    if (!session) { setIsOwner(undefined); return; }
    sb.rpc('is_owner').then(({ data, error }) => setIsOwner(!error && data === true));
  }, [session?.user.id]);

  useEffect(() => {
    try { localStorage.setItem('studio-tab', tab); } catch {}
    history.replaceState(null, '', `#${tab}`);
  }, [tab]);

  if (session === undefined) return <div class="st-center st-muted">加载中…</div>;
  if (!session) return <Login />;

  return (
    <div class="st-app">
      <header class="st-bar">
        <a class="st-brand" href="/"><span class="dot" />Fishbloom <b>Studio</b></a>
        <nav class="st-tabs" role="tablist">
          {TABS.map((t) => (
            <button role="tab" aria-selected={tab === t.id} class={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
        <div class="st-user">
          <span class="st-muted">{session.user.email}</span>
          <button class="st-link" onClick={() => sb.auth.signOut()}>退出</button>
        </div>
      </header>

      {isOwner === false && (
        <p class="st-warn">
          这个账号还不是站点主人,保存会被拒绝。请在 Supabase SQL Editor 里运行:<br />
          <code>insert into public.app_owner (owner_id) values ('{session.user.id}');</code>
        </p>
      )}

      <main class={`st-main ${tab === 'writing' ? 'wide' : ''}`}>   {/* writing uses the full window width */}
        {tab === 'todo' && <TodoTab projects={projects} />}
        {tab === 'learning' && <LearningTab />}
        {tab === 'writing' && <WritingTab projects={projects} />}
      </main>
    </div>
  );
}

function Login() {
  const sb = studioClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true); setError('');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message === 'Invalid login credentials' ? '邮箱或密码不对' : error.message);
  }

  return (
    <div class="st-center">
      <form class="st-login" onSubmit={submit}>
        <a class="st-brand" href="/"><span class="dot" />Fishbloom <b>Studio</b></a>
        <p class="st-muted">只有站点主人可以登录。</p>
        <label>邮箱<input type="email" autocomplete="username" required value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} /></label>
        <label>密码<input type="password" autocomplete="current-password" required value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} /></label>
        {error && <p class="st-error">{error}</p>}
        <button class="st-btn primary" disabled={busy}>{busy ? '登录中…' : '登录'}</button>
      </form>
    </div>
  );
}

function NotConfigured() {
  return (
    <div class="st-center">
      <div class="st-login">
        <a class="st-brand" href="/"><span class="dot" />Fishbloom <b>Studio</b></a>
        <p>还没有连接数据库。</p>
        <p class="st-muted">
          按 <code>supabase/README.md</code> 的步骤创建 Supabase 项目,然后在 <code>.env</code>(本地)和 Vercel 的环境变量里填上
          <code>PUBLIC_SUPABASE_URL</code> 和 <code>PUBLIC_SUPABASE_ANON_KEY</code>。
        </p>
      </div>
    </div>
  );
}
