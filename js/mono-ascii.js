// Click-driven, local character compositions. No camera or continuous render loop.
(() => {
    const panel = document.querySelector('.mono-ascii');
    if (!panel) return;
    const board = panel.querySelector('.mono-ascii-board');
    const mobileBoard = document.querySelector('[data-study="reels"]');
    const mobile = matchMedia('(max-width: 767px)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const columns = 56, rows = 30;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!()+-.=?_| ';
    const supported = new Set(alphabet);
    const boardText = text => [...text.toUpperCase()].filter(char => supported.has(char)).join('');
    const names = {0:'FRMFRM MONO',1:'FRAME / DEPTH',3:'GRID',4:'TYPE / TEXT',5:'MODULAR',6:'STRUCTURAL',7:'ALUMINUM PROFILE'};
    const sceneOrder = [4,0,1,3,5,6,7];
    const canvas = document.createElement('canvas');
    canvas.width = columns * 4; canvas.height = rows * 4;
    const ink = canvas.getContext('2d', {willReadFrequently:true});
    let cells = [], targets = [], scene = 4, frame = 0, visible = false, transitioning = false;
    let palette = [...' .-=+FRM'].map((char,i)=>({char,tone:i/7}));
    const cache = new Map(), hover = new Map();
    const glyphF = new Path2D('M0 0H70V20H20V40H70V60H20V100H0Z');
    const glyphR = new Path2D('M0 0H54.14L70 15.86V44.14L64.14 50L70 55.86V100H50V64.14L45.86 60H20V100H0Z M20 20H45.86L50 24.14V35.85L45.86 40H20Z');
    const glyphM = new Path2D('M0 0H20L35 36L50 0H70V100H50V48L45 60H25L20 48V100H0Z');
    function character(tone) {
        // Flat planes use one glyph per tone rather than spatial dithering.
        const step=Math.round(tone*7)/7;
        return palette.reduce((best,item)=>Math.abs(item.tone-step)<Math.abs(best.tone-step)?item:best,palette[0]).char;
    }
    function polygon(points,fill) {
        ink.beginPath();points.forEach(([x,y],i)=>i?ink.lineTo(x,y):ink.moveTo(x,y));
        ink.closePath();ink.fillStyle=fill;ink.fill();
    }
    function composition(index) {
        if(cache.has(index))return cache.get(index);
        ink.setTransform(4,0,0,4,0,0);
        ink.fillStyle='#000';ink.fillRect(0,0,columns,rows);
        const rect=board.getBoundingClientRect();
        const cellAspect=(rect.width/columns)/(Math.max(rect.height,1)/rows);
        const sx=Math.min(columns/64,rows/32/cellAspect),sy=sx*cellAspect;
        ink.setTransform(4*sx,0,0,4*sy,(columns-64*sx)*2,(rows-32*sy)*2);
        ink.fillStyle='#fff';ink.textAlign='center';ink.textBaseline='middle';
        const direct=new Map();
        const put=(x,y,char)=>{if(x>=0&&x<columns&&y>=0&&y<rows)direct.set(y*columns+x,char);};
        const rule=(x1,y1,x2,y2,char)=>{
            const steps=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));
            for(let i=0;i<=steps;i++)put(Math.round(x1+(x2-x1)*i/Math.max(steps,1)),Math.round(y1+(y2-y1)*i/Math.max(steps,1)),char);
        };
        if(index===0){
            // Sample the actual outlines at cell centres, with no grey fringe.
            // Two three-letter rows give each letter enough cells for its counter and notch.
            const height=12,gapY=2;
            const width=Math.max(5,Math.round(height*.7/cellAspect));
            const gapX=Math.max(1,Math.round(height*.1/cellAspect));
            const left=Math.floor((columns-(width*3+gapX*2))/2);
            const top=Math.floor((rows-(height*2+gapY))/2);
            ink.save();ink.setTransform(1,0,0,1,0,0);
            [glyphF,glyphR,glyphM].forEach((path,letter)=>{
                for(let y=0;y<height;y++)for(let x=0;x<width;x++){
                    if(ink.isPointInPath(path,(x+.5)*70/width,(y+.5)*100/height,'evenodd')){
                        [0,1].forEach(row=>put(left+letter*(width+gapX)+x,top+row*(height+gapY)+y,'M'));
                    }
                }
            });
            ink.restore();
        } else if(index===1){
            // Orthographic frame planes: changes in character coverage give depth.
            polygon([[8,9],[24,2],[56,7],[40,15]],'#d2d2d2');
            polygon([[8,9],[40,15],[40,30],[8,23]],'#727272');
            polygon([[40,15],[56,7],[56,23],[40,30]],'#a0a0a0');
            polygon([[12,12],[36,17],[36,26],[12,21]],'#000');
            polygon([[44,17],[52,13],[52,21],[44,25]],'#000');
            polygon([[18,9],[25,6],[46,9],[39,12]],'#000');
        } else if(index===3){
            // A shared orthogonal grid, with visible intersections and empty bays.
            for(let y=3;y<=27;y++)for(let x=4;x<=52;x++){
                const vertical=(x-4)%8===0,horizontal=(y-3)%6===0;
                if(vertical||horizontal)put(x,y,vertical&&horizontal?'+':vertical?'|':'-');
            }
        } else if(index===5){
            // Repeat every module without an unexplained missing bay.
            for(let y=3;y<27;y++)for(let x=4;x<52;x++){
                const u=(x-4)%8,v=(y-3)%6;
                if(u<7&&v<5){
                    const edge=u===0||u===6||v===0||v===4;
                    if(edge)put(x,y,(u===0||u===6)&&(v===0||v===4)?'+':'F');
                }
            }
        } else if(index===6){
            rule(4,4,51,4,'=');rule(4,5,51,5,'-');
            rule(4,21,51,21,'-');
            [4,28,51].forEach(x=>{
                rule(x,4,x,24,'|');rule(x-1,25,x+1,25,'=');
                [4,5,21].forEach(y=>put(x,y,'+'));
            });
        } else if(index===7){
            // Size the section in screen space, not by assuming square cells.
            const height=Math.min(rows-6,Math.floor((columns-8)*cellAspect));
            const width=Math.max(1,Math.round(height/cellAspect));
            const left=Math.floor((columns-width)/2),top=Math.floor((rows-height)/2);
            const half=height/2;
            for(let y=0;y<height;y++)for(let x=0;x<width;x++){
                const ax=Math.abs((x+.5-width/2)*cellAspect)/half;
                const ay=Math.abs(y+.5-height/2)/half;
                const rim=Math.max(ax,ay)>.76;
                const slot=(ax<.18&&ay>.5)||(ay<.18&&ax>.5);
                const brace=Math.abs(ax-ay)<.10&&ax>.3&&ax<.84;
                const core=Math.max(ax,ay)<.32&&Math.max(ax,ay)>.22;
                if((rim&&!slot)||brace||core)put(left+x,top+y,core?'+':'M');
            }
        } else {
            // Keep the existing description readable: one actual letter per flap.
            const description=document.querySelector('.typeface-info-text [lang="en"]').textContent.trim().replace(/\s+/g,' ').toUpperCase().replace(/70:100/g,'SEVENTY TO ONE HUNDRED').replace(/10-UNIT/g,'TEN UNIT');
            const supportedDescription=boardText(description);
            const left=2,width=columns-left*2,lines=[];
            for(const word of supportedDescription.split(' ')){
                const last=lines.length-1;
                if(last<0||lines[last].length+word.length+1>width)lines.push(word);
                else lines[last]+=` ${word}`;
            }
            const spacing=2;
            const top=Math.floor((rows-((lines.length-1)*spacing+1))/2);
            lines.forEach((text,y)=>[...text].forEach((char,x)=>direct.set((top+y*spacing)*columns+left+x,char)));
        }
        const pixels=ink.getImageData(0,0,canvas.width,canvas.height).data;
        const result=Array(columns*rows).fill(' ');
        for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
            let light=0;
            for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++)light+=pixels[((y*4+dy)*canvas.width+x*4+dx)*4];
            const tone=light/(16*255);
            result[y*columns+x]=character(tone);
        }
        direct.forEach((char,i)=>result[i]=char);
        cache.set(index,result);return result;
    }
    function display(i,char,flip=false){
        const cell=cells[i];
        char=supported.has(char)?char:' ';
        if(hover.has(cell)||cell.firstChild.textContent===char)return;
        cell.firstChild.textContent=char;
        if(flip&&!reduced.matches){
            cell.classList.add('is-board-flipping');
        }
    }
    function settle(){
        clearTimeout(frame);frame=0;
        transitioning=false;panel.removeAttribute('aria-busy');
        cells.forEach((cell,i)=>{display(i,targets[i]);cell.classList.remove('is-board-flipping');});
    }
    function show(animate=true){
        clearTimeout(frame);
        hover.forEach(clearTimeout);hover.clear();
        cells.forEach(cell=>cell.classList.remove('is-flipping'));
        targets=composition(scene);
        panel.setAttribute('aria-label',`${names[scene]}. 클릭하면 다음 문자 그래픽을 표시합니다.`);
        if(!animate||reduced.matches||!visible){settle();return;}
        transitioning=true;panel.setAttribute('aria-busy','true');
        // Restore the original light reel animation and staggered cell timing.
        const started=performance.now();
        const turns=cells.map((cell,i)=>({
            done:cell.firstChild.textContent===targets[i],
            delay:i%columns*14+Math.floor(i/columns)*32,
            duration:430+i%7*65
        }));
        function draw(){
            const elapsed=performance.now()-started,step=Math.floor(elapsed/65);
            let active=false;
            turns.forEach((turn,i)=>{
                if(turn.done)return;
                const local=elapsed-turn.delay;
                if(local<0){active=true;return;}
                if(local<turn.duration){
                    active=true;
                    display(i,alphabet[(step*7+i*11)%alphabet.length],true);
                } else {
                    display(i,targets[i]);cells[i].classList.remove('is-board-flipping');
                    turn.done=true;
                }
            });
            if(active&&visible&&!document.hidden)frame=setTimeout(draw,65);
            else settle();
        }
        frame=setTimeout(draw,0);
    }
    function sync(){
        panel.hidden=mobile.matches;mobileBoard.hidden=!mobile.matches;
        if(mobile.matches){settle();return;}
        if(!cells.length){
            board.style.setProperty('--board-columns',columns);board.style.setProperty('--board-rows',rows);
            cells=Array.from({length:columns*rows},(_,i)=>{
                const cell=document.createElement('span');cell.className='lab-flap';cell.dataset.index=i;
                cell.append(document.createElement('span'));return cell;
            });board.replaceChildren(...cells);
        }
        show(false);
    }
    panel.addEventListener('click',()=>{
        if(transitioning)return;
        scene=sceneOrder[(sceneOrder.indexOf(scene)+1)%sceneOrder.length];show();
    });
    board.addEventListener('animationend',event=>event.target.closest('.lab-flap')?.classList.remove('is-board-flipping'));
    board.addEventListener('pointermove',event=>{
        if(transitioning||event.pointerType==='touch'||reduced.matches)return;
        const cell=event.target.closest('.lab-flap');if(!cell||hover.has(cell))return;
        cell.classList.add('is-flipping');
        cell.firstChild.textContent='FRMFRMMONO'[Math.floor(Math.random()*10)];
        hover.set(cell,setTimeout(()=>{
            cell.firstChild.textContent=targets[Number(cell.dataset.index)];
            cell.classList.remove('is-flipping');hover.delete(cell);
        },220));
    });
    new IntersectionObserver(entries=>{
        visible=entries[0].isIntersecting;if(!visible)settle();
    }).observe(panel);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)settle();});
    window.addEventListener('pagehide',()=>{settle();hover.forEach(clearTimeout);hover.clear();});
    let resizeTimer=0;
    new ResizeObserver(()=>{
        clearTimeout(resizeTimer);
        resizeTimer=setTimeout(()=>{cache.clear();if(!mobile.matches)show(false);},120);
    }).observe(board);
    mobile.addEventListener('change',sync);
    sync();
    document.fonts.load('64px "FRMFRM Mono"').then(()=>{
        const sample=document.createElement('canvas');sample.width=sample.height=96;
        const ctx=sample.getContext('2d',{willReadFrequently:true});
        ctx.font='64px "FRMFRM Mono"';ctx.textAlign='center';ctx.textBaseline='middle';
        palette=[...alphabet].map(char=>{
            ctx.clearRect(0,0,96,96);ctx.fillText(char,48,48);
            const data=ctx.getImageData(0,0,96,96).data;let area=0;
            for(let i=3;i<data.length;i+=4)area+=data[i];
            return {char,tone:area};
        }).sort((a,b)=>a.tone-b.tone);
        const max=palette.at(-1).tone||1;palette.forEach(item=>item.tone/=max);
        cache.clear();if(!mobile.matches&&!transitioning)show(false);
    }).catch(()=>{});
})();
