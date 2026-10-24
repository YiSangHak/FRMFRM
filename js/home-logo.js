// Reveal vertices, trace outlines, then draw connected structural strokes.
(() => {
    document.querySelectorAll('.home-logo-assembly').forEach((svg, instance) => {
        const mobileLogo = svg.classList.contains('home-logo-mobile');
        const ns = 'http://www.w3.org/2000/svg';
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const visibleStroke = .5;
        const make = (tag, attributes = {}) => {
            const node = document.createElementNS(ns, tag);
            Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
            return node;
        };
        const paths = [...svg.querySelectorAll('[data-home-letter] > *')].map(shape => {
            const coordinates = shape.getAttribute('points')?.match(/-?\d*\.?\d+/g);
            const d = coordinates ? coordinates.reduce((text, number, i) => text + (i % 2 ? number : `${i ? ' L' : 'M'}${number},`), '') + ' Z' : shape.getAttribute('d');
            const path = make('path', { d, 'fill-rule': 'evenodd' });
            shape.replaceWith(path);
            return path;
        });
        const definitions = make('defs');
        svg.prepend(definitions);
    // Preserve all corners, including relative h/v/l commands and inner contours.
    function outlineVertices(d) {
        const tokens = d.match(/[MLHVZmlhvz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g);
        const result = [];
        let i = 0, command = '', x = 0, y = 0, startX = 0, startY = 0;
        while (i < tokens.length) {
            if (/^[a-z]$/i.test(tokens[i])) command = tokens[i++];
            const relative = command === command.toLowerCase();
            const kind = command.toUpperCase();
            if (kind === 'Z') { x = startX; y = startY; command = ''; continue; }
            if (kind === 'H') x = Number(tokens[i++]) + (relative ? x : 0);
            else if (kind === 'V') y = Number(tokens[i++]) + (relative ? y : 0);
            else if (kind === 'M' || kind === 'L') {
                x = Number(tokens[i++]) + (relative ? x : 0);
                y = Number(tokens[i++]) + (relative ? y : 0);
                if (kind === 'M') { startX = x; startY = y; command = relative ? 'l' : 'L'; }
            } else throw new Error('Unsupported logo outline command');
            result.push([Number(x.toFixed(4)), Number(y.toFixed(4))]);
        }
        return result;
    }

        // The three letters have separate construction paths and connection timings.
        // Each branch starts only after its parent stroke reaches the joint.
        const plans = [
            [
                // Equal travel speed forms the upper-left joint in both directions.
                { d: 'M10 0V100', width: 20, start: 0, duration: 700 },
                { d: 'M0 10H70', width: 20, start: 0, duration: 490 },
                { d: 'M10 50H70', width: 20, start: 350, duration: 420 }
            ],
            [
                { d: 'M10 0V100', width: 20, start: 0, duration: 700 },
                { d: 'M0 10H50L60 20V40L50 50H10', width: 22, start: 0, duration: 830 },
                { d: 'M45 50H50L60 60V100', width: 22, start: 620, duration: 430 }
            ],
            [
                { d: 'M10 0V100', width: 20, start: 0, duration: 700 },
                { d: 'M10 0L35 52L60 0', width: 28, start: 0, duration: 600 },
                { d: 'M60 0V100', width: 20, start: 600, duration: 500 }
            ]
        ];
        const strokeDrawDuration = 800;
        const constructions = paths.map((path, index) => {
            const vertices = outlineVertices(path.getAttribute('d'));
            const left = Math.min(...vertices.map(([x]) => x));
            const top = Math.min(...vertices.map(([, y]) => y));
            const edgeClip = make('clipPath', { id: `logo-edge-${instance}-${index}`, clipPathUnits: 'userSpaceOnUse' });
            edgeClip.append(make('path', { d: path.getAttribute('d'), 'clip-rule': 'evenodd' }));
            definitions.append(edgeClip);
            // Clip the combined fill and outline once, so their antialiased edges
            // share a single silhouette instead of stacking two different edges.
            path.parentElement.setAttribute('clip-path', `url(#${edgeClip.id})`);
            const mask = make('mask', { id: `logo-strokes-${instance}-${index}`, maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse', x: left-4, y: top-4, width: 78, height: 108 });
            mask.style.maskType = 'luminance';
            const group = make('g', { transform: `translate(${left} ${top})`, fill: 'none', stroke: 'white', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter' });
            const letterPlan = plans[index % 3];
            const letterEnd = Math.max(...letterPlan.map(plan => plan.start + plan.duration));
            const timeScale = strokeDrawDuration / letterEnd;
            const strokes = letterPlan.map(plan => {
                const node = make('path', { d: plan.d, 'stroke-width': plan.width });
                group.append(node);
                // Scale the whole construction together to preserve every joint dependency.
                return { node, ...plan, start: plan.start * timeScale, duration: plan.duration * timeScale };
            });
            mask.append(group);
            definitions.append(mask);
            const fill = make('path', { d: path.getAttribute('d'), 'fill-rule': 'evenodd', class: 'home-logo-fill' });
            path.before(fill);
            const glyph = path.parentElement;
            glyph.classList.add('logo-glyph');
            glyph.dataset.points = vertices.map(point => point.join(',')).join(' ');
            glyph.setAttribute('tabindex', '0');
            glyph.setAttribute('role', 'img');
            glyph.setAttribute('aria-label', `${'FRMFRM'[index]} · logo`);
            return { path, fill, mask, strokes, vertices };
        });
        const anchors = make('g', { fill: 'white', stroke: 'currentColor', 'stroke-width': visibleStroke, 'pointer-events': 'none' });
        const points = [], seen = new Set();
        constructions.forEach(({ vertices }) => vertices.forEach(([x,y]) => {
            const key = `${x},${y}`;
            if (seen.has(key)) return;
            seen.add(key);
            const point = make('rect');
            anchors.append(point);
            points.push({point,x,y});
        }));
        svg.append(anchors);
        function sizeAnchors() {
            const width = svg.getBoundingClientRect().width;
            if (!width) return;
            const scale = width / svg.viewBox.baseVal.width;
            const size = mobileLogo ? Math.max(2.2, 4 / scale) : 2.2;
            svg.dataset.anchorSize = String(size * scale);
            svg.dataset.anchorStroke = String(visibleStroke * scale);
            points.forEach(({ point, x, y }) => {
                point.setAttribute('x', x-size/2); point.setAttribute('y', y-size/2);
                point.setAttribute('width', size); point.setAttribute('height', size);
            });
        }
        new ResizeObserver(sizeAnchors).observe(svg);
        sizeAnchors();
        let animations = [], generation = 0;
        function finish() {
            generation++;
            animations.forEach(animation => animation.cancel());
            animations = [];
            constructions.forEach(({path,fill}) => {
                path.style.fillOpacity = '0'; path.style.strokeOpacity = '0';
                fill.removeAttribute('mask');
            });
            anchors.style.opacity = '0';
            svg.dataset.logoReady = 'true';
        }
        function play() {
            finish();
            if (reduced.matches || getComputedStyle(svg).display === 'none') return;
            svg.dataset.logoReady = 'false';
            const current = generation;
            const revealTimes = points.map(({x}) => 320+x/(mobileLogo?230:470)*650+Math.random()*90);
            const earliest = Math.min(...revealTimes), latest = Math.max(...revealTimes);
            const outlineStart = latest+500, outlineEnd = outlineStart+1200;
            const drawStart = outlineEnd+500;
            const drawDuration = strokeDrawDuration;
            const exitStart = drawStart+drawDuration+600;
            const total = exitStart+latest-earliest+1;
            anchors.style.opacity = '1';
            points.forEach(({point},i) => {
                point.style.opacity = '0';
                animations.push(point.animate([
                    {opacity:0,offset:0,easing:'steps(1,end)'},
                    {opacity:1,offset:revealTimes[i]/total,easing:'steps(1,end)'},
                    {opacity:0,offset:(exitStart+latest-revealTimes[i])/total},
                    {opacity:0,offset:1}
                ],{duration:total,fill:'both'}));
            });
            constructions.forEach(({path,fill,mask,strokes}) => {
                fill.setAttribute('mask',`url(#${mask.id})`);
                path.style.fillOpacity='0'; path.style.stroke='currentColor';
                path.style.strokeWidth=String(visibleStroke*2); path.style.strokeOpacity='0';
                const length=path.getTotalLength();
                path.style.strokeDasharray=`${length} ${length}`;
                path.style.strokeDashoffset=String(length);
                animations.push(path.animate([
                    {strokeDashoffset:String(length),strokeOpacity:1},
                    {strokeDashoffset:'0',strokeOpacity:1}
                ],{delay:outlineStart,duration:1200,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'}));
                const strokeAnimations = [];
                strokes.forEach(({node,start,duration}) => {
                    const length=node.getTotalLength();
                    node.style.strokeDasharray=`${length} ${length}`;
                    node.style.strokeDashoffset=String(length);
                    const animation = node.animate([
                        {strokeDashoffset:String(length)}, {strokeDashoffset:'0'}
                    ],{delay:drawStart+start,duration,easing:'linear',fill:'both'});
                    animations.push(animation);
                    strokeAnimations.push(animation);
                });
                Promise.all(strokeAnimations.map(animation => animation.finished)).then(() => {
                    if (generation === current) fill.removeAttribute('mask');
                }).catch(() => {});
                animations.push(path.animate([{strokeOpacity:1},{strokeOpacity:0}],{
                    delay:drawStart+drawDuration,duration:200,fill:'forwards'
                }));
            });
            Promise.all(animations.map(animation=>animation.finished)).then(()=>{if(generation===current)finish();}).catch(()=>{});
        }
        reduced.addEventListener('change',finish);
        matchMedia('(max-width: 767px)').addEventListener('change',play);
        window.addEventListener('pagehide',finish);
        window.addEventListener('pageshow',event=>{if(event.persisted)play();});
        play();
    });
})();
