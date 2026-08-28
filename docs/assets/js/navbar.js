/* ============================================================================
   Streetbeat - Navigation bar behaviour (shared component)
   The canonical homepage nav behaviour, used on every page:
   · post-hero compression - the pill contracts from right to left around the
     unmoved wordmark; the logo-FAB restores the full bar, as does scrolling up;
   · sliding hover pill - glides between links, snapping in on first appearance
     (no glide from the origin) then easing between targets;
   · mobile menu - the burger morphs the pill downwards (the SAME .nav-drawer
     mechanism as the desktop mega panels) to reveal #navMobile, and toggles
     into an X; closes on link click, Escape, outside click, or growing past
     the burger breakpoint;
   · footer slide-away - once the footer takes over the viewport the whole nav
     slides up out of the way (.nav-away), and returns on the way back up.

   Pairs with assets/css/navbar.css. Dependency-free; self-initializing. The
   mega-panel dropdowns are handled separately by assets/js/meganav.js.
   ============================================================================ */
(function () {
    'use strict';

    var nav = document.getElementById('nav');

    /* ---- Footer slide-away ---- */
    /* The nav persists across client-side navigations (Astro) but the footer is
       swapped with the page body, so the watcher re-arms on astro:page-load.
       rootMargin trims the bottom 55% of the viewport: the nav leaves once the
       footer's top edge climbs into the upper half of the screen. */
    var footerIO = null;
    var watchFooter = function () {
        if (!nav || !('IntersectionObserver' in window)) return;
        if (footerIO) { footerIO.disconnect(); footerIO = null; }
        var footer = document.querySelector('.footer');
        if (!footer) { nav.classList.remove('nav-away'); return; }
        footerIO = new IntersectionObserver(function (entries) {
            nav.classList.toggle('nav-away', entries[0].isIntersecting);
        }, { rootMargin: '0px 0px -55% 0px' });
        footerIO.observe(footer);
    };
    watchFooter();
    document.addEventListener('astro:page-load', watchFooter);

    /* ---- Current-page highlight (re-synced on client navigation) ---- */
    /* The nav DOM persists across Astro navigations (transition:persist), so the
       server-rendered current-page state would otherwise stay frozen on whatever
       page first loaded. Re-evaluate it from location.pathname on every
       astro:page-load, mirroring the server logic: current = path starts with
       '/<seg>'. Links without data-nav-seg are never current; aria-current is
       kept in sync on every marked link for accessibility. */
    var syncNavCurrent = function () {
        if (!nav) return;
        var path = location.pathname;
        nav.querySelectorAll('[data-nav-seg]').forEach(function (a) {
            var seg = a.getAttribute('data-nav-seg');
            var on = !!seg && path.indexOf('/' + seg) === 0;
            if (on) a.setAttribute('aria-current', 'page');
            else a.removeAttribute('aria-current');
        });
    };
    syncNavCurrent();
    document.addEventListener('astro:page-load', syncNavCurrent);

    /* ---- Sliding hover pill across the nav links ---- */
    var navLinks = nav && nav.querySelector('.nav-links');
    if (navLinks) {
        var hoverSlot = document.createElement('li');
        hoverSlot.className = 'nav-hover-slot';
        hoverSlot.setAttribute('aria-hidden', 'true');
        var hover = document.createElement('span');
        hover.className = 'nav-hover';
        hoverSlot.appendChild(hover);
        navLinks.appendChild(hoverSlot);
        var pointerInLinks = false;

        // Park the pill on a link. `snap` places it instantly (no glide) - used
        // on first appearance so it doesn't slide in from the origin.
        var parkOn = function (a, snap) {
            if (snap) hover.style.transition = 'none';
            hover.style.width = a.offsetWidth + 'px';
            hover.style.height = a.offsetHeight + 'px';
            hover.style.transform = 'translate(' + a.offsetLeft + 'px,' + a.offsetTop + 'px)';
            if (snap) { void hover.offsetWidth; hover.style.transition = ''; }
            hover.style.opacity = '1';
        };
        var openTrigger = function () {
            var li = nav.querySelector('.has-mega.is-open');
            return li && li.querySelector('.mega-trigger');
        };

        navLinks.querySelectorAll('a, button.mega-trigger').forEach(function (a) {
            a.addEventListener('mouseenter', function () {
                parkOn(a, hover.style.opacity !== '1');
            });
        });
        navLinks.addEventListener('mouseenter', function () { pointerInLinks = true; });
        navLinks.addEventListener('mouseleave', function () {
            pointerInLinks = false;
            // Leaving the links to browse an open panel keeps the pill parked on
            // that trigger, so you never lose track of what's expanded.
            var t = openTrigger();
            if (t) parkOn(t, false); else hover.style.opacity = '0';
        });

        // React when a mega panel opens/closes (driven by meganav.js): keep the
        // pill on the open trigger; hide it once nothing is open and the pointer
        // has left the links.
        if (window.MutationObserver) {
            var syncPill = function () {
                var t = openTrigger();
                if (t) parkOn(t, hover.style.opacity !== '1');
                else if (!pointerInLinks) hover.style.opacity = '0';
            };
            var obs = new MutationObserver(syncPill);
            nav.querySelectorAll('.has-mega').forEach(function (li) {
                obs.observe(li, { attributes: true, attributeFilter: ['class'] });
            });
        }
    }

    /* ---- Mobile menu (burger morphs the pill drawer open) ---- */
    /* Reuses the .nav-drawer that the desktop mega panels expand into: opening =
       setting an explicit pixel height on the drawer (its content = #navMobile),
       so the pill morphs downwards, transitioned in meganav.css. Capped to the
       viewport so a short (landscape) screen scrolls the panel instead of
       overflowing. Must stay in sync with the CSS breakpoint (960px). */
    var BURGER_BP = 960;
    var burger = document.getElementById('burger');
    var drawer = nav && nav.querySelector('.nav-drawer');
    var mobilePanel = document.getElementById('navMobile');
    if (burger && drawer && mobilePanel) {
        var isOpen = function () { return nav.classList.contains('menu-open'); };
        var drawerHeight = function () {
            // Leave room for the bar row + top gap; scroll the panel past that.
            var cap = Math.max(0, window.innerHeight - mobilePanel.getBoundingClientRect().top - 16);
            return Math.min(mobilePanel.scrollHeight, cap);
        };
        var sizeMobileDrawer = function () {
            var height = drawerHeight();
            mobilePanel.style.maxHeight = height + 'px';
            drawer.style.height = height + 'px';
        };
        var groupTriggers = Array.prototype.slice.call(mobilePanel.querySelectorAll('.nm-group-trigger'));
        var closeGroups = function (except) {
            groupTriggers.forEach(function (trigger) {
                if (trigger === except) return;
                var panel = document.getElementById(trigger.getAttribute('aria-controls'));
                trigger.setAttribute('aria-expanded', 'false');
                trigger.closest('.nm-group').classList.remove('is-open');
                if (panel) { panel.hidden = true; panel.inert = true; }
            });
        };
        var setGroup = function (trigger, open) {
            var panel = document.getElementById(trigger.getAttribute('aria-controls'));
            if (!panel) return;
            if (open) closeGroups(trigger);
            trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
            trigger.closest('.nm-group').classList.toggle('is-open', open);
            panel.hidden = !open;
            panel.inert = !open;
            if (isOpen()) sizeMobileDrawer();
        };
        groupTriggers.forEach(function (trigger) {
            var panel = document.getElementById(trigger.getAttribute('aria-controls'));
            if (panel) panel.inert = true;
            trigger.addEventListener('click', function () {
                setGroup(trigger, trigger.getAttribute('aria-expanded') !== 'true');
            });
        });
        var setMenu = function (o) {
            if (!o) closeGroups();
            nav.classList.toggle('menu-open', o);
            burger.setAttribute('aria-expanded', o ? 'true' : 'false');
            burger.setAttribute('aria-label', o ? 'Close menu' : 'Open menu');
            drawer.inert = nav.classList.contains('nav-compact') || (!o && window.innerWidth <= BURGER_BP);
            if (o) sizeMobileDrawer();
            else {
                mobilePanel.style.maxHeight = '';
                mobilePanel.scrollTop = 0;
                drawer.style.height = '0px';
            }
        };
        drawer.inert = window.innerWidth <= BURGER_BP;
        burger.addEventListener('click', function () { setMenu(!isOpen()); });
        mobilePanel.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', function () { setMenu(false); });
        });
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape' || !isOpen()) return;
            var openGroup = groupTriggers.find(function (trigger) { return trigger.getAttribute('aria-expanded') === 'true'; });
            if (openGroup) { setGroup(openGroup, false); openGroup.focus(); }
            else { setMenu(false); burger.focus(); }
        });
        // Tapping/clicking anywhere outside the pill closes the menu.
        document.addEventListener('click', function (e) {
            if (isOpen() && !nav.contains(e.target)) setMenu(false);
        });
        window.addEventListener('resize', function () {
            // Growing back to desktop hands navigation to the bar links.
            if (window.innerWidth > BURGER_BP) {
                if (isOpen()) setMenu(false);
                else drawer.inert = nav.classList.contains('nav-compact');
                return;
            }
            if (!isOpen()) { drawer.inert = true; return; }
            sizeMobileDrawer();   // keep the open drawer snug
        });
    }

    /* ---- Post-hero compression into the logo FAB ---- */
    /* One visual state only: past [data-nav-hero], the existing pill contracts
       around its unchanged logo and the other bar items fade. Scrolling upward
       or pressing the compact surface restores the normal navbar. */
    var navBar = nav && nav.querySelector('.nav-bar');
    var navLogo = nav && nav.querySelector('.nav-logo');
    var navActions = nav && nav.querySelector('.nav-actions');
    var navFab = document.getElementById('navFab');
    var heroBottom = Infinity;
    var lastScrollY = window.scrollY;
    var scrollFrame = 0;
    var compactState = null;

    var setCompact = function (compact, focusLogo, force) {
        if (!nav || !navFab) return;
        if (!force && compactState === compact) return;
        var isRevealing = compactState === true && !compact;
        compactState = compact;
        var activeWasInBar = compact && navBar && navBar.contains(document.activeElement);

        if (compact && nav.classList.contains('menu-open') && typeof setMenu === 'function') {
            setMenu(false);
        }
        nav.classList.toggle('nav-revealing', isRevealing);
        nav.classList.toggle('nav-compact', compact);
        [navLogo, navLinks, navActions, burger].forEach(function (el) {
            if (el) el.inert = compact;
        });
        navFab.inert = !compact;
        navFab.setAttribute('aria-hidden', compact ? 'false' : 'true');
        navFab.tabIndex = compact ? 0 : -1;
        if (navLogo) {
            if (compact) navLogo.setAttribute('aria-hidden', 'true');
            else navLogo.removeAttribute('aria-hidden');
        }

        if (drawer) {
            drawer.inert = compact || (window.innerWidth <= BURGER_BP && !nav.classList.contains('menu-open'));
        }
        if (activeWasInBar) navFab.focus({ preventScroll: true });
        else if (!compact && focusLogo && navLogo) navLogo.focus({ preventScroll: true });
    };

    var measureCompactWidth = function () {
        if (!nav || !navBar || !navLogo) return;
        var barStyle = getComputedStyle(navBar);
        var innerStyle = getComputedStyle(nav.querySelector('.nav-inner'));
        var frame = parseFloat(barStyle.paddingLeft) * 2
            + navLogo.getBoundingClientRect().width
            + parseFloat(innerStyle.borderLeftWidth)
            + parseFloat(innerStyle.borderRightWidth);
        nav.style.setProperty('--nav-compact-width', Math.ceil(frame) + 'px');
    };

    var measureHero = function () {
        var hero = document.querySelector('[data-nav-hero]');
        heroBottom = hero ? hero.getBoundingClientRect().bottom + window.scrollY : Infinity;
    };

    var syncCompression = function () {
        if (!nav) return;
        var y = window.scrollY;
        var delta = y - lastScrollY;
        var pastHero = y >= heroBottom;

        nav.classList.toggle('scrolled', y > 20);
        setCompact(pastHero && delta >= 0, false);
        lastScrollY = y;
    };

    var requestCompressionSync = function () {
        if (scrollFrame) return;
        scrollFrame = requestAnimationFrame(function () {
            scrollFrame = 0;
            syncCompression();
        });
    };

    var refreshCompression = function () {
        if (!nav) return;
        measureCompactWidth();
        measureHero();
        lastScrollY = window.scrollY;
        nav.classList.toggle('scrolled', lastScrollY > 20);
        setCompact(lastScrollY >= heroBottom, false, true);
    };

    if (nav && navFab) {
        var navInner = nav.querySelector('.nav-inner');
        if (navInner) {
            navInner.addEventListener('transitionend', function (event) {
                if (event.propertyName === 'width' && !nav.classList.contains('nav-compact')) {
                    nav.classList.remove('nav-revealing');
                }
            });
        }
        navFab.addEventListener('click', function () {
            setCompact(false, true);
        });
        window.addEventListener('scroll', requestCompressionSync, { passive: true });
        window.addEventListener('resize', refreshCompression);
        document.addEventListener('astro:page-load', function () {
            requestAnimationFrame(refreshCompression);
        });
        refreshCompression();
    }
})();
