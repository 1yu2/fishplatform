import { useEffect, useMemo, useState } from 'preact/hooks';
import { studioClient } from '../lib/supabase';
import type { Learning, Priority, Todo } from '../lib/studio-types';
import { InlineText, PriorityPicker, PublicToggle, daysSince, errText, today, useToast, type ProjectRef } from './shared';

const rank = { doing: 0, todo: 1, done: 2 } as const;
const GROUPS: { status: Todo['status']; label: string }[] = [
  { status: 'doing', label: '进行中' },
  { status: 'todo', label: '待开始' },
  { status: 'done', label: '已完成' },
];

export default function TodoTab({ projects }: { projects: ProjectRef[] }) {
  const sb = studioClient();
  const toast = useToast();
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [learning, setLearning] = useState<Pick<Learning, 'id' | 'title'>[]>([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>(2);
  const [due, setDue] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);

  async function load() {
    const [{ data, error }, l] = await Promise.all([
      sb.from('todos').select('*'),
      sb.from('learning').select('id,title').order('title'),
    ]);
    if (error) toast.show(errText(error));
    setTodos((data as Todo[]) ?? []);
    setLearning((l.data as Learning[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  const sorted = useMemo(() => [...(todos ?? [])].sort((a, b) =>
    rank[a.status] - rank[b.status] ||
    (a.status === 'done' ? Date.parse(b.done_at ?? '') - Date.parse(a.done_at ?? '') : 0) ||
    a.priority - b.priority ||
    (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
    a.created_at.localeCompare(b.created_at)), [todos]);

  async function add(e: Event) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const { data, error } = await sb.from('todos').insert({ title: t, priority, due: due || null, is_public: isPublic }).select().single();
    if (error) return toast.show(errText(error));
    setTodos((xs) => [...(xs ?? []), data as Todo]);
    setTitle(''); setDue('');
  }

  async function update(id: string, patch: Partial<Todo>) {
    setTodos((xs) => xs!.map((x) => (x.id === id ? { ...x, ...patch } : x)));      // optimistic
    const { error } = await sb.from('todos').update(patch).eq('id', id);
    if (error) { toast.show(errText(error)); load(); }
  }

  function setStatus(t: Todo, status: Todo['status']) {
    const now = new Date().toISOString();
    update(t.id, {
      status,
      started_at: status === 'doing' && !t.started_at ? now : t.started_at,
      done_at: status === 'done' ? now : null,
    });
  }

  async function remove(t: Todo) {
    if (!confirm(`删除「${t.title}」?`)) return;
    setTodos((xs) => xs!.filter((x) => x.id !== t.id));
    const { error } = await sb.from('todos').delete().eq('id', t.id);
    if (error) { toast.show(errText(error)); load(); }
  }

  const learningTitle = (id: string | null) => learning.find((l) => l.id === id)?.title;

  return (
    <section class="st-section">
      <form class="st-add" onSubmit={add}>
        <input class="st-input grow" placeholder="添加待办,回车保存…" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} autofocus />
        <PriorityPicker value={priority} onChange={setPriority} />
        <input class="st-input date" type="date" value={due} min={today()} title="截止日期(可选)" onInput={(e) => setDue((e.target as HTMLInputElement).value)} />
        <PublicToggle value={isPublic} onChange={setIsPublic} />
        <button class="st-btn primary">添加</button>
      </form>

      {todos === null && <p class="st-muted">加载中…</p>}
      {todos?.length === 0 && <p class="st-empty">还没有待办。在上面输入一条,回车就保存了。</p>}

      {GROUPS.map((g) => {
        let items = sorted.filter((t) => t.status === g.status);
        const hidden = g.status === 'done' && !showAllDone ? Math.max(0, items.length - 8) : 0;
        if (hidden) items = items.slice(0, 8);
        if (!items.length) return null;
        return (
          <div class="st-group">
            <h3 class="st-group-title">{g.label}<span>{sorted.filter((t) => t.status === g.status).length}</span></h3>
            <ul class="st-list">
              {items.map((t) => {
                const overdue = t.due && t.status !== 'done' && t.due < today();
                const since = t.status === 'doing' ? daysSince(t.started_at) : t.status === 'done' ? daysSince(t.done_at) : null;
                return (
                  <li class={`st-row s-${t.status} ${overdue ? 'overdue' : ''}`}>
                    <input type="checkbox" class="st-check" checked={t.status === 'done'} title={t.status === 'done' ? '标记为未完成' : '完成'}
                      onChange={() => setStatus(t, t.status === 'done' ? 'todo' : 'done')} />
                    <PriorityPicker value={t.priority} onChange={(p) => update(t.id, { priority: p })} />
                    <div class="st-row-main">
                      <InlineText class="st-title" value={t.title} onSave={(v) => v.trim() && update(t.id, { title: v.trim() })} />
                      <div class="st-meta">
                        {t.status !== 'done' && (
                          <button type="button" class="st-chip" onClick={() => setStatus(t, t.status === 'doing' ? 'todo' : 'doing')}>
                            {t.status === 'doing' ? `进行中 · ${since === 0 ? '今天开始' : `第 ${since! + 1} 天`}` : '开始做'}
                          </button>
                        )}
                        {t.status === 'done' && since !== null && <span>{since === 0 ? '今天完成' : `${since} 天前完成`}</span>}
                        {t.due && t.status !== 'done' && <span class="st-due">{overdue ? '已逾期 · ' : '截止 '}{t.due}</span>}
                        {t.learning_id && <span class="st-link-tag">学习:{learningTitle(t.learning_id)}</span>}
                        {t.project && <span class="st-link-tag">项目:{projects.find((p) => p.slug === t.project)?.title ?? t.project}</span>}
                        {t.notes && <span class="st-has-notes" title={t.notes}>有备注</span>}
                      </div>
                    </div>
                    <PublicToggle value={t.is_public} onChange={(v) => update(t.id, { is_public: v })} />
                    <button type="button" class="st-icon" title="详情" aria-expanded={open === t.id} onClick={() => setOpen(open === t.id ? null : t.id)}>⋯</button>
                    {open === t.id && (
                      <div class="st-detail">
                        <label>截止<input class="st-input date" type="date" value={t.due ?? ''} onChange={(e) => update(t.id, { due: (e.target as HTMLInputElement).value || null })} /></label>
                        <label>关联学习
                          <select class="st-input" value={t.learning_id ?? ''} onChange={(e) => update(t.id, { learning_id: (e.target as HTMLSelectElement).value || null })}>
                            <option value="">无</option>
                            {learning.map((l) => <option value={l.id}>{l.title}</option>)}
                          </select>
                        </label>
                        <label>关联项目
                          <select class="st-input" value={t.project ?? ''} onChange={(e) => update(t.id, { project: (e.target as HTMLSelectElement).value || null })}>
                            <option value="">无</option>
                            {projects.map((p) => <option value={p.slug}>{p.title}</option>)}
                          </select>
                        </label>
                        <label class="wide">备注<InlineText multiline value={t.notes} placeholder="写点备注…" onSave={(v) => update(t.id, { notes: v })} /></label>
                        <button type="button" class="st-btn danger" onClick={() => remove(t)}>删除</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {hidden > 0 && <button class="st-link more" onClick={() => setShowAllDone(true)}>显示更早完成的 {hidden} 条</button>}
          </div>
        );
      })}
      <p class="st-hint">「公开」的待办会显示在首页和博客旁边;完成后在网站上保留 7 天。</p>
      {toast.node}
    </section>
  );
}
