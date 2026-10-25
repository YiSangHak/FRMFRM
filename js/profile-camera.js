// Desktop-only camera specimen. One canvas, sampled at 15 fps; no per-cell DOM.
document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('.header-profile');
    if (!button) return;
    const mobile = matchMedia('(max-width: 767px)');
    const hintLayer = document.createElement('div');
    hintLayer.className = 'profile-camera-hint-layer'; hintLayer.hidden = true;
    const hint = document.createElement('div');
    hint.className = 'profile-camera-hint'; hint.id = 'profile-camera-hint';
    hint.setAttribute('role', 'tooltip');
    hint.innerHTML = '<strong>FRMFRM CAMERA</strong><p>카메라로 담은 장면을 FRMFRM의 문자로 그려보세요.</p><p>클릭하여 시작 ↗</p>';
    const connector = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    connector.classList.add('profile-camera-connector'); connector.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS(connector.namespaceURI, 'line'); connector.append(line);
    const dialog = document.createElement('dialog'); dialog.id = 'profile-camera'; dialog.className = 'profile-camera';
    dialog.setAttribute('aria-labelledby', 'profile-camera-title');
    dialog.innerHTML = '<header class="profile-camera-header"><h2 id="profile-camera-title">FRMFRM CAMERA</h2><button type="button" class="profile-camera-close">CLOSE ×</button></header><div class="profile-camera-stage"><canvas aria-label="웹캠 영상을 FRMFRM MONO 문자로 표현한 실시간 화면"></canvas><p class="profile-camera-status" role="status">카메라 연결 중…</p></div><footer class="profile-camera-footer"><button type="button" class="profile-camera-save" disabled>SAVE IMAGE ↓</button><span class="profile-camera-save-status" role="status"></span></footer>';
    hintLayer.append(connector, hint);
    document.body.append(hintLayer, dialog);
    const video = document.createElement('video'); video.muted = true; video.playsInline = true;
    const canvas = dialog.querySelector('canvas'), context = canvas.getContext('2d', {alpha:false});
    const sample = document.createElement('canvas'), sampler = sample.getContext('2d', {willReadFrequently:true});
    const status = dialog.querySelector('.profile-camera-status');
    const saveButton = dialog.querySelector('.profile-camera-save');
    const saveStatus = dialog.querySelector('.profile-camera-save-status');
    let saveNoticeTimer = 0;
    const notifySave = message => {
        clearTimeout(saveNoticeTimer);
        saveStatus.textContent = message;
        saveStatus.classList.add('is-visible');
        saveNoticeTimer = setTimeout(() => { saveStatus.classList.remove('is-visible'); saveStatus.textContent = ''; }, 2600);
    };
    let stream = null, generation = 0, frame = 0, last = 0, columns = 1, rows = 1, cellWidth = 1, cellHeight = 1, palette = [' ', '.', '-', '=', '+', 'F', 'R', 'M'];
    const hideHint = () => { hintLayer.hidden = true; button.removeAttribute('aria-describedby'); };
    const showHint = event => {
        if (mobile.matches || dialog.open || event.pointerType === 'touch') return;
        hintLayer.hidden = false; button.setAttribute('aria-describedby', hint.id);
        positionHint(event);
    };
    function positionHint(event) {
        const rect = button.getBoundingClientRect();
        const distance = Math.hypot(Math.max(rect.left-event.clientX, 0, event.clientX-rect.right), Math.max(rect.top-event.clientY, 0, event.clientY-rect.bottom));
        if (distance > 150) { hideHint(); return; }
        const width = hint.offsetWidth, height = hint.offsetHeight;
        // Follow the cursor, flipping left near the viewport edge.
        const left = Math.max(16, Math.min(innerWidth-width-16,
            event.clientX+24+width <= innerWidth-16 ? event.clientX+24 : event.clientX-width-24));
        const top = Math.max(16, Math.min(innerHeight-height-16, event.clientY+24));
        hint.style.left = `${left}px`; hint.style.top = `${top}px`;
        connector.setAttribute('width', innerWidth); connector.setAttribute('height', innerHeight);
        const anchorX = rect.left+rect.width/2, anchorY = rect.top+rect.height/2;
        const cornerX = anchorX < left+width/2 ? left : left+width;
        const cornerY = anchorY < top+height/2 ? top : top+height;
        line.setAttribute('x1', anchorX); line.setAttribute('y1', anchorY);
        line.setAttribute('x2', cornerX); line.setAttribute('y2', cornerY);
    }
    button.addEventListener('pointerenter', showHint);
    document.addEventListener('pointermove', event => { if (!hintLayer.hidden) positionHint(event); });
    document.addEventListener('pointerleave', hideHint);
    window.addEventListener('scroll', hideHint, {passive:true});
    window.addEventListener('blur', hideHint);
    function resize() {
        if (!dialog.open) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        const fontSize = 14;
        context.font = `${fontSize}px "FRMFRM Mono", monospace`;
        const advance = context.measureText('M').width || 9;
        columns = Math.max(1, Math.min(160, Math.floor(rect.width/advance)));
        cellWidth = rect.width/columns; cellHeight = fontSize*1.15;
        rows = Math.max(1, Math.floor(rect.height/cellHeight));
        canvas.width = Math.round(rect.width); canvas.height = Math.round(rect.height);
        sample.width = columns; sample.height = rows;
        context.font = `${fontSize}px "FRMFRM Mono", monospace`;
        context.textAlign = 'center'; context.textBaseline = 'middle';
    }
    function render(now) {
        if (!dialog.open || !stream || document.hidden) { frame = 0; return; }
        frame = requestAnimationFrame(render);
        if (now-last < 1000/15 || video.readyState < 2) return;
        last = now;
        const width = canvas.width, height = canvas.height;
        const scale = Math.max(width/video.videoWidth, height/video.videoHeight);
        const sw = width/scale, sh = height/scale;
        sampler.save(); sampler.translate(columns,0); sampler.scale(-1,1);
        sampler.drawImage(video,(video.videoWidth-sw)/2,(video.videoHeight-sh)/2,sw,sh,0,0,columns,rows); sampler.restore();
        const pixels = sampler.getImageData(0,0,columns,rows).data;
        context.fillStyle = '#000'; context.fillRect(0,0,width,height); context.fillStyle = '#fff';
        const offset = (height-rows*cellHeight)/2;
        saveButton.disabled = false;
        for (let y=0;y<rows;y++) for (let x=0;x<columns;x++) {
            const i=(y*columns+x)*4;
            const light=(pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722)/255;
            const glyph=palette[Math.min(palette.length-1,Math.floor(light*palette.length))];
            if (glyph !== ' ') context.fillText(glyph,(x+.5)*cellWidth,offset+(y+.5)*cellHeight);
        }
    }
    function stop() {
        generation++; cancelAnimationFrame(frame); frame=0;
        saveButton.disabled=true;
        clearTimeout(saveNoticeTimer); saveStatus.classList.remove('is-visible'); saveStatus.textContent='';
        stream?.getTracks().forEach(track=>track.stop()); stream=null;
        video.pause(); video.srcObject=null;
        button.setAttribute('aria-pressed','false');
        context.fillStyle='#000'; context.fillRect(0,0,canvas.width,canvas.height);
    }
    function close() { stop(); if (dialog.open) dialog.close(); }
    async function open() {
        if (mobile.matches || dialog.open) return;
        hideHint(); dialog.showModal(); button.setAttribute('aria-pressed','true');
        status.hidden=false; status.textContent='카메라 연결 중…'; saveStatus.textContent=''; resize();
        const request = ++generation;
        try {
            if (!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable');
            const camera = await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
            if (request !== generation || !dialog.open || mobile.matches) { camera.getTracks().forEach(track=>track.stop()); return; }
            stream=camera; video.srcObject=stream; await video.play();
            if (request !== generation || !dialog.open) return;
            status.hidden=true; resize(); last=0; frame=requestAnimationFrame(render);
        } catch (error) {
            if (request !== generation || !dialog.open) return;
            stop();
            status.hidden=false;
            status.textContent=error.name==='NotAllowedError' ? '카메라 접근이 허용되지 않았습니다. 브라우저의 카메라 권한을 확인한 뒤 다시 열어주세요.' : error.name==='NotFoundError' ? '연결된 카메라가 없습니다.' : '카메라를 시작할 수 없습니다. 연결과 브라우저 권한을 확인한 뒤 다시 열어주세요.';
        }
    }
    saveButton.addEventListener('click', () => {
        if (!stream || saveButton.disabled) return;
        // Copy the displayed frame so the download is the moment the user clicked.
        const photo = document.createElement('canvas');
        photo.width=canvas.width; photo.height=canvas.height;
        photo.getContext('2d').drawImage(canvas,0,0);
        photo.toBlob(blob => {
            if (!blob) { notifySave('이미지를 저장하지 못했습니다. 다시 시도해주세요.'); return; }
            const url=URL.createObjectURL(blob), link=document.createElement('a');
            const stamp=new Date().toISOString().replace(/[:.]/g,'-');
            link.href=url; link.download=`FRMFRM-CAMERA-${stamp}.png`;
            document.body.append(link); link.click(); link.remove();
            setTimeout(()=>URL.revokeObjectURL(url),60000);
            if (dialog.open) notifySave('이미지가 저장되었습니다.');
        },'image/png');
    });
    button.addEventListener('profile-camera-open', open);
    dialog.querySelector('.profile-camera-close').addEventListener('click', close);
    dialog.addEventListener('close', stop);
    dialog.addEventListener('cancel', stop);
    dialog.addEventListener('click', event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
    new ResizeObserver(resize).observe(canvas.parentElement);
    mobile.addEventListener('change',()=>{hideHint();if(mobile.matches)close();});
    window.addEventListener('pagehide', close);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else if(dialog.open&&stream){last=0;frame=requestAnimationFrame(render);}});
    document.fonts.load('14px "FRMFRM Mono"').then(()=>{
        const test=document.createElement('canvas');test.width=test.height=40;const ctx=test.getContext('2d',{willReadFrequently:true});ctx.font='24px "FRMFRM Mono"';
        palette=[...' .-=+FRM'].map(char=>{ctx.clearRect(0,0,40,40);ctx.fillText(char,4,28);const data=ctx.getImageData(0,0,40,40).data;let area=0;for(let i=3;i<data.length;i+=4)area+=data[i];return {char,area};}).sort((a,b)=>a.area-b.area).map(item=>item.char);
        resize();
    }).catch(()=>{});
});
