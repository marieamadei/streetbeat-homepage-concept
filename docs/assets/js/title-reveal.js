/* ============================================================================
   titleReveal - per-character float-up for headlines (the site's DEFAULT
   title treatment)

   Splits a headline into words → characters and floats each glyph up into
   place with a hint of vertical squash (no overshoot), the first time the
   title scrolls into view. This is THE appear animation for every section headline
   site-wide. The site's text-animation system is exactly three verbs:

     1. titleReveal (this file) - default for ALL titles. A tamed version of
        the footer CTA's per-character float.
     2. igniteOnScroll - the scroll-scrubbed green letter ignition, reserved
        for at most ONE keystone headline per page.
     3. reveal-on-scroll.js - the blur + rise cascade for everything BELOW
        the headlines (body copy, cards, CTAs). Never put it on a title.

   The footer CTA is this same animation at the same settings -
   footer-motion.js calls titleReveal and only owns the footer's
   orchestration (line offsets, pill beat, trigger).

   NO CLIPPING. No overflow masks anywhere - glyphs simply translate + scale
   while fading in, so descenders (g, y, p, j) and hover targets are never cut.

   Kerning caveat: per-glyph spans drop kerning pairs (letter-spacing is
   inherited, kerning is not) - the same trade-off igniteOnScroll already
   makes; acceptable at every size in the current ramp.

   Usage:
     • Markup: add data-title-reveal to the heading. Auto-initializes.
       Optional numeric value = per-char stagger in seconds.
     • JS: window.titleReveal(el | {el, trigger, stagger, rise, squash,
       scaleX, ease, duration, manual}).
     • manual:true skips the ScrollTrigger and RETURNS the tween (initial
       pose already applied) so a caller can place it in its own timeline -
       add it synchronously (see footer-motion.js).

   Requires GSAP (+ ScrollTrigger unless manual). No-ops - title stays static
   and visible - under reduced motion or when the libraries are missing.
   Fires once; never re-hides.
   ========================================================================== */
(function () {
    'use strict';

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    function split(el) {
        /* Wrap each word in <span class="tr-word"> and each glyph in
           <span class="tr-char">, preserving inline children (e.g. <em>, <br>)
           by walking text nodes only. Words are inline-block + nowrap so line
           breaks still happen only between words; chars are inline-block so
           they can transform. Styles are inline - no stylesheet dependency. */
        /* Per-glyph spans otherwise make some accessibility trees announce
           spaces between every letter. Preserve the authored headline as one
           accessible name before splitting its visual representation. */
        if (!el.hasAttribute('aria-label')) {
            el.setAttribute('aria-label', (el.textContent || '').replace(/\s+/g, ' ').trim());
        }
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        var textNodes = [];
        while (walker.nextNode()) {
            if (walker.currentNode.nodeValue.trim()) textNodes.push(walker.currentNode);
        }
        var chars = [];
        textNodes.forEach(function (node) {
            var frag = document.createDocumentFragment();
            node.nodeValue.split(/(\s+)/).forEach(function (part) {
                if (!part) return;
                if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                var word = document.createElement('span');
                word.className = 'tr-word';
                word.style.cssText = 'display:inline-block;white-space:nowrap;';
                part.split('').forEach(function (ch) {
                    var s = document.createElement('span');
                    s.className = 'tr-char';
                    s.style.cssText = 'display:inline-block;will-change:opacity,transform;';
                    s.textContent = ch;
                    chars.push(s);
                    word.appendChild(s);
                });
                frag.appendChild(word);
            });
            node.parentNode.replaceChild(frag, node);
        });
        return chars;
    }

    function init(opts) {
        if (opts && opts.nodeType) opts = { el: opts };
        opts = opts || {};
        var el = opts.el;
        if (!el || el.__titleRevealed) return;
        el.__titleRevealed = true;
        if (reduced || !window.gsap) return;                    // static fallback
        if (!opts.manual && !window.ScrollTrigger) return;      // static fallback

        var chars = split(el);
        if (!chars.length) return;

        /* The tamed defaults - a clean per-char rise with only a HINT of the
           footer's squash and NO overshoot (power3.out, not back.out), so the
           cascade reads composed, not weavy. The footer CTA passes the
           expressive flagship values. */
        var rise   = (opts.rise   != null ? opts.rise   : 38);           // yPercent of the glyph's own height
        var squash = (opts.squash != null ? opts.squash : 1.04);         // scaleY start (vertical stretch)
        var scaleX = (opts.scaleX != null ? opts.scaleX : 1);
        var ease   = opts.ease || 'power3.out';
        var duration = (opts.duration || 0.7);
        /* Per-char stagger, capped so long headlines don't drag: total spread
           never exceeds MAX_SPREAD regardless of character count. */
        var MAX_SPREAD = 0.7;
        var stagger = (opts.stagger != null)
            ? opts.stagger
            : Math.min(0.02, MAX_SPREAD / Math.max(1, chars.length - 1));

        /* Hidden pose is set by JS only when motion is armed, so no-JS and
           reduced-motion keep the text exactly as written. */
        window.gsap.set(chars, {
            opacity: 0, yPercent: rise, scaleY: squash, scaleX: scaleX,
            transformOrigin: '50% 0%'
        });

        function clearWillChange() {
            chars.forEach(function (c) { c.style.willChange = 'auto'; });
        }

        var vars = {
            opacity: 1, yPercent: 0, scaleY: 1, scaleX: 1,
            duration: duration, ease: ease, stagger: stagger,
            onComplete: clearWillChange
        };

        if (opts.manual) {
            /* Caller owns playback: return the tween for its timeline. Created
               un-paused - the caller must .add() it synchronously so GSAP
               re-parents it before the first tick. */
            return window.gsap.to(chars, vars);
        }

        vars.scrollTrigger = { trigger: opts.trigger || el, start: 'top 82%', once: true };
        return window.gsap.to(chars, vars);
    }

    ready(function () {
        document.querySelectorAll('[data-title-reveal]').forEach(function (el) {
            var stagger = parseFloat(el.getAttribute('data-title-reveal'));
            init({ el: el, stagger: isNaN(stagger) ? undefined : stagger });
        });
    });

    window.titleReveal = init;
})();
