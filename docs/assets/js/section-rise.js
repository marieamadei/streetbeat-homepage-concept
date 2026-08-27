/* ============================================================================
   sectionRise - a section enters as an inset rounded card and grows to full
   bleed while the section above blurs and scales back under it (no darkening -
   the receding section keeps its own colour).

   This is the homepage's signature #compliance entry (after wembi.ai's growing
   service card), extracted as a shared primitive so subpages get a real
   transition between section chapters instead of a hard background seam.
   Use it ONCE per page, on the page's keystone dark (or strongly contrasting)
   section - it reads as "the next chapter rises over the last", and repeating
   it turns the page into a slideshow.

   Usage:
     <section id="tech" data-rise-section>…</section>          auto-init
     <section data-rise-section data-rise-dim="#data">…</section>
       data-rise-dim - optional CSS selector for the section above, which
       blurs/scales back as the card covers it (defaults to the element's
       previous section sibling; pass "none" to skip).

   Requires GSAP + ScrollTrigger. Runs on ALL viewports where motion is allowed
   (mobile included - the inset-card entry is the whole point of the chapter
   transition and must not vanish on phones); only under reduced motion does the
   section render as a plain full-bleed block (no clip, no filter cost). Fires
   via scrub over the approach window (top bottom → top top) and clears every
   prop once settled. window.sectionRise(el) for dynamically added DOM.

   NO CLIPPING BY DEFAULT. The clip-path is what produces the inset-card grow,
   so it is scoped to the .sr-grow class, which is present ONLY while the section
   is animating (before/during the approach, and on scroll-back). The instant the
   section reaches full bleed the class - and with it the clip-path - is removed,
   so a settled section is never clipped and any hover/overflow inside it is free.
   ========================================================================== */
(function () {
    'use strict';

    var STYLE = '[data-rise-section]{position: relative; z-index: 2;}' +
        'html.sr-on [data-rise-section].sr-grow{' +
        'clip-path: inset(0 calc(var(--sri, 0) * 1px) round calc(var(--srr, 20) * 1px) calc(var(--srr, 20) * 1px) 0 0);' +
        '-webkit-clip-path: inset(0 calc(var(--sri, 0) * 1px) round calc(var(--srr, 20) * 1px) calc(var(--srr, 20) * 1px) 0 0);' +
        'will-change: clip-path;}';

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    function prevSection(el) {
        var node = el.previousElementSibling;
        while (node && node.tagName !== 'SECTION' && !node.querySelector('section')) node = node.previousElementSibling;
        if (node && node.tagName !== 'SECTION') node = node.querySelector('section');
        return node;
    }

    function init(el) {
        if (!el || el.__sectionRise) return;
        el.__sectionRise = true;
        if (!window.gsap || !window.ScrollTrigger) return; // plain section fallback

        window.gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', function () {
            var gsap = window.gsap;
            var cs = getComputedStyle(document.documentElement);
            var RAD = parseInt(cs.getPropertyValue('--radius'), 10) || 20;
            /* Side inset that opens the card. Scaled to viewport width; the floor
               is 18px so the gutters stay visible (and the effect legible) on
               phones without eating into the narrow content column. */
            var INSET = Math.round(gsap.utils.clamp(18, 56, window.innerWidth * 0.035));

            document.documentElement.classList.add('sr-on');
            gsap.set(el, { '--srr': RAD });
            el.classList.add('sr-grow');
            gsap.fromTo(el,
                { '--sri': INSET },
                {
                    '--sri': 0, ease: 'none',
                    scrollTrigger: {
                        trigger: el, start: 'top bottom', end: 'top top', scrub: true,
                        invalidateOnRefresh: true,
                        onLeave: function () { el.classList.remove('sr-grow'); },
                        onEnterBack: function () { el.classList.add('sr-grow'); }
                    }
                });

            var dimSel = el.getAttribute('data-rise-dim');
            var dim = dimSel === 'none' ? null
                : dimSel ? document.querySelector(dimSel)
                : prevSection(el);
            if (dim) {
                gsap.fromTo(dim,
                    { filter: 'blur(0px)', scale: 1 },
                    {
                        /* Later, shorter window than the grow: the covered section
                           stays readable until the card reaches mid-viewport. Blur +
                           scale only - no brightness dim, so the receding section keeps
                           its own colour (no darkened square bleeding at its edges). */
                        filter: 'blur(9px)', scale: 0.96, ease: 'none',
                        scrollTrigger: {
                            trigger: el, start: 'top center', end: 'top top', scrub: true,
                            invalidateOnRefresh: true,
                            onLeave: function () { gsap.set(dim, { clearProps: 'filter,transform' }); }
                        }
                    });
            }

            return function () {
                el.classList.remove('sr-grow');
                gsap.set(el, { clearProps: '--sri,--srr' });
                if (dim) gsap.set(dim, { clearProps: 'filter,transform' });
            };
        });
    }

    /* Style is injected once (guarded by id) and unconditionally, so sections
       added by later client-side navigations (Astro ClientRouter swaps) still
       find it in the persistent <head> even when the FIRST page had none. */
    function ensureStyle() {
        if (document.getElementById('section-rise-style')) return;
        var style = document.createElement('style');
        style.id = 'section-rise-style';
        style.textContent = STYLE;
        document.head.appendChild(style);
    }

    ready(function () {
        ensureStyle();
        document.querySelectorAll('[data-rise-section]').forEach(init);
    });

    window.sectionRise = function (el) { ensureStyle(); init(el); };
})();
