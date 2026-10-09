/* ============================================================
   FRMFRM — HOME 3D VIEWER

   Three.js / GLB
   ============================================================ */


import * as THREE from "three";

import { GLTFLoader }
    from "three/addons/loaders/GLTFLoader.js";

import { OrbitControls }
    from "three/addons/controls/OrbitControls.js";

import { RoomEnvironment }
    from "three/addons/environments/RoomEnvironment.js";


/* ============================================================
   01. ELEMENT
   ============================================================ */

const container =
    document.getElementById("model-viewer");


if (!container) {

    console.warn(
        "FRMFRM: #model-viewer not found."
    );

} else {

    init();

}


/* ============================================================
   02. INITIALIZE
   ============================================================ */

function init() {


    /* ----------------------------------------------------------
       SCENE
       ---------------------------------------------------------- */

    const scene =
        new THREE.Scene();


    scene.background =
        new THREE.Color(0xffffff);



    /* ----------------------------------------------------------
       CAMERA
       ---------------------------------------------------------- */

    const camera =
        new THREE.PerspectiveCamera(
            32,
            1,
            0.01,
            10000
        );



    /* ----------------------------------------------------------
       RENDERER
       ---------------------------------------------------------- */

    const renderer =
        new THREE.WebGLRenderer({
            antialias: true,
            alpha: false
        });


    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio,
            1.5
        )
    );


    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    // Bake soft studio reflections once; no HDR download or live shadows.
    const studio = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(studio, 0.04);
    scene.environment = environment.texture;
    studio.dispose();
    pmrem.dispose();

    const aluminum = new THREE.MeshStandardMaterial({
        color: 0xd5d8dc,
        metalness: 0.9,
        roughness: 0.38,
        envMapIntensity: 1.2,
        side: THREE.DoubleSide
    });


    container.appendChild(
        renderer.domElement
    );



    /* ----------------------------------------------------------
       CONTROLS
       ---------------------------------------------------------- */
    const controls =
        new OrbitControls(
            camera,
            renderer.domElement
        );

    controls.enableDamping = true;
    controls.dampingFactor = 0.07;

    /* Drag = Rotate */
    controls.enableRotate = true;

    /* Pan disabled */
    controls.enablePan = false;

    /* Zoom disabled */
    controls.enableZoom = false;

    /* Automatic rotation */
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    controls.autoRotate = !reducedMotion.matches;
    controls.autoRotateSpeed = -0.45;
    reducedMotion.addEventListener("change", () => {
        controls.autoRotate = !reducedMotion.matches;
    });

    /* Stop auto rotation while user interacts */
    controls.addEventListener("start", () => {
        controls.autoRotate = false;
    });

    controls.addEventListener("end", () => {
        controls.autoRotate = !reducedMotion.matches;
    });


    /* ============================================================
       03. GLB
       ============================================================ */

    const loader =
        new GLTFLoader();


    /*
       현재 프로젝트 구조:

       WEB/
       ├── index.html
       └── assets/
           └── models/
               └── cube_profile.glb
    */

    const modelPath =
        "./assets/models/cube_profile.glb";


    loader.load(

        modelPath,


        /* ----------------------------------------------------------
           SUCCESS
           ---------------------------------------------------------- */

        (gltf) => {


            const root =
                gltf.scene;



            /* ------------------------------------------------------
               CENTER MODEL
               ------------------------------------------------------ */

            const box =
                new THREE.Box3()
                    .setFromObject(root);


            const center =
                box.getCenter(
                    new THREE.Vector3()
                );


            root.position.sub(
                center
            );


            scene.add(
                root
            );



            // Share one aluminum material across meshes. Keep the GLB geometry intact.
            const originalMaterials = new Set();
            root.traverse((object) => {
                if (!object.isMesh) return;
                const materials = Array.isArray(object.material)
                    ? object.material : [object.material];
                materials.forEach((material) => originalMaterials.add(material));
                object.material = aluminum;
            });
            originalMaterials.forEach((material) => material.dispose());


            /* ======================================================
               04. AUTO FRAME
               ====================================================== */

            const centeredBox =
                new THREE.Box3()
                    .setFromObject(root);


            const size =
                centeredBox.getSize(
                    new THREE.Vector3()
                );


            const maxDimension =
                Math.max(
                    size.x,
                    size.y,
                    size.z
                );


            const fov =
                THREE.MathUtils.degToRad(
                    camera.fov
                );


            let distance =
                (maxDimension / 2) /
                Math.tan(fov / 2);


            /*
               이전 테스트와 동일한 framing.
            */

            distance *= 1.65;



            camera.position.set(

                distance * 0.85,

                distance * 0.62,

                distance * 0.85

            );


            camera.near =
                Math.max(
                    distance / 1000,
                    0.01
                );


            camera.far =
                distance * 20;


            camera.updateProjectionMatrix();



            /* ------------------------------------------------------
               FIRST RESIZE
               ------------------------------------------------------ */

            resize();


            console.log(
                "FRMFRM: cube_profile.glb loaded."
            );

        },


        undefined,


        /* ----------------------------------------------------------
           ERROR
           ---------------------------------------------------------- */

        (error) => {


            console.error(
                "FRMFRM GLB LOAD ERROR:",
                error
            );


            const errorMessage =
                document.createElement("div");


            errorMessage.textContent =
                "3D MODEL COULD NOT BE LOADED.";


            errorMessage.style.fontSize =
                "12px";


            errorMessage.style.padding =
                "20px";


            container.appendChild(
                errorMessage
            );

        }

    );



    /* ============================================================
       05. RESIZE
       ============================================================ */

    function resize() {


        const width =
            container.clientWidth;


        const height =
            container.clientHeight;


        if (
            width <= 0 ||
            height <= 0
        ) {

            return;

        }


        renderer.setSize(
            width,
            height,
            false
        );


        camera.aspect =
            width / height;


        camera.updateProjectionMatrix();

    }



    window.addEventListener(
        "resize",
        resize
    );


    const resizeObserver =
        new ResizeObserver(
            resize
        );


    resizeObserver.observe(
        container
    );



    /* ============================================================
       06. ANIMATION
       ============================================================ */

    function animate() {


        requestAnimationFrame(
            animate
        );


        controls.update();


        renderer.render(
            scene,
            camera
        );

    }


    animate();

}


/* ============================================================
   END
   ============================================================ */