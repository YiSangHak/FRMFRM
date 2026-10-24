// Local-only camera mirror. No image data leaves the browser.
(() => {
    const board = document.querySelector('.home-camera-board');
    if (!board) return;
    const status = document.querySelector('.home-camera-status');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = matchMedia('(max-width: 767px)');
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const ramp = ' .-=+FRM';
    let columns, rows = 32, cells = [], targets = [], levels = [];
    let stream = null, timer = 0, visible = true, stopped = false, request = 0;
    const hover = new Map();
    function build() {
        hover.forEach(clearTimeout);
        hover.clear();
        columns = mobile.matches ? 32 : 64;
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
            const sw = Math.min(vw, vh * aspect), sh = Math.min(vh, vw / aspect);
            context.setTransform(-1, 0, 0, 1, columns, 0);
            context.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, columns, rows);
            const pixels = context.getImageData(0, 0, columns, rows).data;
            cells.forEach((_, index) => {
                const p = index * 4;
                const light = pixels[p] * .2126 + pixels[p + 1] * .7152 + pixels[p + 2] * .0722;
                if (levels[index] !== undefined && Math.abs(light - levels[index]) < 12) return;
                levels[index] = light;
                display(index, ramp[Math.min(ramp.length - 1, Math.floor(light / 256 * ramp.length))]);
            });
        }
        timer = setTimeout(tick, 100);
    }
    async function start() {
        stopped = false;
        const current = ++request;
        status.textContent = 'FRMFRM MONO / 카메라를 허용하면 문자 거울이 시작됩니다';
        try {
            if (!navigator.mediaDevices?.getUserMedia || !context) throw new Error('Unavailable');
            const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 24 } } });
            if (current !== request) { media.getTracks().forEach(track => track.stop()); return; }
            stream = media;
            video.srcObject = media;
            await video.play();
            if (current !== request) return;
            status.textContent = 'FRMFRM MONO / LIVE — 영상은 저장·전송되지 않습니다';
            media.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
                stop(); fallback(); status.textContent = 'FRMFRM MONO / CAMERA UNAVAILABLE';
            }));
            levels = [];
            tick();
        } catch {
            if (current !== request) return;
            stop(); fallback();
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
    mobile.addEventListener('change', build);
    window.addEventListener('pagehide', stop);
    window.addEventListener('pageshow', event => { if (event.persisted) start(); });
    build();
    start();
})();
