import { useEffect, useRef, useState } from 'preact/hooks';
import MindElixir from 'mind-elixir';
import 'mind-elixir/style.css';

type Theme = NonNullable<ConstructorParameters<typeof MindElixir>[0]['theme']>;

/** Light themes only: the exported SVG has a transparent background and sits on the (light) post. */
const mk = (name: string, palette: string[], root: string, extra: Record<string, string> = {}): Theme =>
  ({ ...MindElixir.THEME, name, palette, cssVar: { ...MindElixir.THEME.cssVar, '--root-bgcolor': root, '--accent-color': palette[0], ...extra } });
const THEMES: { id: string; label: string; theme: Theme }[] = [
  { id: 'lilac', label: '薰衣草', theme: mk('lilac', ['#7c4dff', '#5a2fd0', '#9b6bff', '#b9a4ff', '#6b4bd6', '#8f6bf0'], '#5a2fd0') },
  { id: 'classic', label: '经典彩色', theme: MindElixir.THEME },
  { id: 'ocean', label: '海洋', theme: mk('ocean', ['#0ea5e9', '#0284c7', '#06b6d4', '#14b8a6', '#3b82f6', '#6366f1'], '#0c4a6e') },
  { id: 'forest', label: '森林', theme: mk('forest', ['#16a34a', '#15803d', '#65a30d', '#0d9488', '#84cc16', '#22c55e'], '#14532d') },
  { id: 'sunset', label: '日落', theme: mk('sunset', ['#f97316', '#ef4444', '#f59e0b', '#ec4899', '#fb7185', '#d97706'], '#7c2d12') },
  { id: 'rose', label: '玫瑰', theme: mk('rose', ['#e11d48', '#db2777', '#f43f5e', '#c026d3', '#fb7185', '#be185d'], '#881337') },
  { id: 'mono', label: '黑白', theme: mk('mono', ['#334155', '#475569', '#64748b', '#1e293b', '#52525b', '#78716c'], '#1e293b') },
  { id: 'candy', label: '糖果', theme: mk('candy', ['#a78bfa', '#f472b6', '#38bdf8', '#34d399', '#fbbf24', '#fb923c'], '#6d28d9', { '--main-bgcolor': '#fffafc' }) },
];
/** a branch colour → a few neighbouring hues, so sibling branches are told apart but stay in one family */
function paletteFrom(hex: string): string[] {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = d === 0 ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const hsl = (hh: number) => `hsl(${(hh + 360) % 360} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%)`;
  return [0, 24, -24, 48, -48, 72].map((o) => hsl(h + o));
}
const customTheme = (branch: string, root: string) => mk('custom', paletteFrom(branch), root);
const LAYOUTS = [
  { id: 'side', label: '左右展开', apply: (m: any) => m.initSide() },
  { id: 'right', label: '向右', apply: (m: any) => m.initRight() },
  { id: 'left', label: '向左', apply: (m: any) => m.initLeft() },
  { id: 'down', label: '向下(组织结构)', apply: (m: any) => m.initDown() },
] as const;

