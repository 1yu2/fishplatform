/**
 * Diagram images (draw.io / mind map exports) can carry a width in their URL fragment: `…svg#w=63` = 63% of the
 * column. Studio writes it when you drag the image's handles; this turns it into an inline width for rendering.
 */
export function sizeDiagramImages(html: string): string {
  return html.replace(
    /<img([^>]*?)src="([^"]*\.(?:drawio|mindmap)\.svg#w=(\d+))"([^>]*?)\/?>/g,
    (_m, a, src, w, b) => `<img${a}src="${src}"${b} style="width:${Math.min(100, Math.max(5, +w))}%">`,
  );
}

/** `https://…/x.mindmap.svg#w=63` → 63 */
export const diagramWidth = (src: string) => Number(src.match(/#w=(\d+)$/)?.[1]) || null;
