/* ============================================================================
   White-label overlay scrollbar - vanilla implementation of the ScrollArea spec
   ----------------------------------------------------------------------------
   Native chrome is killed globally in assets/css/scrollbar.css; this module is
   the single sanctioned source of a *visible* bar. It paints a handle-only
   overlay thumb that reveals on scroll and fades after a delay (type="scroll"),
   reserves no layout space, and reads every value from a token:

     --scrollbar-thumb / --scrollbar-thumb-hover  thumb colour (CSS)
     --scrollbar-size                              thumb width  (CSS)
     --scrollbar-radius                            pill radius  (CSS)
     --bank-scrollbar-fade                         reveal/fade duration (here)

   Works for the window (Lenis smooth-scroll) and for any inner scroll container
   without wrapping its DOM: the track is position:fixed and re-placed over the
   scroller's edge on scroll/resize.

   Public API (window.OverlayScrollbar):
     attach(target, opts)  -> Scrollbar    target = element | window
     refresh()                             recompute every instance (call after
                                           layout changes, menu open, etc.)
   Auto-init: the window always gets one; elements matching AUTO_SELECTOR or
   carrying [data-scrollbar] get one too.
   ============================================================================ */
(function () {
    'use strict';

    var AUTO_SELECTOR = '[data-scrollbar]';
    var MIN_THUMB = 28;          // px - keep the thumb grabbable on long pages
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var instances = [];

    function fadeDelayMs() {
        var raw = getComputedStyle(document.documentElement)
            .getPropertyValue('--bank-scrollbar-fade').trim();
        if (!raw) return 500;
        var n = parseFloat(raw);
        if (isNaN(n)) return 500;
        if (raw.indexOf('ms') !== -1) return n;
        if (raw.indexOf('s') !== -1) return n * 1000;
        return n;
    }

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    /* Route a scroll target write through Lenis when scrolling the window so the
       drag stays in sync with smooth-scroll; fall back to native otherwise. */
    function setScroll(isWindow, el, value) {
        if (isWindow && window.lenis && typeof window.lenis.scrollTo === 'function') {
            window.lenis.scrollTo(value, { immediate: true });
        } else if (isWindow) {
            window.scrollTo(0, value);
        } else {
            el.scrollTop = value;
        }
    }

    function Scrollbar(target, opts) {
        opts = opts || {};
        this.isWindow = (target === window || target === document ||
            target === document.documentElement || target === document.body);
        this.type = opts.type || 'scroll';           // scroll | always
        this.hideMs = opts.hideDelay != null ? opts.hideDelay : fadeDelayMs();
        this.el = this.isWindow
            ? (document.scrollingElement || document.documentElement)
            : target;
        this.scroller = this.isWindow ? window : target;
        this._hideTimer = null;
        this._dragging = false;
        this._build();
        this._bind();
        this.refresh();
        if (this.type === 'always') this._show(true);
        instances.push(this);
    }

    Scrollbar.prototype._build = function () {
        var track = document.createElement('div');
        track.className = 'sb-track sb-track--vertical' + (this.isWindow ? ' sb-track--window' : '');
        track.setAttribute('data-orientation', 'vertical');
        track.setAttribute('aria-hidden', 'true');   // decorative chrome only
        var thumb = document.createElement('div');
        thumb.className = 'sb-thumb';
        track.appendChild(thumb);
        document.body.appendChild(track);
        this.track = track;
        this.thumb = thumb;
    };

    Scrollbar.prototype._metrics = function () {
        if (this.isWindow) {
            return {
                scrollTop: this.el.scrollTop,
                scrollH: this.el.scrollHeight,
                clientH: window.innerHeight,
                top: 0,
                left: window.innerWidth - this.track.offsetWidth,
                trackH: window.innerHeight
            };
        }
        var r = this.el.getBoundingClientRect();
        return {
            scrollTop: this.el.scrollTop,
            scrollH: this.el.scrollHeight,
            clientH: this.el.clientHeight,
            top: r.top,
            left: r.right - this.track.offsetWidth,
            trackH: this.el.clientHeight
        };
    };

    Scrollbar.prototype.refresh = function () {
        var m = this._metrics();
        var overflow = m.scrollH - m.clientH;

        // No overflow → no bar (and clear any lingering reveal).
        if (overflow <= 1 || m.trackH <= 0) {
            this.track.style.display = 'none';
            return;
        }
        this.track.style.display = '';
        this.track.style.top = m.top + 'px';
        this.track.style.left = m.left + 'px';
        this.track.style.height = m.trackH + 'px';

        var thumbH = clamp((m.clientH / m.scrollH) * m.trackH, MIN_THUMB, m.trackH);
        var maxThumbTop = m.trackH - thumbH;
        var thumbTop = overflow > 0 ? (m.scrollTop / overflow) * maxThumbTop : 0;
        this.thumb.style.height = thumbH + 'px';
        this.thumb.style.top = clamp(thumbTop, 0, maxThumbTop) + 'px';
    };

    Scrollbar.prototype._show = function (sticky) {
        if (this.track.style.display === 'none') return;
        this.track.classList.add('is-visible');
        if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
        if (sticky || this.type === 'always' || this._dragging) return;
        var self = this;
        this._hideTimer = setTimeout(function () {
            self.track.classList.remove('is-visible');
        }, self.hideMs);
    };

    Scrollbar.prototype._onScroll = function () {
        this.refresh();
        this._show();
    };

    Scrollbar.prototype._bind = function () {
        var self = this;
        this._onScroll = this._onScroll.bind(this);
        this.scroller.addEventListener('scroll', this._onScroll, { passive: true });

        // Reposition/resize when the viewport or scroller geometry changes.
        window.addEventListener('resize', function () { self.refresh(); }, { passive: true });
        if (window.ResizeObserver) {
            this._ro = new ResizeObserver(function () { self.refresh(); });
            this._ro.observe(this.isWindow ? document.documentElement : this.el);
        }
        // Inner containers can be moved by transforms (e.g. a sliding menu) -
        // re-place the track when their transition finishes.
        if (!this.isWindow) {
            this.el.addEventListener('transitionend', function () { self.refresh(); });
        }

        // Hovering the (always-wide) grab area keeps the bar revealed so it can
        // be grabbed; leaving restarts the fade.
        this.thumb.addEventListener('mouseenter', function () { self._show(true); });
        this.thumb.addEventListener('mouseleave', function () { if (!self._dragging) self._show(); });

        this._bindDrag();
    };

    Scrollbar.prototype._bindDrag = function () {
        var self = this;
        var startY = 0, startScroll = 0, overflow = 0, maxThumbTop = 0;

        function onMove(e) {
            var y = (e.touches ? e.touches[0].clientY : e.clientY);
            var dy = y - startY;
            var delta = maxThumbTop > 0 ? (dy / maxThumbTop) * overflow : 0;
            setScroll(self.isWindow, self.el, clamp(startScroll + delta, 0, overflow));
            self.refresh();
            self._show(true);
            if (e.cancelable) e.preventDefault();
        }
        function onUp() {
            self._dragging = false;
            self.track.classList.remove('is-dragging');
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
            document.body.style.userSelect = '';
            self._show();
        }
        function onDown(e) {
            var m = self._metrics();
            overflow = m.scrollH - m.clientH;
            maxThumbTop = m.trackH - self.thumb.offsetHeight;
            startY = (e.touches ? e.touches[0].clientY : e.clientY);
            startScroll = m.scrollTop;
            self._dragging = true;
            self.track.classList.add('is-dragging');
            document.body.style.userSelect = 'none';
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
            self._show(true);
            if (e.cancelable) e.preventDefault();
        }
        this.thumb.addEventListener('pointerdown', onDown);
        this.thumb.addEventListener('touchstart', onDown, { passive: false });
    };

    var OverlayScrollbar = {
        attach: function (target, opts) { return new Scrollbar(target, opts); },
        refresh: function () { instances.forEach(function (i) { i.refresh(); }); },
        /* Re-establish coverage after a client-side navigation (Astro's
           ClientRouter swaps <body>, taking the fixed .sb-track elements with
           it). Instances whose track was removed are dropped and re-attached;
           live ones are left alone, so calling this repeatedly is safe. */
        ensure: function () {
            instances = instances.filter(function (i) {
                if (i.track.isConnected) return true;
                i.track.remove();
                return false;
            });
            var hasWindow = instances.some(function (i) { return i.isWindow; });
            if (!hasWindow) OverlayScrollbar.attach(window);
            document.querySelectorAll(AUTO_SELECTOR).forEach(function (el) {
                var bound = instances.some(function (i) { return i.el === el; });
                if (!bound) OverlayScrollbar.attach(el);
            });
            OverlayScrollbar.refresh();
        }
    };
    window.OverlayScrollbar = OverlayScrollbar;

    function init() {
        OverlayScrollbar.attach(window);
        var seen = [];
        document.querySelectorAll(AUTO_SELECTOR).forEach(function (el) {
            if (seen.indexOf(el) !== -1) return;
            seen.push(el);
            OverlayScrollbar.attach(el);
        });
        // Lenis may attach after DOMContentLoaded; recompute shortly after.
        setTimeout(function () { OverlayScrollbar.refresh(); }, 300);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
