import { Extension, getHTMLFromFragment } from '@tiptap/core';
import { Fragment } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { defaultMarkdownSerializer } from 'prosemirror-markdown';
import StarterKit from '@tiptap/starter-kit';
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details';
import { Markdown } from 'tiptap-markdown';
import { sizeDiagramImages } from '../lib/diagram';

/* ---------- paragraph / heading alignment, stored as <div style="text-align:…"> around the block ---------- */
type Align = 'left' | 'center' | 'right';

const CELLS = ['tableCell', 'tableHeader'];
const TextAlign = Extension.create({
  name: 'textAlign',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          textAlign: {
            default: null,
            // the block's own style, or the <div style="text-align:…"> it was wrapped in
            parseHTML: (el: HTMLElement) => el.style.textAlign || (el.parentElement?.tagName === 'DIV' ? el.parentElement.style.textAlign : '') || null,
            renderHTML: (attrs: Record<string, any>) => (attrs.textAlign ? { style: `text-align:${attrs.textAlign}` } : {}),
          },
        },
      },
      {
        types: CELLS, // GFM column alignment (`:---:`) arrives as a style on the cell
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.textAlign || el.getAttribute('align') || null,
            renderHTML: (attrs: Record<string, any>) => (attrs.textAlign ? { style: `text-align:${attrs.textAlign}` } : {}),
          },
        },
      },
      {
        types: ['table'], // where the table sits in the column: left (default), centre, right
        attributes: {
          align: {
            default: null,
            parseHTML: (el: HTMLElement) => (el.style.marginLeft === 'auto' ? (el.style.marginRight === 'auto' ? 'center' : 'right') : null),
            renderHTML: (attrs: Record<string, any>) =>
              attrs.align === 'center' ? { style: 'margin-left:auto;margin-right:auto' } : attrs.align === 'right' ? { style: 'margin-left:auto;margin-right:0' } : {},
          },
        },
      },
      {
        types: ['tableRow'], // row height, in px (set by dragging the table's bottom handle)
        attributes: {
          height: {
            default: null,
            parseHTML: (el: HTMLElement) => parseInt(el.style.height, 10) || null,
            renderHTML: (attrs: Record<string, any>) => (attrs.height ? { style: `height:${attrs.height}px` } : {}),
          },
        },
      },
      {
        types: ['taskList'], // task lists are written tight, like the other lists
        attributes: {
          tight: {
            default: true,
            parseHTML: (el: HTMLElement) => !el.querySelector('p'),
            renderHTML: (attrs: Record<string, any>) => (attrs.tight ? { 'data-tight': 'true' } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      // in a table: the whole column under the caret; elsewhere: the paragraph(s) / heading(s) in the selection
      setTextAlign: (a: Align) => ({ state, tr, dispatch, commands }: any) => {
        const { $from } = state.selection;
        let cellDepth = -1;
        for (let d = $from.depth; d > 0; d--) if (CELLS.includes($from.node(d).type.name)) { cellDepth = d; break; }
        if (cellDepth < 0) return ['paragraph', 'heading'].map((t) => commands.updateAttributes(t, { textAlign: a === 'left' ? null : a })).some(Boolean);
        const table = $from.node(cellDepth - 2), col = $from.index(cellDepth - 1), tableStart = $from.start(cellDepth - 2);
        if (dispatch) {
          table.forEach((row: any, rowOffset: number) => {
            let pos = tableStart + rowOffset + 1;
            row.forEach((cell: any, _o: number, i: number) => {
              if (i === col) tr.setNodeMarkup(pos, undefined, { ...cell.attrs, textAlign: a });
              pos += cell.nodeSize;
            });
          });
          dispatch(tr);
        }
        return true;
      },
    } as any;
  },
});

/** the table's own view ignores node attributes, so its alignment is shown through a class on the wrapper (see studio.css) */
const TableAlignView = Extension.create({
  name: 'tableAlignView',
  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        decorations(state) {
          const decos: Decoration[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'table' && node.attrs.align) decos.push(Decoration.node(pos, pos + node.nodeSize, { class: `tbl-${node.attrs.align}` }));
          });
          return DecorationSet.create(state.doc, decos);
        },
      },
    })];
  },
});

/** wraps a block serializer so aligned top-level blocks come out as `<div style="text-align:center">\n\n…\n\n</div>` */
const aligned = (inner: (...a: any[]) => void) =>
  function (state: any, node: any, parent: any, index: number) {
    const a = node.attrs.textAlign;
    if (!a || parent?.type?.name !== 'doc') return inner(state, node, parent, index);
    state.write(`<div style="text-align:${a}">`);
    state.closeBlock(node);
    inner(state, node, parent, index);
    state.write('</div>');
    state.closeBlock(node);
  };

const AlignedParagraph = Paragraph.extend({
  addStorage() { return { markdown: { serialize: aligned(defaultMarkdownSerializer.nodes.paragraph as any), parse: {} } }; },
});
const AlignedHeading = Heading.extend({
  addStorage() { return { markdown: { serialize: aligned(defaultMarkdownSerializer.nodes.heading as any), parse: {} } }; },
});

