/* ============================================================================
   scrollTint - scroll-scrubbed page background colour

   Replaces a static section-run gradient (FlowStage) with a live one: sections
   declare the colour they want behind them and a fixed full-viewport underlay
   is re-painted every scroll frame, so the page colour scrubs smoothly (and
   reversibly) with the scrollbar instead of being baked into one element.

   The paint is a vertical gradient, not a flat colour: the stop map is
   sampled at several document positions spanning the current viewport
   (top → bottom), so the colour stays spatially continuous in document
   space. That is what keeps every boundary with an OPAQUE block (a white
   chapter above a tint run, the footer below it) seam-free - a flat colour
   driven by the viewport centre would show a hard edge wherever such a
   block is entering or leaving the screen.

   ── Markup ──────────────────────────────────────────────────────────────────
     <div data-tint="--surface-flow-cyan-soft"> …a section… </div>

   Each marked element becomes a colour stop. The value is a Tier-2 token name
   (tokens.css) - NEVER a raw colour - resolved at runtime so theming keeps
   working. Every stop contributes a PLATEAU (the colour holds across the
   middle band of the element, while it dominates the viewport) and the blend
   happens only between one element's plateau end and the next one's start, so
   you never sit on a permanently muddy in-between mix.

   The cursor is the viewport's vertical centre in document coordinates.
   Before the first plateau / past the last one the colour clamps, so the
   run hands off seam-free to whatever flat block follows.

   Point stop: an EMPTY marker element (zero height) contributes a single
   stop at its document position - use one at the end of a run to resolve
   the colour back (usually to --surface-canvas) before the footer, where
   no section carries that colour:  <div data-tint="--surface-canvas"></div>

   Plateau override: `data-tint-hold="0,1"` (start,end fractions of the
   element's height) re-anchors the plateau. Use "0,1" on markers whose
   element paints its OWN opaque background (the careers beliefs card, the
   app disclaimer): the map then holds their colour across their full
   extent and blends strictly outside them, so the underlay never steps
   away from the colour of the opaque block at its edge.

   Progressive enhancement: when markers are found, `tint-on` is added to
   <html>; CSS uses that to blank the fallback gradient
   (`html.tint-on .flow-stage--tint { background: transparent }`), so no-JS
   still shows the static ramp. On astro:before-swap the underlay paint is
   cleared and the class removed, so pages without markers are untouched.

   ── Aurora blobs ────────────────────────────────────────────────────────────
   Over the base paint the underlay floats THREE soft radial blobs - a white
   light-source, a LIGHTER companion of the section's hue, and a DEEPER (but
   still very light) companion - so the background reads as light shifting
   around one hue while you scroll, not as flat colour bands. Companion
   colours come from the --tint-blob-* tokens (tokens.css), picked per marker
   from its token name (green / cyan family) and interpolated along the same
   stop map as the base colour. The aurora fades out entirely over neutral /
   white zones (so its wash never draws a colour border against an opaque
   white block) and over dark bases (glow patches on near-black read as
   smudges). The blobs are pre-blurred radial gradients (no filter), drift
   slowly with scroll progress and carry an idle orbit animation; both are
   stilled by reduced motion.

   The WHITE glow additionally follows the pointer (fine pointers only): its
   centre eases toward the cursor with a heavy lag, so the light source feels
   attached to the reader's attention rather than snapped to the mouse. The
   follow is an extra offset composed with the scroll drift on the wrapper
   (the inner orbit keyframes stay untouched) and is disabled under reduced
   motion.

   Dependency-free (plain scroll + rAF). If GSAP ScrollTrigger is present its
   `refresh` event re-measures the anchors (pinned sections insert pin-spacers
   that shift everything below them). Exposes window.scrollTint() to re-arm
   after client-side navigations.
   ========================================================================== */
