/* ============================================================
   FRMFRM WEB — MAIN JAVASCRIPT

   Global JavaScript shared across all pages.
   ============================================================ */


"use strict";

// Exhibition interaction uses pointer selection; text entry remains native.
document.addEventListener('keydown', event => {
    if (event.key === 'Tab') event.preventDefault();
}, true);


/* ============================================================
   01. DOM READY
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('.site-nav a, .footer-nav a').forEach(link => {
        link.tabIndex = -1;
    });
    initSmoothScroll();
    initIdleHomeReturn();
    initProfileNavigation();


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

// The same profile mark controls the mobile menu and its filled state.
function initProfileNavigation() {
    const header = document.querySelector('.site-header');
    const button = header?.querySelector('.header-profile');
    const navigation = header?.querySelector('.site-nav');
    if (!button || !navigation) return;
    const mobile = matchMedia('(max-width: 767px)');
    let rotation = 0;
    const setOpen = open => {
        header.classList.toggle('is-menu-open', open);
        navigation.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
        button.setAttribute('aria-pressed', String(open));
        button.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    };
    const syncMode = () => {
        setOpen(false);
        if (mobile.matches) button.setAttribute('aria-controls', navigation.id);
        else {
            navigation.hidden = false;
            button.removeAttribute('aria-expanded');
            button.removeAttribute('aria-controls');
            button.setAttribute('aria-label', '프로파일 단면 채우기 전환');
        }
    };
    button.addEventListener('click', event => {
        rotation += 90;
        button.style.setProperty('--profile-rotation', `${rotation}deg`);
        if (mobile.matches) {
            const open = button.getAttribute('aria-expanded') !== 'true';
            setOpen(open);
        } else button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
    });
    navigation.addEventListener('click', event => {
        if (mobile.matches && event.target.closest('a')) setOpen(false);
    });
    header.addEventListener('keydown', event => {
        if (mobile.matches && event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
            setOpen(false); button.focus();
        }
    });
    header.addEventListener('focusout', event => {
        if (mobile.matches && event.relatedTarget && !header.contains(event.relatedTarget)) setOpen(false);
    });
    document.addEventListener('click', event => {
        if (mobile.matches && !header.contains(event.target)) setOpen(false);
    });
    window.addEventListener('pageshow', event => { if (event.persisted) syncMode(); });
    mobile.addEventListener('change', syncMode);
    syncMode();
}

// Return unattended exhibition pages to the live home screen.
function initIdleHomeReturn() {
    if (document.body.classList.contains('page-home')) return;
    const idleLimit = 60_000;
    let lastInput = Date.now();
    let timer = 0;
    const check = () => {
        clearTimeout(timer);
        const remaining = idleLimit - (Date.now() - lastInput);
        if (remaining <= 0) {
            window.location.replace(new URL('./index.html', window.location.href).href);
            return;
        }
        timer = setTimeout(check, remaining);
    };
    const recordInput = event => {
        if (event.isTrusted) lastInput = Date.now();
    };
    // Wheel input counts directly; animated scrolling never resets the timer.
    ['pointermove', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'wheel', 'touchstart', 'touchmove', 'input', 'click']
        .forEach(type => window.addEventListener(type, recordInput, { passive: true, capture: true }));
    window.addEventListener('pagehide', () => clearTimeout(timer));
    window.addEventListener('pageshow', event => {
        if (event.persisted) { lastInput = Date.now(); check(); }
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
    });
    check();
}

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
        const next = window.scrollY + (target - window.scrollY) * (1 - Math.exp(-elapsed / 55));
        window.scrollTo({ top: Math.abs(target - next) < 1 ? target : next, behavior: 'instant' });
        if (Math.abs(target - window.scrollY) < 1) {
            frame = 0;
        } else {
            frame = requestAnimationFrame(animate);
        }
    };
    window.addEventListener('wheel', event => {
        if (document.querySelector('dialog[open]')) { stop(); return; }
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
        // Discard the old destination immediately when the user reverses direction.
        if (!frame || delta * (target - window.scrollY) < 0) target = window.scrollY;
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
