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
        renderer.toneMapping=THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure=.95;
        renderer.domElement.className='product-viewer-canvas';
        renderer.domElement.tabIndex=0;
        renderer.domElement.setAttribute('aria-label','가구 3D 모델. 드래그로 회전하고 휠 또는 두 손가락으로 확대합니다. 방향키로도 회전할 수 있습니다.');
        const scene=new THREE.Scene();scene.background=new THREE.Color(0xffffff);
        const camera=new THREE.PerspectiveCamera(35,1,.01,20);
        const studio=new RoomEnvironment();
        const generator=new THREE.PMREMGenerator(renderer);
        const environment=generator.fromScene(studio,.04);
        studio.dispose();generator.dispose();scene.environment=environment.texture;
        scene.add(new THREE.HemisphereLight(0xffffff,0x8a8278,.65));
        const key=new THREE.DirectionalLight(0xffffff,1.5);key.position.set(-2,3,2);scene.add(key);
        const controls=new OrbitControls(camera,renderer.domElement);
        controls.enableDamping=false;controls.enablePan=false;controls.autoRotate=false;
        controls.minPolarAngle=.05;controls.maxPolarAngle=Math.PI-.05;
        let gltf;
        try { gltf=await new GLTFLoader().loadAsync(stage.dataset.furnitureModel); }
        catch(error){controls.dispose();environment.dispose();renderer.dispose();throw error;}
        if(disposed){renderer.dispose();environment.dispose();return;}
        scene.add(gltf.scene);
        gltf.scene.traverse(object=>{
            if(!object.isMesh)return;
            const materials=Array.isArray(object.material)?object.material:[object.material];
            materials.forEach(material=>{
                material.envMapIntensity=material.metalness>.5?1.15:.55;
                if(material.map)material.map.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);
            });
        });
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
