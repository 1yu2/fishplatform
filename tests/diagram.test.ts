import { describe, expect, it } from 'vitest';
import { diagramSrc, parseDiagramSize, sizeDiagramImages } from '../src/lib/diagram';

describe('parseDiagramSize', () => {
  it('reads a plain width', () => {
    expect(parseDiagramSize('/x/a.drawio.svg#w=63')).toEqual({ w: 63, c: null, n: null });
  });

  it('reads a crop (tenths of a percent) and the aspect ratio', () => {
    expect(parseDiagramSize('a.mindmap.svg#w=60;c=100,50,200,100;n=2517')).toEqual({
      w: 60,
      c: [0.1, 0.05, 0.2, 0.1],
      n: 2.517,
    });
  });

  it('returns null without a size fragment', () => {
    expect(parseDiagramSize('a.drawio.svg')).toBeNull();
    expect(parseDiagramSize('a.drawio.svg#diagram-abc')).toBeNull();
    expect(parseDiagramSize('a.drawio.svg#w=')).toBeNull();
  });

  it('does not clamp (clamping happens when rendering)', () => {
    expect(parseDiagramSize('a.drawio.svg#w=250')?.w).toBe(250);
  });
});

describe('diagramSrc', () => {
  it('replaces any existing fragment with the width', () => {
    expect(diagramSrc('a.drawio.svg#w=10;c=1,2,3,4;n=1000', 63)).toBe('a.drawio.svg#w=63');
    expect(diagramSrc('a.drawio.svg', 40)).toBe('a.drawio.svg#w=40');
  });

  it('writes the crop only when both crop and ratio are given', () => {
    expect(diagramSrc('a.drawio.svg', 60, [0.1, 0.05, 0.2, 0.1], 2.517)).toBe(
      'a.drawio.svg#w=60;c=100,50,200,100;n=2517',
    );
    expect(diagramSrc('a.drawio.svg', 60, [0.1, 0.05, 0.2, 0.1], null)).toBe('a.drawio.svg#w=60');
    expect(diagramSrc('a.drawio.svg', 60, null, 2.517)).toBe('a.drawio.svg#w=60');
  });

  it('round-trips through parseDiagramSize', () => {
    const c: [number, number, number, number] = [0.123, 0, 0.25, 0.05];
    expect(parseDiagramSize(diagramSrc('/s/x.mindmap.svg#old', 77, c, 1.5))).toEqual({ w: 77, c, n: 1.5 });
    expect(parseDiagramSize(diagramSrc('/s/x.drawio.svg', 33))).toEqual({ w: 33, c: null, n: null });
  });
});

describe('sizeDiagramImages', () => {
  it('adds a width style to a plain-width diagram', () => {
    expect(sizeDiagramImages('<p><img src="/a.drawio.svg#w=63" alt="d"></p>')).toBe(
      '<p><img src="/a.drawio.svg#w=63" alt="d" style="width:63%"></p>',
    );
  });

  it('clamps the width to 5–100', () => {
    expect(sizeDiagramImages('<img src="a.drawio.svg#w=0">')).toBe('<img src="a.drawio.svg#w=0" style="width:5%">');
    expect(sizeDiagramImages('<img src="a.drawio.svg#w=3">')).toBe('<img src="a.drawio.svg#w=3" style="width:5%">');
    expect(sizeDiagramImages('<img src="a.mindmap.svg#w=250">')).toBe(
      '<img src="a.mindmap.svg#w=250" style="width:100%">',
    );
  });

  it('wraps a cropped diagram in a clipping box', () => {
    const src = 'a.drawio.svg#w=60;c=100,50,200,100;n=2517';
    // visible part: 1 - 0.1 - 0.05 = 0.85 wide, 1 - 0.1 - 0.2 = 0.7 high
    const vw = 0.85, vh = 0.7;
    expect(sizeDiagramImages(`<img src="${src}" alt="x">`)).toBe(
      `<span class="dg-crop" style="width:60%;aspect-ratio:${((vw / vh) * 2.517).toFixed(4)}">` +
        `<img src="${src}" alt="x" style="width:${(100 / vw).toFixed(3)}%;left:${((-0.1 / vw) * 100).toFixed(3)}%;top:${((-0.1 / vh) * 100).toFixed(3)}%"></span>`,
    );
    // same thing with literal numbers: 0.85 / 0.7 × 2.517 = 3.05636, 100 / 0.85 = 117.647, …
    expect(sizeDiagramImages(`<img src="${src}">`)).toBe(
      `<span class="dg-crop" style="width:60%;aspect-ratio:3.0564"><img src="${src}" style="width:117.647%;left:-11.765%;top:-14.286%"></span>`,
    );
  });

  it('falls back to a plain width when the crop leaves almost nothing', () => {
    expect(sizeDiagramImages('<img src="a.drawio.svg#w=50;c=500,0,480,0;n=1000">')).toBe(
      '<img src="a.drawio.svg#w=50;c=500,0,480,0;n=1000" style="width:50%">',
    );
  });

  it('leaves diagrams without a size fragment untouched', () => {
    const html = '<img src="a.drawio.svg"><img src="b.mindmap.svg#diagram-xyz">';
    expect(sizeDiagramImages(html)).toBe(html);
  });

  it('leaves non-diagram images untouched', () => {
    const html = '<img src="photo.png#w=50"><img src="plain.svg#w=50"><img src="x.jpg">';
    expect(sizeDiagramImages(html)).toBe(html);
  });

  it('handles several images and self-closing tags', () => {
    expect(sizeDiagramImages('<img src="a.drawio.svg#w=20" /><img src="b.png">')).toBe(
      '<img src="a.drawio.svg#w=20"  style="width:20%"><img src="b.png">',
    );
  });
});
