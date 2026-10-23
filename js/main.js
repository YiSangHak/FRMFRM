/* ============================================================
   FRMFRM WEB — MAIN JAVASCRIPT

   Global JavaScript shared across all pages.
   ============================================================ */


"use strict";


/* ============================================================
   01. DOM READY
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    initSmoothScroll();
    const profileButton = document.querySelector('.header-profile');
    if (profileButton) {
        let profileRotation = 0;
        profileButton.addEventListener('click', () => {
            profileRotation += 90;
            profileButton.style.setProperty('--profile-rotation', `${profileRotation}deg`);
            const filled = profileButton.getAttribute('aria-pressed') !== 'true';
            profileButton.setAttribute('aria-pressed', String(filled));
        });
    }


    // Keep the editable specimen and size control in sync.
    const sizeControl = document.getElementById("type-tester-size");
    const specimen = document.querySelector(".type-tester-input");
    if (sizeControl && specimen && !sizeControl.dataset.integrated) {
        const updateSize = () => {
            specimen.style.fontSize = `${sizeControl.value}px`;
        };
        sizeControl.addEventListener("input", updateSize);
        updateSize();
    }

});

// Ease wheel and trackpad input without changing the document's native layout.
function initSmoothScroll() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let target = window.scrollY;
    let lastTime = 0;
    const stop = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        target = window.scrollY;
    };
    const maximum = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const animate = time => {
        const elapsed = Math.min(time - lastTime, 64);
        lastTime = time;
        target = Math.max(0, Math.min(target, maximum()));
        const next = window.scrollY + (target - window.scrollY) * (1 - Math.exp(-elapsed / 160));
        window.scrollTo({ top: Math.abs(target - next) < 1 ? target : next, behavior: 'instant' });
        if (Math.abs(target - window.scrollY) < 1) {
            frame = 0;
        } else {
            frame = requestAnimationFrame(animate);
        }
    };
    window.addEventListener('wheel', event => {
        if (reducedMotion.matches || event.ctrlKey || event.metaKey || event.shiftKey ||
            !event.cancelable || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            stop();
            return;
        }
        if (!event.deltaY) return;
        for (let node = event.target instanceof Element ? event.target : null;
            node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
            if (node.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])') ||
                (/auto|scroll/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight)) {
                stop();
                return;
            }
        }
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
        if (!frame) target = window.scrollY;
        target = Math.max(0, Math.min(target + delta, maximum()));
        if (target === window.scrollY && !frame) return;
        event.preventDefault();
        if (!frame) {
            lastTime = performance.now();
            frame = requestAnimationFrame(animate);
        }
    }, { passive: false });
    window.addEventListener('pointerdown', stop, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('keydown', stop);
    window.addEventListener('resize', stop);
    window.addEventListener('hashchange', stop);
    reducedMotion.addEventListener('change', stop);
}


/* ============================================================
   02. CROSS MARKS
   ============================================================ */

/*
   HTML에서 .cross-target 클래스를 가진 요소를 찾고
   네 꼭짓점에 construction cross를 자동으로 생성합니다.

   Example:

   <div class="home-title cross-target">
       ...
   </div>
*/

function initCrossMarks() {

    const targets =
        document.querySelectorAll(".cross-target");


    targets.forEach((target) => {

        /*
           중복 실행 방지
        */

        if (target.dataset.crossInitialized === "true") {
            return;
        }


        const positions = [
            "tl",
            "tr",
            "bl",
            "br"
        ];


        positions.forEach((position) => {

            const cross =
                document.createElement("span");


            cross.className =
                `corner-cross corner-cross--${position}`;


            cross.setAttribute(
                "aria-hidden",
                "true"
            );


            target.appendChild(cross);

        });


        target.dataset.crossInitialized = "true";

    });

}


/* ============================================================
   END
   ============================================================ */
