import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { studioClient } from '../lib/supabase';
import type { Learning, Note, Todo } from '../lib/studio-types';
import { TagInput, errText, slugify, useToast, type ProjectRef } from './shared';

const LANGS = [{ id: 'zh', label: '中文' }, { id: 'en', label: 'English' }, { id: 'ja', label: '日本語' }] as const;
const postUrl = (n: Note) => `${n.lang === 'en' ? '' : `/${n.lang}`}/blog/${n.slug}/`;

export default function WritingTab({ projects }: { projects: ProjectRef[] }) {
  const sb = studioClient();
  const toast = useToast();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [learning, setLearning] = useState<Pick<Learning, 'id' | 'title' | 'status'>[]>([]);
  const [todos, setTodos] = useState<Pick<Todo, 'id' | 'title' | 'status'>[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [q, setQ] = useState('');

  async function load() {
    const [n, l, t] = await Promise.all([
      sb.from('notes').select('*').order('updated_at', { ascending: false }),
      sb.from('learning').select('id,title,status').order('title'),
      sb.from('todos').select('id,title,status').order('created_at', { ascending: false }),
    ]);
    if (n.error) toast.show(errText(n.error));
    setNotes((n.data as Note[]) ?? []);
    setLearning((l.data as Learning[]) ?? []);
    setTodos((t.data as Todo[]) ?? []);
    if (!current && n.data?.length) setCurrent((n.data[0] as Note).id);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const { data, error } = await sb.from('notes').insert({ title: '', body: '' }).select().single();
    if (error) return toast.show(errText(error));
    setNotes((xs) => [data as Note, ...(xs ?? [])]);
    setCurrent((data as Note).id);
  }

  const list = useMemo(() => (notes ?? []).filter((n) => !q || `${n.title} ${n.tags.join(' ')} ${n.body}`.toLowerCase().includes(q.toLowerCase())), [notes, q]);
  const note = notes?.find((n) => n.id === current) ?? null;

  return (
    <section class="st-writing">
      <aside class="st-notes">
        <button class="st-btn primary block" onClick={create}>+ 新建笔记</button>
        <input class="st-input" placeholder="搜索标题、标签、正文…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        {notes === null && <p class="st-muted">加载中…</p>}
        {notes?.length === 0 && <p class="st-empty">还没有笔记。点「新建笔记」开始写。</p>}
        <ul>
          {list.map((n) => (
            <li>
              <button class={n.id === current ? 'on' : ''} onClick={() => setCurrent(n.id)}>
                <span class="t">{n.title || '无标题'}</span>
                <span class="m">
                  <span class={`st-badge ${n.status}`}>{n.status === 'published' ? '已发布' : '私密'}</span>
                  {new Date(n.updated_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {note ? (
        <Editor key={note.id} note={note} learning={learning} todos={todos} projects={projects}
          onChange={(n) => setNotes((xs) => xs!.map((x) => (x.id === n.id ? n : x)))}
          onDelete={() => { setNotes((xs) => xs!.filter((x) => x.id !== note.id)); setCurrent(null); }}
          toast={toast.show} />
      ) : (
        notes !== null && <div class="st-editor-empty st-muted">选择左边的一篇笔记,或者新建一篇。</div>
      )}
      {toast.node}
    </section>
  );
}

function Editor({ note, learning, todos, projects, onChange, onDelete, toast }: {
  note: Note;
  learning: Pick<Learning, 'id' | 'title' | 'status'>[];
  todos: Pick<Todo, 'id' | 'title' | 'status'>[];
  projects: ProjectRef[];
  onChange: (n: Note) => void;
  onDelete: () => void;
  toast: (m: string) => void;
}) {
  const sb = studioClient();
  const [n, setN] = useState<Note>(note);
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving'>('saved');
  const [view, setView] = useState<'split' | 'write' | 'preview'>(() => (window.innerWidth > 1100 ? 'split' : 'write'));
  const [uploading, setUploading] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<Partial<Note>>({});
  const timer = useRef<number>();

  // autosave: batch edits and write them 1.2s after the last change
  function edit(patch: Partial<Note>) {
    const next = { ...n, ...patch };
    setN(next); onChange(next);
    pending.current = { ...pending.current, ...patch };
    setSaveState('dirty');
    clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 1200);
  }
  async function flush(): Promise<boolean> {
    clearTimeout(timer.current);
    const patch = pending.current;
    if (!Object.keys(patch).length) return true;
    pending.current = {};
    setSaveState('saving');
    const { error } = await sb.from('notes').update(patch).eq('id', note.id);
    if (error) { toast(errText(error)); pending.current = { ...patch, ...pending.current }; setSaveState('dirty'); return false; }
    setSaveState(Object.keys(pending.current).length ? 'dirty' : 'saved');
    return true;
  }
  useEffect(() => () => { flush(); }, []);           // save when switching notes
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (Object.keys(pending.current).length) { e.preventDefault(); flush(); } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const html = useMemo(() => DOMPurify.sanitize(marked.parse(n.body || '', { async: false }) as string), [n.body]);

  /* ---------- toolbar ---------- */
  function wrap(before: string, after = before, placeholder = '') {
    const el = ta.current!; const { selectionStart: s, selectionEnd: e, value } = el;
    const sel = value.slice(s, e) || placeholder;
    const body = value.slice(0, s) + before + sel + after + value.slice(e);
    edit({ body });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  }
  function linePrefix(prefix: string) {
    const el = ta.current!; const { selectionStart: s, value } = el;
    const start = value.lastIndexOf('\n', s - 1) + 1;
    edit({ body: value.slice(0, start) + prefix + value.slice(start) });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + prefix.length, s + prefix.length); });
  }
  function insertAtCursor(text: string) {
    const el = ta.current!; const { selectionStart: s, selectionEnd: e, value } = el;
    edit({ body: value.slice(0, s) + text + value.slice(e) });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + text.length, s + text.length); });
  }

  /* ---------- images: paste, drop or pick a file -> Supabase Storage -> Markdown ---------- */
  async function upload(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setUploading(true);
    for (const f of images) {
      if (f.size > 8 * 1024 * 1024) { toast(`${f.name} 太大了(上限 8MB)`); continue; }
      const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
      const path = `notes/${note.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from('studio').upload(path, f, { contentType: f.type, cacheControl: '31536000' });
      if (error) { toast(errText(error)); continue; }
      const { data } = sb.storage.from('studio').getPublicUrl(path);
      insertAtCursor(`\n![${f.name.replace(/\.[^.]+$/, '')}](${data.publicUrl})\n`);
    }
    setUploading(false);
  }
  const onPaste = (e: ClipboardEvent) => {
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.some((f) => f.type.startsWith('image/'))) { e.preventDefault(); upload(files); }
  };
  const onDrop = (e: DragEvent) => {
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length) { e.preventDefault(); upload(files); }
  };

  /* ---------- publishing ---------- */
  async function publish() {
    const slug = n.slug || slugify(n.title);
    const missing = [!n.title.trim() && '标题', !slug && 'URL 名称(英文)', !n.summary.trim() && '摘要'].filter(Boolean);
    if (missing.length) return toast(`发布前还需要填写:${missing.join('、')}`);
    pending.current = { ...pending.current, slug, status: 'published', published_at: n.published_at ?? new Date().toISOString() };
    setN((x) => ({ ...x, ...pending.current })); onChange({ ...n, ...pending.current } as Note);
    const ok = await flush();
    if (ok) toast('已发布,刷新博客页就能看到');
  }
  async function unpublish() {
    edit({ status: 'private' });
    await flush();
  }
  async function remove() {
    if (!confirm(`删除这篇笔记${n.status === 'published' ? '(它会从博客上消失)' : ''}?`)) return;
    pending.current = {};
    const { error } = await sb.from('notes').delete().eq('id', note.id);
    if (error) return toast(errText(error));
    onDelete();
  }

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div class="st-editor">
      <div class="st-editor-head">
        <input class="st-note-title" placeholder="标题" value={n.title} onInput={(e) => edit({ title: (e.target as HTMLInputElement).value })} />
        <span class={`st-save ${saveState}`}>{saveState === 'saved' ? '已保存' : saveState === 'saving' ? '保存中…' : '未保存'}</span>
      </div>

      <div class="st-toolbar" role="toolbar">
        <button title="标题" onClick={() => linePrefix('## ')}>H2</button>
        <button title="小标题" onClick={() => linePrefix('### ')}>H3</button>
        <button title="加粗" onClick={() => wrap('**', '**', '加粗')}><b>B</b></button>
        <button title="斜体" onClick={() => wrap('*', '*', '斜体')}><i>I</i></button>
        <button title="链接" onClick={() => wrap('[', '](https://)', '链接文字')}>🔗</button>
        <button title="行内代码" onClick={() => wrap('`', '`', 'code')}>{'</>'}</button>
        <button title="代码块" onClick={() => wrap('\n```js\n', '\n```\n', '// code')}>{'{ }'}</button>
        <button title="引用" onClick={() => linePrefix('> ')}>❝</button>
        <button title="列表" onClick={() => linePrefix('- ')}>•</button>
        <label class="st-upload" title="插入图片(也可以直接粘贴或拖进来)">
          {uploading ? '上传中…' : '🖼 图片'}
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { upload([...((e.target as HTMLInputElement).files ?? [])]); (e.target as HTMLInputElement).value = ''; }} />
        </label>
        <span class="st-spacer" />
        <div class="st-seg">
          {(['write', 'split', 'preview'] as const).map((v) => <button class={view === v ? 'on' : ''} onClick={() => setView(v)}>{{ write: '写', split: '分栏', preview: '预览' }[v]}</button>)}
        </div>
      </div>

      <div class={`st-panes ${view}`}>
        {view !== 'preview' && (
          <textarea ref={ta} class="st-body" placeholder="用 Markdown 写作。可以直接粘贴或拖入图片。" value={n.body}
            onInput={(e) => edit({ body: (e.target as HTMLTextAreaElement).value })} onPaste={onPaste} onDrop={onDrop}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); flush(); } }} />
        )}
        {view !== 'write' && <article class="st-preview prose" dangerouslySetInnerHTML={{ __html: html || '<p class="st-muted">预览会显示在这里</p>' }} />}
      </div>

      <div class="st-meta-panel">
        <div class="st-publish">
          <span class={`st-badge ${n.status}`}>{n.status === 'published' ? '已发布' : '私密笔记'}</span>
          {n.status === 'published' && n.slug && <a href={postUrl(n)} target="_blank" rel="noopener">在博客中查看 ↗</a>}
          <span class="st-spacer" />
          {n.status === 'published'
            ? <button class="st-btn" onClick={unpublish}>撤回为私密</button>
            : <button class="st-btn primary" onClick={publish}>发布到博客</button>}
        </div>

        <label>摘要<textarea class="st-input" rows={2} placeholder="一两句话,显示在博客列表里" value={n.summary} onInput={(e) => edit({ summary: (e.target as HTMLTextAreaElement).value })} /></label>
        <div class="st-row2">
          <label>语言
            <select class="st-input" value={n.lang} onChange={(e) => edit({ lang: (e.target as HTMLSelectElement).value as Note['lang'] })}>
              {LANGS.map((l) => <option value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label>URL 名称
            <input class="st-input" placeholder={slugify(n.title) || 'my-first-note'} value={n.slug ?? ''}
              onInput={(e) => edit({ slug: slugify((e.target as HTMLInputElement).value) || null })} />
          </label>
        </div>
        <label>标签<TagInput value={n.tags} onChange={(tags) => edit({ tags })} /></label>

        <fieldset class="st-links">
          <legend>关联到</legend>
          <details open={n.learning_ids.length > 0}>
            <summary>学习清单 {n.learning_ids.length > 0 && <b>{n.learning_ids.length}</b>}</summary>
            {learning.length === 0 && <p class="st-muted">学习清单是空的</p>}
            {learning.map((l) => <label class="st-check-row"><input type="checkbox" checked={n.learning_ids.includes(l.id)} onChange={() => edit({ learning_ids: toggle(n.learning_ids, l.id) })} />{l.title}</label>)}
          </details>
          <details open={n.projects.length > 0}>
            <summary>项目 {n.projects.length > 0 && <b>{n.projects.length}</b>}</summary>
            {projects.map((p) => <label class="st-check-row"><input type="checkbox" checked={n.projects.includes(p.slug)} onChange={() => edit({ projects: toggle(n.projects, p.slug) })} />{p.title}</label>)}
          </details>
          <details open={n.todo_ids.length > 0}>
            <summary>待办 {n.todo_ids.length > 0 && <b>{n.todo_ids.length}</b>}</summary>
            {todos.length === 0 && <p class="st-muted">还没有待办</p>}
            {todos.map((t) => <label class="st-check-row"><input type="checkbox" checked={n.todo_ids.includes(t.id)} onChange={() => edit({ todo_ids: toggle(n.todo_ids, t.id) })} />{t.title}{t.status === 'done' && ' ✓'}</label>)}
          </details>
        </fieldset>

        <button class="st-link danger" onClick={remove}>删除这篇笔记</button>
      </div>
    </div>
  );
}