/* ---------- tables: GFM when plain, HTML when they carry column widths or aligned cells (Markdown can't hold those) ---------- */
function rowsOf(table: any): any[][] {
  const rows: any[][] = [];
  table.forEach((row: any) => { const cells: any[] = []; row.forEach((c: any) => cells.push(c)); rows.push(cells); });
  return rows;
}
function isPlainTable(table: any): boolean {
  let tall = false;
  table.forEach((row: any) => { if (row.attrs.height) tall = true; });
  if (tall || table.attrs.align) return false; // row heights and table alignment need HTML
  const [head, ...body] = rowsOf(table);
  const span = (c: any) => c.attrs.colspan > 1 || c.attrs.rowspan > 1;
  const custom = (c: any) => { // anything GFM can't say
    if (c.attrs.colwidth) return true;
    let aligned = false;
    c.forEach((p: any) => { if (p.attrs?.textAlign) aligned = true; });
    return aligned;
  };
  if (head.some((c) => c.type.name !== 'tableHeader' || span(c) || c.childCount > 1 || custom(c))) return false;
  // a column's alignment is one thing for the whole column
  return !body.some((r) => r.some((c, j) => c.type.name === 'tableHeader' || span(c) || c.childCount > 1 || custom(c) || (c.attrs.textAlign ?? null) !== (head[j]?.attrs.textAlign ?? null)));
}
const DELIMITER: Record<string, string> = { left: ':---', center: ':---:', right: '---:' };
const TableWithMarkdown = Table.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any, _parent: any) {
          if (!isPlainTable(node)) {
            const html = getHTMLFromFragment(Fragment.from(node), node.type.schema);
            const box = document.createElement('div'); box.innerHTML = html;
            // the table's alignment style replaces the width style, so write the width back: the sum of the column widths
            const table = box.querySelector('table'), widths = rowsOf(node)[0].map((c: any) => c.attrs.colwidth?.[0]);
            if (table && widths.every(Boolean)) table.style.width = `${widths.reduce((a: number, b: number) => a + b, 0)}px`;
            state.write(box.innerHTML.trim()); state.closeBlock(node); // one line: an HTML block ends at a blank line
            return;
          }
          state.inTable = true;
          node.forEach((row: any, _p: number, i: number) => {
            state.write('| ');
            row.forEach((col: any, _q: number, j: number) => {
              if (j) state.write(' | ');
              const content = col.firstChild;
              if (content.textContent.trim()) state.renderInline(content);
            });
            state.write(' |'); state.ensureNewLine();
            if (!i) {
              const cells: any[] = []; row.forEach((c: any) => cells.push(c));
              state.write(`| ${cells.map((c) => DELIMITER[c.attrs.textAlign] ?? '---').join(' | ')} |`); state.ensureNewLine();
            }
          });
          state.closeBlock(node); state.inTable = false;
        },
        parse: {},
      },
    };
  },
});

/* ---------- details: back to the `<details><summary>…` form that was typed ---------- */
const DetailsWithMarkdown = Details.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          node.forEach((child: any) => {
            if (child.type.name === 'detailsSummary') { state.write(`<details>\n<summary>${child.textContent}</summary>`); state.closeBlock(child); }
            else state.renderContent(child);
          });
          state.write('</details>');
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});

/* ---------- images: plain, diagram (sized / cropped via the URL fragment), or a placeholder box ---------- */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export const placeholderKind = (src: string) =>
  src.startsWith('#diagram-') ? 'drawio' : src.startsWith('#mindmap-') ? 'mindmap' : src.startsWith('#uploading-') ? 'uploading' : null;

const DiagramImage = Image.configure({ inline: true }).extend({
  draggable: false,
  addAttributes() {
    return { ...this.parent?.(), v: { default: 0, rendered: false } }; // bumped to force the view to be rebuilt
  },
  addNodeView() {
    return ({ node }) => {
      const src: string = node.attrs.src ?? '', alt: string = node.attrs.alt ?? '';
      const ph = placeholderKind(src);
      let dom: HTMLElement;
      if (ph) {
        dom = document.createElement('div');
        dom.className = ph === 'uploading' ? 'st-diagram-ph uploading' : 'st-diagram-ph';
        dom.contentEditable = 'false';
        dom.dataset.diagram = src.replace(/^#[a-z]+-/, '');
        if (ph === 'mindmap') dom.dataset.kind = 'mindmap';
        dom.textContent = ph === 'uploading' ? `上传中… ${alt}` : ph === 'mindmap' ? '✺ 思维导图 · 点击这里开始绘制' : '◈ 图表 · 点击这里开始绘制';
      } else {
        const tmp = document.createElement('div');
        tmp.innerHTML = sizeDiagramImages(`<img src="${esc(src)}" alt="${esc(alt)}">`);
        dom = tmp.firstElementChild as HTMLElement;
      }
      return {
        dom,
        update: (n) => n.type === node.type && n.attrs.src === src && n.attrs.alt === alt && n.attrs.v === node.attrs.v,
        ignoreMutation: () => true, // the resize/crop handles edit this DOM live
      };
    };
  },
});

export function editorExtensions(placeholder: string) {
  return [
    StarterKit.configure({ paragraph: false, heading: false, trailingNode: false, underline: false, link: { openOnClick: false } }),
    AlignedParagraph, AlignedHeading, TextAlign, TableAlignView,
    TableWithMarkdown.configure({ resizable: true, cellMinWidth: 60 }), TableRow, TableCell, TableHeader,
    TaskList, TaskItem.configure({ nested: true }),
    DetailsWithMarkdown.configure({ persist: true }), DetailsSummary, DetailsContent,
    DiagramImage, Placeholder.configure({ placeholder }),
    Markdown.configure({ html: true, tightLists: true, bulletListMarker: '-', linkify: false, breaks: false, transformPastedText: true }),
  ];
}
