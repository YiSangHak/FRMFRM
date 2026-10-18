const host = document.querySelector('.about-logo-inspector');
if (host) {
    const svg = host.querySelector('.about-inspector-svg');
    const glyphs = [...host.querySelectorAll('.logo-glyph')];
    const ns = 'http://www.w3.org/2000/svg';
    // Draw in screen pixels so handles and labels keep their size at every breakpoint.
    const hud = document.createElement('div');
    hud.className = 'logo-inspector-hud';
    hud.setAttribute('aria-hidden', 'true');
    const drawing = document.createElementNS(ns, 'svg');
    const guides = document.createElementNS(ns, 'g');
    const marker = document.createElementNS(ns, 'circle');
    marker.setAttribute('class', 'logo-pointer-dot');
    marker.setAttribute('r', '2.5');
    drawing.append(guides, marker);
    const labels = Array.from({ length: 3 }, () => {
        const label = document.createElement('span');
        label.className = 'logo-coordinate-label';
        return label;
    });
    hud.append(drawing, ...labels);
    document.body.append(hud);
    let active = null;
    let pointer = null;
    let frame = 0;
    const create = (tag, attrs) => {
        const node = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
        guides.append(node);
    };
    const labelAt = (label, text, x, y) => {
        label.textContent = text;
        label.style.left = `${Math.max(8, Math.min(x, innerWidth - label.offsetWidth - 8))}px`;
        label.style.top = `${Math.max(8, Math.min(y, innerHeight - 22))}px`;
    };
    const draw = () => {
        frame = 0;
        if (!active) return;
        const matrix = svg.getScreenCTM();
        const transform = active.getScreenCTM();
        if (!matrix || !transform) return;
        const box = active.getBoundingClientRect();
        const origin = new DOMPoint(0, 0).matrixTransform(active.transform.baseVal.consolidate().matrix);
        const { left: x, top: y, right, bottom, width, height } = box;
        // No viewBox: overlay units are CSS pixels, just like getScreenCTM().
        // innerWidth includes the scrollbar; using it as a viewBox rescales and
        // centers the drawing inside the narrower layout viewport.
        guides.replaceChildren();
        [x, right].forEach(value => create('line', { x1: value, y1: 0, x2: value, y2: innerHeight, class: 'logo-guide' }));
        [y, bottom].forEach(value => create('line', { x1: 0, y1: value, x2: innerWidth, y2: value, class: 'logo-guide' }));
        create('rect', { x, y, width, height, class: 'logo-selection' });
        active.dataset.points.split(' ').forEach(pair => {
            const [px, py] = pair.split(',').map(Number);
            const point = new DOMPoint(px, py).matrixTransform(transform);
            create('rect', { x: point.x - 2.5, y: point.y - 2.5, width: 5, height: 5, class: 'logo-anchor' });
        });
        [[x,y], [right,y], [x,bottom], [right,bottom]].forEach(([px,py]) => {
            create('rect', { x: px - 3, y: py - 3, width: 6, height: 6, class: 'logo-anchor' });
        });
        labelAt(labels[0], `(${origin.x}, ${origin.y})`, x, y - 23);
        labelAt(labels[1], `(${origin.x + 70}, ${origin.y + 100})`, right + 9, bottom + 7);
        marker.style.display = pointer ? '' : 'none';
        labels[2].style.display = pointer ? '' : 'none';
        if (pointer) {
            const point = new DOMPoint(pointer.x, pointer.y).matrixTransform(matrix.inverse());
            create('line', { x1: pointer.x, y1: 0, x2: pointer.x, y2: innerHeight, class: 'logo-guide logo-pointer-guide' });
            create('line', { x1: 0, y1: pointer.y, x2: innerWidth, y2: pointer.y, class: 'logo-guide logo-pointer-guide' });
            marker.setAttribute('cx', pointer.x);
            marker.setAttribute('cy', pointer.y);
            const text = `X ${point.x.toFixed(1)}  Y ${point.y.toFixed(1)}`;
            // Put the live readout above the cursor near the lower selection edge.
            const nearBottom = Math.abs(pointer.y - bottom) < 32;
            labelAt(labels[2], text, pointer.x + 13, pointer.y + (nearBottom ? -27 : 13));
        }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const show = glyph => {
        active = glyph;
        glyphs.forEach(item => item.classList.toggle('is-active', item === glyph));
        hud.classList.add('is-visible');
        schedule();
    };
    const clear = () => {
        active = null;
        pointer = null;
        hud.classList.remove('is-visible');
        glyphs.forEach(glyph => glyph.classList.remove('is-active'));
    };
    glyphs.forEach(glyph => {
        glyph.addEventListener('focus', () => { pointer = null; show(glyph); });
    });
    svg.addEventListener('pointermove', event => {
        pointer = { x: event.clientX, y: event.clientY };
        // Use the glyph bounds, including counters, for stable selection.
        const glyph = glyphs.find(item => {
            const box = item.getBoundingClientRect();
            return pointer.x >= box.left && pointer.x <= box.right && pointer.y >= box.top && pointer.y <= box.bottom;
        });
        if (glyph) show(glyph);
        else if (active) schedule();
    });
    svg.addEventListener('pointerdown', event => {
        const glyph = event.target.closest('.logo-glyph');
        if (glyph) { pointer = { x: event.clientX, y: event.clientY }; show(glyph); }
    });
    host.addEventListener('pointerleave', clear);
    host.addEventListener('focusout', event => { if (!host.contains(event.relatedTarget)) clear(); });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', clear, { passive: true });
    window.addEventListener('blur', clear);
}