/** Mind-map editor. `data` is the JSON saved inside an earlier export (or '' for a new map). onSave gets the SVG with the source embedded. */
export default function MindMapModal({ data, onSave, onClose }: {
  data: string;
  onSave: (svg: Blob) => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mind = useRef<any>();
  const [themeId, setThemeId] = useState('lilac');
  const [layoutId, setLayoutId] = useState<string>('side');
  const [branch, setBranch] = useState('#7c4dff');
  const [root, setRoot] = useState('#5a2fd0');

  useEffect(() => {
    window.getSelection()?.removeAllRanges();
    let saved: any = null;
    try { saved = data ? JSON.parse(data) : null; } catch {}
    const custom = saved?.t === 'custom' && /^#[0-9a-f]{6}$/i.test(saved?.c?.b) && /^#[0-9a-f]{6}$/i.test(saved?.c?.r);
    const tid = custom ? 'custom' : THEMES.find((t) => t.id === saved?.t)?.id ?? 'lilac';
    const lid = LAYOUTS.find((l) => l.id === saved?.l)?.id ?? 'side';
    setThemeId(tid); setLayoutId(lid);
    if (custom) { setBranch(saved.c.b); setRoot(saved.c.r); }
    const m: any = new MindElixir({ el: box.current!, direction: MindElixir.SIDE, theme: custom ? customTheme(saved.c.b, saved.c.r) : THEMES.find((t) => t.id === tid)!.theme });
    m.init(saved?.d ?? (saved?.nodeData ? saved : MindElixir.new('中心主题')));
    LAYOUTS.find((l) => l.id === lid)!.apply(m);
    mind.current = m;
    return () => { m.destroy?.(); };
  }, []);

  function pickTheme(id: string) {
    const t = THEMES.find((x) => x.id === id)!;
    setThemeId(id); mind.current?.changeTheme(t.theme);
    // show the preset's colours in the pickers, so tweaking one starts from it
    setBranch(t.theme.palette[0].startsWith('#') ? t.theme.palette[0] : '#7c4dff'); setRoot(String(t.theme.cssVar?.['--root-bgcolor'] ?? '#4c4f69'));
  }
  function pickColor(which: 'b' | 'r', v: string) {
    const b = which === 'b' ? v : branch, r = which === 'r' ? v : root;
    which === 'b' ? setBranch(v) : setRoot(v);
    setThemeId('custom'); mind.current?.changeTheme(customTheme(b, r));
  }
  function pickLayout(id: string) { setLayoutId(id); LAYOUTS.find((l) => l.id === id)!.apply(mind.current); }

  async function save() {
    const m = mind.current;
    // foreignObject keeps the text laid out correctly; drop the grey page background so it blends into the post
    const svg = (await m.exportSvg(false).text()).replace(/<rect x="0" y="0"[^>]*><\/rect>/, '');
    // keep the source inside the file so the map can be opened again
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify({ d: m.getData(), t: themeId, l: layoutId, c: { b: branch, r: root } }))));
    onSave(new Blob([svg.replace(/<svg[^>]*>/, (tag) => `${tag}<metadata id="mindmap-data">${b64}</metadata>`)], { type: 'image/svg+xml' }));
    onClose();
  }

  return (
    <div class="st-diagram-overlay">
      <div class="st-mm-box">
        <div class="st-mm-bar">
          <span class="st-mm-opts">
            <span class="st-muted">配色</span>
            {THEMES.map((t) => (
              <button type="button" class={`st-mm-swatch ${themeId === t.id ? 'on' : ''}`} title={t.label}
                style={{ background: `linear-gradient(135deg, ${t.theme.palette[0]} 0 50%, ${t.theme.palette[2]} 50% 100%)` }}
                onClick={() => pickTheme(t.id)} />
            ))}
            <label class="st-mm-color" title="分支颜色"><input type="color" value={branch} onInput={(e) => pickColor('b', (e.target as HTMLInputElement).value)} />分支</label>
            <label class="st-mm-color" title="中心主题颜色"><input type="color" value={root} onInput={(e) => pickColor('r', (e.target as HTMLInputElement).value)} />中心</label>
            <span class="st-muted">布局</span>
            <select class="st-input st-mm-select" value={layoutId} onChange={(e) => pickLayout((e.target as HTMLSelectElement).value)}>
              {LAYOUTS.map((l) => <option value={l.id}>{l.label}</option>)}
            </select>
          </span>
          <span class="st-mm-actions">
            <span class="st-muted st-mm-hint">Tab 子节点 · Enter 同级 · Delete 删除 · 双击改字</span>
            <button class="st-btn" onClick={onClose}>取消</button>
            <button class="st-btn primary" onClick={save}>保存并退出</button>
          </span>
        </div>
        <div ref={box} class="st-mm-canvas" />
      </div>
    </div>
  );
}
