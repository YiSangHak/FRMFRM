document.querySelectorAll('.about-logo-inspector, .home-logo-assembly').forEach(host => {
    const svg = host.matches('.home-logo-assembly') ? host : host.querySelector('.about-inspector-svg');
    const glyphs = [...host.querySelectorAll('.logo-glyph')];
    const hitShapes = glyphs.map(glyph => ({ glyph, shape: glyph.querySelector('.home-logo-fill') || glyph.querySelector('path') }));
    const glyphAt = (clientX, clientY) => {
        for (const { glyph, shape } of hitShapes) {
            if (!shape) continue;
            const matrix = shape.getScreenCTM();
            if (!matrix) continue;
            const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
            // Test filled geometry even while the visible glyph is an outline.
            if (shape.isPointInFill(point)) return glyph;
        }
        return null;
    };
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
    const anchorLabels = document.createElement('div');
    hud.append(drawing, anchorLabels, ...labels);
    labels[0].style.display = labels[1].style.display = 'none';
    document.body.append(hud);
    let active = null;
    let pointer = null;
    let frame = 0;
    let retainedTouch = null;
    let touchPointerId = null;
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
        if (!box.width || box.bottom < 0 || box.top > innerHeight) {
            hud.classList.remove('is-visible');
            return;
        }
        hud.classList.add('is-visible');
        if (retainedTouch) {
            const screenPoint = new DOMPoint(retainedTouch.x, retainedTouch.y).matrixTransform(matrix);
            pointer = { x: screenPoint.x, y: screenPoint.y };
        }
        const { left: x, top: y, right, bottom, width, height } = box;
        // No viewBox: overlay units are CSS pixels, just like getScreenCTM().
        // innerWidth includes the scrollbar; using it as a viewBox rescales and
        // centers the drawing inside the narrower layout viewport.
        guides.replaceChildren();
        [x, right].forEach(value => create('line', { x1: value, y1: 0, x2: value, y2: innerHeight, class: 'logo-guide' }));
        [y, bottom].forEach(value => create('line', { x1: 0, y1: value, x2: innerWidth, y2: value, class: 'logo-guide' }));
        create('rect', { x, y, width, height, class: 'logo-selection' });
        const homeLogo = svg.classList.contains('home-logo-assembly');
        const anchorSize = homeLogo ? Number(svg.dataset.anchorSize) || 5 : 5;
        const cornerSize = homeLogo ? anchorSize : 6;
        const anchorStyle = 'stroke-width: .8px';
        const annotatedPoints = [];
        const seenPoints = new Set();
        const rememberPoint = (screenX, screenY) => {
            const local = new DOMPoint(screenX, screenY).matrixTransform(matrix.inverse());
            const text = `(${Number(local.x.toFixed(2))}, ${Number(local.y.toFixed(2))})`;
            if (!seenPoints.has(text)) { seenPoints.add(text); annotatedPoints.push({ x: screenX, y: screenY, text }); }
        };
        active.dataset.points.split(' ').forEach(pair => {
            const [px, py] = pair.split(',').map(Number);
            const point = new DOMPoint(px, py).matrixTransform(transform);
            rememberPoint(point.x, point.y);
            create('rect', { x: point.x - anchorSize / 2, y: point.y - anchorSize / 2, width: anchorSize, height: anchorSize, class: 'logo-anchor', style: anchorStyle });
        });
        [[x,y], [right,y], [x,bottom], [right,bottom]].forEach(([px,py]) => {
            rememberPoint(px, py);
            create('rect', { x: px - cornerSize / 2, y: py - cornerSize / 2, width: cornerSize, height: cornerSize, class: 'logo-anchor', style: anchorStyle });
        });
        anchorLabels.replaceChildren();
        const occupied = [];
        annotatedPoints.forEach(point => {
            const label = document.createElement('span');
            label.className = 'logo-coordinate-label';
            label.textContent = point.text;
            anchorLabels.append(label);
            const w = label.offsetWidth, h = label.offsetHeight || 17;
            const candidates = [];
            for (let row = 0; row < 8; row++) {
                for (const left of [point.x + 8, point.x - w - 8]) {
                    candidates.push([left, point.y - h - 5 - row * (h + 2)], [left, point.y + 5 + row * (h + 2)]);
                }
            }
            const fit = candidates.map(([left, top]) => [Math.max(8, Math.min(left, innerWidth-w-8)), Math.max(8, Math.min(top, innerHeight-h-8))]);
            const position = fit.find(([left, top]) => !occupied.some(box => left < box.right && left+w > box.left && top < box.bottom && top+h > box.top)) || fit[0];
            const [left, top] = position;
            label.style.left = `${left}px`;
            label.style.top = `${top}px`;
            occupied.push({left:left-2,top:top-2,right:left+w+2,bottom:top+h+2});
            if (Math.hypot(left-point.x, top-point.y) > 40) {
                create('line', { x1: point.x, y1: point.y, x2: left + (left < point.x ? w : 0), y2: top+h/2, class: 'logo-guide' });
            }
        });
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
        if (svg.dataset.logoReady === 'false') return;
        active = glyph;
        glyphs.forEach(item => item.classList.toggle('is-active', item === glyph));
        hud.classList.add('is-visible');
        schedule();
    };
    const clear = () => {
        active = null;
        pointer = null;
        retainedTouch = null;
        hud.classList.remove('is-visible');
        glyphs.forEach(glyph => glyph.classList.remove('is-active'));
    };
    glyphs.forEach(glyph => {
        glyph.addEventListener('focus', () => {
            if (retainedTouch || !glyph.matches(':focus-visible')) return;
            pointer = null; show(glyph);
        });
    });
    const updatePointer = (event, touch) => {
        if (svg.dataset.logoReady === 'false') return;
        pointer = { x: event.clientX, y: event.clientY };
        if (touch) {
            const matrix = svg.getScreenCTM();
            if (matrix) {
                const point = new DOMPoint(pointer.x, pointer.y).matrixTransform(matrix.inverse());
                retainedTouch = { x: point.x, y: point.y };
            }
        } else retainedTouch = null;
        const glyph = glyphAt(event.clientX, event.clientY);
        if (glyph) show(glyph);
        else clear();
    };
    svg.addEventListener('pointermove', event => {
        const touch = event.pointerType === 'touch' || event.pointerType === 'pen';
        if (touch && event.pointerId !== touchPointerId) return;
        updatePointer(event, touch);
    });
    svg.addEventListener('pointerdown', event => {
        if (svg.dataset.logoReady === 'false') return;
        const touch = event.pointerType === 'touch' || event.pointerType === 'pen';
        if (touch) {
            // Only gestures that begin on an actual glyph face belong to the inspector.
            if (!glyphAt(event.clientX, event.clientY) || touchPointerId !== null) return;
            touchPointerId = event.pointerId;
            svg.setPointerCapture(event.pointerId);
        }
        updatePointer(event, touch);
    });
    const releaseTouch = event => {
        if (event.pointerId !== touchPointerId) return;
        touchPointerId = null;
        if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
        // Keep the last SVG-local position after the finger leaves the screen.
        schedule();
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => svg.addEventListener(type, releaseTouch));
    host.addEventListener('pointerleave', () => { if (!retainedTouch) clear(); });
    host.addEventListener('focusout', event => { if (!retainedTouch && !host.contains(event.relatedTarget)) clear(); });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', () => { if (retainedTouch) schedule(); else clear(); }, { passive: true });
    window.addEventListener('blur', clear);
});
