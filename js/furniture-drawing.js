// Model-derived component drawing. All dimensions and coordinates are in millimetres.
document.querySelectorAll('[data-furniture-drawing]').forEach(async host => {
    const stage=host.querySelector('.product-drawing-stage');
    const ns='http://www.w3.org/2000/svg';
    const tooltip=document.createElement('div');
    tooltip.className='product-drawing-tooltip';tooltip.hidden=true;tooltip.setAttribute('role','status');
    document.body.append(tooltip);
    const make=(tag,attrs={})=>{
        const node=document.createElementNS(ns,tag);
        Object.entries(attrs).forEach(([name,value])=>node.setAttribute(name,value));
        return node;
    };
    const project=([x,y,z])=>[(x+y)/Math.sqrt(2),(-x+y-2*z)/Math.sqrt(6)];
    const format=value=>Number(value.toFixed(2)).toString();
    try {
        const response=await fetch(host.dataset.furnitureDrawing);
        if(!response.ok)throw new Error('Model unavailable');
        const model=await response.json();
        if(model.units!=='mm')throw new Error('Unexpected model units');
        const projected=model.parts.flatMap(part=>part.edges.flatMap(edge=>edge.map(project)));
        const xs=projected.map(p=>p[0]),ys=projected.map(p=>p[1]);
        const left=Math.min(...xs)-32,top=Math.min(...ys)-32;
        const width=Math.max(...xs)-left+32,height=Math.max(...ys)-top+32;
        const svg=make('svg',{viewBox:`${left} ${top} ${width} ${height}`,'aria-hidden':'true'});
        stage.append(svg);
        const bins=new Map(),triangleBins=new Map(),binSize=16,records=[],surfaces=[];
        const surfaceLayer=make('g');svg.append(surfaceLayer);
        model.parts.forEach(part=>{
            const group=make('g',{'class':'furniture-model-part'});
            const d=part.edges.map(edge=>edge.map((point,i)=>`${i?'L':'M'}${project(point).map(v=>v.toFixed(4)).join(' ')}`).join(' ')).join(' ');
            const path=make('path',{d,fill:'none',stroke:'currentColor','stroke-width':'.8','vector-effect':'non-scaling-stroke'});
            const hit=make('path',{d,fill:'none',stroke:'transparent','stroke-width':'12','vector-effect':'non-scaling-stroke','class':'furniture-part-hit'});
            group.append(path,hit);svg.append(group);
            const record={part,group,path,hit};records.push(record);
            const faceGroups=new Map();
            for(const triangle of part.mesh.triangles){
                const world=triangle.slice(0,3).map(i=>part.mesh.vertices[i]);
                const p=world.map(project),face=triangle[3];
                const determinant=(p[1][1]-p[2][1])*(p[0][0]-p[2][0])+(p[2][0]-p[1][0])*(p[0][1]-p[2][1]);
                if(Math.abs(determinant)<1e-7)continue;
                const item={world,p,face,record,determinant};
                const minX=Math.floor(Math.min(...p.map(v=>v[0]))/binSize),maxX=Math.floor(Math.max(...p.map(v=>v[0]))/binSize);
                const minY=Math.floor(Math.min(...p.map(v=>v[1]))/binSize),maxY=Math.floor(Math.max(...p.map(v=>v[1]))/binSize);
                for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
                    const key=`${x},${y}`;if(!triangleBins.has(key))triangleBins.set(key,[]);triangleBins.get(key).push(item);
                }
                if(!faceGroups.has(face))faceGroups.set(face,[]);
                faceGroups.get(face).push(item);
            }
            record.faceNodes=new Map();
            for(const [face,triangles] of faceGroups){
                const d=triangles.map(item=>item.p.map((p,i)=>`${i?'L':'M'}${p.map(n=>n.toFixed(4)).join(' ')}`).join(' ')+'Z').join(' ');
                const node=make('path',{d,fill:'white',stroke:'none','class':'furniture-part-surface'});
                record.faceNodes.set(face,node);
                const depth=triangles.reduce((sum,item)=>sum+item.world.flatMap(point=>[-point[0]+point[1]+point[2]]).reduce((a,b)=>a+b,0)/3,0)/triangles.length;
                surfaces.push({node,depth});
            }
            part.edges.forEach(edge=>edge.forEach(world=>{
                const [x,y]=project(world),key=`${Math.floor(x/binSize)},${Math.floor(y/binSize)}`;
                if(!bins.has(key))bins.set(key,[]);
                bins.get(key).push({x,y,world,record});
            }));
        });
        // Cull source edges against the same projected surfaces used for picking.
        // Model coordinates and dimensions are independent of this display operation.
        function frontDepth(point) {
            let depth=-Infinity;
            for(const triangle of triangleBins.get(`${Math.floor(point[0]/binSize)},${Math.floor(point[1]/binSize)}`)||[]) {
                const [a,b,c]=triangle.p;
                const u=((b[1]-c[1])*(point[0]-c[0])+(c[0]-b[0])*(point[1]-c[1]))/triangle.determinant;
                const v=((c[1]-a[1])*(point[0]-c[0])+(a[0]-c[0])*(point[1]-c[1]))/triangle.determinant;
                const w=1-u-v;
                if(u<-.0001||v<-.0001||w<-.0001)continue;
                const d=triangle.world.map(p=>-p[0]+p[1]+p[2]);
                depth=Math.max(depth,u*d[0]+v*d[1]+w*d[2]);
            }
            return depth;
        }
        records.forEach(({part,path,hit})=>{
            const commands=[];
            part.edges.forEach(edge=>{
                let pen=false;
                edge.forEach((end,i)=>{
                    const start=i?edge[i-1]:end;
                    const distance=Math.hypot(...end.map((v,j)=>v-start[j]));
                    const steps=Math.max(1,Math.ceil(distance/4));
                    for(let n=i?1:0;n<=steps;n++){
                        const world=start.map((v,j)=>v+(end[j]-v)*n/steps);
                        const p=project(world),depth=-world[0]+world[1]+world[2];
                        if(depth>=frontDepth(p)-.6){commands.push(`${pen?'L':'M'}${p.map(v=>v.toFixed(4)).join(' ')}`);pen=true;}
                        else pen=false;
                    }
                });
            });
            const d=commands.join(' ');path.setAttribute('d',d);hit.setAttribute('d',d);
        });
        surfaces.sort((a,b)=>a.depth-b.depth).forEach(({node})=>surfaceLayer.append(node));
        const overlay=make('g',{'pointer-events':'none'});svg.append(overlay);
        let selected=null,selectedFace=null,lastSample=null,touch=null,persistent=false,frame=0,latest=null;
        function placeTooltip(clientX,clientY){
            tooltip.hidden=false;
            const box=tooltip.getBoundingClientRect();
            const x=Math.min(Math.max(8,clientX+14),innerWidth-box.width-8);
            let y=clientY+16;
            if(y+box.height>innerHeight-8)y=clientY-box.height-16;
            tooltip.style.left=`${x}px`;tooltip.style.top=`${Math.max(8,y)}px`;
        }
        function clear(){
            selected?.group.classList.remove('is-active');
            selectedFace?.classList.remove('is-active');selectedFace=null;
            selected=null;lastSample=null;overlay.replaceChildren();tooltip.hidden=true;
            svg.classList.remove('has-selection');
        }
        function paint(sample,event){
            if(!sample){clear();return;}
            const {record,world}=sample,{part}=record;
            if(selected!==record){
                selected?.group.classList.remove('is-active');selected=record;
                record.group.classList.add('is-active');svg.classList.add('has-selection');
            }
            selectedFace?.classList.remove('is-active');
            selectedFace=record.faceNodes.get(sample.face);
            selectedFace?.classList.add('is-active');
            lastSample=sample;
            const matrix=svg.getScreenCTM(),scale=matrix?Math.hypot(matrix.a,matrix.b):1;
            overlay.replaceChildren();
            // Bounds belong to one BREP solid; no exported SVG fragments are treated as parts.
            const corners=[];
            for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++)corners.push([x?part.max[0]:part.min[0],y?part.max[1]:part.min[1],z?part.max[2]:part.min[2]]);
            for(let i=0;i<8;i++)for(const bit of [1,2,4])if((i&bit)===0){
                const a=project(corners[i]),b=project(corners[i|bit]);
                overlay.append(make('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#999','stroke-width':'.6','stroke-dasharray':`${3/scale} ${3/scale}`,'vector-effect':'non-scaling-stroke'}));
            }
            corners.forEach(corner=>{
                const [x,y]=project(corner),size=5/scale;
                overlay.append(make('rect',{x:x-size/2,y:y-size/2,width:size,height:size,fill:'white',stroke:'black','stroke-width':'.8','vector-effect':'non-scaling-stroke'}));
            });
            const [x,y]=project(world);
            overlay.append(make('circle',{cx:x,cy:y,r:2.5/scale,fill:'black',stroke:'white','stroke-width':'1','vector-effect':'non-scaling-stroke'}));
            tooltip.textContent=`${part.name}\n${part.size.map(format).join(' × ')} mm\n${sample.face!==undefined?'≈ ':''}X ${format(world[0])}   Y ${format(world[1])}   Z ${format(world[2])} mm`;
            if(event)placeTooltip(event.clientX,event.clientY);
            else if(matrix){const point=new DOMPoint(x,y).matrixTransform(matrix);placeTooltip(point.x,point.y);}
        }
        function hit(event){
            const matrix=svg.getScreenCTM();if(!matrix)return null;
            const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
            const radius=12/Math.hypot(matrix.a,matrix.b),range=Math.ceil(radius/binSize);
            const bx=Math.floor(point.x/binSize),by=Math.floor(point.y/binSize);
            let surface=null,front=-Infinity;
            for(const triangle of triangleBins.get(`${bx},${by}`)||[]){
                const [a,b,c]=triangle.p;
                const u=((b[1]-c[1])*(point.x-c[0])+(c[0]-b[0])*(point.y-c[1]))/triangle.determinant;
                const v=((c[1]-a[1])*(point.x-c[0])+(a[0]-c[0])*(point.y-c[1]))/triangle.determinant;
                const w=1-u-v;
                if(u<-.00001||v<-.00001||w<-.00001)continue;
                const world=[0,1,2].map(i=>u*triangle.world[0][i]+v*triangle.world[1][i]+w*triangle.world[2][i]);
                const depth=-world[0]+world[1]+world[2];
                if(depth>front){front=depth;surface={record:triangle.record,world,face:triangle.face};}
            }
            if(surface)return surface;
            let best=null,distance=radius*radius;
            for(let y=by-range;y<=by+range;y++)for(let x=bx-range;x<=bx+range;x++){
                for(const sample of bins.get(`${x},${y}`)||[]){
                    const d=(sample.x-point.x)**2+(sample.y-point.y)**2;
                    if(d<distance){distance=d;best=sample;}
                }
            }
            return best;
        }
        svg.addEventListener('pointermove',event=>{
            if(event.pointerType==='touch'&&touch!==event.pointerId)return;
            latest={clientX:event.clientX,clientY:event.clientY};
            if(!frame)frame=requestAnimationFrame(()=>{frame=0;paint(hit(latest),latest);});
        });
        svg.addEventListener('pointerdown',event=>{
            persistent=event.pointerType==='touch'||event.pointerType==='pen';
            if(persistent&&event.target.matches('.furniture-part-hit, .furniture-part-surface')){touch=event.pointerId;svg.setPointerCapture(touch);}
            paint(hit(event),event);
        });
        const release=event=>{if(event.pointerId===touch){touch=null;if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);}};
        ['pointerup','pointercancel','lostpointercapture'].forEach(type=>svg.addEventListener(type,release));
        svg.addEventListener('pointerleave',()=>{if(!persistent){cancelAnimationFrame(frame);frame=0;clear();}});
        stage.addEventListener('keydown',event=>{
            if(!['ArrowLeft','ArrowRight','Home','End','Escape'].includes(event.key))return;
            event.preventDefault();if(event.key==='Escape'){clear();return;}
            const index=records.indexOf(selected);
            const next=event.key==='Home'?0:event.key==='End'?records.length-1:(index+(event.key==='ArrowRight'?1:-1)+records.length)%records.length;
            const record=records[next],world=record.part.edges[0]?.[0];
            if(world)paint({record,world});
        });
        new ResizeObserver(()=>{if(lastSample)paint(lastSample);}).observe(svg);
        window.addEventListener('scroll',()=>{if(persistent&&lastSample)paint(lastSample);else clear();},{passive:true});
    }catch(error){
        // Keep failure feedback local to the study; product photos remain available.
        stage.textContent='도면을 불러오지 못했습니다.';
    }
});
