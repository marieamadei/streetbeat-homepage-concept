/* ============================================================================
   Streetbeat - Mega navigation behaviour (shared by every page)
   Hover-intent + keyboard controller for the nav's mega panels. Pairs with
   assets/css/meganav.css; see that file for the markup contract.

   · The panels live inside the pill's .nav-drawer row; opening = setting an
     explicit pixel height on the drawer so the pill morphs downwards
     (transitioned in meganav.css). Switching panels re-measures, so
     panel-to-panel height changes morph too.
   · Hovering a trigger (or its panel) opens it; a short close delay bridges
     the pointer's travel between trigger and panel so nothing flickers.
   · Hovering a different trigger switches panels immediately.
   · Triggers are menu buttons, not links: click just opens/toggles.
   · Keyboard: focusing a trigger opens its panel; focus leaving trigger+panel
     closes; Escape closes and returns focus to the trigger.
   · Scrolling, or clicking/tapping outside, closes.

   Dependency-free; self-initializing.
   ============================================================================ */
(function () {
    'use strict';

    function initMegaNav() {
    var navEl = document.getElementById('nav');
    if (!navEl || navEl.dataset.megaNavBound === '1') return;
    navEl.dataset.megaNavBound = '1';
    var triggers = Array.prototype.slice.call(navEl.querySelectorAll('.has-mega'));
    if (!triggers.length) return;

    var drawer = navEl.querySelector('.nav-drawer');
    var hideT = null;
    var current = null; // the open .has-mega, or null

    function panelFor(li) { return document.getElementById(li.getAttribute('data-mega')); }
    function linkFor(li) { return li.querySelector('.mega-trigger'); }
    // Size the drawer to the active panel - reading offsetHeight after the
    // is-open flip gives the panel's laid-out height, and an explicit px
    // value is what makes the height transition (the morph) possible.
    function sizeDrawer() {
        if (!drawer) return;
        var p = current && panelFor(current);
        drawer.style.height = p ? p.offsetHeight + 'px' : '0px';
    }

    function open(li) {
        clearTimeout(hideT);
        if (current === li) return;
        if (current) shut(current);
        current = li;
        li.classList.add('is-open');
        linkFor(li).setAttribute('aria-expanded', 'true');
        var p = panelFor(li);
        if (p) p.classList.add('is-open');
        navEl.classList.add('mega-open');
        sizeDrawer();
    }
    function shut(li) {
        li.classList.remove('is-open');
        linkFor(li).setAttribute('aria-expanded', 'false');
        var p = panelFor(li);
        if (p) p.classList.remove('is-open');
    }
    function closeAll() {
        clearTimeout(hideT);
        if (!current) return;
        shut(current);
        current = null;
        navEl.classList.remove('mega-open');
        sizeDrawer();
    }
    function delayedClose() {
        clearTimeout(hideT);
        hideT = setTimeout(closeAll, 140);
    }
    function within(target) {
        if (!current) return false;
        var p = panelFor(current);
        return current.contains(target) || (p && p.contains(target));
    }

    triggers.forEach(function (li) {
        var link = linkFor(li);
        var panel = panelFor(li);
        if (!link || !panel) return;

        li.addEventListener('mouseenter', function () { open(li); });
        li.addEventListener('mouseleave', delayedClose);
        panel.addEventListener('mouseenter', function () { open(li); });
        panel.addEventListener('mouseleave', delayedClose);

        link.addEventListener('click', function (e) {
            e.preventDefault();
            if (current === li) closeAll(); else open(li);
        });
        link.addEventListener('focus', function () { open(li); });

        panel.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', closeAll);
        });
    });

    document.addEventListener('focusin', function (e) {
        if (current && !within(e.target)) closeAll();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && current) {
            var link = linkFor(current);
            closeAll();
            if (link) link.focus();
        }
    });
    document.addEventListener('click', function (e) {
        if (current && !within(e.target)) closeAll();
    });
    window.addEventListener('scroll', function () { if (current) closeAll(); }, { passive: true });
    // The pill's width breathes with the viewport; keep an open drawer snug.
    window.addEventListener('resize', function () { if (current) sizeDrawer(); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMegaNav, { once: true });
    } else {
        initMegaNav();
    }
    document.addEventListener('astro:page-load', initMegaNav);
})();