(function () {
    'use strict';

    var ATTR = 'data-tint';
    var HTML_CLASS = 'tint-on';
    /* Plateau band: the colour holds from 30% to 70% of the element's height,
       so roughly one viewport of blend happens across each section seam. */
    var HOLD_START = 0.3;
    var HOLD_END = 0.7;

    /* Viewport fractions where the stop map is sampled each frame (top →
       bottom). The map is piecewise linear, so five samples reproduce it
       closely; the underlay gradient interpolates between them. */
    var SAMPLES = [0, 0.25, 0.5, 0.75, 1];

    var stops = [];          /* [{ y, base, light, deep, vis }] sorted by y */
    var active = false;
    var ticking = false;
    var lastPaint = '';
    var stHooked = false;
    var underlay = null;
    var blobLayer = null;    /* masked container the blobs live in */
    var blobs = null;        /* { glow, light, deep } wrapper elements */
    var glowColor = null;    /* resolved --tint-blob-glow */
    var lastBlobKey = '';
    var drift = {};          /* last scroll-drift offset per blob key (px) */

    /* Pointer-follow state for the white glow: `pointerTarget` is where the
       cursor last was, `follow` the eased offset actually applied. Only fine
       pointers (mouse/trackpad) opt in - on touch the glow stays on its
       scroll path - and reduced motion disables it entirely. */
    var FOLLOW_STRENGTH = 1;     /* full follow - the glow centres on the cursor */
    var FOLLOW_EASE = 0.07;      /* per-frame lerp - settles in ~1s, so the white
                                    calm arrives where you point without ever
                                    reading as a hard spotlight */
    var pointerTarget = null;
    var follow = { x: 0, y: 0 };
    var followRaf = 0;
    var followEngaged = false;   /* pointer has taken ownership of the glow */
    var canFollow =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: fine)').matches &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* The three blobs: viewport anchor, size, rest opacity, and how far each
       drifts (in vmax) across the full page scroll. Falloff to transparent at
       70% of the radius = the pre-blur (no CSS filter cost). */
    var BLOBS = [
        { key: 'glow',  x: 18, y: 12, size: 135, alpha: 0.7, driftX: 6,  driftY: 10, phase: 0.0 },
        { key: 'light', x: 84, y: 42, size: 110, alpha: 0.75, driftX: -8, driftY: 14, phase: 2.1 },
        { key: 'deep',  x: 30, y: 92, size: 120, alpha: 0.55, driftX: 7,  driftY: -12, phase: 4.2 },
    ];

    /* ── colour resolution ─────────────────────────────────────────────── */

    /* Resolve a token to concrete channels by letting the browser compute it
       on a probe element (handles nested var() chains, hex, rgb, oklch…). */
    function resolveToken(token) {
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

    /* ── measurement ───────────────────────────────────────────────────── */

    function luminance(c) {
        return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
    }

    /* Blob companion colours for a marker: family from the token NAME
       (green / cyan), colours from the --tint-blob-* tokens. The aurora lives
       ONLY over hued zones: on neutral/white bases and on dark bases the
       visibility anchor is 0, so the blobs fade out on the approach to any
       quiet zone. That keeps their wash away from the seams of opaque white
       blocks (heroes, white chapters, the footer) - a tinted underlay edge
       against an opaque white block reads as a colour border. */
    function companions(token, base) {
        if (luminance(base) < 0.5) return { light: base, deep: base, vis: 0 };
        var fam = /green/.test(token) ? 'green' : /cyan/.test(token) ? 'cyan' : null;
        if (!fam) return { light: base, deep: base, vis: 0 };
        return {
            light: resolveToken('--tint-blob-' + fam + '-light') || base,
            deep: resolveToken('--tint-blob-' + fam + '-deep') || base,
            vis: 1,
        };
    }

    function measure() {
        var els = document.querySelectorAll('[' + ATTR + ']');
        stops = [];
        if (!glowColor) glowColor = resolveToken('--tint-blob-glow');
        Array.prototype.forEach.call(els, function (el) {
            var token = el.getAttribute(ATTR);
            if (!token) return;
            var c = el.__tintColor || (el.__tintColor = resolveToken(token));
            if (!c) return;
            var comp = el.__tintComp || (el.__tintComp = companions(token, c));
            var rect = el.getBoundingClientRect();
            var top = rect.top + window.scrollY;
            var h = rect.height;
            /* per-marker plateau override (see header): "start,end" fractions */
            var hold = (el.getAttribute('data-tint-hold') || '').split(',');
            var hs = hold.length === 2 ? parseFloat(hold[0]) : HOLD_START;
            var he = hold.length === 2 ? parseFloat(hold[1]) : HOLD_END;
            if (isNaN(hs) || isNaN(he)) { hs = HOLD_START; he = HOLD_END; }
            /* plateau: same values at both anchors */
            var entry = { base: c, light: comp.light, deep: comp.deep, vis: comp.vis };
            stops.push({ y: top + h * hs, base: entry.base, light: entry.light, deep: entry.deep, vis: entry.vis });
            stops.push({ y: top + h * he, base: entry.base, light: entry.light, deep: entry.deep, vis: entry.vis });
        });
        stops.sort(function (a, b) { return a.y - b.y; });
        active = stops.length > 0;
        document.documentElement.classList.toggle(HTML_CLASS, active);
        if (active) apply();
        else clearPaint();
    }

    /* ── paint ─────────────────────────────────────────────────────────── */

    function mixC(a, z, t) {
        return {
            r: a.r + (z.r - a.r) * t,
            g: a.g + (z.g - a.g) * t,
            b: a.b + (z.b - a.b) * t,
        };
    }

    /* Interpolated stop-map record at document position y (clamped before
       the first stop / past the last one): base + blob colours + blob
       visibility, all blended along the same map. */
    function sampleAt(y) {
        var n = stops.length;
        if (y <= stops[0].y) return stops[0];
        if (y >= stops[n - 1].y) return stops[n - 1];
        var i = 1;
        while (i < n && stops[i].y < y) i++;
        var a = stops[i - 1], z = stops[i];
        var t = z.y === a.y ? 0 : (y - a.y) / (z.y - a.y);
        return {
            base: mixC(a.base, z.base, t),
            light: mixC(a.light, z.light, t),
            deep: mixC(a.deep, z.deep, t),
            vis: a.vis + (z.vis - a.vis) * t,
        };
    }

    function rgb(c) {
        return 'rgb(' + Math.round(c.r) + ', ' + Math.round(c.g) + ', ' + Math.round(c.b) + ')';
    }

    /* The paint target: a fixed full-viewport layer behind all content (no
       negative z-index exists anywhere else in the site) but above the body
       canvas colour, so transparent sections show it exactly like they showed
       the old flat body paint. The base colour paints on the underlay itself;
       the three aurora blobs are children (wrapper = JS scroll drift, inner =
       CSS idle float, so the two transforms never fight). */
    function getUnderlay() {
        if (underlay && underlay.isConnected) return underlay;
        ensureBlobStyle();
        underlay = document.createElement('div');
        underlay.setAttribute('data-tint-underlay', '');
        underlay.setAttribute('aria-hidden', 'true');
        underlay.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;';
        /* The blobs live in a masked layer: a vertical alpha mask (rebuilt each
           frame from the visibility map) fades the wash out exactly where the
           document says the zone is quiet, so it can never butt against the
           edge of an opaque white block while the seam is mid-viewport. */
        blobLayer = document.createElement('div');
        blobLayer.style.cssText = 'position:absolute;inset:0;';
        blobs = {};
        BLOBS.forEach(function (b, i) {
            var wrap = document.createElement('div');
            wrap.className = 'tint-blob-wrap';
            wrap.style.cssText =
                'position:absolute;width:' + b.size + 'vmax;height:' + b.size + 'vmax;' +
                'left:' + b.x + '%;top:' + b.y + '%;margin:-' + (b.size / 2) + 'vmax 0 0 -' + (b.size / 2) + 'vmax;' +
                'will-change:transform;';
            var inner = document.createElement('div');
            inner.className = 'tint-blob';
            var canAnimate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            inner.style.cssText =
                'width:100%;height:100%;border-radius:50%;' +
                (canAnimate
                    ? 'animation:tint-blob-orbit ' + (26 + i * 9) + 's var(--ease) ' + (-i * 7) + 's infinite' +
                      (i === 1 ? ' reverse' : '') + ';'
                    : 'animation:none;');
            wrap.appendChild(inner);
            blobLayer.appendChild(wrap);
            blobs[b.key] = { wrap: wrap, inner: inner, spec: b };
        });
        underlay.appendChild(blobLayer);
        document.body.appendChild(underlay);
        return underlay;
    }

    /* Idle orbit keyframes - injected once, persist in <head> across Astro
       client-side swaps. Each blob circles an elliptical path (translate %
       is relative to the blob's own 90–120vmax box, so ±9% ≈ 10vmax of
       travel - clearly alive) while breathing in scale. Blobs get different
       durations/phases and one runs reversed, so they orbit around each
       other instead of moving in lockstep. Stilled under reduced motion. */
    function ensureBlobStyle() {
        if (document.getElementById('tint-blob-style')) return;
        var style = document.createElement('style');
        style.id = 'tint-blob-style';
        style.textContent =
            '@keyframes tint-blob-orbit{' +
            '0%{transform:translate3d(0,-7%,0) scale(1);}' +
            '25%{transform:translate3d(9%,0,0) scale(1.1);}' +
            '50%{transform:translate3d(0,7%,0) scale(1.18);}' +
            '75%{transform:translate3d(-9%,0,0) scale(1.08);}' +
            '100%{transform:translate3d(0,-7%,0) scale(1);}}' +
            '@media (prefers-reduced-motion: reduce){.tint-blob{animation:none !important;}}';
        document.head.appendChild(style);
    }

    /* A blob is a pre-blurred radial gradient: solid-ish core falling to
       transparent at 70% of the radius - soft with zero filter cost. */
    function paintBlob(entry, color) {
        var c = rgb(color);
        entry.inner.style.background =
            'radial-gradient(circle closest-side, ' + c + ' 0%, ' + c + ' 25%, transparent 70%)';
        entry.inner.style.opacity = String(entry.spec.alpha);
    }

    function apply() {
        if (!active) return;
        var top = window.scrollY;
        var vh = window.innerHeight;
        var parts = [];
        var flat = true;
        var first = '';
        for (var i = 0; i < SAMPLES.length; i++) {
            var c = rgb(sampleAt(top + vh * SAMPLES[i]).base);
            if (i === 0) first = c;
            else if (c !== first) flat = false;
            parts.push(c + ' ' + (SAMPLES[i] * 100) + '%');
        }
        var paint = flat ? first : 'linear-gradient(180deg, ' + parts.join(', ') + ')';
        var el = getUnderlay();
        if (paint !== lastPaint) {
            lastPaint = paint;
            el.style.background = paint;
        }

        /* Aurora: colours from the viewport-centre sample; visibility as a
           VERTICAL MASK sampled across the viewport (same document-space map
           as the base gradient), so the wash fades out spatially before any
           quiet zone instead of dimming the whole viewport at once; drift
           from overall scroll progress (one slow sweep across the page). */
        var mid = sampleAt(top + vh / 2);
        var maskParts = [];
        for (var j = 0; j < SAMPLES.length; j++) {
            var v = sampleAt(top + vh * SAMPLES[j]).vis;
            maskParts.push('rgba(0,0,0,' + v.toFixed(3) + ') ' + (SAMPLES[j] * 100) + '%');
        }
        var mask = 'linear-gradient(180deg, ' + maskParts.join(', ') + ')';
        var docH = Math.max(1, document.documentElement.scrollHeight - vh);
        var p = Math.min(1, Math.max(0, top / docH));
        var key = rgb(mid.light) + '|' + rgb(mid.deep) + '|' + mask + '|' + p.toFixed(4);
        if (key === lastBlobKey) return;
        lastBlobKey = key;
        blobLayer.style.webkitMaskImage = mask;
        blobLayer.style.maskImage = mask;
        paintBlob(blobs.glow, glowColor || { r: 255, g: 255, b: 255 });
        paintBlob(blobs.light, mid.light);
        paintBlob(blobs.deep, mid.deep);
        var vmax = Math.max(window.innerWidth, vh) / 100;
        BLOBS.forEach(function (b) {
            var dx = Math.sin(p * Math.PI * 2 + b.phase) * b.driftX * vmax;
            var dy = p * b.driftY * vmax;
            drift[b.key] = { x: dx, y: dy };
            setBlobTransform(b.key);
        });
    }

    /* Compose the wrapper transform: scroll drift for every blob, plus the
       eased pointer-follow offset on the white glow. Kept separate from
       apply() so the follow loop can retarget the glow without a repaint. */
    function setBlobTransform(key) {
        if (!blobs || !blobs[key]) return;
        /* Once the pointer has taken over the glow, its scroll drift is
           dropped - otherwise the drift (and the idle orbit, stilled in
           followStep) parks the bright core a few hundred px away from the
           cursor and the follow is imperceptible. */
        var owned = key === 'glow' && followEngaged;
        var d = owned ? { x: 0, y: 0 } : (drift[key] || { x: 0, y: 0 });
        var fx = key === 'glow' ? follow.x : 0;
        var fy = key === 'glow' ? follow.y : 0;
        blobs[key].wrap.style.transform =
            'translate3d(' + (d.x + fx).toFixed(1) + 'px, ' + (d.y + fy).toFixed(1) + 'px, 0)';
    }

    /* ── pointer follow (white glow only) ──────────────────────────────── */

    /* Ease the glow's offset toward the cursor each frame; stop the loop
       once it has settled so an idle mouse costs nothing. */
    function followStep() {
        followRaf = 0;
        if (!active || !pointerTarget || !blobs) return;
        if (!followEngaged) {
            followEngaged = true;
            /* Still the glow's idle orbit: freeze it at its current animated
               transform, then ease that transform home. Left running, the
               orbit swings the bright core ±9% of a 135vmax box (~hundreds
               of px) around the cursor and the follow reads as random
               drifting instead of light settling where you point. */
            var inner = blobs.glow.inner;
            inner.style.transform = getComputedStyle(inner).transform;
            inner.style.animation = 'none';
            void inner.offsetWidth; /* commit the frozen frame */
            inner.style.transition = 'transform 1.6s var(--ease)';
            inner.style.transform = 'translate3d(0,0,0) scale(1)';
            /* seed the eased offset from the wrapper's current drift so the
               handover is continuous rather than a jump */
            var d = drift.glow || { x: 0, y: 0 };
            follow.x += d.x;
            follow.y += d.y;
        }
        /* target offset: from the glow's rest anchor all the way to the
           cursor - the light roams the whole viewport, trailing far behind */
        var spec = blobs.glow.spec;
        var ax = window.innerWidth * (spec.x / 100);
        var ay = window.innerHeight * (spec.y / 100);
        var tx = (pointerTarget.x - ax) * FOLLOW_STRENGTH;
        var ty = (pointerTarget.y - ay) * FOLLOW_STRENGTH;
        follow.x += (tx - follow.x) * FOLLOW_EASE;
        follow.y += (ty - follow.y) * FOLLOW_EASE;
        setBlobTransform('glow');
        if (Math.abs(tx - follow.x) > 0.5 || Math.abs(ty - follow.y) > 0.5) {
            followRaf = requestAnimationFrame(followStep);
        }
    }

    function onPointerMove(e) {
        if (!active) return;
        pointerTarget = { x: e.clientX, y: e.clientY };
        if (!followRaf) followRaf = requestAnimationFrame(followStep);
    }

    function clearPaint() {
        lastPaint = '';
        lastBlobKey = '';
        if (followRaf) { cancelAnimationFrame(followRaf); followRaf = 0; }
        pointerTarget = null;
        followEngaged = false;
        follow = { x: 0, y: 0 };
        drift = {};
        if (underlay) { underlay.remove(); underlay = null; blobLayer = null; blobs = null; }
        document.documentElement.classList.remove(HTML_CLASS);
    }

    /* ── scheduling ────────────────────────────────────────────────────── */

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

    /* Pinned sections (GSAP) insert pin-spacers that shift every anchor below
       them - re-measure whenever ScrollTrigger recomputes its own positions. */
    function hookScrollTrigger() {
        if (stHooked || !window.ScrollTrigger) return;
        stHooked = true;
        window.ScrollTrigger.addEventListener('refresh', remeasure);
    }

    function init() {
        hookScrollTrigger();
        /* drop stale colours (tokens may differ per theme / page) */
        glowColor = null;
        document.querySelectorAll('[' + ATTR + ']').forEach(function (el) {
            delete el.__tintColor;
            delete el.__tintComp;
        });
        measure();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', remeasure);
    if (canFollow) window.addEventListener('pointermove', onPointerMove, { passive: true });
    /* late layout shifts (fonts, images) move the anchors */
    window.addEventListener('load', remeasure);

    /* Old page's underlay paint must not leak onto the next page. */
    document.addEventListener('astro:before-swap', function () {
        active = false;
        stops = [];
        clearPaint();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.scrollTint = init;   /* re-arm after client-side navigation */
})();
