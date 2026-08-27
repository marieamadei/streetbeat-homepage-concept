/* ============================================================================
   dotGrid - FigJam-style ambient dot field for fixed DARK stages

   Drops a canvas layer behind any element marked `data-dot-grid`: a square
   grid of 24 columns of pin-prick dots resting at a very faint neutral
   (--border-on-dark). Random dots ignite one at a time as radial-gradient
   blooms in the brand accents (greens/cyans, from tokens.css) and fade back;
   dots near the cursor brighten softly. One paint layer, no per-dot DOM.

   ── Markup ──────────────────────────────────────────────────────────────────
     <div class="…" data-dot-grid>            <!-- a positioned dark wrapper -->
       …sections… (lift their content above the canvas with z-index)
     </div>

   The host must be position:relative (or otherwise positioned); the module
   injects `<canvas class="dot-grid-canvas">` as its first child, absolutely
   filling it (z-index 0, pointer-events none). Content above should sit in a
   positioned layer (z-index ≥ 1) so the dots read as background.

   Dependency-free. Draws only the rows near the viewport, animates only while
   the host is on screen, and holds a single static frame under
   prefers-reduced-motion. Re-scans via window.dotGrid() (the layout calls it
   per navigation); loops self-terminate when their canvas leaves the DOM.
   ========================================================================== */
