import { useEffect, useRef, useState } from 'preact/hooks';
import type { Priority } from '../lib/studio-types';

export interface ProjectRef { slug: string; title: string }

export const PRIORITY_LABEL: Record<Priority, string> = { 1: '高', 2: '中', 3: '低' };

/** three dots; click cycles 1 → 2 → 3 → 1 */
export function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  const next = ((value % 3) + 1) as Priority;
  return (
    <button type="button" class={`st-prio p${value}`} title={`优先级:${PRIORITY_LABEL[value]}(点击切换)`} onClick={() => onChange(next)}>
      <i /><i /><i />
    </button>
  );
}

export function PublicToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" class={`st-public ${value ? 'on' : ''}`} title={value ? '公开:显示在网站上' : '私密:只有你能看到'} onClick={() => onChange(!value)}>
      {value ? '公开' : '私密'}
    </button>
  );
}

/** comma / Enter separated tags */
export function TagInput({ value, onChange, placeholder = '标签,用逗号分隔' }: { value: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState(value.join(', '));
  useEffect(() => setText(value.join(', ')), [value.join('|')]);
  const commit = () => {
    const tags = [...new Set(text.split(/[,，\n]/).map((t) => t.trim()).filter(Boolean))];
    if (tags.join('|') !== value.join('|')) onChange(tags);
  };
  return <input class="st-input" value={text} placeholder={placeholder} onInput={(e) => setText((e.target as HTMLInputElement).value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />;
}

/** text that saves on blur / Enter (Shift+Enter for a new line when multiline) */
export function InlineText({ value, onSave, multiline = false, placeholder, class: cls = '' }: {
  value: string; onSave: (v: string) => void; multiline?: boolean; placeholder?: string; class?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const save = () => { if (v !== value) onSave(v); };
  const props = {
    class: `st-inline ${cls}`, value: v, placeholder,
    onInput: (e: Event) => setV((e.target as HTMLInputElement).value),
    onBlur: save,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (!multiline || !e.shiftKey)) { e.preventDefault(); (e.target as HTMLElement).blur(); }
      if (e.key === 'Escape') { setV(value); (e.target as HTMLElement).blur(); }
    },
  };
  return multiline ? <textarea rows={3} {...props} /> : <input {...props} />;
}

/** small toast for save errors */
export function useToast() {
  const [msg, setMsg] = useState('');
  const timer = useRef<number>();
  const show = (m: string) => { setMsg(m); clearTimeout(timer.current); timer.current = window.setTimeout(() => setMsg(''), 4000); };
  const node = msg ? <div class="st-toast" role="status">{msg}</div> : null;
  return { show, node };
}

export function errText(e: { message?: string } | null | undefined): string {
  if (!e) return '';
  if (/row-level security|permission denied/i.test(e.message ?? '')) return '没有权限保存:这个账号还不是站点主人。';
  return e.message ?? '保存失败';
}

export const today = () => new Date().toISOString().slice(0, 10);

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 864e5));
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}
