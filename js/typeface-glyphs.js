const stage = document.getElementById('glyph-stage');
const grid = document.getElementById('glyph-grid');
const ns = 'http://www.w3.org/2000/svg';
const svgElement = (tag, attrs = {}) => {
    const element = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
};

async function init() {
    const response = await fetch('./assets/typeface/frmfrm-mono-glyphs.json');
    if (!response.ok) throw new Error('Glyph data unavailable');
    const data = await response.json();
    // Show each outline once: (), [], and {} share the same bracket shapes.
    const seenOutlines = new Set();
    data.glyphs = data.glyphs.filter(glyph => {
        if (seenOutlines.has(glyph.path)) return false;
        seenOutlines.add(glyph.path);
        return true;
    });
    let selected = data.glyphs[0];
    let mode = 'solid';
    const buttons = [];

    // One shared coordinate frame keeps metric guides stationary across glyphs.
    const width = Math.max(...data.glyphs.map(glyph => glyph.advance)) + 320;

    function render() {
        const top = data.ascender + 260;
        const height = top - data.descender + 160;
        const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });
        const guides = [
            ['CAP HEIGHT', data.capHeight],
            ['BASELINE', 0],
            ['DESCENDER', data.descender]
        ];
        // This font has equal cap and x heights; avoid duplicate guide lines.
        if (data.xHeight !== data.capHeight) guides.splice(1, 0, ['X-HEIGHT', data.xHeight]);
        guides.forEach(([label, value]) => {
            const y = top - value;
            svg.append(svgElement('line', { x1: 0, x2: width, y1: y, y2: y, class: 'glyph-guide' }));
            const title = svgElement('text', { x: 16, y: y - 18, class: 'glyph-guide-label' });
            title.textContent = label;
            const metric = svgElement('text', { x: width - 16, y: y - 18, 'text-anchor': 'end', class: 'glyph-guide-label' });
            metric.textContent = value;
            svg.append(title, metric);
        });
        const shape = svgElement('g', { transform: `translate(${(width - selected.advance) / 2} ${top}) scale(1 -1)` });
        shape.append(svgElement('path', { d: selected.path, class: mode === 'solid' ? 'glyph-solid' : 'glyph-outline' }));
        if (mode === 'anchors') {
            selected.segments.forEach(([a, b]) => shape.append(svgElement('line', {
                x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'glyph-handle-line'
            })));
            selected.handles.forEach(([x, y]) => shape.append(svgElement('circle', { cx: x, cy: y, r: 8, class: 'glyph-handle' })));
            selected.anchors.forEach(([x, y]) => shape.append(svgElement('rect', { x: x - 15, y: y - 15, width: 30, height: 30, class: 'glyph-anchor' })));
        }
        // Keep one stable filled hit area while the visible outline changes.
        // The fill is invisible but pointer events follow the actual glyph shape.
        shape.style.pointerEvents = 'none';
        svg.append(shape);
        const hit = svgElement('path', {
            d: selected.path,
            transform: `translate(${(width - selected.advance) / 2} ${top}) scale(1 -1)`,
            fill: 'transparent',
            'pointer-events': 'fill',
            class: 'glyph-hit'
        });
        hit.addEventListener('pointerenter', event => {
            if (event.pointerType === 'touch') return;
            hovered = true;
            updateMode();
        });
        hit.addEventListener('pointerleave', () => {
            hovered = false;
            updateMode();
        });
        svg.append(hit);
        stage.replaceChildren(svg);
        stage.setAttribute('aria-label', `${selected.char}, ${mode} view`);
        document.getElementById('glyph-selected').textContent = selected.char;
        document.getElementById('glyph-status').textContent = `${selected.char} · ${selected.name}`;
        buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(data.glyphs[index] === selected)));
    }

    data.glyphs.forEach((glyph, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'glyph-cell';
        button.textContent = glyph.char;
        button.setAttribute('aria-label', `${glyph.char}, ${glyph.name}`);
        button.setAttribute('aria-pressed', String(index === 0));
        button.addEventListener('click', () => { hovered = false; mode = focused ? 'anchors' : 'solid'; selected = glyph; render(); });
        buttons.push(button);
        grid.append(button);
    });
    // Pointer hover and keyboard focus reveal the original outline points.
    let hovered = false;
    let focused = false;
    const updateMode = () => {
        mode = hovered || focused ? 'anchors' : 'solid';
        const shape = stage.querySelector('svg > g');
        const path = shape.querySelector('path');
        path.setAttribute('class', mode === 'solid' ? 'glyph-solid' : 'glyph-outline');
        shape.querySelectorAll('.glyph-handle-line, .glyph-handle, .glyph-anchor').forEach(node => node.remove());
        if (mode === 'anchors') {
            selected.segments.forEach(([a, b]) => shape.append(svgElement('line', {
                x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'glyph-handle-line'
            })));
            selected.handles.forEach(([x, y]) => shape.append(svgElement('circle', { cx: x, cy: y, r: 8, class: 'glyph-handle' })));
            selected.anchors.forEach(([x, y]) => shape.append(svgElement('rect', { x: x - 15, y: y - 15, width: 30, height: 30, class: 'glyph-anchor' })));
        }
        stage.setAttribute('aria-label', `${selected.char}, ${mode} view`);
    };
    stage.addEventListener('focus', () => { focused = true; updateMode(); });
    stage.addEventListener('blur', () => { focused = false; updateMode(); });
    document.getElementById('glyph-count').textContent = `${data.glyphs.length} GLYPHS`;
    render();
}
init().catch(() => {
    stage.textContent = 'Glyph preview could not be loaded. Please refresh.';
    document.getElementById('glyph-status').textContent = 'Glyph data could not be loaded.';
});
