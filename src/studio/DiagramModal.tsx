import { useEffect, useRef } from 'preact/hooks';

const ORIGIN = 'https://embed.diagrams.net';
const SRC = `${ORIGIN}/?embed=1&proto=json&spin=1&libraries=1&saveAndExit=1&noSaveBtn=1&ui=min&lang=zh`;

/**
 * draw.io in an iframe. `xml` is empty for a new diagram, or the data: URI of an earlier
 * `.drawio.svg` export (the SVG carries its own source, so it can be edited again).
 * onSave receives the exported SVG; the modal closes itself afterwards.
 */
export default function DiagramModal({ xml, onSave, onClose }: {
  xml: string;
  onSave: (svg: Blob) => void;
  onClose: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // a page-wide text selection tints the iframe with the site's ::selection purple
    window.getSelection()?.removeAllRanges();
    const send = (m: object) => frame.current?.contentWindow?.postMessage(JSON.stringify(m), ORIGIN);
    async function onMessage(e: MessageEvent) {
      if (e.origin !== ORIGIN || e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return;
      let msg: any;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.event === 'init') send({ action: 'load', xml, autosave: 0 });
      else if (msg.event === 'save') send({ action: 'export', format: 'xmlsvg', xml: msg.xml, spin: '正在导出…' });
      else if (msg.event === 'export') {
        const svg = await (await fetch(msg.data)).text();
        onSave(new Blob([svg], { type: 'image/svg+xml' })); onClose();
      }
      else if (msg.event === 'exit') onClose();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div class="st-diagram-overlay">
      <iframe ref={frame} class="st-diagram-frame" src={SRC} title="draw.io" />
    </div>
  );
}
