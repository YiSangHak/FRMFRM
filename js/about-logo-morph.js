const host = document.querySelector('.about-logo-cycle');
if (host) {
    init().catch(error => console.warn('FRMFRM logo animation:', error));
}
async function init() {
    const response = await fetch('./assets/logo/logo-morph.json');
    if (!response.ok) throw new Error('Logo data unavailable');
    const states = await response.json();
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 470 320');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('about-morph-svg');
    const paths = states[0].map(() => {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('fill-rule', 'evenodd');
        svg.append(path);
        return path;
    });
    const pathData = contours => contours.map(points => 'M' + points.map(p => p.join(',')).join('L') + 'Z').join('');
    const center = contours => {
        const points = contours.flat();
        const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
        return [(Math.min(...xs)+Math.max(...xs))/2, (Math.min(...ys)+Math.max(...ys))/2];
    };
    const hasShape = contours => {
        const points = contours.flat();
        return Math.max(...points.map(p=>p[0])) > Math.min(...points.map(p=>p[0]));
    };
    // Extra Rs begin/end directly on an existing R, with no fade or scaling.
    const outlineAt = (state, index) => {
        const outline = states[state][index];
        if (hasShape(outline)) return outline;
        return states[state][index === 6 ? 1 : 4];
    };
    const drawState = index => paths.forEach((path,i) => {
        path.setAttribute('d',pathData(outlineAt(index,i)));
    });
    drawState(0);
    host.replaceChildren(svg);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true, frame, previous, elapsed = 0;
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }).observe(host);
    function animate(time) {
        if (previous !== undefined && visible && !document.hidden && !reduced.matches) elapsed += Math.min(time-previous,100);
        previous=time;
        if (reduced.matches) drawState(0);
        else {
            const current=Math.floor(elapsed/1000)%4, next=(current+1)%4;
            const progress=Math.max(0,Math.min(1,(elapsed%1000-350)/650));
            if (!progress) drawState(current);
            else {
                const ease=progress*progress*(3-2*progress);
                paths.forEach((path,i) => {
                    const from=outlineAt(current,i), to=outlineAt(next,i);
                    const a=center(from), b=center(to);
                    // Translate intact outlines; never interpolate individual vertices.
                    const outline = progress < 0.5 ? from : to;
                    const origin=center(outline);
                    const x=a[0]+(b[0]-a[0])*ease, y=a[1]+(b[1]-a[1])*ease;
                    const contours=outline.map(points=>points.map(p=>[p[0]+x-origin[0],p[1]+y-origin[1]]));
                    path.setAttribute('d',pathData(contours));
                });
            }
        }
        frame=requestAnimationFrame(animate);
    }
    frame=requestAnimationFrame(animate);
    window.addEventListener('pagehide',()=>cancelAnimationFrame(frame),{once:true});
}