(function () {
    'use strict';

    var COLS = 24;          /* horizontal dot count - the grid is square */
    var REST_A = 0.10;      /* resting dot alpha - very faint */
    var HOVER_A = 0.38;     /* alpha at the cursor's centre */
    var HOVER_R = 150;      /* cursor influence radius (px) */
    var SPARK_A = 0.68;     /* peak alpha of an ignited bloom */

    var reducedMq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

    function toRGB(c) {
        if (c.charAt(0) === '#') {
            var h = c.slice(1);
            if (h.length === 3) h = h.replace(/./g, '$&$&');
            var n = parseInt(h, 16);
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        }
        var m = c.match(/[\d.]+/g);
        return m ? [+m[0], +m[1], +m[2]] : [255, 255, 255];
    }

    function arm(host) {
        if (host.dataset.dotGridBound) return;
        host.dataset.dotGridBound = '1';

        var canvas = document.createElement('canvas');
        canvas.className = 'dot-grid-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        /* width/height:100% is REQUIRED, not redundant with inset:0 - a <canvas>
           is a replaced element whose width/height attributes give it an
           intrinsic size (the device-pixel buffer, host×dpr). For replaced
           elements inset:0 does NOT stretch the box, so on HiDPI (dpr>1) the
           canvas would render at 1.5× the host and displace every dot off the
           bottom/right. Pinning the CSS box to 100% keeps it locked to the host. */
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';
        host.insertBefore(canvas, host.firstChild);
        var ctx = canvas.getContext('2d');
        if (!ctx) return;

        /* Colours from the locked tokens - resolved once; dot-grid hosts are
           fixed dark surfaces, the same in both themes. */
        var cs = getComputedStyle(document.documentElement);
        var tok = function (n) { return cs.getPropertyValue(n).trim(); };
        var rest = toRGB(tok('--border-on-dark') || 'rgba(255,255,255,0.12)');
        var hot = toRGB(tok('--text-on-dark-primary') || '#FFFFFF');
        var sparkColors = [
            tok('--accent-green'),
            tok('--accent-green-bright'),
            tok('--accent-cyan'),
            tok('--accent-cyan-bright'),
        ].filter(Boolean).map(toRGB);

        var W = 0, H = 0, cell = 0, rows = 0, dotR = 0;
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5); /* the host can span several viewports - cap the buffer */

        function size() {
            W = host.clientWidth;
            H = host.clientHeight;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            cell = W / COLS;                    /* square grid: rows follow */
            rows = Math.ceil(H / cell) + 1;
            dotR = Math.max(0.75, Math.min(1.5, cell * 0.02)); /* pin-pricks */
        }

        /* Sparks - dots currently lit, each with its own colour + lifespan. */
        var sparks = [];
        var nextSpark = 0;
        function spawn(now, r0, r1) {
            if (now < nextSpark) return;
            nextSpark = now + 220 + Math.random() * 480;
            if (sparks.length > COLS) return;   /* keep it sparse */
            sparks.push({
                col: Math.floor(Math.random() * (COLS + 1)),
                /* spawn within the visible band so ignitions are always seen */
                row: r0 + Math.floor(Math.random() * Math.max(1, r1 - r0)),
                rgb: sparkColors[Math.floor(Math.random() * sparkColors.length)],
                t0: now,
                life: 1800 + Math.random() * 1600,
            });
        }

        /* Pointer, in host-local coords (the canvas is pointer-events:none,
           so we listen on the host and let events bubble up from content). */
        var px = -1e4, py = -1e4;
        function onMove(e) {
            var r = host.getBoundingClientRect();
            px = e.clientX - r.left;
            py = e.clientY - r.top;
        }
        function onLeave() { px = -1e4; py = -1e4; }

        function draw(now) {
            ctx.clearRect(0, 0, W, H);
            var animate = !(reducedMq && reducedMq.matches);

            /* Only the rows near the viewport get painted - the host can be
               several screens tall and off-screen dots are invisible anyway. */
            var top = host.getBoundingClientRect().top;
            var r0 = Math.max(0, Math.floor((-top - 200) / cell));
            var r1 = Math.min(rows, Math.ceil((-top + window.innerHeight + 200) / cell));

            if (animate) spawn(now, r0, r1);

            /* Spark intensity per grid slot: quick attack, slow decay. */
            var lit = {};
            if (animate) {
                sparks = sparks.filter(function (s) { return now - s.t0 < s.life; });
                sparks.forEach(function (s) {
                    var p = (now - s.t0) / s.life;
                    var a = p < 0.18 ? p / 0.18 : 1 - (p - 0.18) / 0.82;
                    var key = s.row * (COLS + 1) + s.col;
                    if (!lit[key] || a > lit[key].a) lit[key] = { a: a, rgb: s.rgb };
                });
            }

            for (var r = r0; r < r1; r++) {
                var y = r * cell + cell / 2;
                for (var c = 0; c <= COLS; c++) {
                    var x = c * cell + cell / 2;
                    /* base - faint neutral, lifted near the cursor */
                    var a = REST_A;
                    if (animate) {
                        var d = Math.hypot(x - px, y - py);
                        if (d < HOVER_R) {
                            var f = 1 - d / HOVER_R;
                            a = REST_A + (HOVER_A - REST_A) * f * f;
                        }
                    }
                    var s = lit[r * (COLS + 1) + c];
                    if (s) {
                        /* ignited - a radial-gradient bloom: a hot core melting
                           through the brand colour into transparency. */
                        var sa = Math.max(a, s.a * SPARK_A);
                        /* halo radius 1.5× the previous bloom, but the colour
                           stops are compressed inward so the hot core stays
                           tiny - a small dot with a slightly bigger light. */
                        /* Floor at the dot radius: a real bloom is always
                           larger, but guard the canvas radius against ever
                           going <0 (createRadialGradient/arc throw an
                           IndexSizeError on a negative r), which would abort
                           the whole frame. */
                        var bloomR = Math.max(dotR, (dotR * 2 + s.a * dotR * 1.5) * 1.5);
                        var g = ctx.createRadialGradient(x, y, 0, x, y, bloomR);
                        g.addColorStop(0, 'rgba(' + hot[0] + ',' + hot[1] + ',' + hot[2] + ',' + sa + ')');
                        g.addColorStop(0.17, 'rgba(' + s.rgb[0] + ',' + s.rgb[1] + ',' + s.rgb[2] + ',' + (sa * 0.9) + ')');
                        g.addColorStop(0.37, 'rgba(' + s.rgb[0] + ',' + s.rgb[1] + ',' + s.rgb[2] + ',' + (sa * 0.25) + ')');
                        g.addColorStop(1, 'rgba(' + s.rgb[0] + ',' + s.rgb[1] + ',' + s.rgb[2] + ',0)');
                        ctx.fillStyle = g;
                        ctx.beginPath();
                        ctx.arc(x, y, bloomR, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        ctx.fillStyle = 'rgba(' + rest[0] + ',' + rest[1] + ',' + rest[2] + ',' + a + ')';
                        ctx.beginPath();
                        ctx.arc(x, y, dotR, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }

        /* Animate only while the host is on screen; self-terminate once the
           canvas leaves the DOM (Astro swaps pages by replacing the body). */
        var raf = 0;
        var visible = false;
        function loop(now) {
            if (!canvas.isConnected) { raf = 0; return; }
            draw(now);
            if (visible && !(reducedMq && reducedMq.matches)) raf = requestAnimationFrame(loop);
            else raf = 0;
        }
        function start() { if (!raf) raf = requestAnimationFrame(loop); }

        if ('IntersectionObserver' in window) {
            var io = new IntersectionObserver(function (entries) {
                visible = entries[0].isIntersecting;
                if (visible) start();
            }, { rootMargin: '100px' });
            io.observe(host);
        } else {
            visible = true;
            start();
        }

        if ('ResizeObserver' in window) {
            new ResizeObserver(function () { size(); draw(performance.now()); }).observe(host);
        } else {
            window.addEventListener('resize', function () { size(); draw(performance.now()); });
        }
        /* Redraw on scroll too - the painted band follows the viewport even
           when the rAF loop is idle under reduced motion. */
        window.addEventListener('scroll', function () {
            if (!raf && canvas.isConnected) draw(performance.now());
        }, { passive: true });

        if (reducedMq && reducedMq.addEventListener) {
            reducedMq.addEventListener('change', function () { size(); start(); });
        }
        host.addEventListener('pointermove', onMove);
        host.addEventListener('pointerleave', onLeave);

        size();
        draw(performance.now());
    }

    function init(root) {
        root = root || document;
        Array.prototype.forEach.call(root.querySelectorAll('[data-dot-grid]'), arm);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { init(); });
    } else {
        init();
    }

    window.dotGrid = init;   /* call again after injecting new DOM */
})();
