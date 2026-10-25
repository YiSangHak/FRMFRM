// Load the 3D tools and model only when the viewer is opened; render only on demand.
document.querySelectorAll('[data-furniture-model]').forEach(stage => {
    const dialog=stage.closest('dialog');
    const trigger=document.querySelector('.product-viewer-open');
    const close=dialog.querySelector('.product-viewer-close');
    const status=dialog.querySelector('.product-viewer-status');
    let viewer=null,loading=null,frame=0,disposed=false;
    const invalidate=()=>{
        if(!viewer||!dialog.open||document.hidden||frame)return;
        frame=requestAnimationFrame(()=>{frame=0;viewer.renderer.render(viewer.scene,viewer.camera);});
    };
    function resize(){
        if(!viewer||!dialog.open)return;
        const width=stage.clientWidth,height=stage.clientHeight;
        if(!width||!height)return;
        viewer.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
        viewer.renderer.setSize(width,height,false);
        viewer.camera.aspect=width/height;viewer.camera.updateProjectionMatrix();
        invalidate();
    }
    async function load(){
        stage.setAttribute('aria-busy','true');
        status.textContent='LOADING 3D…';status.hidden=false;
        const [THREE,{GLTFLoader},{OrbitControls},{RoomEnvironment}]=await Promise.all([
            import('three'),import('three/addons/loaders/GLTFLoader.js'),
            import('three/addons/controls/OrbitControls.js'),import('three/addons/environments/RoomEnvironment.js')
        ]);
        const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
        renderer.outputColorSpace=THREE.SRGBColorSpace;
        // Preserve the supplied texture's contrast without a filmic highlight lift.
        renderer.toneMapping=THREE.NoToneMapping;
        renderer.domElement.className='product-viewer-canvas';
        renderer.domElement.tabIndex=0;
        renderer.domElement.setAttribute('aria-label','가구 3D 모델. 드래그 또는 방향키로 회전할 수 있습니다.');
        const scene=new THREE.Scene();scene.background=new THREE.Color(0xffffff);
        const camera=new THREE.PerspectiveCamera(35,1,.01,20);
        const studio=new RoomEnvironment();
        const generator=new THREE.PMREMGenerator(renderer);
        const environment=generator.fromScene(studio,.04);
        studio.dispose();generator.dispose();scene.environment=environment.texture;
        scene.add(new THREE.HemisphereLight(0xffffff,0xd4d4d4,.8));
        const key=new THREE.DirectionalLight(0xffffff,.55);key.position.set(-2,3,2);scene.add(key);
        const controls=new OrbitControls(camera,renderer.domElement);
        controls.enableDamping=false;controls.enablePan=false;controls.enableZoom=false;controls.autoRotate=false;
        controls.minPolarAngle=.05;controls.maxPolarAngle=Math.PI-.05;
        let gltf;
        try { gltf=await new GLTFLoader().loadAsync(stage.dataset.furnitureModel); }
        catch(error){controls.dispose();environment.dispose();renderer.dispose();throw error;}
        if(disposed){renderer.dispose();environment.dispose();return;}
        scene.add(gltf.scene);
        const woodSurfaces=new Map();
        let plywoodEdgeMap=null;
        let aluminumGrain=null;
        function makeAluminumGrain(){
            const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
            const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(256,256);
            let seed=731;
            const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
            const lines=Array.from({length:256},()=>random());
            for(let y=0;y<256;y++)for(let x=0;x<256;x++){
                const value=Math.round(220+(lines[x]-.5)*18+(random()-.5)*5);
                const i=(y*256+x)*4;
                pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;
                pixels.data[i+3]=255;
            }
            ctx.putImageData(pixels,0,0);
            const map=new THREE.CanvasTexture(canvas);
            // Data texture: no sRGB conversion for roughness or bump height.
            map.wrapS=map.wrapT=THREE.RepeatWrapping;
            map.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);
            return map;
        }
        function makePlywoodEdgeMap(){
            const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
            const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(512,256);
            // Two alternating veneers per 3 mm repeat; fine grain and narrow glue seams.
            for(let y=0;y<256;y++)for(let x=0;x<512;x++){
                const layer=y<128?0:1,within=y%128;
                const grain=2*Math.sin(x*.17+Math.sin(y*.09)*2)+Math.sin(x*.63+y*.31);
                const seam=within<3?14:within<6?5:0;
                const base=layer?[190,157,111]:[220,193,151];
                const i=(y*512+x)*4;
                for(let c=0;c<3;c++)pixels.data[i+c]=base[c]+grain-seam;
                pixels.data[i+3]=255;
            }
            ctx.putImageData(pixels,0,0);
            const map=new THREE.CanvasTexture(canvas);
            map.colorSpace=THREE.SRGBColorSpace;
            map.wrapS=map.wrapT=THREE.RepeatWrapping;
            map.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);
            return map;
        }
        gltf.scene.traverse(object=>{
            if(!object.isMesh)return;
            const materials=Array.isArray(object.material)?object.material:[object.material];
            if(materials.some(material=>material.metalness>.5)){
                const geometry=object.geometry;
                geometry.computeBoundingBox();
                const extent=geometry.boundingBox.getSize(new THREE.Vector3()).toArray();
                const along=extent.indexOf(Math.max(...extent));
                const positions=geometry.attributes.position,normals=geometry.attributes.normal;
                const uv=new Float32Array(positions.count*2);
                const across=[0,1,2].filter(axis=>axis!==along);
                for(let i=0;i<positions.count;i++){
                    const a=across[0],b=across[1];
                    const cross=Math.abs(normals.getComponent(i,a))<Math.abs(normals.getComponent(i,b))?a:b;
                    uv[i*2]=positions.getComponent(i,cross)/.012;
                    uv[i*2+1]=positions.getComponent(i,along)/.12;
                }
                geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
            }
            if(materials.some(material=>material.name==='Birch plywood edge')){
                const positions=object.geometry.attributes.position;
                const uv=new Float32Array(positions.count*2);
                for(let i=0;i<positions.count;i++){
                    // A shared height coordinate keeps layers aligned around every corner.
                    uv[i*2]=(positions.getX(i)+positions.getZ(i))/.064;
                    uv[i*2+1]=positions.getY(i)/.003;
                }
                object.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
            }
            const adjusted=materials.map(material=>{
                if(material.name==='Birch plywood edge'){
                    plywoodEdgeMap??=makePlywoodEdgeMap();
                    material.map=plywoodEdgeMap;
                    material.color.set(0xffffff);
                    material.needsUpdate=true;
                }
                // Show the supplied grain at its original sRGB values, without
                // lighting or specular highlights clipping the pale surface.
                if(material.name==='Birch plywood surface'&&material.map){
                    if(!woodSurfaces.has(material)){
                        material.map.colorSpace=THREE.SRGBColorSpace;
                        material.map.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);
                        woodSurfaces.set(material,new THREE.MeshBasicMaterial({
                            name:material.name,map:material.map,color:0xffffff,
                            side:material.side,toneMapped:false
                        }));
                    }
                    return woodSurfaces.get(material);
                }
                const isMetal=material.metalness>.5;
                material.envMapIntensity=isMetal?.38:.1;
                material.roughness=isMetal?.72:Math.max(material.roughness,.85);
                if(isMetal){
                    aluminumGrain??=makeAluminumGrain();
                    material.color.setRGB(.55,.56,.57);
                    material.roughnessMap=aluminumGrain;
                    material.bumpMap=aluminumGrain;
                    material.bumpScale=.000008;
                    material.needsUpdate=true;
                }
                if(material.map)material.map.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);
                return material;
            });
            object.material=Array.isArray(object.material)?adjusted:adjusted[0];
        });
        woodSurfaces.forEach((replacement,original)=>original.dispose());
        const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3());
        const center=box.getCenter(new THREE.Vector3());
        controls.target.set(center.x,box.min.y+size.y*.45,center.z);
        const width=Math.max(stage.clientWidth,1),height=Math.max(stage.clientHeight,1);
        camera.aspect=width/height;camera.updateProjectionMatrix();
        const vertical=THREE.MathUtils.degToRad(camera.fov);
        const horizontal=2*Math.atan(Math.tan(vertical/2)*camera.aspect);
        const distance=size.length()/2/Math.sin(Math.min(vertical,horizontal)/2)*1.04;
        const direction=new THREE.Vector3(-1,.6,-1).normalize();
        camera.position.copy(controls.target).addScaledVector(direction,distance);
        controls.minDistance=size.length()*.6;controls.maxDistance=distance*3;
        controls.update();
        // A baked-looking soft contact shadow, without real-time shadow maps.
        const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
        const ink=shadowCanvas.getContext('2d');
        const gradient=ink.createRadialGradient(64,64,12,64,64,64);
        gradient.addColorStop(0,'rgba(0,0,0,.13)');gradient.addColorStop(1,'rgba(0,0,0,0)');
        ink.fillStyle=gradient;ink.fillRect(0,0,128,128);
        const shadowMap=new THREE.CanvasTexture(shadowCanvas);
        const shadow=new THREE.Mesh(new THREE.PlaneGeometry(size.x*1.7,size.z*1.7),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));
        shadow.rotation.x=-Math.PI/2;shadow.position.set(center.x,box.min.y-.001,center.z);scene.add(shadow);
        stage.querySelector('img')?.remove();stage.append(renderer.domElement);
        viewer={THREE,renderer,scene,camera,controls,environment,shadowMap};
        controls.addEventListener('change',invalidate);
        renderer.domElement.addEventListener('keydown',event=>{
            if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
            event.preventDefault();
            const offset=camera.position.clone().sub(controls.target),spherical=new THREE.Spherical().setFromVector3(offset);
            if(event.key==='ArrowLeft')spherical.theta-=.08;
            if(event.key==='ArrowRight')spherical.theta+=.08;
            if(event.key==='ArrowUp')spherical.phi=Math.max(.05,spherical.phi-.08);
            if(event.key==='ArrowDown')spherical.phi=Math.min(Math.PI-.05,spherical.phi+.08);
            camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();invalidate();
        });
        stage.removeAttribute('aria-busy');status.hidden=true;
        controls.enabled=dialog.open;
        resize();
    }
    trigger.addEventListener('click',async()=>{
        dialog.showModal();document.documentElement.classList.add('has-product-viewer');
        if(viewer){viewer.controls.enabled=true;resize();return;}
        if(!loading)loading=load().catch(()=>{
            stage.removeAttribute('aria-busy');status.textContent='3D 모델을 불러오지 못했습니다. 네트워크와 브라우저의 3D 지원을 확인해주세요.';
            status.hidden=false;loading=null;
        });
        await loading;
    });
    close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{
        const box=dialog.getBoundingClientRect();
        if(event.target===dialog&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom))dialog.close();
    });
    dialog.addEventListener('close',()=>{
        document.documentElement.classList.remove('has-product-viewer');
        if(viewer)viewer.controls.enabled=false;
        cancelAnimationFrame(frame);frame=0;trigger.focus({preventScroll:true});
    });
    new ResizeObserver(resize).observe(stage);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else invalidate();});
    window.addEventListener('pagehide',event=>{
        if(event.persisted)return;
        disposed=true;cancelAnimationFrame(frame);
        if(!viewer)return;
        viewer.controls.dispose();viewer.renderer.dispose();viewer.environment.dispose();viewer.shadowMap.dispose();
        const textures=new Set(),materials=new Set();
        viewer.scene.traverse(object=>{
            if(!object.isMesh)return;object.geometry.dispose();
            (Array.isArray(object.material)?object.material:[object.material]).forEach(material=>materials.add(material));
        });
        materials.forEach(material=>{Object.values(material).forEach(value=>{if(value?.isTexture)textures.add(value);});material.dispose();});
        textures.forEach(texture=>texture.dispose());
    });
});
