/**
 * Diagram images (draw.io / mind map exports) carry their size in the URL fragment, written by Studio:
 *   `…svg#w=63`                      63% of the column wide, uncropped
 *   `…svg#w=63;c=100,0,250,50;n=2517` cropped: insets top,right,bottom,left in tenths of a percent of the image,
 *                                     n = the image's width/height × 1000; w is the width of what stays visible
 * Resizing keeps the shape (no stretching); cropping only changes which part is visible, at the same scale.
 */
export type DiagramSize = { w: number; c: [number, number, number, number] | null; n: number | null };

export function parseDiagramSize(src: string): DiagramSize | null {
  const m = src.match(/#w=(\d+)(?:;c=(\d+),(\d+),(\d+),(\d+))?(?:;n=(\d+))?$/);
  if (!m) return null;
  return {
    w: +m[1],
    c: m[2] === undefined ? null : [+m[2] / 1000, +m[3] / 1000, +m[4] / 1000, +m[5] / 1000],
    n: m[6] ? +m[6] / 1000 : null,
  };
}

export function diagramSrc(base: string, w: number, c?: number[] | null, n?: number | null): string {
  const crop = c && n ? `;c=${c.map((x) => Math.round(x * 1000)).join(',')};n=${Math.round(n * 1000)}` : '';
  return `${base.split('#')[0]}#w=${w}${crop}`;
}

/** Turns the size in the URL into markup: a plain width, or a clipping box around the shifted image when cropped. */
export function sizeDiagramImages(html: string): string {
  return html.replace(
    /<img([^>]*?)src="([^"]*\.(?:drawio|mindmap)\.svg#w=[^"]*)"([^>]*?)\/?>/g,
    (tag, a, src, b) => {
      const s = parseDiagramSize(src);
      if (!s) return tag;
      const w = Math.min(100, Math.max(5, s.w));
      if (!s.c || !s.n) return `<img${a}src="${src}"${b} style="width:${w}%">`;
      const [t, r, bo, l] = s.c, vw = 1 - l - r, vh = 1 - t - bo;
      if (vw < 0.05 || vh < 0.05) return `<img${a}src="${src}"${b} style="width:${w}%">`;
      return `<span class="dg-crop" style="width:${w}%;aspect-ratio:${((vw / vh) * s.n).toFixed(4)}"><img${a}src="${src}"${b} style="width:${(100 / vw).toFixed(3)}%;left:${((-l / vw) * 100).toFixed(3)}%;top:${((-t / vh) * 100).toFixed(3)}%"></span>`;
    },
  );
}
