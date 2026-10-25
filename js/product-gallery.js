// Native horizontal scrolling on mobile; desktop keeps the vertical image rail.
document.querySelectorAll('.product-gallery').forEach(gallery => {
    const track=gallery.querySelector('.product-gallery-track');
    const navigation=gallery.querySelector('.product-gallery-thumbnails');
    const items=[...track.querySelectorAll('.product-gallery-item')];
    const mobile=matchMedia('(max-width: 767px)');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let offsets=[],frame=0;
    const buttons=items.map((item,index)=>{
        const source=item.querySelector('img');
        const button=document.createElement('button');
        button.type='button';button.tabIndex=-1;
        button.className='product-gallery-thumbnail';
        button.setAttribute('aria-label',source.alt);
        button.setAttribute('aria-controls',track.id);
        const image=document.createElement('img');
        image.src=source.getAttribute('src');image.alt='';image.loading='lazy';image.decoding='async';
        button.append(image);
        button.addEventListener('click',()=>{
            if(!mobile.matches)return;
            track.scrollTo({left:offsets[index],behavior:reduced.matches?'instant':'smooth'});
        });
        return button;
    });
    navigation.replaceChildren(...buttons);
    function select(index){
        buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
    }
    function measure(){
        offsets=items.map(item=>item.offsetLeft-items[0].offsetLeft);
        update();
    }
    function update(){
        frame=0;
        if(!mobile.matches)return;
        let nearest=0;
        offsets.forEach((offset,i)=>{
            if(Math.abs(offset-track.scrollLeft)<Math.abs(offsets[nearest]-track.scrollLeft))nearest=i;
        });
        select(nearest);
    }
    track.addEventListener('scroll',()=>{
        if(mobile.matches&&!frame)frame=requestAnimationFrame(update);
    },{passive:true});
    mobile.addEventListener('change',()=>{
        track.scrollTo({left:0,top:0,behavior:'instant'});measure();select(0);
    });
    new ResizeObserver(measure).observe(track);
    window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});
    select(0);measure();
});
