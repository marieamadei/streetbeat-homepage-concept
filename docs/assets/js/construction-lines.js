/* ============================================================================
   constructionLines - the fixed page-level blade pattern

   A full-viewport, position:fixed layer of stroke-only Streetbeat logo blades
   (the two halves of the mark, alternating row by row) that sits just above
   the page background and NEVER moves: content scrolls over it, opaque cards
   and dark chapters (the homepage compliance card, WaveBand, the footer…)
   simply occlude it.

   ── Layering ────────────────────────────────────────────────────────────────
   The layer is `position:fixed; inset:0; z-index:-1` appended to <body>, the
   same slot as the scroll-tint underlay (assets/js/scroll-tint.js). Siblings
   at the same negative z paint in DOM order, so this module keeps itself
   AFTER `[data-tint-underlay]` - above the tint/aurora paint, below every
   in-flow block. Anything that paints an opaque background therefore hides
   the pattern for free; transparent sections show it.

   ── Modes ───────────────────────────────────────────────────────────────────
   The geometry never changes; only stroke colour + opacity shift with the
   background behind the current viewport. Three looks, from tokens.css:

     white     --lines-stroke-on-white / --lines-alpha-on-white
     tint      --lines-stroke-on-tint  / --lines-alpha-on-tint
     dark      --lines-stroke-on-dark  / --lines-alpha-on-dark

   The stop map is derived from the SAME `data-tint` markers scroll-tint
   consumes (plateau semantics included), classified by token name:
   canvas/subtle → white · dark → dark · anything else → tint. The colour and
   alpha are interpolated at the viewport centre every scroll frame, so the
   look scrubs smoothly (and reversibly) across section seams. A page with no
   markers gets the white look.

   ── Local windows (data-lines-local) ────────────────────────────────────────
   An OPAQUE element that should still show the lines (e.g. the security
   page's white Technical Security card, which must stay opaque for its
   section-rise entry) can declare `data-lines-local`. The module injects a
   viewport-sized copy of the pattern INSIDE it (z:-1 within the element's
   own stacking context - above its background, below its content) and
   re-anchors it to the viewport every scroll frame, so the lines inside the
   window line up exactly with the global fixed layer and appear equally
   still. The element must be a stacking context (position + z-index - true
   for [data-rise-section]). Look: always the on-white preset.

   Dependency-free. Exposes window.constructionLines() to re-arm after Astro
   client-side navigations; adds `lines-on` to <html> while armed (CSS uses it
   to make opaque-white heroes transparent so the pattern shows through them).
   ========================================================================== */
