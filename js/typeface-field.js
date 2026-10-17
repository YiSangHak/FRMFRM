const lab = document.getElementById('mono-lab');
if (lab) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const panels = lab.querySelectorAll('[data-study]');
    // Pointer movement affects only the panel being explored; no idle render loop.
    panels.forEach(panel => {
        let pending = 0;
        const update = event => {
            if (reducedMotion.matches) return;
            const rect = panel.getBoundingClientRect();
            const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
            const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
            cancelAnimationFrame(pending);
            pending = requestAnimationFrame(() => {
                panel.style.setProperty('--mx', x.toFixed(3));
                panel.style.setProperty('--my', y.toFixed(3));
                if (panel.dataset.study === 'orbit') {
                    panel.style.setProperty('--dial-angle', `${Math.atan2(y, x) * 180 / Math.PI + 90}deg`);
                }
            });
        };
        panel.addEventListener('pointermove', update);
        panel.addEventListener('pointerleave', () => {
            cancelAnimationFrame(pending);
            panel.style.setProperty('--mx', '0');
            panel.style.setProperty('--my', '0');
        });
    });

    const construction = lab.querySelector('[data-study="construction"]');
    const alphabet = ['M', 'F', 'R', 'A', 'E', 'H'];
    let glyphIndex = 0;
    let glyphData;
    function drawConstruction() {
        const char = alphabet[glyphIndex];
        construction.querySelector('[data-construction-char]').textContent = char;
        construction.setAttribute('aria-label', `Construction diagram of ${char}. Activate to change letter.`);
        const group = construction.querySelector('.lab-glyph-shape');
        group.replaceChildren();
        const glyph = glyphData?.glyphs.find(item => item.char === char);
        if (!glyph) return;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', glyph.path);
        group.append(path);
        // Anchor marks reveal the actual orthogonal construction of this typeface.
        glyph.anchors.forEach(([x, y]) => {
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            dot.setAttribute('x', x - 8);
            dot.setAttribute('y', y - 8);
            dot.setAttribute('width', 16);
            dot.setAttribute('height', 16);
            dot.setAttribute('fill', '#fff');
            dot.setAttribute('stroke-width', 3);
            group.append(dot);
        });
    }
    construction.addEventListener('click', () => { glyphIndex = (glyphIndex + 1) % alphabet.length; drawConstruction(); });
    fetch('./assets/typeface/frmfrm-mono-glyphs.json')
        .then(response => { if (!response.ok) throw new Error('Glyph data unavailable'); return response.json(); })
        .then(data => { glyphData = data; drawConstruction(); })
        .catch(() => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', 200); text.setAttribute('y', 300);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('style', 'font:280px "FRMFRM Mono";letter-spacing:0');
            text.textContent = 'M'; construction.querySelector('svg').append(text);
        });

    const orbit = lab.querySelector('[data-study="orbit"]');
    const ring = orbit.querySelector('.lab-orbit-ring');
    const ticks = orbit.querySelector('.lab-orbit-ticks');
    const dialLetters = 'FRMFRMMONO!?';
    [...dialLetters].forEach((char, index) => {
        const letter = document.createElement('span');
        letter.className = 'lab-orbit-letter';
        letter.style.setProperty('--angle', `${index * 360 / dialLetters.length}deg`);
        letter.textContent = char;
        ring.append(letter);
    });
    for (let i = 0; i < 60; i++) {
        const tick = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tick.setAttribute('d', `M200 48V${i % 5 ? 54 : 64}`);
        tick.setAttribute('transform', `rotate(${i * 6} 200 200)`);
        ticks.append(tick);
    }
    let turns = 0;
    orbit.addEventListener('click', () => {
        turns++;
        orbit.style.setProperty('--dial-angle', `${turns * 90}deg`);
        orbit.querySelector('.lab-orbit-core').textContent = dialLetters[turns % dialLetters.length];
    });

    const reels = lab.querySelector('[data-study="reels"]');
    const reelWindow = reels.querySelector('.lab-reel-window');
    const smallBoard = window.matchMedia('(max-width: 767px)');
    const reelAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!()+-.=?[]_{|} ';
    const scenes = ['FRAME / STOOL', 'FRMFRM MONO', 'SPATIAL STUDY', 'FRMFRM MONO / LARGE LETTERS', 'STRUCTURAL RHYTHM', 'FRAME / CHAIR', 'PROFILE SECTION', 'STOOL / ISOMETRIC FRAME'];
    let messageIndex = 0, boardCells = [], boardFrame = 0, boardVisible = false;
    let targets = [], columns = 48, rows = 22;
    const hoverTimers = new Map();
    const boardCache = new Map();
    function boardText() {
        columns = smallBoard.matches ? 24 : 48;
        rows = 22;
        const cacheKey = `${columns}:${messageIndex}`;
        const applyBoardMetadata = () => {
            reels.style.setProperty('--board-columns', columns);
            reels.style.setProperty('--board-rows', rows);
            reels.setAttribute('aria-label', `${scenes[messageIndex]}. Split-flap character art. Activate for the next composition.`);
        };
        if (boardCache.has(cacheKey)) { targets = boardCache.get(cacheKey); applyBoardMetadata(); return; }
        const grid = Array.from({ length: rows }, () => Array(columns).fill(' '));
        const put = (x, y, char) => { if (x >= 0 && x < columns && y >= 0 && y < rows) grid[y][x] = char; };
        const text = (word, y, x = Math.floor((columns - word.length) / 2)) => [...word].forEach((char, i) => put(x + i, y, char));
        const line = (x1, y1, x2, y2, char) => {
            const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
            for (let i = 0; i <= steps; i++) put(Math.round(x1 + (x2 - x1) * i / Math.max(steps, 1)), Math.round(y1 + (y2 - y1) * i / Math.max(steps, 1)), char);
        };
        // Rasterize each glyph separately, with a guaranteed empty column between letters.
        // Area sampling preserves complete strokes instead of testing a single pixel.
        const largeWord = (word, top, height) => {
            const gap = 1;
            const measure = document.createElement('canvas').getContext('2d');
            measure.font = '100px "FRMFRM Mono"';
            const metricsList = [...word].map(char => measure.measureText(char));
            const maxWidth = Math.max(...metricsList.map(m => m.actualBoundingBoxLeft + m.actualBoundingBoxRight));
            const maxHeight = Math.max(...metricsList.map(m => m.actualBoundingBoxAscent + m.actualBoundingBoxDescent));
            const usable = columns - (word.length - 1) * gap;
            const scale = Math.min(usable * 16 / word.length / maxWidth, height * 16 / (maxHeight * .78));
            const cellWidth = Math.floor(maxWidth * scale / 16);
            const start = Math.floor((columns - (cellWidth * word.length + (word.length - 1) * gap)) / 2);
            [...word].forEach((char, index) => {
                const left = start + index * (cellWidth + gap);
                const bitmap = document.createElement('canvas');
                bitmap.width = cellWidth * 16; bitmap.height = height * 16;
                const context = bitmap.getContext('2d', { willReadFrequently: true });
                context.font = '100px "FRMFRM Mono"';
                const metrics = context.measureText(char);
                const inkWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
                const inkHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
                const glyphScale = Math.min(bitmap.width / inkWidth, bitmap.height / (inkHeight * .78));
                context.translate((bitmap.width - inkWidth * glyphScale) / 2, (bitmap.height - inkHeight * glyphScale * .78) / 2);
                context.scale(glyphScale, glyphScale * .78);
                context.fillStyle = '#fff';
                context.fillText(char, metrics.actualBoundingBoxLeft, metrics.actualBoundingBoxAscent);
                const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
                for (let y = 0; y < height; y++) for (let x = 0; x < cellWidth; x++) {
                    let coverage = 0;
                    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
                        coverage += pixels[((y * 16 + py) * bitmap.width + x * 16 + px) * 4 + 3];
                    }
                    if (coverage / (256 * 255) >= .38) put(left + x, top + y, 'M');
                }
            });
        };
        if (messageIndex === 0) {
            const cx = Math.floor(columns / 2), half = smallBoard.matches ? 9 : 13;
            const a = [cx - half, 4], b = [cx + half - 5, 4], c = [cx + half, 7], d = [cx - half + 5, 7];
            [ [a,b], [b,c], [c,d], [d,a] ].forEach(([p,q]) => line(...p,...q,'='));
            [a,b,c,d].forEach(([x,y]) => { line(x,y+1,x,y+10,'|'); put(x,y,'+'); put(x,y+10,'+'); });
            line(a[0],14,b[0],14,'-'); line(b[0],14,c[0],17,'-');
            line(c[0],17,d[0],17,'='); line(d[0],17,a[0],14,'-');
            [a,b,c,d].forEach(([x,y]) => { put(x,y,'+'); put(x,y+10,'+'); });

        } else if (messageIndex === 1) {
            if (smallBoard.matches) {
                largeWord('FRM', 0, 9); largeWord('FRM', 10, 9); text('MONO', 21);
            } else {
                largeWord('FRMFRM', 4, 12); text('FRMFRM MONO', 19);
            }
        } else if (messageIndex === 2) {
            const cx = (columns - 1) / 2, cy = 10.5;
            for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
                const nx = (x - cx) / (columns * .35), ny = (y - cy) / 7.5;
                const radius = nx * nx + ny * ny;
                if (Math.abs(radius - 1) < .14) put(x, y, '+');
                else if (radius < 1 && (Math.abs(nx) < .055 || Math.abs(ny) < .07)) put(x,y, Math.abs(nx) < .055 ? '|' : '-');
                else if (radius < 1 && (Math.abs(nx * nx * 4 + ny * ny - 1) < .19 || Math.abs(nx * nx + ny * ny * 5 - 1) < .2)) put(x,y,'.');
            }

        } else if (messageIndex === 3) {
            if (smallBoard.matches) {
                largeWord('FRM', 0, 9); largeWord('FRM', 10, 9); text('MONO', 21);
            } else {
                largeWord('FRMFRM', 1, 9); largeWord('MONO', 12, 9);
            }
        } else if (messageIndex === 4) {
            for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
                const wave = Math.sin(x * .28) * 3.2 + Math.cos(x * .13) * 2;
                const distance = Math.abs(y - 10 - wave);
                if (distance < 1.2) put(x,y,'FRMFRM'[x % 6]);
                else if (distance < 2.8) put(x,y,'+');
                else if (distance < 4.4) put(x,y,'.');
            }

        } else if (messageIndex === 5) {
            const cx = Math.floor(columns / 2);
            const width = smallBoard.matches ? 7 : 10;
            const backLeft = cx - width, backRight = cx + width - 4;
            line(backLeft, 2, backRight, 2, '=');
            line(backLeft, 2, backLeft, 10, '|');
            line(backRight, 2, backRight, 10, '|');
            line(backLeft, 6, backRight, 6, '-');
            const corners = [[backLeft,10], [backRight,10], [backRight+4,13], [backLeft+4,13]];
            corners.forEach(([x,y],i) => {
                const next = corners[(i + 1) % 4];
                line(x,y,...next,'=');
                line(x,y+1,x,y+7,'|');
                put(x,y,'+'); put(x,y+7,'+');
            });
            line(backLeft+4,18,backRight+4,18,'-');
            [[backLeft,2],[backRight,2]].forEach(([x,y]) => put(x,y,'+'));
        } else if (messageIndex === 6) {
            // Four identical quadrants form an orthogonal profile cross-section.
            const cx = Math.floor(columns / 2), cy = 10;
            for (let y = -8; y <= 8; y++) for (let x = -10; x <= 10; x++) {
                const ax = Math.abs(x), ay = Math.abs(y);
                let char = ' ';
                if ((ay === 8 && ax >= 5) || (ay === 4 && ax >= 5) || (ay === 2 && ax <= 2)) char = '=';
                if ((ax === 10 && ay >= 4) || (ax === 5 && ay >= 4) || (ax === 2 && ay <= 2)) char = '|';
                if ((ax === 5 && ay === 4) || (ax === 10 && ay === 8) || (ax === 2 && ay === 2)) char = '+';
                if (ax >= 3 && ax <= 5 && ay === ax - 1) char = '+';
                if (char !== ' ') put(cx+x,cy+y,char);
            }
            put(cx,cy,'+');
        } else if (messageIndex === 7) {
            // Symmetric axonometric seat and cubic frame, centered on the board.
            const cx = Math.floor(columns / 2);
            const half = smallBoard.matches ? 10 : 13;
            const top = [cx, 2], right = [cx + half, 6];
            const front = [cx, 10], left = [cx - half, 6];
            const drop = 10;
            // Recessed rear rails stay light, so the visible frame reads first.
            line(top[0], top[1] + 2, top[0], top[1] + drop, '.');
            line(cx - half, 6 + drop, cx, 2 + drop, '.');
            line(cx, 2 + drop, cx + half, 6 + drop, '.');
            // A restrained surface texture distinguishes the seat from the open frame.
            for (let y = 3; y < 10; y++) for (let x = cx - half + 1; x < cx + half; x++) {
                if (Math.abs(x - cx) / half + Math.abs(y - 6) / 4 < .85) put(x, y, (x + y) % 3 === 0 ? '-' : '.');
            }
            [[top,right], [right,front], [front,left], [left,top]].forEach(([a,b]) => line(...a,...b,'='));
            [[left,front], [front,right]].forEach(([a,b]) => {
                line(a[0], a[1] + 1, b[0], b[1] + 1, '-');
                line(a[0], a[1] + drop, b[0], b[1] + drop, '=');
            });
            [left, front, right].forEach(([x,y]) => {
                line(x,y+1,x,y+drop,'|');
                put(x,y,'+'); put(x,y+drop,'+');
            });
            put(...top,'+');
        }
        targets = grid.flat();
        boardCache.set(cacheKey, targets);
        applyBoardMetadata();
    }
    function settleBoard() {
        cancelAnimationFrame(boardFrame); boardFrame = 0;
        hoverTimers.forEach(timer => clearTimeout(timer)); hoverTimers.clear();
        boardCells.forEach((cell, index) => {
            cell.firstChild.textContent = targets[index] || ' ';
            cell.classList.remove('is-flipping');
        });
    }
    function buildBoard() {
        cancelAnimationFrame(boardFrame); boardFrame = 0;
        boardText();
        boardCells = targets.map((char, index) => {
            const cell = document.createElement('span'); cell.className = 'lab-flap';
            const letter = document.createElement('span'); letter.textContent = char;
            cell.dataset.index = index;
            cell.append(letter); return cell;
        });
        reelWindow.replaceChildren(...boardCells);
    }
    function rollBoard() {
        settleBoard();
        boardText();
        if (reducedMotion.matches || !boardVisible || document.hidden) { settleBoard(); return; }
        const start = performance.now();
        let lastStep = -1;
        const tickInterval = smallBoard.matches ? 95 : 65;
        const finished = new Uint8Array(boardCells.length);
        boardCells.forEach(cell => cell.classList.remove('is-flipping'));
        const tick = now => {
            const elapsed = now - start;
            const step = Math.floor(elapsed / tickInterval);
            let active = false;
            if (step !== lastStep) {
                boardCells.forEach((cell, index) => {
                    if (finished[index]) return;
                    const delay = index % columns * 14 + Math.floor(index / columns) * 32;
                    const duration = 430 + index % 7 * 65;
                    if (targets[index] === ' ' && cell.firstChild.textContent === ' ') { finished[index] = 1; return; }
                    const local = elapsed - delay;
                    if (local < 0) { active = true; return; }
                    if (local < duration) {
                        active = true;
                        cell.classList.add('is-flipping');
                        const char = reelAlphabet[(step * 7 + index * 11) % reelAlphabet.length];
                        if (cell.firstChild.textContent !== char) cell.firstChild.textContent = char;
                    } else {
                        cell.classList.remove('is-flipping');
                        if (cell.firstChild.textContent !== targets[index]) cell.firstChild.textContent = targets[index];
                        finished[index] = 1;
                    }
                });
                lastStep = step;
            } else active = true;
            if (active) boardFrame = requestAnimationFrame(tick);
            else { boardFrame = 0; settleBoard(); }
        };
        boardFrame = requestAnimationFrame(tick);
    }
    buildBoard();
    document.fonts.load('100px \"FRMFRM Mono\"').then(() => { boardCache.clear(); if ((messageIndex === 1 || messageIndex === 3) && !boardFrame) { boardText(); settleBoard(); } });
    reelWindow.addEventListener('pointermove', event => {
        if (boardFrame || reducedMotion.matches || event.pointerType === 'touch') return;
        const cell = event.target.closest('.lab-flap');
        if (!cell || hoverTimers.has(cell)) return;
        cell.classList.add('is-flipping');
        cell.firstChild.textContent = reelAlphabet[Math.floor(Math.random() * (reelAlphabet.length - 1))];
        hoverTimers.set(cell, setTimeout(() => {
            cell.firstChild.textContent = targets[Number(cell.dataset.index)];
            cell.classList.remove('is-flipping'); hoverTimers.delete(cell);
        }, 220));
    });
    reels.addEventListener('click', () => { messageIndex = (messageIndex + 1) % scenes.length; rollBoard(); });
    smallBoard.addEventListener('change', buildBoard);
    let boardEntered = false;
    new IntersectionObserver(entries => {
        boardVisible = entries[0].isIntersecting;
        if (!boardVisible) settleBoard();
        else if (!boardEntered) { boardEntered = true; rollBoard(); }
    }, { threshold: .15 }).observe(reels);
    document.addEventListener('visibilitychange', () => { if (document.hidden) settleBoard(); });
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) settleBoard(); });

    const echo = lab.querySelector('[data-study="echo"]');
    const echoLayers = echo.querySelectorAll('.lab-echo-stage > span');
    const echoWords = ['FRAME', 'FORMS', 'MONO!'];
    let echoIndex = 0;
    echoLayers.forEach((layer, index) => layer.style.setProperty('--layer', index - 3));
    echo.addEventListener('click', () => {
        echoIndex = (echoIndex + 1) % echoWords.length;
        echoLayers.forEach(layer => { layer.textContent = echoWords[echoIndex]; });
    });

    const svgNode = (tag, attributes) => {
        const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
        return node;
    };
    // These diagrams share the pointer controls, with no autonomous animation loop.
    function graphicPointer(panel, render) {
        let frame = 0;
        panel.addEventListener('pointermove', event => {
            if (reducedMotion.matches) return;
            const rect = panel.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width * 2 - 1;
            const y = (event.clientY - rect.top) / rect.height * 2 - 1;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => render(x, y));
        });
        panel.addEventListener('pointerleave', () => { cancelAnimationFrame(frame); render(0, 0); });
    }
    const projection = lab.querySelector('[data-study="projection"]');
    let projectionPhase = 0;
    function renderProjection(x = 0, y = 0) {
        const forms = projection.querySelector('[data-projection-forms]');
        const fragment = document.createDocumentFragment();
        [ [155, 28], [285, 52], [455, 92] ].forEach(([cx, baseRadius], index) => {
            const radius = baseRadius * (1 + x * .12);
            const group = svgNode('g', { transform: `translate(${cx} 200)` });
            const fill = ['#fff', '#aaa', '#f9f9f9'][(index + projectionPhase) % 3];
            group.append(svgNode('circle', { r: radius, fill, stroke: '#111', 'stroke-width': .8 }));
            if (index === 2 || projectionPhase === 2) {
                group.append(svgNode('ellipse', { rx: radius * (.22 + Math.abs(x) * .3), ry: radius, fill: 'none', stroke: '#555', 'stroke-width': .8, transform: `rotate(${y * 30})` }));
                group.append(svgNode('ellipse', { rx: radius, ry: radius * (.26 + Math.abs(y) * .3), fill: 'none', stroke: '#555', 'stroke-width': .8 }));
            }
            group.append(svgNode('path', { d: `M${-radius - 7} 0H${radius + 7}M0 ${-radius - 7}V${radius + 7}`, fill: 'none', stroke: '#555', 'stroke-width': .7 }));
            group.append(svgNode('path', { d: 'M-5 -5L5 5', fill: 'none', stroke: '#111', 'stroke-width': .8 }));
            fragment.append(group);
        });
        forms.replaceChildren(fragment);
    }
    projection.addEventListener('click', () => { projectionPhase = (projectionPhase + 1) % 3; renderProjection(); });
    graphicPointer(projection, renderProjection);
    renderProjection();

    const comparison = lab.querySelector('[data-study="comparison"]');
    const comparisonDrawing = comparison.querySelector('[data-comparison-drawing]');
    let collapsed = false, collapseAmount = 0, comparisonFrame = 0;
    let viewX = 0, viewY = 0, chairModel = null;
    function renderComparison() {
        const fragment = document.createDocumentFragment();
        const scale = 1.9;
        const faceDepth = 160;
        const yaw = Math.PI / 4 + viewX * .16;
        const tilt = .5 + viewY * .04;
        const depthFactor = 1 - collapseAmount;
        const project = (x,y,z) => [360 - collapseAmount * 60 + (x * Math.cos(yaw) - z * depthFactor * Math.sin(yaw)) * scale, 225 + ((x * Math.sin(yaw) + z * depthFactor * Math.cos(yaw)) * tilt - y) * scale];
        const path = (points, attributes = {}) => {
            const node = svgNode('path', { d: points.map((p,i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' '), fill:'none', ...attributes });
            fragment.append(node); return node;
        };
        const label = (value,x,y,attributes = {}) => {
            const node = svgNode('text',{x,y,'text-anchor':'middle',class:'lab-svg-label',...attributes});
            node.textContent=value; fragment.append(node);
        };
        const face = z => [[0,0,z],[70,0,z],[70,100,z],[0,100,z],[0,0,z]];
        // The F is on the foreground face; the chair recedes behind it.
        path(face(0).map(p=>project(...p)),{fill:'#f2f2f2','fill-opacity':.45,stroke:'#aaa','stroke-width':.8});
        const corners=[[0,0],[70,0],[70,100],[0,100]];
        corners.forEach(([x,y])=>path([project(x,y,0),project(x,y,faceDepth)],{stroke:'#aaa','stroke-width':.8,'stroke-dasharray':'4 5'}));
        if (chairModel) {
            const surfaces=[];
            const transformChairPoint = ([px,py,pz]) => [(400-px)/6+1.67,pz/6,(py+30)/6];
            chairModel.parts.forEach(part=>{
                if (part.material === 'plywood' && part.faces) {
                    // Use the actual STEP seat outline, including the rear-post
                    // cutouts. The seat and every frame member share one transform.
                    part.faces.forEach(face=>{
                        const points=face.map(transformChairPoint);
                        const a=points[0],b=points[1],c=points[2];
                        const normal=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])];
                        if (normal[0]+normal[2]+normal[1]*1.4 <= 0) return;
                        const depth=points.reduce((sum,p)=>sum+p[0]+p[2]+p[1]*.7,0)/points.length;
                        surfaces.push({points,depth,material:part.material,normal,layer:1});
                    });
                    return;
                }
                // STEP x = seat depth; y = width; z = height. Uniform 1/6 scale
                // preserves the measured 400:400:600 proportions and 430 mm seat.
                const ranges=[{min:part.min,max:part.max,layer:0}];
                if(part.max[2]>chairModel.seatTop) {
                    ranges.push({min:[part.min[0],part.min[1],Math.max(part.min[2],chairModel.seatTop)],max:part.max,layer:2});
                }
                ranges.forEach(range=>{
                const vertices=[];
                for(let z=0;z<2;z++) for(let y=0;y<2;y++) for(let x=0;x<2;x++) {
                    const px=(x?range.max[0]:range.min[0]);
                    const py=(y?range.max[1]:range.min[1]);
                    const pz=(z?range.max[2]:range.min[2]);
                    // Quarter-turn the actual STEP assembly: rear uprights are at
                    // the left of its side elevation, matching the stem of F.
                    vertices.push(transformChairPoint([px,py,pz]));
                }
                // Only three outward faces: the far sides are omitted like a CAD
                // technical illustration, avoiding internal edges through the seat.
                [[4,6,7,5],[0,2,6,4],[2,3,7,6]].forEach(indices=>{
                    const points=indices.map(i=>vertices[i]);
                    const a=points[0],b=points[1],c=points[2];
                    const normal=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])];
                    const depth=points.reduce((sum,p)=>sum+p[0]+p[2]+p[1]*.7,0)/4;
                    surfaces.push({points,depth,material:part.material,normal,layer:range.layer});
                });
                });
            });
            // Outline the joined silhouette once. Individual box edges would
            // introduce seams through coplanar members and the plywood seat.
            const defs=svgNode('defs',{});
            const filter=svgNode('filter',{id:'chair-silhouette',x:'-10%',y:'-10%',width:'120%',height:'120%','color-interpolation-filters':'sRGB'});
            filter.append(svgNode('feMorphology',{in:'SourceAlpha',operator:'dilate',radius:.55,result:'expanded'}));
            filter.append(svgNode('feComposite',{in:'expanded',in2:'SourceAlpha',operator:'out',result:'border'}));
            filter.append(svgNode('feFlood',{'flood-color':'#777',result:'ink'}));
            filter.append(svgNode('feComposite',{in:'ink',in2:'border',operator:'in',result:'outline'}));
            const merge=svgNode('feMerge',{});
            merge.append(svgNode('feMergeNode',{in:'outline'}),svgNode('feMergeNode',{in:'SourceGraphic'}));
            filter.append(merge);defs.append(filter);fragment.append(defs);
            const chairGroup=svgNode('g',{filter:'url(#chair-silhouette)'});
            fragment.append(chairGroup);
            surfaces.sort((a,b)=>a.layer-b.layer || a.depth-b.depth).forEach(({points,material,normal})=>{
                const shade=material==='plywood' ? '#d9d9d9' : Math.abs(normal[1])>0 ? '#fafafa' : '#e9e9e9';
                chairGroup.append(path([...points,points[0]].map(p=>project(...p)),{fill:shade,stroke:'none'}));
            });
        }
        const fOutline=[[70,100],[0,100],[0,0],[20,0],[20,40],[70,40],[70,60],[20,60],[20,80],[70,80],[70,100]];
        path(face(faceDepth).map(p=>project(...p)),{stroke:'#999','stroke-width':.8});
        path(fOutline.map(([x,y])=>project(x,y,faceDepth)),{fill:'#fff','fill-opacity':.12,stroke:'#111','stroke-width':1.4});
        // Same face coordinates, linked through the volume, rather than two
        // disconnected objects linked across a flat page.
        [[0,0],[70,0],[0,100],[70,100]].forEach(([x,y])=>{
            const a=project(x,y,0),b=project(x,y,faceDepth);
            (depthFactor>.02?[a,b]:[a]).forEach(([px,py])=>fragment.append(svgNode('rect',{x:px-2.7,y:py-2.7,width:5.4,height:5.4,fill:'#fff',stroke:'#555','stroke-width':.7})));
        });
        const fLabel=project(35,108,faceDepth),chairLabel=project(35,108,0);
        if(depthFactor>.3) {
            label('F',fLabel[0],fLabel[1]-9);
            label('CHAIR 01',chairLabel[0],chairLabel[1]-9);
        } else label('F / CHAIR 01',350,26);
        comparisonDrawing.replaceChildren(fragment);
    }
    comparison.addEventListener('click',()=>{
        collapsed=!collapsed;
        comparison.setAttribute('aria-pressed',String(collapsed));
        cancelAnimationFrame(comparisonFrame);
        const from=collapseAmount,to=collapsed?1:0,start=performance.now();
        const animate=now=>{
            const progress=reducedMotion.matches?1:Math.min(1,(now-start)/650);
            collapseAmount=from+(to-from)*(1-Math.pow(1-progress,3));
            renderComparison();
            if(progress<1)comparisonFrame=requestAnimationFrame(animate);
        };
        comparisonFrame=requestAnimationFrame(animate);
    });
    graphicPointer(comparison,(x,y)=>{viewX=-x;viewY=y;renderComparison();});
    fetch('./assets/typeface/chair01-frame.json').then(response=>{
        if(!response.ok)throw new Error('CHAIR 01 geometry unavailable');
        return response.json();
    }).then(data=>{chairModel=data;renderComparison();}).catch(()=>{
        comparison.setAttribute('aria-label','CHAIR 01 model could not be loaded. Reload to try again.');
        const label=svgNode('text',{x:300,y:410,'text-anchor':'middle',class:'lab-svg-label'});
        label.textContent='CHAIR 01 — LOAD ERROR';comparisonDrawing.append(label);
    });
    renderComparison();

    new ResizeObserver(() => {
        const rect = orbit.querySelector('.lab-orbit-stage').getBoundingClientRect();
        orbit.style.setProperty('--orbit-radius', `${-Math.min(rect.width, rect.height) * .37}px`);
    }).observe(lab);
}
