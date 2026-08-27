/* ============================================================================
   footerMotion - the shared footer's two GSAP beats, extracted from the
   per-page inline copies (verified identical across the subpages):

     • Footer CTA - per-character "float up" reveal (plays once on enter).
       The animation itself is titleReveal (title-reveal.js) - the site-wide
       default title treatment, at its default settings. This file only owns
       the orchestration: the two-line offset, the pill beat, and the trigger.
     • Footer wordmark - letters rise out of the card one-by-one, scrubbed

   Requires GSAP + ScrollTrigger (and title-reveal.js loaded first for the
   CTA); no-ops under reduced motion (static text remains). Idempotent per
   element (guards on the nodes), so it is safe to call again after
   client-side navigation swaps in a fresh footer - the Astro layout re-arms
   it on every astro:page-load. Self-initializes on DOMContentLoaded too, so
   legacy pages can adopt it with one script tag.
   Exposes window.footerMotion().
   ============================================================================ */
(function () {
    'use strict';

    function init() {
        var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced || !window.gsap || !window.ScrollTrigger) return;
        var gsap = window.gsap;
        gsap.registerPlugin(window.ScrollTrigger);

        /* ---- Footer CTA - titleReveal, flagship intensity ---- */
        (function () {
            if (!window.titleReveal) return;   // title-reveal.js must load first
            var cta = document.querySelector('.footer-cta');
            if (!cta || cta.__sfInit) return;
            cta.__sfInit = true;
            var lines = [cta.querySelector('h2'), cta.querySelector('.sub')].filter(Boolean);
            if (!lines.length) return;
            var pill = cta.querySelector('.pill-green');
            if (pill) gsap.set(pill, { autoAlpha: 0, y: 18 });

            /* The shared per-char float at its site-wide default settings - the
               footer CTA is the SAME effect as every other title. manual:true
               applies the hidden pose and hands back the tween so THIS timeline
               owns playback (the footer sits at the page's very bottom, so its
               trigger point is bespoke, as are the line + pill beats). */
            var tl = gsap.timeline({ paused: true });
            var got = 0;
            lines.forEach(function (line, i) {
                var tween = window.titleReveal({ el: line, manual: true });
                if (tween) { tl.add(tween, i * 0.18); got++; }
            });
            if (!got) return;
            if (pill) tl.to(pill, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.45');

            /* refreshPriority -1: the footer is always last on the page, but these
               triggers are created on DOMContentLoaded - BEFORE page sections arm
               their own triggers on astro:page-load. Any pinned section above
               (e.g. the homepage logo cloud) adds scroll distance that GSAP only
               credits to triggers refreshed AFTER the pin, so without this the
               footer's start lands ~the pin's duration too early and the beats
               play off-screen. */
            window.ScrollTrigger.create({ trigger: cta, start: 'top 88%', once: true, refreshPriority: -1, onEnter: function () { tl.play(); } });
        })();

        /* ---- Footer wordmark - letters rise out of the card, scrubbed ---- */
        (function () {
            var media = document.querySelector('.footer-media');
            var band = document.querySelector('.footer-word');
            if (!media || !band || media.__sfInit) return;
            media.__sfInit = true;
            var COUNT = 10, vars = [];
            for (var i = 1; i <= COUNT; i++) vars.push('--l' + i);
            function dist() { return Math.round(band.offsetHeight * 1.12) + 24; }

            var tl = gsap.timeline({
                scrollTrigger: {
                    trigger: '.footer-union',
                    start: 'top 96%',
                    end: 'top 18%',
                    scrub: 1.8,
                    invalidateOnRefresh: true,
                    refreshPriority: -1 /* refresh after pinned sections - see CTA note */
                }
            });
            vars.forEach(function (v, idx) {
                tl.fromTo(media,
                    { [v]: function () { return dist() + 'px'; } },
                    { [v]: '0px', ease: 'power3.out', duration: 1 },
                    idx * 0.45
                );
            });
        })();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.footerMotion = init;
})();
