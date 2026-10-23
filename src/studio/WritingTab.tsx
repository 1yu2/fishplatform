import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Editor as TipEditor } from '@tiptap/core';
import { studioClient } from '../lib/supabase';
import type { Learning, Note, Todo } from '../lib/studio-types';
import { diagramSrc, parseDiagramSize } from '../lib/diagram';
import { editorExtensions } from './tiptap';
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

function AlignIcon({ k }: { k: 'left' | 'center' | 'right' }) {
  const w = [12, 8, 12, 6], x = (n: number) => (k === 'left' ? 2 : k === 'right' ? 14 - n : (16 - n) / 2);
  return <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">{w.map((n, i) => <rect x={x(n)} y={2.5 + i * 3.4} width={n} height="1.6" rx=".8" fill="currentColor" />)}</svg>;
}

function TableAlignIcon({ k }: { k: 'left' | 'center' | 'right' }) {
  const x = k === 'left' ? 2 : k === 'right' ? 8 : 5;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.5 2v12M14.5 2v12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".45" />
      <rect x={x} y="4" width="6" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" />
      <path d={`M${x} 8h6`} stroke="currentColor" stroke-width="1.2" />
    </svg>
  );
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

const markdownOf = (e: TipEditor) => ((e.storage as any).markdown.getMarkdown() as string).replace(/\n+$/, '');

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
  const [metaOpen, setMetaOpen] = pref<'1' | '0'>('editor-meta', typeof window !== 'undefined' && window.innerWidth > 1400 ? '1' : '0');
  const [outlineOpen, setOutlineOpen] = pref<'1' | '0'>('editor-outline', '0');
  const [focus, setFocus] = useState(false);
  const [menu, setMenu] = useState<'' | 'insert' | 'code' | 'learning' | 'project'>('');
  const [uploading, setUploading] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const ed = useRef<TipEditor | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pending = useRef<Partial<Note>>({});
  const timer = useRef<number>();
  const [saveTick, setSaveTick] = useState(0); // bumped on every editor transaction: re-render toolbar state, re-measure the image frame

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

  const stats = useMemo(() => {
    const cjk = (n.body.match(/[぀-ヿ㐀-鿿]/g) || []).length;
    const words = n.body.replace(/[぀-ヿ㐀-鿿]/g, ' ').replace(/[#*_`>\-\[\]()!|]/g, ' ').split(/\s+/).filter(Boolean).length;
    return { count: cjk + words, minutes: Math.max(1, Math.round(cjk / 400 + words / 220)) };
  }, [n.body]);

  /* ---------- the editor: WYSIWYG on top of Markdown (the note is still stored as a Markdown string) ---------- */
  const latest = useRef<{ edit: (p: Partial<Note>) => void; flush: () => Promise<boolean>; upload: (f: File[]) => void }>({ edit, flush, upload: () => {} });
  latest.current.edit = edit; latest.current.flush = flush;
  useEffect(() => {
    const editor = new TipEditor({
      element: host.current!,
      extensions: editorExtensions('开始写作…  直接输入就是排好版的文章,粘贴或拖入图片会自动上传'),
      content: note.body,
      editorProps: {
        attributes: { class: 'st-doc-content prose', spellcheck: 'false' },
        handlePaste: (_v, e) => {
          const files = [...(e.clipboardData?.files ?? [])];
          if (!files.some((f) => f.type.startsWith('image/'))) return false;
          e.preventDefault(); latest.current.upload(files); return true;
        },
        handleDrop: (_v, e) => {
          const files = [...(e.dataTransfer?.files ?? [])];
          if (!files.length) return false;
          e.preventDefault(); latest.current.upload(files); return true;
        },
        handleKeyDown: (_v, e) => {
          const mod = e.metaKey || e.ctrlKey;
          if (mod && e.key === 's') { e.preventDefault(); latest.current.flush(); return true; }
          if (mod && e.key === 'k') { e.preventDefault(); promptLink(); return true; }
          return false;
        },
      },
      onUpdate: ({ editor: e }) => latest.current.edit({ body: markdownOf(e) }),
      onTransaction: () => setSaveTick((x) => x + 1),
    });
    ed.current = editor;
    // a placeholder box, or one of our diagram images, was clicked
    const onClick = (e: MouseEvent) => {
      const ph = (e.target as HTMLElement).closest?.('.st-diagram-ph:not(.uploading)') as HTMLElement | null;
      if (ph) {
        const id = ph.dataset.diagram!;
        return setDiagram(ph.dataset.kind === 'mindmap' ? { kind: 'mindmap', data: '', oldUrl: `#mindmap-${id}` } : { kind: 'drawio', data: '', oldUrl: `#diagram-${id}` });
      }
      const img = e.target as HTMLImageElement;
      if (img.tagName !== 'IMG') return;
      const src = img.getAttribute('src') ?? '';
      const kind = src.includes('.drawio.svg') ? 'drawio' : src.includes('.mindmap.svg') ? 'mindmap' : null;
      if (kind) setSel({ src, kind });
    };
    editor.view.dom.addEventListener('click', onClick);
    // the bottom border of a table row (away from the column borders) is a row-height handle
    const dom = editor.view.dom;
    const rowEdge = (e: MouseEvent) => {
      const cell = (e.target as HTMLElement).closest?.('td,th') as HTMLElement | null;
      if (!cell) return null;
      const r = cell.getBoundingClientRect();
      if (e.clientX - r.left <= 8 || r.right - e.clientX <= 8) return null; // that is a column border
      const row = cell.closest('tr') as HTMLElement | null;
      if (Math.abs(e.clientY - r.bottom) <= 4) return row;
      // the border between two rows is painted on the lower cell: the pointer may be on the top edge of the next row
      if (Math.abs(e.clientY - r.top) <= 4) return (row?.previousElementSibling as HTMLElement | null) ?? null;
      return null;
    };
    const hoverSoon = () => { clearTimeout(hoverTimer.current); hoverTimer.current = window.setTimeout(() => { hoverEl.current = null; setHover(null); }, 350); };
    const onMove = (e: MouseEvent) => {
      if (dragging.current) return;
      wrap.current?.classList.toggle('row-resize', !!rowEdge(e));
      const t = (e.target as HTMLElement).closest?.('table') as HTMLElement | null;
      if (!t) { if (hoverEl.current) hoverSoon(); return; }
      clearTimeout(hoverTimer.current);
      if (hoverEl.current !== t) { hoverEl.current = t; refreshHoverRef.current(); }
    };
    const onContext = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.('table')) return;
      e.preventDefault();
      const at = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (at) editor.chain().focus().setTextSelection(at.pos).run();
      setTableOpen(true);
    };
    dom.addEventListener('mouseleave', hoverSoon); dom.addEventListener('contextmenu', onContext);
    const onDown = (e: MouseEvent) => { const tr = rowEdge(e); if (tr) { e.preventDefault(); e.stopPropagation(); startRowResize(e, tr); } };
    dom.addEventListener('mousemove', onMove); dom.addEventListener('mousedown', onDown, true);
    return () => { dom.removeEventListener('mouseleave', hoverSoon); dom.removeEventListener('contextmenu', onContext); clearTimeout(hoverTimer.current); dom.removeEventListener('mousemove', onMove); dom.removeEventListener('mousedown', onDown, true); editor.view.dom.removeEventListener('click', onClick); editor.destroy(); ed.current = null; };
  }, []);

  // outline (目录): the headings of the document, click one to jump to it
  const headings: { level: number; text: string; pos: number }[] = [];
  ed.current?.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') headings.push({ level: node.attrs.level, text: node.textContent.trim() || '(空标题)', pos });
    return node.type.name !== 'heading';
  });
  function goToHeading(pos: number) {
    const e = ed.current; if (!e) return;
    (e.view.nodeDOM(pos) as HTMLElement | null)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    e.chain().setTextSelection(pos + 1).run();
  }
  const run = () => ed.current!.chain().focus();
  const on = (name: string, attrs?: Record<string, unknown>) => !!ed.current?.isActive(name, attrs);
  function promptLink() {
    const e = ed.current!;
    const url = window.prompt('链接地址(留空取消链接)', e.getAttributes('link').href ?? 'https://');
    if (url === null) return;
    if (url.trim() === '') e.chain().focus().extendMarkRange('link').unsetLink().run();
    else e.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }
  function link(label: string, href: string) {
    run().insertContent({ type: 'text', text: label, marks: [{ type: 'link', attrs: { href } }] }).run();
    setMenu('');
  }
  const align = (a: 'left' | 'center' | 'right') => (run() as any).setTextAlign(a).run();

  /* ---------- images: paste, drop or pick -> Supabase Storage -> an image in the document ---------- */
  function replaceImageSrc(from: string, to: string) {
    const e = ed.current; if (!e) return;
    const { tr } = e.state; let hit = false;
    e.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image' && node.attrs.src === from) { tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: to, v: (node.attrs.v ?? 0) + 1 }); hit = true; }
    });
    if (hit) e.view.dispatch(tr);
  }
  function removeImage(src: string) {
    const e = ed.current; if (!e) return;
    const { tr } = e.state; const found: [number, number][] = [];
    e.state.doc.descendants((node, pos) => { if (node.type.name === 'image' && node.attrs.src === src) found.push([pos, node.nodeSize]); });
    found.reverse().forEach(([pos, size]) => tr.delete(pos, pos + size));
    e.view.dispatch(tr);
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
    for (const f of images) {
      if (f.size > 8 * 1024 * 1024) { toast(`${f.name} 太大了(上限 8MB)`); continue; }
      // a placeholder goes in at the caret right away; the real URL replaces it when the upload is done
      const ph = `#uploading-${Math.random().toString(36).slice(2, 8)}`;
      run().insertContent({ type: 'paragraph', content: [{ type: 'image', attrs: { src: ph, alt: f.name.replace(/(\.drawio|\.mindmap)?\.[^.]+$/, '') } }] }).run();
      const url = await uploadFile(f);
      if (url) replaceImageSrc(ph, url); else removeImage(ph);
    }
    setUploading(false);
  }
  latest.current.upload = upload;

  /* selected diagram image: corner handles scale it (same shape), "裁剪" cuts it with the edge handles, 编辑 reopens the editor */
  const [sel, setSel] = useState<{ src: string; kind: 'drawio' | 'mindmap' } | null>(null);
  const [rect, setRect] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
  const dragging = useRef(false);
  const findImg = (src: string) => [...(ed.current?.view.dom.querySelectorAll('img') ?? [])].find((i) => i.getAttribute('src') === src) as HTMLImageElement | undefined;
  /** the visible box: the clipping wrapper of a cropped image, else the image itself */
  const boxOf = (img: HTMLImageElement) => (img.closest('.dg-crop') as HTMLElement | null) ?? img;
  function measure() {
    const img = sel && findImg(sel.src), view = wrap.current?.getBoundingClientRect();
    if (!img || !view) return setRect(null);
    const r = boxOf(img).getBoundingClientRect();
    if (r.bottom < view.top || r.top > view.bottom) return setRect(null); // scrolled out of the preview
    setRect({ l: r.left, t: r.top, w: r.width, h: r.height });
  }
  useLayoutEffect(() => { measure(); const id = requestAnimationFrame(measure); return () => cancelAnimationFrame(id); }, [sel, saveTick]);
  useEffect(() => {
    if (!sel) return;
    const on = () => { if (!dragging.current) measure(); };
    const down = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!t.closest?.('.st-img-sel') && t.tagName !== 'IMG') setSel(null); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setSel(null);
    window.addEventListener('resize', on); wrap.current?.addEventListener('scroll', on);
    document.addEventListener('mousedown', down); document.addEventListener('keydown', esc);
    return () => { window.removeEventListener('resize', on); wrap.current?.removeEventListener('scroll', on); document.removeEventListener('mousedown', down); document.removeEventListener('keydown', esc); };
  }, [sel]);
  const [diagram, setDiagram] = useState<{ kind: 'drawio' | 'mindmap'; data: string; oldUrl?: string } | null>(null);
  async function saveDiagram(svg: Blob, kind: 'drawio' | 'mindmap', oldUrl?: string) {
    const file = new File([svg], kind === 'drawio' ? '图表.drawio.svg' : '导图.mindmap.svg', { type: 'image/svg+xml' });
    if (!oldUrl) return upload([file]);
    setUploading(true);
    const url = await uploadFile(file);
    setUploading(false);
    const size = oldUrl.startsWith('#') ? '' : (oldUrl.match(/#w=\d+/)?.[0] ?? ''); // keep the chosen width (a crop would no longer fit the redrawn picture)
    if (url) replaceImageSrc(oldUrl, url + size);
  }
  function addDiagram(kind: 'drawio' | 'mindmap') {
    setMenu('');
    const id = Math.random().toString(36).slice(2, 8);
    run().insertContent({ type: 'paragraph', content: [{ type: 'image', attrs: { src: kind === 'drawio' ? `#diagram-${id}` : `#mindmap-${id}`, alt: kind === 'drawio' ? '图表' : '导图' } }] }).run();
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
    replaceImageSrc(src, next);
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
      else replaceImageSrc(src, src); // nothing changed: rebuild the view to drop the temporary live styles
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }
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
  /* ---------- floating bars: table tools sit on the table, text tools on the selection ---------- */
  const [float, setFloat] = useState<{ kind: 'text' | 'table'; left: number; top: number } | null>(null);
  // The table tools stay out of the way: hovering a table shows a small ⋯ handle (and the right-edge grip); clicking it, or
  // right-clicking the table, opens the tool bar, which closes again when the caret leaves the table.
  const [hover, setHover] = useState<{ l: number; t: number; w: number; h: number; pos: number } | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const hoverTimer = useRef<number>();
  const hoverEl = useRef<HTMLElement | null>(null);
  const tblPos = useRef<number | null>(null);
  const tableAt = (e: TipEditor, el: HTMLElement) => {
    const $p = e.state.doc.resolve(e.view.posAtDOM(el, 0));
    for (let d = $p.depth; d > 0; d--) if ($p.node(d).type.name === 'table') return $p.before(d);
    return -1;
  };
  function refreshHover() {
    const el = hoverEl.current, e = ed.current;
    if (!el || !e) return;
    if (!el.isConnected) { hoverEl.current = null; return setHover(null); }
    const r = el.getBoundingClientRect(), pos = tableAt(e, el);
    if (pos < 0) { hoverEl.current = null; return setHover(null); }
    setHover({ l: r.left, t: r.top, w: r.width, h: r.height, pos });
  }
  function placeFloat() {
    const e = ed.current, box = wrap.current?.getBoundingClientRect();
    if (!e || !box) return setFloat(null);
    refreshHover();
    const { selection } = e.state, { $from } = selection;
    let tableDepth = -1;
    for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'table') { tableDepth = d; break; }
    if (tableDepth > 0) tblPos.current = $from.before(tableDepth);
    else if (tableOpen) setTableOpen(false); // the caret left the table: the tools go away
    if (tableDepth > 0 && tableOpen) {
      const el = e.view.nodeDOM($from.before(tableDepth)) as HTMLElement | null;
      if (!el) return setFloat(null);
      const r = el.getBoundingClientRect();
      if (r.bottom < box.top || r.top > box.bottom) return setFloat(null);
      return setFloat({ kind: 'table', left: Math.max(box.left + 8, Math.min(r.left, window.innerWidth - 660)), top: Math.max(box.top + 6, r.top - 46) });
    }
    if (selection.empty || (selection as any).node) return setFloat(null); // only a text selection gets the text bar
    const a = e.view.coordsAtPos(selection.from), b = e.view.coordsAtPos(selection.to);
    const top = Math.min(a.top, b.top), bottom = Math.max(a.bottom, b.bottom);
    if (bottom < box.top || top > box.bottom) return setFloat(null);
    const mid = (Math.min(a.left, b.left) + Math.max(a.right, b.right)) / 2;
    setFloat({ kind: 'text', left: Math.max(box.left + 8, mid - 150), top: top - 46 < box.top + 6 ? bottom + 8 : top - 46 });
  }
  /** open the table tool bar for the table at `pos`, putting the caret in it if it is somewhere else */
  function openTable(pos: number) {
    const e = ed.current; if (!e) return;
    const { $from } = e.state.selection;
    let inside = false;
    for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'table' && $from.before(d) === pos) inside = true;
    if (!inside) e.chain().focus().setTextSelection(pos + 4).run(); // the first cell
    tblPos.current = pos; setTableOpen(true);
  }
  /**
   * Table size, the usual way: dragging a column border (including the table's right edge) is handled by the table
   * extension; here, dragging the bottom border of a row sets that row's height.
   */
  function startRowResize(e: MouseEvent, tr: HTMLElement) {
    const editor = ed.current; if (!editor) return;
    const $p = editor.state.doc.resolve(editor.view.posAtDOM(tr, 0));
    let rowPos = -1;
    for (let d = $p.depth; d > 0; d--) if ($p.node(d).type.name === 'tableRow') { rowPos = $p.before(d); break; }
    if (rowPos < 0) return;
    const h0 = tr.getBoundingClientRect().height, y0 = e.clientY;
    dragging.current = true; document.body.classList.add('st-resizing');
    const move = (ev: MouseEvent) => {
      const node = editor.state.doc.nodeAt(rowPos); if (!node) return;
      const height = Math.round(Math.max(28, h0 + ev.clientY - y0));
      if (node.attrs.height !== height) editor.view.dispatch(editor.state.tr.setNodeMarkup(rowPos, undefined, { ...node.attrs, height }));
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); dragging.current = false; document.body.classList.remove('st-resizing'); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }
  /** the table's right edge: widens or narrows the last column (the other columns keep their width) */
  function startTableEdge(e: MouseEvent, pos: number) {
    e.preventDefault(); e.stopPropagation();
    const editor = ed.current;
    if (!editor) return;
    const wrapper = editor.view.nodeDOM(pos) as HTMLElement | null, table = wrapper?.querySelector('table');
    const first = table?.querySelector('tr');
    if (!wrapper || !first) return;
    const w0 = ([...first.children] as HTMLElement[]).map((c) => c.getBoundingClientRect().width), last = w0.length - 1;
    const maxLast = (wrapper.parentElement?.getBoundingClientRect().width ?? 9999) - 2 - w0.slice(0, last).reduce((a, b) => a + b, 0);
    const x0 = e.clientX;
    dragging.current = true; document.body.classList.add('st-resizing');
    const move = (ev: MouseEvent) => {
      const widths = w0.map((w, i) => Math.round(i === last ? Math.max(60, Math.min(maxLast, w + ev.clientX - x0)) : w));
      const node = editor.state.doc.nodeAt(pos); if (!node) return;
      const { tr } = editor.state; let changed = false;
      node.forEach((row, rowOff) => {
        let cell = pos + 1 + rowOff + 1;
        row.forEach((c, _o, i) => {
          if (c.attrs.colspan === 1 && c.attrs.colwidth?.[0] !== widths[i]) { tr.setNodeMarkup(cell, undefined, { ...c.attrs, colwidth: [widths[i]] }); changed = true; }
          cell += c.nodeSize;
        });
      });
      if (changed) editor.view.dispatch(tr);
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); dragging.current = false; document.body.classList.remove('st-resizing'); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }
  /** where the table sits (left / centre / right), as opposed to the alignment of the text in its cells; a full-width table is narrowed first so the change is visible */
  function currentTableAlign(): 'left' | 'center' | 'right' {
    try { return ed.current?.state.doc.nodeAt(tblPos.current ?? 0)?.attrs.align ?? 'left'; } catch { return 'left'; }
  }
  function alignTable(kind: 'left' | 'center' | 'right') {
    const editor = ed.current, pos = tblPos.current;
    if (!editor || pos == null) return;
    const node = editor.state.doc.nodeAt(pos); if (!node) return;
    const { tr } = editor.state;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, align: kind === 'left' ? null : kind });
    let sized = false;
    node.descendants((c) => { if (c.attrs?.colwidth) sized = true; });
    const wrapper = editor.view.nodeDOM(pos) as HTMLElement | null, first = wrapper?.querySelector('tr');
    if (kind !== 'left' && !sized && first) {
      const widths = ([...first.children] as HTMLElement[]).map((c) => Math.max(60, Math.round(c.getBoundingClientRect().width * 0.8)));
      node.forEach((row, rowOff) => {
        let cell = pos + 1 + rowOff + 1;
        row.forEach((c, _o, i) => {
          if (c.attrs.colspan === 1) tr.setNodeMarkup(cell, undefined, { ...c.attrs, colwidth: [widths[i]] });
          cell += c.nodeSize;
        });
      });
    }
    editor.view.dispatch(tr);
  }
  const placeRef = useRef(placeFloat); placeRef.current = placeFloat;
  const refreshHoverRef = useRef(refreshHover); refreshHoverRef.current = refreshHover;
  useLayoutEffect(() => { placeFloat(); }, [saveTick, tableOpen]);
  useEffect(() => {
    if (!tableOpen) return;
    const down = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!t.closest?.('.st-float, table')) setTableOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setTableOpen(false);
    document.addEventListener('mousedown', down); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', esc); };
  }, [tableOpen]);
  useEffect(() => {
    const go = () => placeRef.current();
    wrap.current?.addEventListener('scroll', go); window.addEventListener('resize', go);
    return () => { wrap.current?.removeEventListener('scroll', go); window.removeEventListener('resize', go); };
  }, []);

  const T = (props: { t: string; k?: string; on?: boolean; onClick: () => void; children: any }) => (
    <button type="button" class={props.on ? 'on' : ''} title={props.k ? `${props.t}(${props.k})` : props.t} onMouseDown={(e) => e.preventDefault()} onClick={props.onClick}>{props.children}</button>
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

        <div class="st-toolbar" role="toolbar" aria-label="格式">
          <div class="st-tool-group">
            <T t="一级标题" on={on('heading', { level: 1 })} onClick={() => run().toggleHeading({ level: 1 }).run()}>H1</T>
            <T t="二级标题" on={on('heading', { level: 2 })} onClick={() => run().toggleHeading({ level: 2 }).run()}>H2</T>
            <T t="三级标题" on={on('heading', { level: 3 })} onClick={() => run().toggleHeading({ level: 3 }).run()}>H3</T>
          </div>
          <div class="st-tool-group">
            <T t="无序列表" on={on('bulletList')} onClick={() => run().toggleBulletList().run()}>•</T>
            <T t="有序列表" on={on('orderedList')} onClick={() => run().toggleOrderedList().run()}>1.</T>
            <T t="任务列表" on={on('taskList')} onClick={() => run().toggleTaskList().run()}>☑</T>
            <T t="引用" on={on('blockquote')} onClick={() => run().toggleBlockquote().run()}>❝</T>
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
                  <button onClick={() => { run().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setMenu(''); }}>▦ 表格</button>
                  <button onClick={() => setMenu('code')}>{'{ }'} 代码块 ›</button>
                  <button onClick={() => { run().setHorizontalRule().run(); setMenu(''); }}>— 分割线</button>
                  <button onClick={() => { run().toggleTaskList().run(); setMenu(''); }}>☑ 任务列表</button>
                  <button onClick={() => { run().insertContent({ type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: '提示' }, { type: 'text', text: ':' }] }] }).run(); setMenu(''); }}>💡 提示框</button>
                  <button onClick={() => { (run() as any).setDetails().run(); setMenu(''); }}>▸ 折叠内容</button>
                  <button onClick={() => setMenu('learning')}>⌥ 学习清单条目 ›</button>
                  <button onClick={() => setMenu('project')}>◇ 项目 ›</button>
                </div>
              )}
              {menu === 'code' && (
                <div class="st-menu grid" role="menu">
                  {CODE_LANGS.map((l) => <button onClick={() => { run().toggleCodeBlock({ language: l }).run(); setMenu(''); }}>{l}</button>)}
                </div>
              )}
              {menu === 'learning' && (
                <div class="st-menu" role="menu">
                  {learning.length === 0 && <p class="st-muted">学习清单是空的</p>}
                  {learning.map((l) => (
                    <button onClick={() => {
                      // link the item in the text, and also record the relation
                      link(l.title, l.url ?? `/learning/${l.id}/`);
                      if (!n.learning_ids.includes(l.id)) edit({ learning_ids: [...n.learning_ids, l.id] });
                    }}>{l.title}</button>
                  ))}
                </div>
              )}
              {menu === 'project' && (
                <div class="st-menu" role="menu">
                  {projects.map((p) => (
                    <button onClick={() => {
                      link(p.title, `/projects/${p.slug}/`);
                      if (!n.projects.includes(p.slug)) edit({ projects: [...n.projects, p.slug] });
                    }}>{p.title}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <span class="st-spacer" />
          <div class="st-tool-group">
            <T t={outlineOpen === '1' ? '隐藏目录' : '显示目录'} on={outlineOpen === '1'} onClick={() => setOutlineOpen(outlineOpen === '1' ? '0' : '1')}>☰ 目录</T>
          </div>
        </div>

        <div class="st-doc-row">
          <div class="st-doc" ref={wrap}><div ref={host} /></div>
          {outlineOpen === '1' && (
            <aside class="st-outline" aria-label="目录">
              <p class="st-outline-title">目录</p>
              {headings.length === 0
                ? <p class="st-muted">写几个标题,会出现在这里</p>
                : <ol>{headings.map((h) => <li class={`d${h.level}`}><button type="button" title={h.text} onClick={() => goToHeading(h.pos)}>{h.text}</button></li>)}</ol>}
            </aside>
          )}
        </div>

        <div class="st-status">
          <span>{stats.count} 字 · 约 {stats.minutes} 分钟</span>
          <span class="st-muted">直接排版 · 存为 Markdown · 表格拖边框调列宽 · ⌘S 保存{focus ? ' · Esc 退出专注' : ''}</span>
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
      {(() => {
        // handles that sit on the document are clipped to it, so they never float over the toolbar or the page header while scrolling
        const box = wrap.current?.getBoundingClientRect();
        if (!box || (!hover && !(sel && rect))) return null;
        return (
          <div class="st-clip" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
            {hover && !tableOpen && (
              <button type="button" class="st-tbl-handle" title="表格工具(也可以右键点表格)" style={{ left: hover.l - box.left, top: Math.max(4, hover.t - box.top - 28) }}
                onMouseEnter={() => clearTimeout(hoverTimer.current)} onMouseLeave={() => { hoverTimer.current = window.setTimeout(() => { hoverEl.current = null; setHover(null); }, 350); }}
                onMouseDown={(e) => e.preventDefault()} onClick={() => openTable(hover.pos)}>⋯</button>
            )}
            {hover && <div class="st-tbl-edge" title="拖动调整表格宽度" style={{ left: hover.l + hover.w - 4 - box.left, top: hover.t - box.top, height: hover.h }}
              onMouseEnter={() => clearTimeout(hoverTimer.current)} onMouseLeave={() => { hoverTimer.current = window.setTimeout(() => { hoverEl.current = null; setHover(null); }, 350); }}
              onMouseDown={(e) => startTableEdge(e, hover.pos)} />}
            {sel && rect && (
              <div class="st-img-sel" style={{ left: rect.l - box.left, top: rect.t - box.top, width: rect.w, height: rect.h }}>
                <div class="bar" style={rect.t - box.top < 52 ? { top: 8, right: 8 } : undefined}>
                  <button class="st-btn primary" onClick={() => editImage(sel)}>编辑</button>
                </div>
                {/* corners scale (same shape); edges crop that side */}
                {([['nw', -1, -1], ['ne', 1, -1], ['sw', -1, 1], ['se', 1, 1]] as const).map(([c, sx, sy]) => <div class={`h ${c}`} onMouseDown={(e) => startResize(e, sx, sy)} />)}
                {([['n', 0, -1], ['w', -1, 0], ['e', 1, 0], ['s', 0, 1]] as const).map(([c, hx, hy]) => <div class={`h ${c}`} onMouseDown={(e) => startEdgeCrop(e, hx, hy)} />)}
              </div>
            )}
          </div>
        );
      })()}
      {float && (
        <div class="st-float" style={{ left: float.left, top: float.top }} onMouseDown={(e) => e.preventDefault()}>
          {float.kind === 'table' && (<>
            <T t="在上方插入一行" onClick={() => run().addRowBefore().run()}>↑行</T>
            <T t="在下方插入一行" onClick={() => run().addRowAfter().run()}>↓行</T>
            <T t="在左侧插入一列" onClick={() => run().addColumnBefore().run()}>←列</T>
            <T t="在右侧插入一列" onClick={() => run().addColumnAfter().run()}>→列</T>
            <T t="删除当前行" onClick={() => run().deleteRow().run()}>−行</T>
            <T t="删除当前列" onClick={() => run().deleteColumn().run()}>−列</T>
            <T t="合并或拆分选中的单元格" onClick={() => run().mergeOrSplit().run()}>合并</T>
            <T t="删除整个表格" onClick={() => run().deleteTable().run()}>删表格</T>
            <span class="sep" />
            {(['left', 'center', 'right'] as const).map((k) => (
              <T t={{ left: '表格靠左', center: '表格居中', right: '表格靠右' }[k]} on={currentTableAlign() === k} onClick={() => alignTable(k)}><TableAlignIcon k={k} /></T>
            ))}
            <span class="sep" />
          </>)}
          <T t="加粗" k="⌘B" on={on('bold')} onClick={() => run().toggleBold().run()}><b>B</b></T>
          <T t="斜体" k="⌘I" on={on('italic')} onClick={() => run().toggleItalic().run()}><i>I</i></T>
          <T t="删除线" on={on('strike')} onClick={() => run().toggleStrike().run()}><s>S</s></T>
          <T t="行内代码" on={on('code')} onClick={() => run().toggleCode().run()}>{'`·`'}</T>
          <T t="链接" k="⌘K" on={on('link')} onClick={promptLink}>🔗</T>
          <span class="sep" />
          <T t={float.kind === 'table' ? '文字左对齐(当前列)' : '左对齐'} onClick={() => align('left')}><AlignIcon k="left" /></T>
          <T t={float.kind === 'table' ? '文字居中(当前列)' : '居中'} onClick={() => align('center')}><AlignIcon k="center" /></T>
          <T t={float.kind === 'table' ? '文字右对齐(当前列)' : '右对齐'} onClick={() => align('right')}><AlignIcon k="right" /></T>
        </div>
      )}
      {diagram?.kind === 'drawio' && <DiagramModal xml={diagram.data} onSave={(svg) => saveDiagram(svg, 'drawio', diagram.oldUrl)} onClose={() => setDiagram(null)} />}
      {diagram?.kind === 'mindmap' && <MindMapModal data={diagram.data} onSave={(svg) => saveDiagram(svg, 'mindmap', diagram.oldUrl)} onClose={() => setDiagram(null)} />}
    </div>
  );
}
