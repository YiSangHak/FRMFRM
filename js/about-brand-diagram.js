const figure = document.querySelector('.about-brand-diagram');
if (figure) {
    const svg = figure.querySelector('svg');
    const orbits = [...svg.querySelectorAll('[data-orbit]')];
    const logo = svg.querySelector('.brand-diagram-center');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const states = orbits.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 }));
    let frame = 0, previous = 0, drag = null;
    const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
    const pointAt = event => new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const render = time => {
        const step = previous ? Math.min((time - previous) / 16.667, 2) : 1;
        previous = time;
        let moving = false;
        states.forEach((state, i) => {
            if (reduced.matches) { state.x = state.tx; state.y = state.ty; state.vx = state.vy = 0; }
            else {
                for (const axis of ['x', 'y']) {
                    const velocity = `v${axis}`, target = `t${axis}`;
                    state[velocity] = (state[velocity] + (state[target] - state[axis]) * .075 * step) * Math.pow(.76, step);
                    state[axis] += state[velocity] * step;
                    if (Math.abs(state[target] - state[axis]) + Math.abs(state[velocity]) > .025) moving = true;
                }
            }
            orbits[i].setAttribute('transform', `translate(${state.x} ${state.y})`);
        });
        logo.setAttribute('transform', `translate(${(states[0].x + states[1].x) / 2} ${(states[0].y + states[1].y) / 2})`);
        frame = moving ? requestAnimationFrame(render) : 0;
        if (!frame) previous = 0;
    };
    const wake = () => { if (!frame) frame = requestAnimationFrame(render); };
    const reset = () => { states.forEach(state => { state.tx = state.ty = 0; }); wake(); };
    svg.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const point = pointAt(event);
        const orbit = event.target.closest('[data-orbit]');
        const index = orbit ? Number(orbit.dataset.orbit) : (point.x < 400 ? 0 : 1);
        drag = { id: event.pointerId, index, x: point.x, y: point.y, startX: states[index].x, startY: states[index].y };
        svg.setPointerCapture(event.pointerId);
        figure.classList.add('is-dragging');
    });
    svg.addEventListener('pointermove', event => {
        const point = pointAt(event);
        if (drag) {
            if (drag.id !== event.pointerId) return;
            const state = states[drag.index];
            state.tx = clamp(drag.startX + (point.x - drag.x) * .65, 38);
            state.ty = clamp(drag.startY + (point.y - drag.y) * .65, 26);
            const other = states[1 - drag.index];
            other.tx = -state.tx * .22;
            other.ty = -state.ty * .22;
        } else {
            if (event.pointerType === 'touch') return;
            const x = clamp((point.x - 400) / 400, 1), y = clamp((point.y - 240) / 240, 1);
            states.forEach((state, i) => {
                state.tx = x * (i === 0 ? 15 : 23);
                state.ty = y * (i === 0 ? 16 : -12);
            });
        }
        wake();
    });
    const release = event => {
        if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.id)) return;
        const id = drag.id;
        drag = null;
        figure.classList.remove('is-dragging');
        if (svg.hasPointerCapture(id)) svg.releasePointerCapture(id);
        reset();
    };
    svg.addEventListener('pointerup', release);
    svg.addEventListener('pointercancel', release);
    svg.addEventListener('lostpointercapture', release);
    svg.addEventListener('pointerleave', () => { if (!drag) reset(); });
    window.addEventListener('blur', release);
    window.addEventListener('pagehide', () => cancelAnimationFrame(frame), { once: true });
}
