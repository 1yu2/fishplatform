import { useEffect, useMemo, useState } from 'preact/hooks';
import { studioClient } from '../lib/supabase';
import { fetchRepo, formatStars, parseRepo, type Learning } from '../lib/studio-types';
import { InlineText, PriorityPicker, PublicToggle, TagInput, errText, useToast } from './shared';

const STATUS: { id: Learning['status']; label: string }[] = [
  { id: 'learning', label: '在学' },
  { id: 'to_learn', label: '想学' },
  { id: 'learned', label: '学完' },
];

export default function LearningTab() {
  const sb = studioClient();
  const toast = useToast();
  const [items, setItems] = useState<Learning[] | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Learning['status'] | ''>('');
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    const { data, error } = await sb.from('learning').select('*');
    if (error) toast.show(errText(error));
    setItems((data as Learning[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  const sorted = useMemo(() => {
    const order = { learning: 0, to_learn: 1, learned: 2 };
    return [...(items ?? [])]
      .filter((i) => !filter || i.status === filter)
      .sort((a, b) => order[a.status] - order[b.status] || a.importance - b.importance || b.created_at.localeCompare(a.created_at));
  }, [items, filter]);

  // paste a GitHub URL (or owner/name) and the details fill in; anything else is saved as a link
  async function add(e: Event) {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;
    setBusy(true);
    const repo = parseRepo(raw);
    let row: Partial<Learning>;
    if (repo) {
      if (items?.some((i) => i.repo?.toLowerCase() === repo.toLowerCase())) { setBusy(false); return toast.show('这个仓库已经在清单里了'); }
      const info = await fetchRepo(repo);
      row = { kind: 'repo', repo, url: info?.url ?? `https://github.com/${repo}`, title: info?.title ?? repo.split('/')[1],
              description: info?.description ?? null, stars: info?.stars ?? null, language: info?.language ?? null };
      if (!info) toast.show('没拿到 GitHub 信息(可能是私有仓库或请求太频繁),先按名字保存了');
    } else {
      let url = raw;
      if (!/^https?:\/\//.test(url)) url = `https://${url}`;
      let title = raw;
      try { const u = new URL(url); title = (u.hostname.replace(/^www\./, '') + u.pathname).replace(/\/$/, ''); } catch {}
      row = { kind: 'link', url, title };
    }
    const { data, error } = await sb.from('learning').insert(row).select().single();
    setBusy(false);
    if (error) return toast.show(errText(error));
    setItems((xs) => [data as Learning, ...(xs ?? [])]);
    setInput('');
    setOpen((data as Learning).id);
  }

  async function update(id: string, patch: Partial<Learning>) {
    setItems((xs) => xs!.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await sb.from('learning').update(patch).eq('id', id);
    if (error) { toast.show(errText(error)); load(); }
  }

  async function refresh(i: Learning) {
    if (!i.repo) return;
    const info = await fetchRepo(i.repo);
    if (!info) return toast.show('GitHub 暂时拿不到信息');
    update(i.id, { description: info.description, stars: info.stars, language: info.language, url: info.url });
  }

  async function remove(i: Learning) {
    if (!confirm(`从清单里删除「${i.title}」?`)) return;
    setItems((xs) => xs!.filter((x) => x.id !== i.id));
    const { error } = await sb.from('learning').delete().eq('id', i.id);
    if (error) { toast.show(errText(error)); load(); }
  }

  return (
    <section class="st-section">
      <form class="st-add" onSubmit={add}>
        <input class="st-input grow" placeholder="粘贴 GitHub 仓库地址(或任意链接),回车添加…" value={input} onInput={(e) => setInput((e.target as HTMLInputElement).value)} autofocus />
        <button class="st-btn primary" disabled={busy}>{busy ? '获取中…' : '添加'}</button>
      </form>

      <div class="st-filter">
        <button class={!filter ? 'on' : ''} onClick={() => setFilter('')}>全部 {items?.length ?? ''}</button>
        {STATUS.map((s) => <button class={filter === s.id ? 'on' : ''} onClick={() => setFilter(s.id)}>{s.label} {items?.filter((i) => i.status === s.id).length ?? ''}</button>)}
      </div>

      {items === null && <p class="st-muted">加载中…</p>}
      {items?.length === 0 && <p class="st-empty">清单是空的。粘贴一个 GitHub 地址试试,比如 https://github.com/mrdoob/three.js</p>}

      <ul class="st-cards">
        {sorted.map((i) => (
          <li class={`st-card s-${i.status}`}>
            <div class="st-card-top">
              <PriorityPicker value={i.importance} onChange={(p) => update(i.id, { importance: p })} />
              <div class="st-seg" role="group" aria-label="状态">
                {STATUS.map((s) => <button class={i.status === s.id ? 'on' : ''} onClick={() => update(i.id, { status: s.id })}>{s.label}</button>)}
              </div>
              <PublicToggle value={i.is_public} onChange={(v) => update(i.id, { is_public: v })} />
            </div>
            <InlineText class="st-title" value={i.title} onSave={(v) => v.trim() && update(i.id, { title: v.trim() })} />
            {i.description && <p class="st-desc">{i.description}</p>}
            <div class="st-meta">
              {i.url && <a href={i.url} target="_blank" rel="noopener">{i.repo ?? i.url.replace(/^https?:\/\//, '')} ↗</a>}
              {i.stars != null && <span class="st-stars">★ {formatStars(i.stars)}</span>}
              {i.language && <span>{i.language}</span>}
              {i.tags.map((t) => <span class="st-tag">{t}</span>)}
            </div>
            <div class="st-card-actions">
              <button class="st-link" onClick={() => setOpen(open === i.id ? null : i.id)}>{open === i.id ? '收起' : i.notes ? '笔记 / 编辑' : '写笔记 / 编辑'}</button>
              {i.repo && <button class="st-link" onClick={() => refresh(i)}>刷新星数</button>}
            </div>
            {open === i.id && (
              <div class="st-detail">
                <label class="wide">标签<TagInput value={i.tags} onChange={(tags) => update(i.id, { tags })} /></label>
                <label class="wide">笔记<InlineText multiline value={i.notes} placeholder="为什么想学它、学到了什么…(Shift+Enter 换行)" onSave={(v) => update(i.id, { notes: v })} /></label>
                <button type="button" class="st-btn danger" onClick={() => remove(i)}>删除</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p class="st-hint">「公开」的条目会出现在网站的「学习」页面;在学的会显示在首页。想把学习心得写成文章,去「写作」里新建笔记并关联它。</p>
      {toast.node}
    </section>
  );
}
