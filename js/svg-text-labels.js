// Keep diagram geometry in SVG, but render its annotations as fixed-size HTML text.
(() => {
    function init(){
    const selector='text.lab-svg-label, .lab-projection-labels text, text.brand-diagram-label, text.brand-diagram-center, text.glyph-guide-label';
    const hosts=new Map();
    function attach(host){
        if(!host||hosts.has(host))return;
        host.classList.add('svg-text-host');
        const layer=document.createElement('span');
        layer.className='svg-text-label-layer';layer.setAttribute('aria-hidden','true');
        let frame=0,labels=[];
        const update=()=>{
            frame=0;
            const current=host.querySelector(':scope > svg');
            if(!current)return;
            if(layer.parentElement!==host)host.append(layer);
            const texts=[...current.querySelectorAll(selector)];
            while(labels.length>texts.length)labels.pop().remove();
            const box=host.getBoundingClientRect();
            texts.forEach((text,index)=>{
                let label=labels[index];
                if(!label){label=document.createElement('span');label.className='svg-text-label';layer.append(label);labels.push(label);}
                const matrix=text.getScreenCTM();
                if(!matrix){label.hidden=true;return;}
                label.hidden=false;label.textContent=text.textContent;
                const x=text.x.baseVal.numberOfItems?text.x.baseVal.getItem(0).value:0;
                const y=text.y.baseVal.numberOfItems?text.y.baseVal.getItem(0).value:0;
                const point=new DOMPoint(x,y).matrixTransform(matrix);
                const style=getComputedStyle(text);
                const primary=text.matches('.brand-diagram-label')||!!text.closest('.lab-projection-labels');
                label.dataset.kind=text.matches('.brand-diagram-center')?'brand':primary?'primary':'note';
                label.style.left=`${point.x-box.left-host.clientLeft}px`;
                label.style.top=`${point.y-box.top-host.clientTop}px`;
                label.style.color=style.fill==='none'?'currentColor':style.fill;
                const anchor=style.textAnchor==='middle'?'-50%':style.textAnchor==='end'?'-100%':'0';
                const baseline=['central','middle'].includes(style.dominantBaseline)?'-50%':'-80%';
                label.style.transform=`translate(${anchor}, ${baseline})`;
            });
        };
        const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
        const observer=new MutationObserver(records=>{
            if(records.some(record=>{
                if(layer.contains(record.target))return false;
                if(record.type==='childList'&&[...record.addedNodes,...record.removedNodes].every(node=>node===layer))return false;
                return true;
            }))schedule();
        });
        hosts.set(host,{observer,schedule});
        observer.observe(host,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','transform','x','y','style','text-anchor']});
        new ResizeObserver(schedule).observe(host);
        update();
    }
    document.querySelectorAll('.about-brand-diagram, .lab-construction, .lab-comparison, .lab-projection, .glyph-stage').forEach(attach);
    document.fonts.ready.then(()=>hosts.forEach(({schedule})=>schedule()));
    window.addEventListener('pagehide',event=>{
        if(event.persisted)return;
        hosts.forEach(({observer})=>observer.disconnect());
    });
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
    else init();
})();
