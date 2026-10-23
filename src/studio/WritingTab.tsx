import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { studioClient } from '../lib/supabase';
import type { Learning, Note, Todo } from '../lib/studio-types';
import { diagramSrc, parseDiagramSize, sizeDiagramImages } from '../lib/diagram';
import DiagramModal from './DiagramModal';
import MindMapModal from './MindMapModal';
import { TagInput, errText, slugify, useToast, type ProjectRef } from './shared';

const LANGS = [{ id: 'zh', label: '中文' }, { id: 'en', label: 'English' }, { id: 'ja', label: '日本語' }] as const;
const CODE_LANGS = ['js', 'ts', 'python', 'java', 'cpp', 'go', 'rust', 'sql', 'bash', 'json', 'html', 'css', 'glsl'];
const postUrl = (n: Note) => `${n.lang === 'en' ? '' : `/${n.lang}`}/blog/${n.slug}/`;

/** remembered UI choices (per browser) */
function pref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => { try { return (localStorage.getItem(`studio-${key}`) as T) || fallback; } catch { return fallback; } });
  return [v, (x: T) => { setV(x); try { localStorage.setItem(`studio-${key}`, x); } catch {} }];
}

export default function WritingTab({ projects }: { projects: ProjectRef[] }) {
  const sb = studioClient();
  const toast = useToast();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [learning, setLearning] = useState<Pick<Learning, 'id' | 'title' | 'status' | 'url'>[]>([]);
  const [todos, setTodos] = useState<Pick<Todo, 'id' | 'title' | 'status'>[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [listOpen, setListOpen] = pref<'1' | '0'>('notes-list', '1');

  async function load() {
    const [n, l, t] = await Promise.all([
      sb.from('notes').select('*').order('updated_at', { ascending: false }),
      sb.from('learning').select('id,title,status,url').order('title'),
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
    <section class={`st-writing ${listOpen === '1' ? '' : 'list-closed'}`}>
      {listOpen === '1' && (
        <aside class="st-notes">
          <div class="st-notes-head">
            <button class="st-btn primary grow" onClick={create}>+ 新建笔记</button>
            <button class="st-icon" title="收起笔记列表" onClick={() => setListOpen('0')}>«</button>
          </div>
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
      )}

      {note ? (
        <Editor key={note.id} note={note} learning={learning} todos={todos} projects={projects}
          listOpen={listOpen === '1'} onOpenList={() => setListOpen('1')} onCreate={create}
          onChange={(n) => setNotes((xs) => xs!.map((x) => (x.id === n.id ? n : x)))}
          onDelete={() => { setNotes((xs) => xs!.filter((x) => x.id !== note.id)); setCurrent(null); }}
          toast={toast.show} />
      ) : (
        notes !== null && (
          <div class="st-editor-empty st-muted">
            {listOpen !== '1' && <button class="st-btn" onClick={() => setListOpen('1')}>» 打开笔记列表</button>}
            <p>选择一篇笔记,或者 <button class="st-link" onClick={create}>新建一篇</button>。</p>
          </div>
        )
      )}
      {toast.node}
    </section>
  );
}

function Editor({ note, learning, todos, projects, listOpen, onOpenList, onCreate, onChange, onDelete, toast }: {
  note: Note;
  learning: Pick<Learning, 'id' | 'title' | 'status' | 'url'>[];
  todos: Pick<Todo, 'id' | 'title' | 'status'>[];
  projects: ProjectRef[];
  listOpen: boolean;
  onOpenList: () => void;
  onCreate: () => void;
  onChange: (n: Note) => void;
  onDelete: () => void;
  toast: (m: string) => void;
}) {
  const sb = studioClient();
  const [n, setN] = useState<Note>(note);
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving'>('saved');
  const [view, setView] = pref<'write' | 'split' | 'preview'>('editor-view', typeof window !== 'undefined' && window.innerWidth > 1000 ? 'split' : 'write');
  const [metaOpen, setMetaOpen] = pref<'1' | '0'>('editor-meta', typeof window !== 'undefined' && window.innerWidth > 1400 ? '1' : '0');
  const [focus, setFocus] = useState(false);
  const [menu, setMenu] = useState<'' | 'insert' | 'code' | 'learning' | 'project'>('');
  const [uploading, setUploading] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const pv = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pending = useRef<Partial<Note>>({});
  const timer = useRef<number>();

  /* ---------- autosave: batch edits, write 1.2s after the last change ---------- */
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

  /* ---------- focus mode: only the editor, Esc to leave ---------- */
  useEffect(() => {
    document.documentElement.classList.toggle('st-focus', focus);
    if (!focus) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !menu) setFocus(false); };
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('keydown', esc); document.documentElement.classList.remove('st-focus'); };
  }, [focus, menu]);
  useEffect(() => {                                  // close menus on outside click
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.st-menu-wrap')) setMenu(''); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const html = useMemo(() => sizeDiagramImages(DOMPurify.sanitize(marked.parse(n.body || '', { async: false, gfm: true, breaks: false }) as string)
    // a diagram that has been inserted but not drawn yet is shown as a click-to-edit box
    .replace(/<img[^>]*src="#diagram-([a-z0-9]+)"[^>]*>/g, '<div class="st-diagram-ph" data-diagram="$1">◈ 图表 · 点击这里开始绘制</div>')
    .replace(/<img[^>]*src="#mindmap-([a-z0-9]+)"[^>]*>/g, '<div class="st-diagram-ph" data-kind="mindmap" data-diagram="$1">✺ 思维导图 · 点击这里开始绘制</div>')), [n.body]);
  const stats = useMemo(() => {
    const cjk = (n.body.match(/[぀-ヿ㐀-鿿]/g) || []).length;
    const words = n.body.replace(/[぀-ヿ㐀-鿿]/g, ' ').replace(/[#*_`>\-\[\]()!|]/g, ' ').split(/\s+/).filter(Boolean).length;
    return { count: cjk + words, minutes: Math.max(1, Math.round(cjk / 400 + words / 220)) };
  }, [n.body]);

  /* ---------- text editing helpers (keep the textarea's undo-friendly selection) ---------- */
  function replaceRange(start: number, end: number, text: string, selStart?: number, selEnd?: number) {
    const el = ta.current!;
    const body = el.value.slice(0, start) + text + el.value.slice(end);
    edit({ body });
    requestAnimationFrame(() => {
      el.focus();
      const a = selStart ?? start + text.length;
      el.setSelectionRange(a, selEnd ?? a);
    });
  }
  function wrap(before: string, after = before, placeholder = '') {
    const el = ta.current!; const { selectionStart: s, selectionEnd: e, value } = el;
    const sel = value.slice(s, e) || placeholder;
    replaceRange(s, e, before + sel + after, s + before.length, s + before.length + sel.length);
  }
  /** add (or toggle off) a prefix on every selected line */
  function linePrefix(prefix: string | ((i: number) => string)) {
    const el = ta.current!; const { selectionStart: s, selectionEnd: e, value } = el;
    const start = value.lastIndexOf('\n', s - 1) + 1;
    const endNl = value.indexOf('\n', e); const end = endNl === -1 ? value.length : endNl;
    const lines = value.slice(start, end).split('\n');
    const first = typeof prefix === 'string' ? prefix : prefix(0);
    const allHave = typeof prefix === 'string' && lines.every((l) => l.startsWith(prefix));
    const out = lines.map((l, i) => {
      const p = typeof prefix === 'string' ? prefix : prefix(i);
      if (allHave) return l.slice(p.length);
      return p + l.replace(/^(#{1,6} |> |[-*+] \[[ xX]\] |[-*+] |\d+\. )/, '');
    }).join('\n');
    replaceRange(start, end, out, start + (allHave ? 0 : first.length), start + out.length);
  }
  function insertBlock(text: string, cursorOffset?: number) {
    const el = ta.current!; const { selectionStart: s, selectionEnd: e, value } = el;
    const pre = s > 0 && value[s - 1] !== '\n' ? '\n\n' : s > 1 && value[s - 2] !== '\n' ? '\n' : '';
    const post = value[e] && value[e] !== '\n' ? '\n\n' : '\n';
    const block = pre + text + post;
    const caret = s + pre.length + (cursorOffset ?? text.length);
    replaceRange(s, e, block, caret, caret);
    setMenu('');
  }

  /* ---------- Markdown keyboard behaviour ---------- */
  function onKeyDown(e: KeyboardEvent) {
    const el = ta.current!;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 's') { e.preventDefault(); flush(); return; }
    if (mod && e.key === 'b') { e.preventDefault(); wrap('**', '**', '加粗'); return; }
    if (mod && e.key === 'i') { e.preventDefault(); wrap('*', '*', '斜体'); return; }
    if (mod && e.key === 'k') { e.preventDefault(); wrap('[', '](https://)', '链接文字'); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: end, value } = el;
      if (s === end && !e.shiftKey) { replaceRange(s, s, '  '); return; }
      const start = value.lastIndexOf('\n', s - 1) + 1;
      const lines = value.slice(start, end).split('\n');
      const out = lines.map((l) => (e.shiftKey ? l.replace(/^ {1,2}/, '') : '  ' + l)).join('\n');
      replaceRange(start, end, out, start, start + out.length);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !mod && !e.isComposing) {
      // continue lists / quotes / task lists; an empty item ends the list
      const { selectionStart: s, value } = el;
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const line = value.slice(lineStart, s);
      const m = line.match(/^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)\. |> )/);
      if (!m) return;
      e.preventDefault();
      if (line.trim() === m[2].trim()) { replaceRange(lineStart, s, ''); return; }
      let marker = m[2];
      if (m[3]) marker = `${+m[3] + 1}. `;
      if (/\[[xX]\]/.test(marker)) marker = marker.replace(/\[[xX]\]/, '[ ]');
      replaceRange(s, el.selectionEnd, '\n' + m[1] + marker);
    }
  }

  /* ---------- images: paste, drop or pick -> Supabase Storage -> Markdown ---------- */
  // Swap a placeholder for its final text without touching the user's caret (they may be typing elsewhere by now).
  function swapText(from: string, to: string) {
    const el = ta.current;
    if (!el) return;
    const i = el.value.indexOf(from);
    if (i < 0) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const d = to.length - from.length;
    const shift = (x: number) => (x >= i + from.length ? x + d : x > i ? i + to.length : x);
    edit({ body: el.value.slice(0, i) + to + el.value.slice(i + from.length) });
    if (document.activeElement === el) requestAnimationFrame(() => el.setSelectionRange(shift(s), shift(e)));
  }
  async function uploadFile(f: File): Promise<string | null> {
    const ext = f.name.endsWith('.drawio.svg') ? 'drawio.svg' : f.name.endsWith('.mindmap.svg') ? 'mindmap.svg' : (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
    const path = `notes/${note.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from('studio').upload(path, f, { contentType: f.type, cacheControl: '31536000' });
    if (error) { toast(errText(error)); return null; }
    return sb.storage.from('studio').getPublicUrl(path).data.publicUrl;
  }
  async function upload(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setUploading(true);
    // Drop placeholders at the paste point right away, so edits made while uploading can't shift where the images land.
    const jobs = images.map((f) => ({ f, ph: `![上传中 ${Math.random().toString(36).slice(2, 8)}…]()` }));
    insertBlock(jobs.map((j) => j.ph).join('\n\n'));
    for (const { f, ph } of jobs) {
      if (f.size > 8 * 1024 * 1024) { toast(`${f.name} 太大了(上限 8MB)`); swapText(ph, ''); continue; }
      const url = await uploadFile(f);
      swapText(ph, url ? `![${f.name.replace(/(\.drawio|\.mindmap)?\.[^.]+$/, '')}](${url})` : '');
    }
    setUploading(false);
  }

  /* ---------- diagrams: draw.io (.drawio.svg) and mind maps (.mindmap.svg) are saved as SVG images that carry their
     own source; click one in the preview to edit it again. A not-yet-drawn one is a `#diagram-xxx` / `#mindmap-xxx` placeholder. ---------- */
  /* selected diagram image: corner handles scale it (same shape), "裁剪" cuts it with the edge handles, 编辑 reopens the editor */
  const [sel, setSel] = useState<{ src: string; kind: 'drawio' | 'mindmap' } | null>(null);
  const [rect, setRect] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
  const dragging = useRef(false);
  const findImg = (src: string) => [...(pv.current?.querySelectorAll('img') ?? [])].find((i) => i.getAttribute('src') === src) as HTMLImageElement | undefined;
  /** the visible box: the clipping wrapper of a cropped image, else the image itself */
  const boxOf = (img: HTMLImageElement) => (img.closest('.dg-crop') as HTMLElement | null) ?? img;
  function measure() {
    const img = sel && findImg(sel.src), view = pv.current?.getBoundingClientRect();
    if (!img || !view) return setRect(null);
    const r = boxOf(img).getBoundingClientRect();
    if (r.bottom < view.top || r.top > view.bottom) return setRect(null); // scrolled out of the preview
    setRect({ l: r.left, t: r.top, w: r.width, h: r.height });
  }
  useLayoutEffect(() => { measure(); const id = requestAnimationFrame(measure); return () => cancelAnimationFrame(id); }, [sel, html, view]);
  useEffect(() => {
    if (!sel) return;
    const on = () => { if (!dragging.current) measure(); };
    const down = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!t.closest?.('.st-img-sel') && t.tagName !== 'IMG') setSel(null); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setSel(null);
    window.addEventListener('resize', on); pv.current?.addEventListener('scroll', on);
    document.addEventListener('mousedown', down); document.addEventListener('keydown', esc);
    return () => { window.removeEventListener('resize', on); pv.current?.removeEventListener('scroll', on); document.removeEventListener('mousedown', down); document.removeEventListener('keydown', esc); };
  }, [sel]);
  const [diagram, setDiagram] = useState<{ kind: 'drawio' | 'mindmap'; data: string; oldUrl?: string } | null>(null);
  async function saveDiagram(svg: Blob, kind: 'drawio' | 'mindmap', oldUrl?: string) {
    const file = new File([svg], kind === 'drawio' ? '图表.drawio.svg' : '导图.mindmap.svg', { type: 'image/svg+xml' });
    if (!oldUrl) return upload([file]);
    setUploading(true);
    const url = await uploadFile(file);
    setUploading(false);
    const size = oldUrl.startsWith('#') ? '' : (oldUrl.match(/#w=\d+/)?.[0] ?? ''); // keep the chosen width (a crop would no longer fit the redrawn picture)
    if (url) edit({ body: (ta.current?.value ?? n.body).split(oldUrl).join(url + size) });
  }
  function addDiagram(kind: 'drawio' | 'mindmap') {
    setMenu('');
    if (view !== 'split') setView('split');
    const id = Math.random().toString(36).slice(2, 8);
    setTimeout(() => ta.current && insertBlock(kind === 'drawio' ? `![图表](#diagram-${id})` : `![导图](#mindmap-${id})`), 50);
  }
  async function onPreviewClick(e: MouseEvent) {
    const ph = (e.target as HTMLElement).closest?.('.st-diagram-ph') as HTMLElement | null;
    if (ph) {
      const id = ph.dataset.diagram!;
      return setDiagram(ph.dataset.kind === 'mindmap' ? { kind: 'mindmap', data: '', oldUrl: `#mindmap-${id}` } : { kind: 'drawio', data: '', oldUrl: `#diagram-${id}` });
    }
    const img = e.target as HTMLImageElement;
    if (img.tagName !== 'IMG') return;
    const src = img.getAttribute('src') ?? '';
    const kind = src.includes('.drawio.svg') ? 'drawio' : src.includes('.mindmap.svg') ? 'mindmap' : null;
    if (kind) setSel({ src, kind });
  }
  async function editImage(m: { src: string; kind: 'drawio' | 'mindmap' }) {
    setSel(null);
    try {
      const res = await fetch(m.src);
      if (m.kind === 'mindmap') {
        const b64 = (await res.text()).match(/<metadata id="mindmap-data">([^<]*)<\/metadata>/)?.[1];
        return setDiagram({ kind: 'mindmap', data: b64 ? decodeURIComponent(escape(atob(b64))) : '', oldUrl: m.src });
      }
      const blob = await res.blob();
      const data = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.readAsDataURL(blob); });
      setDiagram({ kind: 'drawio', data, oldUrl: m.src });
    } catch { toast('读取图表失败'); }
  }
  /** commit a new size/crop: it lives in the image URL, so it survives re-editing and renders on the blog */
  function setSize(src: string, next: string) {
    setSel((m) => m && { ...m, src: next });
    edit({ body: (ta.current?.value ?? n.body).split(src).join(next) });
  }
  const columnWidth = (img: HTMLImageElement) => (boxOf(img).parentElement ?? img).getBoundingClientRect().width;
  /** corner handles: scale, keeping the shape. The image is centred, so both edges move. */
  function startResize(e: MouseEvent, sx: -1 | 0 | 1, sy: -1 | 0 | 1) {
    e.preventDefault(); e.stopPropagation();
    const img = sel && findImg(sel.src);
    if (!sel || !img) return;
    const box = boxOf(img), src = sel.src, parentW = columnWidth(img), r0 = box.getBoundingClientRect(), startW = r0.width, startH = r0.height, x0 = e.clientX, y0 = e.clientY;
    let w = startW;
    dragging.current = true; document.body.classList.add('st-resizing');
    const move = (ev: MouseEvent) => {
      // top / bottom edges: the height decides; otherwise the horizontal drag does. The shape is always kept.
      const target = sx === 0 ? (startW * (startH + sy * (ev.clientY - y0))) / startH : startW + 2 * sx * (ev.clientX - x0);
      w = Math.max(60, Math.min(parentW, target)); box.style.width = `${w}px`; measure();
    };
    const up = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      dragging.current = false; document.body.classList.remove('st-resizing');
      const old = parseDiagramSize(src);
      setSize(src, diagramSrc(src, Math.max(5, Math.min(100, Math.round((w / parentW) * 100))), old?.c, old?.n));
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }
  /**
   * Edge handles crop: the edge follows the mouse and the picture keeps its scale, so only the visible part changes.
   * While dragging, the box is nudged (margin / translate) so the dragged edge stays under the cursor; the real
   * layout (centred, flowing with the text) is applied when the mouse is released.
   */
  function startEdgeCrop(e: MouseEvent, hx: -1 | 0 | 1, hy: -1 | 0 | 1) {
    e.preventDefault(); e.stopPropagation();
    const img = sel && findImg(sel.src);
    if (!sel || !img) return;
    const src = sel.src, old = parseDiagramSize(src), c0 = old?.c ?? [0, 0, 0, 0];
    const N = old?.n ?? img.naturalWidth / (img.naturalHeight || 1), parentW = columnWidth(img);
    const fullW = boxOf(img).getBoundingClientRect().width / (1 - c0[1] - c0[3]), fullH = fullW / N;
    let box = boxOf(img);
    if (!box.classList.contains('dg-crop')) { // wrap an uncropped picture so it can be clipped live
      const w = document.createElement('span'); w.className = 'dg-crop';
      img.parentElement!.insertBefore(w, img); w.appendChild(img); box = w;
    }
    let [t, r, b, l] = c0;
    const x0 = e.clientX, y0 = e.clientY, MIN = 0.08, clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
    dragging.current = true; document.body.classList.add('st-resizing');
    const paint = () => {
      const vw = 1 - l - r, vh = 1 - t - b;
      box.style.width = `${fullW * vw}px`; box.style.aspectRatio = String((vw / vh) * N);
      box.style.marginTop = `calc(1.4em + ${t * fullH}px)`; box.style.transform = `translateX(${((l - r) * fullW) / 2}px)`;
      Object.assign(img.style, { width: `${100 / vw}%`, left: `${(-l / vw) * 100}%`, top: `${(-t / vh) * 100}%` });
      measure();
    };
    paint(); // lay the (possibly just wrapped) box out in its current state before the first move
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - x0) / fullW, dy = (ev.clientY - y0) / fullH;
      if (hx === -1) l = clamp(c0[3] + dx, 1 - r - MIN);
      if (hx === 1) r = clamp(c0[1] - dx, 1 - l - MIN);
      if (hy === -1) t = clamp(c0[0] + dy, 1 - b - MIN);
      if (hy === 1) b = clamp(c0[2] - dy, 1 - t - MIN);
      paint();
    };
    const up = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      dragging.current = false; document.body.classList.remove('st-resizing');
      const cut = t + r + b + l > 0.002;
      const pct = Math.max(5, Math.min(100, Math.round(((fullW * (1 - l - r)) / parentW) * 100)));
      const next = diagramSrc(src, pct, cut ? [t, r, b, l] : null, cut ? N : null);
      if (next !== src) setSize(src, next);
      else if (pv.current) pv.current.innerHTML = html; // nothing changed: drop the temporary live styles
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }
  const onPaste = (e: ClipboardEvent) => {
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.some((f) => f.type.startsWith('image/'))) { e.preventDefault(); upload(files); }
  };
  const onDrop = (e: DragEvent) => {
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length) { e.preventDefault(); upload(files); }
  };

  /* ---------- split view: keep the preview at the same relative scroll position ---------- */
  const lastTyped = useRef(0);
  function syncScroll() {
    const a = ta.current, b = pv.current;
    if (!a || !b || view !== 'split') return;
    if (Date.now() - lastTyped.current < 400) return; // scroll caused by typing, not by the user dragging
    const r = a.scrollTop / Math.max(1, a.scrollHeight - a.clientHeight);
    b.scrollTop = r * (b.scrollHeight - b.clientHeight);
  }

  // The preview HTML is replaced on every keystroke; keep its scroll position instead of letting it clamp/jump.
  const pvTop = useRef(0);
  useLayoutEffect(() => { if (pv.current) pv.current.scrollTop = pvTop.current; }, [html]);

  /* ---------- publishing ---------- */
  async function publish() {
    const slug = n.slug || slugify(n.title);
    const missing = [!n.title.trim() && '标题', !slug && 'URL 名称(英文)', !n.summary.trim() && '摘要'].filter(Boolean);
    if (missing.length) { setMetaOpen('1'); return toast(`发布前还需要填写:${missing.join('、')}`); }
    pending.current = { ...pending.current, slug, status: 'published', published_at: n.published_at ?? new Date().toISOString() };
    setN((x) => ({ ...x, ...pending.current })); onChange({ ...n, ...pending.current } as Note);
    if (await flush()) toast('已发布,刷新博客页就能看到');
  }
  async function unpublish() { edit({ status: 'private' }); await flush(); }
  async function remove() {
    if (!confirm(`删除这篇笔记${n.status === 'published' ? '(它会从博客上消失)' : ''}?`)) return;
    pending.current = {};
    const { error } = await sb.from('notes').delete().eq('id', note.id);
    if (error) return toast(errText(error));
    onDelete();
  }

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const T = (props: { t: string; k?: string; onClick: () => void; children: any }) => (
    <button type="button" title={props.k ? `${props.t}(${props.k})` : props.t} onMouseDown={(e) => e.preventDefault()} onClick={props.onClick}>{props.children}</button>
  );

  return (
    <div class={`st-editor ${metaOpen === '1' ? 'meta-open' : ''} ${focus ? 'focus' : ''}`}>
      <div class="st-editor-main">
        <div class="st-editor-head">
          {!listOpen && !focus && <button class="st-icon" title="打开笔记列表" onClick={onOpenList}>»</button>}
          <input class="st-note-title" placeholder="标题" value={n.title} onInput={(e) => edit({ title: (e.target as HTMLInputElement).value })} />
          <span class={`st-save ${saveState}`}>{saveState === 'saved' ? '已保存' : saveState === 'saving' ? '保存中…' : '未保存'}</span>
          {n.status === 'published'
            ? <button class="st-btn" onClick={unpublish}>撤回</button>
            : <button class="st-btn primary" onClick={publish}>发布</button>}
          <button class={`st-icon ${metaOpen === '1' ? 'on' : ''}`} title="文章设置:摘要、标签、关联" onClick={() => setMetaOpen(metaOpen === '1' ? '0' : '1')}>⚙</button>
          <button class={`st-icon ${focus ? 'on' : ''}`} title={focus ? '退出专注(Esc)' : '专注写作'} onClick={() => setFocus(!focus)}>{focus ? '⤡' : '⤢'}</button>
        </div>

        <div class="st-toolbar" role="toolbar" aria-label="Markdown">
          <div class="st-tool-group">
            <T t="一级标题" onClick={() => linePrefix('# ')}>H1</T>
            <T t="二级标题" onClick={() => linePrefix('## ')}>H2</T>
            <T t="三级标题" onClick={() => linePrefix('### ')}>H3</T>
          </div>
          <div class="st-tool-group">
            <T t="加粗" k="⌘B" onClick={() => wrap('**', '**', '加粗')}><b>B</b></T>
            <T t="斜体" k="⌘I" onClick={() => wrap('*', '*', '斜体')}><i>I</i></T>
            <T t="删除线" onClick={() => wrap('~~', '~~', '删除线')}><s>S</s></T>
            <T t="行内代码" onClick={() => wrap('`', '`', 'code')}>{'`·`'}</T>
            <T t="链接" k="⌘K" onClick={() => wrap('[', '](https://)', '链接文字')}>🔗</T>
          </div>
          <div class="st-tool-group">
            <T t="无序列表" onClick={() => linePrefix('- ')}>•</T>
            <T t="有序列表" onClick={() => linePrefix((i) => `${i + 1}. `)}>1.</T>
            <T t="任务列表" onClick={() => linePrefix('- [ ] ')}>☑</T>
            <T t="引用" onClick={() => linePrefix('> ')}>❝</T>
          </div>
          <div class="st-tool-group">
            <T t="插入图片(也可以直接粘贴或拖进来)" onClick={() => fileInput.current?.click()}>{uploading ? '上传中…' : '🖼'}</T>
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { upload([...((e.target as HTMLInputElement).files ?? [])]); (e.target as HTMLInputElement).value = ''; }} />
            <div class="st-menu-wrap">
              <button type="button" class={menu ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => setMenu(menu ? '' : 'insert')}>插入 ▾</button>
              {menu === 'insert' && (
                <div class="st-menu" role="menu">
                  <button onClick={() => addDiagram('mindmap')}>✺ 思维导图</button>
                  <button onClick={() => addDiagram('drawio')}>◈ 流程图 / 架构图…</button>
                  <button onClick={() => insertBlock('| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |', 2)}>▦ 表格</button>
                  <button onClick={() => setMenu('code')}>{'{ }'} 代码块 ›</button>
                  <button onClick={() => insertBlock('---')}>— 分割线</button>
                  <button onClick={() => insertBlock('- [ ] ', 6)}>☑ 任务列表</button>
                  <button onClick={() => insertBlock('> **提示**:')}>💡 提示框</button>
                  <button onClick={() => { const t = '<details>\n<summary>点击展开</summary>\n\n内容\n\n</details>'; insertBlock(t, t.indexOf('内容')); }}>▸ 折叠内容</button>
                  <button onClick={() => setMenu('learning')}>⌥ 学习清单条目 ›</button>
                  <button onClick={() => setMenu('project')}>◇ 项目 ›</button>
                </div>
              )}
              {menu === 'code' && (
                <div class="st-menu grid" role="menu">
                  {CODE_LANGS.map((l) => <button onClick={() => insertBlock('```' + l + '\n\n```', l.length + 4)}>{l}</button>)}
                </div>
              )}
              {menu === 'learning' && (
                <div class="st-menu" role="menu">
                  {learning.length === 0 && <p class="st-muted">学习清单是空的</p>}
                  {learning.map((l) => (
                    <button onClick={() => {
                      // link the item in the text, and also record the relation
                      wrap(`[`, `](${l.url ?? `/learning/${l.id}/`})`, l.title);
                      if (!n.learning_ids.includes(l.id)) edit({ learning_ids: [...n.learning_ids, l.id] });
                      setMenu('');
                    }}>{l.title}</button>
                  ))}
                </div>
              )}
              {menu === 'project' && (
                <div class="st-menu" role="menu">
                  {projects.map((p) => (
                    <button onClick={() => {
                      wrap(`[`, `](/projects/${p.slug}/)`, p.title);
                      if (!n.projects.includes(p.slug)) edit({ projects: [...n.projects, p.slug] });
                      setMenu('');
                    }}>{p.title}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <span class="st-spacer" />
          <div class="st-seg" role="group" aria-label="视图">
            {(['write', 'split', 'preview'] as const).map((v) => <button class={view === v ? 'on' : ''} onClick={() => setView(v)}>{{ write: '编辑', split: '分栏', preview: '预览' }[v]}</button>)}
          </div>
        </div>

        <div class={`st-panes ${view}`}>
          {view !== 'preview' && (
            <textarea ref={ta} class="st-body" spellcheck={false}
              placeholder={'用 Markdown 写作…\n\n# 标题\n**加粗**  *斜体*  `代码`\n- 列表(回车自动续写)\n> 引用\n\n可以直接粘贴或拖入图片。'}
              value={n.body}
              onInput={(e) => { lastTyped.current = Date.now(); edit({ body: (e.target as HTMLTextAreaElement).value }); }}
              onKeyDown={onKeyDown} onPaste={onPaste} onDrop={onDrop} onScroll={syncScroll} />
          )}
          {view !== 'write' && (
            <article ref={pv} class="st-preview prose" onClick={onPreviewClick} onScroll={(e) => { pvTop.current = (e.currentTarget as HTMLElement).scrollTop; }} dangerouslySetInnerHTML={{ __html: html || '<p class="st-muted">预览会显示在这里</p>' }} />
          )}
        </div>

        <div class="st-status">
          <span>{stats.count} 字 · 约 {stats.minutes} 分钟</span>
          <span class="st-muted">Markdown · 回车续写列表 · Tab 缩进 · ⌘S 保存{focus ? ' · Esc 退出专注' : ''}</span>
        </div>
      </div>

      {metaOpen === '1' && (
        <aside class="st-meta-panel">
          <div class="st-publish">
            <span class={`st-badge ${n.status}`}>{n.status === 'published' ? '已发布' : '私密笔记'}</span>
            {n.status === 'published' && n.slug && <a href={postUrl(n)} target="_blank" rel="noopener">在博客中查看 ↗</a>}
            <span class="st-spacer" />
            <button class="st-icon" title="收起" onClick={() => setMetaOpen('0')}>×</button>
          </div>

          <label>摘要<textarea class="st-input" rows={3} placeholder="一两句话,显示在博客列表里" value={n.summary} onInput={(e) => edit({ summary: (e.target as HTMLTextAreaElement).value })} /></label>
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

          <div class="st-meta-foot">
            <button class="st-link" onClick={onCreate}>+ 新建另一篇</button>
            <button class="st-link danger" onClick={remove}>删除这篇笔记</button>
          </div>
        </aside>
      )}
      {sel && rect && (
        <div class="st-img-sel" style={{ left: rect.l, top: rect.t, width: rect.w, height: rect.h }}>
          <div class="bar" style={rect.t < 52 ? { top: 8, right: 8 } : undefined}>
            <button class="st-btn primary" onClick={() => editImage(sel)}>编辑</button>
          </div>
          {/* corners scale (same shape); edges crop that side */}
          {([['nw', -1, -1], ['ne', 1, -1], ['sw', -1, 1], ['se', 1, 1]] as const).map(([c, sx, sy]) => <div class={`h ${c}`} onMouseDown={(e) => startResize(e, sx, sy)} />)}
          {([['n', 0, -1], ['w', -1, 0], ['e', 1, 0], ['s', 0, 1]] as const).map(([c, hx, hy]) => <div class={`h ${c}`} onMouseDown={(e) => startEdgeCrop(e, hx, hy)} />)}
        </div>
      )}
      {diagram?.kind === 'drawio' && <DiagramModal xml={diagram.data} onSave={(svg) => saveDiagram(svg, 'drawio', diagram.oldUrl)} onClose={() => setDiagram(null)} />}
      {diagram?.kind === 'mindmap' && <MindMapModal data={diagram.data} onSave={(svg) => saveDiagram(svg, 'mindmap', diagram.oldUrl)} onClose={() => setDiagram(null)} />}
    </div>
  );
}
