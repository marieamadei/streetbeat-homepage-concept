/* ============================================================================
   Streetbeat - boot loader → hero hand-off (BrandHero section)
   Extracted 1:1 from the legacy homepage inline controller so the Astro
   BrandHero section can load it as a module. A white loader owns first paint:
   ONE green→cyan gradient is masked into the 10 Streetbeat letters (footer
   fw-*.svg masks) and shares its ramp with the loading bar below. As the bar
   fills L→R each letter pops up out of it; a highlight shimmers across, the
   type floods to black, and it flies onto the hero wordmark slot - then the
   loader clears, the 3D logo arms, and the subtitle blur-fades in.

   Gated by the .hero-intro class the section's arming script sets pre-paint
   (skipped under reduced motion / no JS / client-side navigation). Scroll is
   locked for the duration and handed back from finish() - the single exit
   point every path reaches. Runs on DOMContentLoaded so GSAP (deferred at the
   END of the Astro layout body, i.e. after this file in document order) is
   guaranteed to have executed.
   ============================================================================ */
(function () {
    'use strict';

    /* ---- Scroll lock (held for the duration of the boot intro) ---- */
    var scrollLocked = false;
    function blockScrollInput(e) { e.preventDefault(); }
    function blockScrollKeys(e) {
        var t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        // space, page up/down, end, home, arrow keys
        if ([32, 33, 34, 35, 36, 37, 38, 39, 40].indexOf(e.keyCode) !== -1) e.preventDefault();
    }
    function lockScroll() {
        if (scrollLocked) return;
        scrollLocked = true;
        window.addEventListener('wheel', blockScrollInput, { passive: false });
        window.addEventListener('touchmove', blockScrollInput, { passive: false });
        window.addEventListener('keydown', blockScrollKeys, { passive: false });
        if (window.lenis) window.lenis.stop();
    }
    function unlockScroll() {
        if (scrollLocked) {
            scrollLocked = false;
            window.removeEventListener('wheel', blockScrollInput, { passive: false });
            window.removeEventListener('touchmove', blockScrollInput, { passive: false });
            window.removeEventListener('keydown', blockScrollKeys, { passive: false });
            if (window.lenis) window.lenis.start();
        }
        // Reveal the nav at the exact moment scrolling is handed back, so its
        // links can't be clicked while scroll is still locked. This must also
        // run on early failure paths where lockScroll() was never reached.
        document.documentElement.classList.remove('nav-locked');
    }

    function boot() {
        var root = document.documentElement;
        var heroPath = document.getElementById('sbPath');
        var heroLetters = document.querySelector('.hero-letter-group');
        var heroWord = document.querySelector('.hero-word svg');
        var loader = document.getElementById('loader');
        var union = document.querySelector('.loader-union');
        var type = document.getElementById('loaderType');
        var ink = document.getElementById('loaderInk');
        var shine = document.getElementById('loaderShine');
        var letters = document.getElementById('loaderLetters');
        var sbStopA = document.getElementById('sbStopA');
        var sbStopB = document.getElementById('sbStopB');

        // Brand colours from the locked tokens (single source of truth). Seed the
        // hero wordmark's hand-off gradient with them so it matches the loader's
        // gradient exactly; the same INK value drains it to black at the end.
        var cs = getComputedStyle(root);
        var BRAND_GREEN = cs.getPropertyValue('--accent-green').trim();
        var BRAND_CYAN = cs.getPropertyValue('--accent-cyan').trim();
        var INK = cs.getPropertyValue('--text-primary').trim();
        if (sbStopA) sbStopA.style.stopColor = BRAND_GREEN;
        if (sbStopB) sbStopB.style.stopColor = BRAND_CYAN;

        function finish() {
            clearTimeout(window.__introFailsafe);
            if (heroPath) heroPath.style.fill = INK;
            if (heroLetters) heroLetters.style.fill = INK;
            if (loader) loader.classList.remove('is-active');
            if (window.__armHeroLogo) window.__armHeroLogo();   // reveal the 3D logo
            root.classList.remove('hero-intro');                // CSS blur-fades the subtitle
            unlockScroll();                                     // hand scrolling back to the user
        }

        // Not armed (reduced motion / no-JS / client-nav path): leave the static hero as-is.
        if (!root.classList.contains('hero-intro')) return;
        // Can't run the loader: hand off immediately so nothing stays hidden.
        if (!loader || !union || !type || !heroPath || !heroWord || !window.gsap) { finish(); return; }

        // Keep the branded arrival under two seconds on a typical connection.
        // Every timeline/tween uses the same factor, preserving the choreography
        // while preventing the decorative intro from dominating LCP.
        var INTRO_DURATION_FACTOR = 0.55;
        var INTRO_SPEED = 1 / INTRO_DURATION_FACTOR;

        lockScroll();   // hold scroll until finish() runs at the end of the sequence
        loader.classList.add('is-active');
        // The controller now owns completion - every path below reaches finish() -
        // so retire the pre-paint failsafe (it must not fire during the sequence)
        // and replace it with a generous backstop that ends CLEANLY via finish()
        // rather than yanking the loader mid-hand-off.
        clearTimeout(window.__introFailsafe);
        window.__introFailsafe = setTimeout(finish, 12000);

        // Each letter's horizontal centre (fraction of the wordmark width). The
        // bar fills L→R; a letter only emerges once the fill has covered its WHOLE
        // width - i.e. the front has passed its trailing edge (midpoint to the next
        // letter) - so a glyph never pokes out ahead of the fill during a stall.
        var CENTERS = [0.054, 0.151, 0.235, 0.319, 0.429, 0.524, 0.633, 0.745, 0.859, 0.963];
        var TRIG = CENTERS.map(function (c, i) {
            return i === 9 ? 0.94 : (c + CENTERS[i + 1]) / 2;
        });

        // tuck distance: a touch more than the band height so letters start hidden
        // below it - tucked under the bar they rise out of.
        function tuck() { return Math.round(type.offsetHeight * 1.18) + 10; }
        var TUCK = tuck();

        var rise = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];   // 0 = tucked, 1 = at rest
        var fired = [false, false, false, false, false, false, false, false, false, false];

        function applyLetter(i) {
            union.style.setProperty('--l' + (i + 1), (TUCK * (1 - rise[i])).toFixed(2) + 'px');
        }
        function resetLetters() { for (var i = 0; i < 10; i++) { rise[i] = 0; applyLetter(i); } }

        // Each letter rises FROM the bar with the same whisper of overshoot as the
        // site's titleReveal (back.out(1.2)) so the boot wordmark shares the title
        // animation's personality instead of a stiff sine settle. The overshoot
        // past rest is only a few px of the tuck distance - comfortably inside the
        // loader's --glyph-pad headroom (the hand-off ripple already lives there) -
        // then the glyph lands back exactly on the bar. Every glyph rises the same
        // way, so the word still flows out of the bar as one continuous wave.
        function popLetter(i) {
            if (fired[i]) return;
            fired[i] = true;
            var o = { r: 0 };
            gsap.to(o, {
                r: 1,
                duration: 0.65,
                ease: 'back.out(1.2)',
                onUpdate: function () { rise[i] = o.r; applyLetter(i); }
            }).timeScale(INTRO_SPEED);
        }

        var p = { v: 0 };
        function render() {
            var v = p.v;
            // One clip on the unified surface reveals the bar + letters together L→R.
            if (letters) letters.style.clipPath = letters.style.webkitClipPath = 'inset(0 ' + ((1 - v) * 100).toFixed(2) + '% 0 0)';
            for (var i = 0; i < 10; i++) { if (!fired[i] && v >= TRIG[i]) popLetter(i); }
        }
        resetLetters();
        render();

        // The fill paces the reveal - ONE continuous sine sweep from empty to full,
        // so the whole word composes as a single smooth wave. Once full, only wait
        // for the final letter to settle. Brand fonts load asynchronously and the
        // SVG hand-off geometry is font-independent, so neither fonts.ready nor the
        // full window load may hold the first meaningful render hostage.
        var tl = gsap.timeline({
            onUpdate: render,
            onComplete: function () {
                for (var i = 0; i < 10; i++) popLetter(i);   // safety: any not yet fired
                var t0 = performance.now();
                (function waitReady() {
                    var settled = rise.every(function (r) { return r > 0.999; });
                    if (settled || performance.now() - t0 > 700) clickBounceHandoff();
                    else requestAnimationFrame(waitReady);
                })();
            }
        });
        tl.timeScale(INTRO_SPEED);
        tl.to(p, { v: 1, duration: 2.1, ease: 'sine.inOut' });

        // Shimmer + "click bounce" hand-off, stage 1 - once the bar is full a soft
        // sheen sweeps across WHILE the block presses IN (a centred anticipation
        // squash); then it springs UP to the hero slot with a gentle overshoot,
        // settling EXACTLY on the wordmark. The type surface flies as one, origin
        // top-left, so it lands pixel-on-pixel; the instant it lands, stage 2 swaps
        // it for the crisp vector wordmark.
        function clickBounceHandoff() {
            // force:true so the reset applies even though Lenis (if present) is
            // stopped during the intro.
            if (window.lenis) { try { window.lenis.scrollTo(0, { immediate: true, force: true }); } catch (e) {} }
            window.scrollTo(0, 0);

            type.style.overflow = 'visible';        // let the scaled surface escape the band clip
            loader.style.pointerEvents = 'none';

            // Measure the FLIP from the NATURAL (un-squashed) state so the target
            // scale is exact.
            gsap.set(type, { transformOrigin: '0 0' });
            var from = ink.getBoundingClientRect();  // the glyph canvas == the wordmark rect
            var to = heroWord.getBoundingClientRect();
            if (!from.width || !to.width) { finish(); return; }
            var scale = to.width / from.width;
            var dx = to.left - from.left;
            var dy = to.top - from.top;

            // Centred anticipation: with origin 0 0, translating by (1-s)·half-size
            // holds the block's CENTRE fixed as it shrinks.
            var SQUASH = 0.88;
            var ax = (1 - SQUASH) * from.width / 2;
            var ay = (1 - SQUASH) * from.height / 2;

            // release the loading clip so the full wordmark scales up
            letters.style.clipPath = letters.style.webkitClipPath = 'none';

            // Secondary motion - as the bounce force hits, a subtle travelling
            // ripple runs through the letters (reusing the per-letter --lN offsets).
            // The sin(w·π) envelope is 0 at BOTH ends, so the letters bob WITH the
            // word and land back at exact rest.
            var wave = { w: 0 };
            var WAVE_AMP = 4.5;     // local px - gentle bob (kept under --glyph-pad so it never clips)
            var WAVE_CYCLES = 1.5;  // knock-and-settle per letter across the run
            var WAVE_LAG = 0.075;   // per-letter phase offset → ripple travelling L→R
            function applyWave() {
                var w = wave.w;
                var env = Math.sin(w * Math.PI);            // 0 → 1 → 0 (rest at both ends)
                for (var i = 0; i < 10; i++) {
                    var o = WAVE_AMP * env * Math.sin((w * WAVE_CYCLES - i * WAVE_LAG) * 6.2831853);
                    union.style.setProperty('--l' + (i + 1), o.toFixed(2) + 'px');
                }
            }

            var barWipe = { v: 100 };
            gsap.timeline({ onComplete: armLogoThenReveal }).timeScale(INTRO_SPEED)
                // sheen sweeps across (concurrent with the press)
                .set(shine, { opacity: 1 }, 0)
                .fromTo(shine, { xPercent: -200 }, { xPercent: 320, duration: 0.7, ease: 'power2.inOut' }, 0)
                .to(shine, { opacity: 0, duration: 0.2, ease: 'none' }, 0.55)
                // 1) anticipation - the block presses IN (centred squash) as the sheen passes
                .to(type, { x: ax, y: ay, scale: SQUASH, duration: 0.40, ease: 'power2.inOut' }, 0.16)
                // 2) bounce - springs UP to the hero slot, overshooting then settling EXACTLY
                .to(type, { x: dx, y: dy, scale: scale, duration: 1.06, ease: 'back.out(1.3)' }, 0.56)
                // 3) letter ripple - fires at the LAUNCH: the letters feel the kick,
                //    ripple up the climb, and damp back to exact rest before landing.
                .to(wave, { w: 1, duration: 0.8, ease: 'none', onUpdate: applyWave }, 0.54)
                // its loading bar wipes away L→R as it launches
                .to(barWipe, { v: 0, duration: 0.72, ease: 'power2.in',
                    onUpdate: function () { letters.style.setProperty('--bar-rev', barWipe.v.toFixed(2) + '%'); } }, 0.62)
                // melt the white backdrop so the hero shows behind the gradient wordmark
                .to(loader, { backgroundColor: 'transparent', duration: 0.6, ease: 'power1.out' }, 0.80);
        }

        // Hand-off, stage 2 - the scaled mask has landed pixel-on-pixel over the
        // hero slot. Swap it for the REAL inline-SVG wordmark filled with the SAME
        // gradient: a vector ⇒ pin-sharp at hero size. Then the 3D logo appears; a
        // beat later the supporting line blur-fades in.
        function armLogoThenReveal() {
            heroPath.style.fill = 'url(#sbBase)';      // crisp gradient vector, same colours
            if (heroLetters) heroLetters.style.fill = 'url(#sbBase)';
            gsap.set(type, { autoAlpha: 0 });          // drop the blurry scaled mask
            if (window.__armHeroLogo) window.__armHeroLogo();   // the logo appears
            gsap.delayedCall(0.75 * INTRO_DURATION_FACTOR, revealLineThenInk);
        }

        // Hand-off, stage 3 - the supporting line appears, and THAT is when
        // "Streetbeat" goes black: drain the wordmark's gradient stops to ink so
        // the colour melts to black while the wordmark stays crisp vector.
        function revealLineThenInk() {
            root.classList.remove('hero-intro');   // CSS blur-fades the subtitle in
            gsap.timeline({ onComplete: finish }).timeScale(INTRO_SPEED)
                .to([sbStopA, sbStopB], { stopColor: INK, duration: 0.55, ease: 'power1.out' }, 0);
        }
    }

    // Deferred scripts run BEFORE DOMContentLoaded (readyState 'interactive'), and
    // GSAP is deferred at the end of the layout body - after this file in document
    // order. Waiting for DOMContentLoaded guarantees every deferred script
    // (including GSAP) has executed before the controller decides anything.
    if (document.readyState === 'complete') boot();
    else document.addEventListener('DOMContentLoaded', boot);
})();
