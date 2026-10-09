const title = document.querySelector('.page-typeface .typeface-title h1');
if (title) {
    let initialText = true;
    const defaultText = title.textContent.trim();
    const fitTitle = () => {
        if (!initialText) return;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = '100px "FRMFRM Mono"';
        const naturalWidth = context.measureText(defaultText).width;
        const spacing = -3 * (defaultText.length - 1);
        const size = Math.max(24, Math.min(180, title.parentElement.clientWidth * 100 / (naturalWidth + spacing)));
        title.style.fontSize = `${size}px`;
    };
    title.addEventListener('input', () => { initialText = false; });
    document.fonts.ready.then(() => {
        fitTitle();
        title.focus({ preventScroll: true });
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(title);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        new ResizeObserver(fitTitle).observe(title.parentElement);
    });
}

// Convert Korean two-set keyboard input to the corresponding Latin keys.
if (title) {
    const initials = ['r','R','s','e','E','f','a','q','Q','t','T','d','w','W','c','z','x','v','g'];
    const vowels = ['k','o','i','O','j','p','u','P','h','hk','ho','hl','y','n','nj','np','nl','b','m','ml','l'];
    const finals = ['', 'r','R','rt','s','sw','sg','e','f','fr','fa','fq','ft','fx','fv','fg','a','q','qt','t','T','d','w','c','z','x','v','g'];
    const consonants = ['r','R','rt','s','sw','sg','e','E','f','fr','fa','fq','ft','fx','fv','fg','a','q','Q','qt','t','T','d','w','W','c','z','x','v','g'];
    const toLatin = text => [...text].map(char => {
        const code = char.codePointAt(0);
        if (code >= 0xac00 && code <= 0xd7a3) {
            const syllable = code - 0xac00;
            return initials[Math.floor(syllable / 588)] + vowels[Math.floor(syllable % 588 / 28)] + finals[syllable % 28];
        }
        if (code >= 0x3131 && code <= 0x314e) return consonants[code - 0x3131];
        if (code >= 0x314f && code <= 0x3163) return vowels[code - 0x314f];
        if (code >= 0x1100 && code <= 0x1112) return initials[code - 0x1100];
        if (code >= 0x1161 && code <= 0x1175) return vowels[code - 0x1161];
        if (code >= 0x11a8 && code <= 0x11c2) return finals[code - 0x11a7];
        return char;
    }).join('').toUpperCase().replace(/[^A-Z!?._+\-=()| \n\r]/g, '');
    let composing = false;
    const normalize = () => {
        const selection = window.getSelection();
        let offset = null;
        if (selection.rangeCount && title.contains(selection.anchorNode)) {
            const before = selection.getRangeAt(0).cloneRange();
            before.selectNodeContents(title);
            before.setEnd(selection.anchorNode, selection.anchorOffset);
            offset = toLatin(before.toString()).length;
        }
        // Work on text nodes to preserve line breaks from the editable element.
        const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        let changed = false;
        nodes.forEach(node => {
            const converted = toLatin(node.data);
            if (converted !== node.data) { node.data = converted; changed = true; }
        });
        if (changed && offset !== null) {
            let remaining = offset;
            for (const node of nodes) {
                if (remaining <= node.length) {
                    const caret = document.createRange();
                    caret.setStart(node, remaining);
                    caret.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(caret);
                    break;
                }
                remaining -= node.length;
            }
        }
    };
    title.addEventListener('compositionstart', () => { composing = true; });
    title.addEventListener('compositionend', () => { composing = false; normalize(); });
    title.addEventListener('input', event => {
        if (!composing && !event.isComposing) normalize();
    });
}
