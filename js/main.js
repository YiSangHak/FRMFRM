/* ============================================================
   FRMFRM WEB — MAIN JAVASCRIPT

   Global JavaScript shared across all pages.
   ============================================================ */


"use strict";


/* ============================================================
   01. DOM READY
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    const menuToggle = document.querySelector('.header-profile');
    const navigation = document.getElementById('main-navigation');
    if (menuToggle && navigation) {
        const setMenuOpen = open => {
            menuToggle.setAttribute('aria-expanded', String(open));
            menuToggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
            navigation.hidden = !open;
        };
        const mobileMenu = window.matchMedia('(max-width: 767px)');
        const isHomePage = document.body.classList.contains('page-home');
        setMenuOpen(isHomePage || !mobileMenu.matches);
        mobileMenu.addEventListener('change', event => setMenuOpen(isHomePage || !event.matches));
        let profileRotation = 0;
        menuToggle.addEventListener('click', () => {
            profileRotation += 90;
            menuToggle.style.setProperty('--profile-rotation', `${profileRotation}deg`);
            setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
        });
        navigation.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                setMenuOpen(false);
                menuToggle.focus();
            }
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