// Local-only camera mirror. No image data leaves the browser.
(() => {
    const board = document.querySelector('.mono-camera-board');
    if (!board) return;
    const status = document.querySelector('.mono-camera-status');
    const panel = document.querySelector('.mono-camera');
    const graphic = document.querySelector('[data-study="reels"]');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = matchMedia('(max-width: 767px)');
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const ramp = ' .-=+FRM';
    let palette = [...ramp].map((char, i) => ({ char, tone: i / (ramp.length - 1) }));
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    async function preparePalette() {
        await document.fonts.load('64px "FRMFRM Mono"');
        const sample = document.createElement('canvas');
        sample.width = sample.height = 96;
        const ink = sample.getContext('2d', { willReadFrequently: true });
        ink.font = '64px "FRMFRM Mono"';
        ink.textAlign = 'center';
        ink.textBaseline = 'middle';
        const glyphs = [...' .-_=+|!()[]{}?ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
        const measured = glyphs.map(char => {
            ink.clearRect(0, 0, 96, 96);
            ink.fillText(char, 48, 48);
            const pixels = ink.getImageData(0, 0, 96, 96).data;
            let area = 0;
            for (let i = 3; i < pixels.length; i += 4) area += pixels[i];
            return { char, tone: area };
        }).sort((a, b) => a.tone - b.tone);
        const maximum = measured[measured.length - 1].tone || 1;
        palette = measured.map(item => ({ char: item.char, tone: item.tone / maximum }));
        levels = [];
    }
    function characterAt(tone, index) {
        let upper = palette.findIndex(item => item.tone >= tone);
        if (upper <= 0) return palette[upper === 0 ? 0 : palette.length - 1].char;
        const low = palette[upper - 1], high = palette[upper];
        const fraction = (tone - low.tone) / Math.max(high.tone - low.tone, .0001);
        const x = index % columns, y = Math.floor(index / columns);
        return fraction > (bayer[(y % 4) * 4 + x % 4] + .5) / 16 ? high.char : low.char;
    }
    let columns, rows = 32, cells = [], targets = [], levels = [];
    let stream = null, timer = 0, visible = true, stopped = false, request = 0;
    const hover = new Map();
    function build() {
        hover.forEach(clearTimeout);
        hover.clear();
        columns = mobile.matches ? 32 : 64;
        rows = 32;
        board.style.setProperty('--board-columns', columns);
        board.style.setProperty('--board-rows', rows);
        canvas.width = columns;
        canvas.height = rows;
        levels = [];
        targets = Array(columns * rows).fill(' ');
        cells = targets.map((_, index) => {
            const cell = document.createElement('span');
            cell.className = 'lab-flap';
            cell.dataset.index = index;
            cell.append(document.createElement('span'));
            return cell;
        });
        board.replaceChildren(...cells);
        fallback();
    }
    function display(index, char) {
        targets[index] = char;
        const cell = cells[index];
        if (hover.has(cell) || cell.firstChild.textContent === char) return;
        cell.firstChild.textContent = char;
        if (!reduced.matches && stream) cell.classList.add('is-camera-flipping');
    }
    function fallback() {
        // Quiet modular field remains usable when permission or hardware is absent.
        for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
            const edge = x % 8 === 0 || y % 8 === 0;
            display(y * columns + x, edge ? '+' : ' ');
        }
        const word = 'FRMFRM MONO';
        const start = 16 * columns + Math.floor((columns - word.length) / 2);
        [...word].forEach((char, i) => display(start + i, char));
    }
    function tick() {
        if (stopped) return;
        if (stream && visible && !document.hidden && video.readyState >= 2) {
            const rect = board.getBoundingClientRect();
            const aspect = rect.width / Math.max(rect.height, 1);
            const vw = video.videoWidth, vh = video.videoHeight;
            // Fit the full camera frame in the physical board proportions.
            // Sampling dimensions differ from displayed cell proportions.
            const cameraAspect = vw / vh;
            const width = columns * Math.min(1, cameraAspect / aspect);
            const height = rows * Math.min(1, aspect / cameraAspect);
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.fillStyle = '#000';
            context.fillRect(0, 0, columns, rows);
            context.setTransform(-1, 0, 0, 1, columns, 0);
            context.drawImage(video, 0, 0, vw, vh, (columns - width) / 2, (rows - height) / 2, width, height);
            const pixels = context.getImageData(0, 0, columns, rows).data;
            cells.forEach((_, index) => {
                const p = index * 4;
                const light = pixels[p] * .2126 + pixels[p + 1] * .7152 + pixels[p + 2] * .0722;
                const previous = levels[index];
                const filtered = previous === undefined ? light : previous * .35 + light * .65;
                if (previous !== undefined && Math.abs(filtered - previous) < 4) return;
                levels[index] = filtered;
                // Gentle contrast expands midtones; ordered dithering is spatially stable.
                const tone = Math.max(0, Math.min(1, (filtered / 255 - .5) * 1.12 + .5));
                display(index, characterAt(tone, index));
            });
        }
        timer = setTimeout(tick, 100);
    }
    function showGraphic() {
        panel.hidden = true;
        graphic.hidden = false;
    }
    async function start() {
        if (mobile.matches) { stop(); showGraphic(); return; }
        panel.hidden = false;
        graphic.hidden = true;
        stopped = false;
        const current = ++request;
        status.textContent = 'FRMFRM MONO / 카메라를 허용하면 문자 거울이 시작됩니다';
        try {
            if (!navigator.mediaDevices?.getUserMedia || !context) throw new Error('Unavailable');
            const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 }, resizeMode: { ideal: 'none' }, frameRate: { ideal: 15, max: 24 } } });
            if (current !== request) { media.getTracks().forEach(track => track.stop()); return; }
            stream = media;
            video.srcObject = media;
            await video.play();
            if (current !== request) return;
            status.textContent = 'FRMFRM MONO / LIVE — 영상은 저장·전송되지 않습니다';
            media.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
                stop(); showGraphic(); status.textContent = 'FRMFRM MONO / CAMERA UNAVAILABLE';
            }));
            levels = [];
            tick();
        } catch {
            if (current !== request) return;
            stop(); showGraphic();
            status.textContent = 'FRMFRM MONO / 카메라 연결 또는 브라우저 권한을 확인해주세요';
        }
    }
    function stop() {
        request++;
        stopped = true;
        clearTimeout(timer);
        stream?.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
        hover.forEach(clearTimeout);
        hover.clear();
        cells.forEach((cell, index) => {
            cell.classList.remove('is-flipping', 'is-camera-flipping');
            cell.firstChild.textContent = targets[index];
        });
    }
    board.addEventListener('animationend', event => event.target.closest('.lab-flap')?.classList.remove('is-camera-flipping'));
    board.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch' || reduced.matches) return;
        const cell = event.target.closest('.lab-flap');
        if (!cell || hover.has(cell)) return;
        cell.classList.add('is-flipping');
        cell.firstChild.textContent = 'FRMFRMMONO'[Math.floor(Math.random() * 10)];
        hover.set(cell, setTimeout(() => {
            cell.firstChild.textContent = targets[Number(cell.dataset.index)];
            cell.classList.remove('is-flipping');
            hover.delete(cell);
        }, 220));
    });
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; });
    observer.observe(board);
    let paletteReady = false;
    function syncMode() {
        stop();
        if (mobile.matches) {
            showGraphic();
            return;
        }
        build();
        if (!paletteReady) {
            paletteReady = true;
            preparePalette().catch(() => { paletteReady = false; });
        }
        start();
    }
    mobile.addEventListener('change', syncMode);
    window.addEventListener('pagehide', stop);
    window.addEventListener('pageshow', event => { if (event.persisted) syncMode(); });
    syncMode();
})();