(function () {
    'use strict';

    /* Locked geometry: A+B alternating · tile 510 · gap 0 · aligned columns. */
    var TILE = 510;

    /* The two blade halves of the Streetbeat mark, stroke-only - inlined from
       assets/logo/blade-a.svg / blade-b.svg. [w, h, pathData] */
    var BLADES = [
        [118, 105, 'M9.79297 0.5H97.3193C109.772 15.8427 116.568 35.0013 116.561 54.7617C116.543 70.388 112.232 85.709 104.097 99.0537L104.089 99.0654C102.287 102.217 99.9718 103.828 97.5039 104.096C95.0259 104.365 92.2631 103.296 89.5449 100.809L3.64551 14.9609C0.728711 11.8137 -0.103168 8.18303 0.916992 5.39258C1.92835 2.62631 4.83225 0.500064 9.79297 0.5Z'],
        [118, 105, 'M19.9756 0.555664C22.3778 0.235573 25.0122 1.29026 27.4932 3.99512L27.5088 4.01074L113.416 89.8662L113.422 89.873L113.429 89.8789C116.575 92.7989 117.509 96.3124 116.548 99.0342C115.594 101.734 112.697 103.863 107.732 103.863H20.1963C7.82825 89.5884 0.500012 70.7461 0.5 50.0654C0.5 33.9312 5.57298 19.1667 13.4336 5.76562L13.4365 5.76172C15.245 2.59878 17.5671 0.876598 19.9756 0.555664Z'],
    ];

    var ATTR = 'data-tint';
    var HTML_CLASS = 'lines-on';
    var HOLD_START = 0.3;
    var HOLD_END = 0.7;

    var layer = null;
    var svgEl = null;
    var stops = [];        /* [{ y, stroke:{r,g,b}, alpha }] sorted by y */
    var looks = null;      /* resolved { white, tint, dark } → { stroke, alpha } */
    var locals = [];       /* [{ host, pat }] - data-lines-local windows */
    var active = false;
    var ticking = false;
    var lastKey = '';
    var stHooked = false;
    var uid = 0;

    /* ── token resolution (same probe trick as scroll-tint) ───────────── */

    function resolveColor(token) {
        var probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
        probe.style.color = 'var(' + token + ')';
        document.body.appendChild(probe);
        var rgb = getComputedStyle(probe).color;
        probe.remove();
        var m = rgb.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
        if (!m) return null;
        return { r: +m[1], g: +m[2], b: +m[3] };
    }

    function resolveLooks() {
        var cs = getComputedStyle(document.documentElement);
        function alpha(n) {
            var v = parseFloat(cs.getPropertyValue(n));
            return isNaN(v) ? 0 : v;
        }
        return {
            white: { stroke: resolveColor('--lines-stroke-on-white'), alpha: alpha('--lines-alpha-on-white') },
            tint: { stroke: resolveColor('--lines-stroke-on-tint'), alpha: alpha('--lines-alpha-on-tint') },
            dark: { stroke: resolveColor('--lines-stroke-on-dark'), alpha: alpha('--lines-alpha-on-dark') },
        };
    }

    /* Which look does a tint token imply? */
    function lookFor(token) {
        if (/dark/.test(token)) return looks.dark;
        if (/canvas|subtle/.test(token)) return looks.white;
        return looks.tint;
    }

    /* ── the layer ─────────────────────────────────────────────────────── */

    function bladeCell(idx, x, y) {
        var b = BLADES[idx];
        var s = Math.min(TILE / b[0], TILE / b[1]);
        var tx = x + (TILE - b[0] * s) / 2;
        var ty = y + (TILE - b[1] * s) / 2;
        return '<g transform="translate(' + tx + ' ' + ty + ') scale(' + s + ')">' +
            '<path d="' + b[2] + '" fill="none" vector-effect="non-scaling-stroke"/></g>';
    }

    function buildLayer() {
        var el = document.createElement('div');
        el.setAttribute('data-construction-lines', '');
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;';
        /* 2 rows tall, aligned columns, rows alternate blade A / blade B */
        el.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" ' +
            'style="display:block;stroke-width:1px;" aria-hidden="true">' +
            '<defs><pattern id="construction-lines-pat" width="' + TILE + '" height="' + (TILE * 2) +
            '" patternUnits="userSpaceOnUse">' +
            bladeCell(0, 0, 0) + bladeCell(1, 0, TILE) +
            '</pattern></defs>' +
            /* stroke=none: the rect inherits the svg's stroke otherwise and
               draws its own edges as hairlines (section-divider artefact) */
            '<rect width="100%" height="100%" stroke="none" fill="url(#construction-lines-pat)"/></svg>';
        return el;
    }

    function getLayer() {
        if (layer && layer.isConnected) return layer;
        layer = buildLayer();
        svgEl = layer.firstElementChild;
        document.body.appendChild(layer);
        return layer;
    }

    /* ── local windows (data-lines-local) ──────────────────────────────── */

    function armLocals() {
        locals = [];
        var els = document.querySelectorAll('[data-lines-local]');
        Array.prototype.forEach.call(els, function (host) {
            var old = host.querySelector(':scope > [data-lines-window]');
            if (old) old.remove();
            var id = 'construction-lines-local-' + (++uid);
            var holder = document.createElement('div');
            holder.setAttribute('data-lines-window', '');
            holder.setAttribute('aria-hidden', 'true');
            holder.style.cssText = 'position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden;';
            holder.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" ' +
                'style="display:block;stroke-width:1px;" aria-hidden="true">' +
                '<defs><pattern id="' + id + '" width="' + TILE + '" height="' + (TILE * 2) +
                '" patternUnits="userSpaceOnUse">' +
                bladeCell(0, 0, 0) + bladeCell(1, 0, TILE) +
                '</pattern></defs>' +
                '<rect width="100%" height="100%" stroke="none" fill="url(#' + id + ')"/></svg>';
            host.insertBefore(holder, host.firstChild);
            var svg = holder.firstElementChild;
            svg.style.stroke = 'rgb(' + Math.round(looks.white.stroke.r) + ', ' +
                Math.round(looks.white.stroke.g) + ', ' + Math.round(looks.white.stroke.b) + ')';
            svg.style.opacity = String(looks.white.alpha);
            locals.push({ host: host, pat: holder.querySelector('pattern') });
        });
    }

    /* Re-anchor each window's pattern to the viewport, so its lines sit
       exactly where the global fixed layer would paint them - the pattern
       reads as one still layer even inside an opaque, moving card. */
    function syncLocals() {
        for (var i = 0; i < locals.length; i++) {
            var l = locals[i];
            if (!l.pat.isConnected) continue;
            var r = l.host.getBoundingClientRect();
            l.pat.setAttribute('patternTransform', 'translate(' + (-r.left) + ' ' + (-r.top) + ')');
        }
    }

    /* The scroll-tint underlay is created lazily; if it lands after us in the
       DOM it would paint over the pattern (same z-index, DOM order decides).
       Cheap per-frame check keeps this layer last of the two. */
    function assertOrder() {
        var tint = document.querySelector('[data-tint-underlay]');
        if (!tint || !layer) return;
        if (layer.compareDocumentPosition(tint) & Node.DOCUMENT_POSITION_FOLLOWING) {
            document.body.appendChild(layer);
        }
    }

    /* ── stop map ──────────────────────────────────────────────────────── */

    function measure() {
        var els = document.querySelectorAll('[' + ATTR + ']');
        stops = [];
        if (!looks) looks = resolveLooks();
        Array.prototype.forEach.call(els, function (el) {
            var token = el.getAttribute(ATTR);
            if (!token) return;
            var look = lookFor(token);
            if (!look.stroke) return;
            var rect = el.getBoundingClientRect();
            var top = rect.top + window.scrollY;
            var h = rect.height;
            var hold = (el.getAttribute('data-tint-hold') || '').split(',');
            var hs = hold.length === 2 ? parseFloat(hold[0]) : HOLD_START;
            var he = hold.length === 2 ? parseFloat(hold[1]) : HOLD_END;
            if (isNaN(hs) || isNaN(he)) { hs = HOLD_START; he = HOLD_END; }
            stops.push({ y: top + h * hs, stroke: look.stroke, alpha: look.alpha });
            stops.push({ y: top + h * he, stroke: look.stroke, alpha: look.alpha });
        });
        stops.sort(function (a, b) { return a.y - b.y; });
        active = true;
        document.documentElement.classList.add(HTML_CLASS);
        getLayer();
        armLocals();
        apply();
    }

    function mixC(a, z, t) {
        return {
            r: a.r + (z.r - a.r) * t,
            g: a.g + (z.g - a.g) * t,
            b: a.b + (z.b - a.b) * t,
        };
    }

    function sampleAt(y) {
        var n = stops.length;
        if (n === 0) return looks.white;
        if (y <= stops[0].y) return stops[0];
        if (y >= stops[n - 1].y) return stops[n - 1];
        var i = 1;
        while (i < n && stops[i].y < y) i++;
        var a = stops[i - 1], z = stops[i];
        var t = z.y === a.y ? 0 : (y - a.y) / (z.y - a.y);
        return {
            stroke: mixC(a.stroke, z.stroke, t),
            alpha: a.alpha + (z.alpha - a.alpha) * t,
        };
    }

    function apply() {
        if (!active || !svgEl) return;
        assertOrder();
        syncLocals();
        var s = sampleAt(window.scrollY + window.innerHeight / 2);
        var key = Math.round(s.stroke.r) + ',' + Math.round(s.stroke.g) + ',' +
            Math.round(s.stroke.b) + '|' + s.alpha.toFixed(3);
        if (key === lastKey) return;
        lastKey = key;
        svgEl.style.stroke = 'rgb(' + Math.round(s.stroke.r) + ', ' +
            Math.round(s.stroke.g) + ', ' + Math.round(s.stroke.b) + ')';
        svgEl.style.opacity = String(s.alpha);
    }

    /* ── scheduling (mirrors scroll-tint) ──────────────────────────────── */

    function onScroll() {
        if (!active || ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
            ticking = false;
            apply();
        });
    }

    function remeasure() {
        if (!active) return;
        requestAnimationFrame(measure);
    }

    function hookScrollTrigger() {
        if (stHooked || !window.ScrollTrigger) return;
        stHooked = true;
        window.ScrollTrigger.addEventListener('refresh', remeasure);
    }

    function teardown() {
        active = false;
        stops = [];
        lastKey = '';
        if (layer) { layer.remove(); layer = null; svgEl = null; }
        locals.forEach(function (l) {
            var w = l.host.querySelector(':scope > [data-lines-window]');
            if (w) w.remove();
        });
        locals = [];
        document.documentElement.classList.remove(HTML_CLASS);
    }

    function init() {
        hookScrollTrigger();
        looks = null;   /* re-resolve tokens (theme may differ per page) */
        measure();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', remeasure);
    window.addEventListener('load', remeasure);

    document.addEventListener('astro:before-swap', teardown);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.constructionLines = init;   /* re-arm after client-side navigation */
})();
