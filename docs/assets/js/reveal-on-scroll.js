/* ============================================================================
   revealOnScroll - sequential "fade + rise + de-blur" for NON-TITLE content

   The site-wide reveal for stacked content: cards, stats, paragraphs, list
   items, CTAs. Ported 1:1 (timings + behaviour) from the reference site's
   stagger reveal, with a touch of blur added on the way in:

     • each item starts invisible, pushed down --reveal-shift, blurred --reveal-blur
     • when the group's top crosses 70% of the viewport, items settle one by one
     • a tiny --reveal-delay lead-in, then duration --reveal-duration ·
       easeOutCubic (--reveal-ease) · --reveal-stagger apart
     • fires ONCE on enter (not scrubbed); never re-hides on scroll back up

   Titles/headlines are handled by their own treatments (e.g. word-split,
   igniteOnScroll) - this effect is deliberately for the content BELOW them.

   Why no GSAP: every page links assets/css/tokens.css, but not every page loads
   GSAP/ScrollTrigger. This module is therefore dependency-free (IntersectionObserver
   + CSS transitions reading the shared --reveal-* tokens) so it drops into any
   current or future page with a single <script> tag and no extra wiring.

   NOTE on naming: the homepage carries a separate, pre-existing single-element
   reveal primitive on the bare attribute `[data-reveal]` (fade + rise, no auto
   stagger, no blur). This module deliberately uses DIFFERENT attributes
   (`data-reveal-group` / `data-reveal-item`) so the two never collide - the
   cascade here is the standard for stacked NON-title content going forward.

   ── Markup ──────────────────────────────────────────────────────────────────
     <div data-reveal-group>                <!-- the group / scroll trigger -->
       <p   data-reveal-item>…</p>          <!-- staggered children, in order -->
       <a   data-reveal-item>…</a>
     </div>

     <!-- standalone (reveals itself when it enters view) -->
     <p data-reveal-item>…</p>

   Optional per-group override:  data-reveal-group="0.14"  (stagger in seconds)

   No-ops gracefully: under prefers-reduced-motion or without IntersectionObserver,
   content is shown immediately with no animation. Re-scans on DOM changes so
   dynamically injected content is picked up. Exposes window.revealOnScroll().
   ========================================================================== */
(function () {
    'use strict';

    var GROUP = '[data-reveal-group]';
    var ITEM = '[data-reveal-item]';
    var READY = 'is-reveal-ready';   /* on a primed item: hidden + transition armed */
    var SHOWN = 'is-revealed';       /* on a settled item: visible */

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var supported = 'IntersectionObserver' in window;

    /* Inject the effect's CSS once. It reads the shared --reveal-* tokens
       (tokens.css) so timings stay a single source of truth, with literal
       fallbacks so the module still degrades sanely if the tokens are missing. */
    function injectStyle() {
        if (document.getElementById('reveal-on-scroll-style')) return;
        var css =
            '[data-reveal-item].' + READY + '{' +
                'opacity:0;' +
                'transform:translateY(var(--reveal-shift));' +
                'filter:blur(var(--reveal-blur));' +
                'transition:opacity var(--reveal-duration) var(--reveal-ease),' +
                'transform var(--reveal-duration) var(--reveal-ease),' +
                'filter var(--reveal-duration) var(--reveal-ease);' +
                'transition-delay:calc(var(--reveal-delay) + var(--reveal-stagger) * var(--reveal-i,0));' +
                'will-change:opacity,transform,filter;' +
            '}' +
            '[data-reveal-item].' + SHOWN + '{' +
                'opacity:1;transform:none;filter:none;' +
            '}' +
            '@media (prefers-reduced-motion: reduce){' +
                '[data-reveal-item].' + READY + '{transition:none;opacity:1;transform:none;filter:none;}' +
            '}';
        var style = document.createElement('style');
        style.id = 'reveal-on-scroll-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* Items inside a group reveal together (staggered); standalone items reveal
       on their own. Each item carries --reveal-i = its position so the CSS
       transition-delay produces the cascade. */
    function itemsOf(group) {
        return Array.prototype.filter.call(
            group.querySelectorAll(ITEM),
            function (el) { return el.closest(GROUP) === group; }
        );
    }

    function prime(items) {
        items.forEach(function (el, i) {
            el.style.setProperty('--reveal-i', i);
            el.classList.add(READY);
        });
    }

    function reveal(items) {
        items.forEach(function (el) { el.classList.add(SHOWN); });
    }

    function observe(trigger, items) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                reveal(items);
                io.unobserve(entry.target);   /* one-way: fire once, never re-hide */
            });
        }, { rootMargin: '0px 0px -30% 0px', threshold: 0 });   /* ≈ "top 70%" */
        io.observe(trigger);
    }

    function init(root) {
        root = root || document;

        /* Reduced motion / no IO: show everything, skip the animation entirely. */
        if (reduced || !supported) {
            Array.prototype.forEach.call(root.querySelectorAll(ITEM), function (el) {
                el.classList.add(SHOWN);
            });
            return;
        }

        injectStyle();

        /* Grouped items: the group is the trigger; its items stagger in. */
        Array.prototype.forEach.call(root.querySelectorAll(GROUP), function (group) {
            if (group.dataset.revealBound) return;
            group.dataset.revealBound = '1';
            var items = itemsOf(group);
            if (!items.length) return;
            var override = parseFloat(group.getAttribute('data-reveal-group'));
            if (!isNaN(override)) group.style.setProperty('--reveal-stagger', override + 's');
            prime(items);
            observe(group, items);
        });

        /* Standalone items (not inside a group): each is its own trigger. */
        Array.prototype.forEach.call(root.querySelectorAll(ITEM), function (el) {
            if (el.closest(GROUP) || el.dataset.revealBound) return;
            el.dataset.revealBound = '1';
            prime([el]);
            observe(el, [el]);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { init(); });
    } else {
        init();
    }

    window.revealOnScroll = init;   /* call again after injecting new DOM */
})();
