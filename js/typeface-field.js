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

    const masthead = lab.querySelector('[data-study="masthead"]');
    masthead.setAttribute('aria-pressed', 'false');
    masthead.addEventListener('click', () => {
        const inverted = masthead.classList.toggle('is-inverted');
        masthead.setAttribute('aria-pressed', String(inverted));
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
    const reelWords = ['MONO', 'FORM', 'FROM', 'GRID', 'TYPE'];
    const tracks = [];
    let reelIndex = 0, resetTimer;
    for (let column = 0; column < 4; column++) {
        const reel = document.createElement('span'); reel.className = 'lab-reel';
        const track = document.createElement('span'); track.className = 'lab-reel-track';
        [...reelWords, reelWords[0]].forEach(word => {
            const letter = document.createElement('span'); letter.textContent = word[column]; track.append(letter);
        });
        track.style.transitionDelay = `${column * 70}ms`;
        reel.append(track); reelWindow.append(reel); tracks.push(track);
    }
    reels.addEventListener('click', () => {
        if (resetTimer) return;
        reelIndex++;
        reels.style.setProperty('--reel-index', reelIndex);
        reels.querySelector('[data-reel-word]').textContent = reelWords[reelIndex % reelWords.length];
        if (reelIndex === reelWords.length) {
            resetTimer = setTimeout(() => {
                tracks.forEach(track => { track.style.transition = 'none'; });
                reelIndex = 0; reels.style.setProperty('--reel-index', '0');
                // Commit the equivalent first position before restoring the transition.
                void reelWindow.offsetHeight;
                tracks.forEach(track => { track.style.removeProperty('transition'); });
                resetTimer = null;
            }, reducedMotion.matches ? 0 : 1250);
        }
    });

    const echo = lab.querySelector('[data-study="echo"]');
    const echoLayers = echo.querySelectorAll('.lab-echo-stage > span');
    const echoWords = ['FRAME', 'FORMS', 'MONO!'];
    let echoIndex = 0;
    echoLayers.forEach((layer, index) => layer.style.setProperty('--layer', index - 3));
    echo.addEventListener('click', () => {
        echoIndex = (echoIndex + 1) % echoWords.length;
        echoLayers.forEach(layer => { layer.textContent = echoWords[echoIndex]; });
    });

    const measure = lab.querySelector('[data-study="measure"]');
    ['FRMFRM', 'IIIIII', 'MMMMMM'].forEach(word => {
        const row = document.createElement('span'); row.className = 'lab-measure-row';
        [...word].forEach(char => { const cell = document.createElement('span'); cell.textContent = char; row.append(cell); });
        measure.querySelector('.lab-measure-lines').append(row);
    });
    measure.addEventListener('click', () => {
        const hidden = measure.classList.toggle('is-clean');
        measure.setAttribute('aria-pressed', String(!hidden));
    });

    new ResizeObserver(() => {
        const rect = orbit.querySelector('.lab-orbit-stage').getBoundingClientRect();
        orbit.style.setProperty('--orbit-radius', `${-Math.min(rect.width, rect.height) * .37}px`);
        const step = Math.max(40, reelWindow.clientWidth / 4 * 1.2);
        reels.style.setProperty('--reel-step', `${step}px`);
        reels.style.setProperty('--reel-font', `${step * .82}px`);
    }).observe(lab);
}
