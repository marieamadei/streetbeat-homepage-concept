/* ============================================================================
   igniteOnScroll - scroll-scrubbed letter ignition (after wembi.ai's steps text)

   Every letter of a headline rests dim (its settle colour at a low opacity). A
   scrubbed timeline lights letters one-by-one as the trigger scrolls up into
   view: each letter POPS to brand green the instant it's reached, then eases
   back to its settle colour on its OWN 1s clock - deliberately NOT scrub-locked.
   Because the ignition order is scroll-locked but the green→settle fade runs in
   real time, fast scrolling stacks many green fades at once (an intense flare)
   while slow scrolling ripples letter-by-letter. Scrolling back only reverses
   the scrubbed opacity; the green is fired from onStart and never re-triggers on
   reverse, so the colour is one-way, exactly like the reference.

   Single source of truth for this effect - consumed by the homepage (compliance
   headline + section eyebrows) and the design-system page. Exposes a global
   window.igniteOnScroll. Requires GSAP + ScrollTrigger on the page; no-ops under
   reduced motion or when those libraries are missing (the headline simply keeps
   its static markup).

   opts:
     • el - the headline element to ignite
     • trigger - element whose scroll drives the scrub (defaults to el)
     • endVar - token name for the settle colour (default --surface-canvas, for the
                  dark compliance canvas; light sections pass --text-primary /
                  --text-tertiary)
     • rest - resting opacity (default .16)
   ========================================================================== */
(function () {
    'use strict';

    function igniteOnScroll(opts) {
        opts = opts || {};
        var heading = opts.el;
        if (!heading) return;

        /* No-op when we can't animate: leave the static headline untouched. */
        var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced || !window.gsap || !window.ScrollTrigger) return;
        if (gsap.core.globals().ScrollTrigger == null) gsap.registerPlugin(ScrollTrigger);

        var trigger = opts.trigger || heading;

        /* Brand colours from the locked tokens (single source of truth). */
        var cs  = getComputedStyle(document.documentElement);
        var POP = cs.getPropertyValue('--accent-green').trim() || '#00CC4F';   /* brand green - the saturated peak when many letters flare at speed */
        var END = cs.getPropertyValue(opts.endVar || '--surface-canvas').trim() || '#FFFFFF';
        var REST = (opts.rest != null) ? opts.rest : 0.16;   /* resting opacity - the settle colour, dimmed */

        /* Preserve a single spoken headline before visual per-letter spans are
           introduced; otherwise accessibility trees may announce every glyph
           as a separate word. */
        if (/^H[1-6]$/.test(heading.tagName) && !heading.hasAttribute('aria-label')) {
            heading.setAttribute('aria-label', (heading.textContent || '').replace(/\s+/g, ' ').trim());
        }

        /* Split into per-glyph spans, walking text nodes so any inline markup
           and the inter-word spaces both survive. Plain inline spans keep
           normal line-breaking (breaks at spaces only) - no per-letter
           wrapping artefacts on a multi-line headline. */
        var chars = [];
        (function split(node) {
            Array.prototype.slice.call(node.childNodes).forEach(function (n) {
                if (n.nodeType === 3) {
                    var frag = document.createDocumentFragment();
                    n.nodeValue.split('').forEach(function (ch) {
                        if (ch === ' ') { frag.appendChild(document.createTextNode(' ')); return; }
                        var s = document.createElement('span');
                        s.className = 'comp-char';
                        s.textContent = ch;
                        chars.push(s);
                        frag.appendChild(s);
                    });
                    node.replaceChild(frag, n);
                } else if (n.nodeType === 1) {
                    split(n);
                }
            });
        })(heading);
        if (!chars.length) return;

        /* Rest pose set before this off-screen region ever paints. */
        gsap.set(chars, { color: END, opacity: REST, willChange: 'opacity, color' });

        var DUR  = 0.1;
        var step = chars.length > 1 ? (1 - DUR) / (chars.length - 1) : 0;
        var tl = gsap.timeline();
        chars.forEach(function (c, i) {
            tl.to(c, {
                opacity: 1,
                duration: DUR,
                onStart: function () {
                    gsap.killTweensOf(c, 'color');
                    gsap.set(c, { color: POP });                             /* ignite green */
                    gsap.to(c, { color: END, duration: 1, delay: 0.08 });    /* settle to base colour, real time */
                }
            }, i * step);
        });

        /* Lead-in delay: hold off igniting until the headline has travelled a
           little into view, then run the reveal over the next stretch of
           scroll. Expressed in vh past the moment the section's top enters the
           viewport ("top bottom"), so it's framing-independent:
             • DELAY_VH - how far past entering view before the first letter lights
             • SPAN_VH - scroll length over which the whole headline ignites */
        var DELAY_VH = 35;
        var SPAN_VH  = 45;
        ScrollTrigger.create({
            trigger: trigger,
            start: 'top bottom-=' + DELAY_VH + '%',
            end:   'top bottom-=' + (DELAY_VH + SPAN_VH) + '%',
            scrub: true,
            animation: tl
        });
    }

    window.igniteOnScroll = igniteOnScroll;
})();
