/* ============================================================================
   Streetbeat - interactive office globe (amCharts 5)
   A draggable orthographic (3D) world map of Streetbeat locations.

   - Real vector countries (am5geodata_worldLow) so the map actually reads.
   - Each location is a small dot on the sphere (green = office, cyan = team);
     office pins carry a resting translucent halo so the HQ anchors read
     heavier than the plain people dots.
   - The cities are listed as cards in two centered clusters flanking the globe
     (offices left, team right) - authored in the markup, no connectors.
   - Hover relational state: hovering a card OR its dot lights the pair - the
     card scales up while its siblings fade (CSS), and the matching dot grows
     (JS). Works in both directions.
   - Drag to spin (fling inertia). The clusters stay put as the globe rotates.
   - On narrow screens the clusters are hidden for a grouped text list.

   Brand styling lives in CONFIG below.
   ========================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    // colors (brand) - hexes mirror tokens.css primitives (amCharts needs
    // numeric colors, so the var() indirection can't be used here).
    sphereFill: 0xfafafa,   // ocean / sphere background → --c-neutral-50
    landFill: 0xe0e1e3,     // countries → --c-neutral-200 (lighter field so pins pop)
    landStroke: 0xffffff,   // country borders
    graticule: 0xe0e1e3,    // lat/long grid lines → --c-neutral-200
    marker: 0x00cc4f,       // --accent-green  → offices (HQ / anchor locations)
    markerGlow: 0x46fe8d,   // --accent-green-bright → office pulse core
    markerPeople: 0x04b2af, // --accent-cyan   → distributed team members
    markerPeopleGlow: 0x3ff0ed, // brighter cyan → people pulse core
    // framing (fixed at rest)
    // centers ~ -50° lng + slight northern tilt so every location, from Palo Alto
    // (-122°) across to Wrocław (+17°), sits on the visible front hemisphere.
    rotationX: 50,
    rotationY: -12,
    // drag-fling inertia (carousel-style decay)
    flingTau: 700,          // ms - higher = longer, smoother glide after release
    maxFling: 0.6,          // cap on release speed (deg/ms)
    minFling: 0.003,        // stop momentum below this speed (deg/ms)
    tiltClamp: 80,          // max vertical tilt (deg) so it can't flip over a pole
    // pin geometry - offices are ringed anchors, people are plain smaller dots
    dotRadiusOffice: 4.5,
    dotRadiusPeople: 3,
    haloRadius: 10,         // resting translucent halo behind office pins
    haloOpacity: 0.14,
    hoverGrow: 1.6,         // radius multiplier on hover (radius, not scale -
                            // keeps the mark's weight constant while it grows)
    dimOpacity: 0.25,       // non-hovered dots fade back (mirrors the label fade)
    pulseScale: 3.4,        // how far the gradient pulse ring expands
    pulseDuration: 1500,    // ms per pulse loop
    frameDuration: 1100,    // ms to spin-and-frame a clicked location
  };

  // Streetbeat locations - order MUST match the data-idx values in the markup.
  // type: 'office' = a Streetbeat office (green); 'people' = where distributed
  // team members are based (amber).
  var OFFICES = [
    { name: 'Palo Alto',      lng: -122.14, lat: 37.44,  type: 'office' }, // 0
    { name: 'Milan',          lng: 9.19,    lat: 45.46,  type: 'office' }, // 1
    { name: 'Wrocław',        lng: 17.04,   lat: 51.11,  type: 'office' }, // 2
    { name: 'Mexico City',    lng: -99.13,  lat: 19.43,  type: 'people' }, // 3
    { name: 'São Paulo',      lng: -46.63,  lat: -23.55, type: 'people' }, // 4
    { name: 'Madrid',         lng: -3.70,   lat: 40.42,  type: 'people' }, // 5
    { name: 'Lucca',          lng: 10.50,   lat: 43.84,  type: 'people' }, // 6
    { name: 'Florence',       lng: 11.26,   lat: 43.77,  type: 'people' }, // 7
    { name: 'Zagreb',         lng: 15.98,   lat: 45.81,  type: 'people' }, // 8
    { name: 'Sarajevo',       lng: 18.36,   lat: 43.85,  type: 'people' }, // 9
  ];

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function build() {
    if (!window.am5 || !window.am5map || !window.am5geodata_worldLow) return;

    var stage = document.getElementById('officeGlobe');
    /* per-element guard (not a module flag): with a client-side router the
       stage is a FRESH element on each visit, so a rebuilt page re-inits
       while a double fire on the same DOM stays a no-op. */
    if (!stage || stage.dataset.sbGlobe) return;
    stage.dataset.sbGlobe = '1';
    var figure = stage.closest('.globe-figure');
    var cards = Array.prototype.slice.call(figure.querySelectorAll('.globe-label'));

    var root = am5.Root.new('officeGlobe');
    root._logo && root._logo.dispose(); // hide amCharts logo if present
    root.setThemes([am5themes_Animated.new(root)]);

    var chart = root.container.children.push(am5map.MapChart.new(root, {
      panX: 'rotateX',
      panY: 'rotateY',
      projection: am5map.geoOrthographic(),
      rotationX: CONFIG.rotationX,
      rotationY: CONFIG.rotationY,
      // lock zoom: rotation only, so page scroll/wheel is never hijacked
      minZoomLevel: 1,
      maxZoomLevel: 1,
      wheelX: 'none',
      wheelY: 'none',
      paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8,
    }));

    // Sphere background (the "ocean")
    var bgSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {}));
    bgSeries.mapPolygons.template.setAll({
      fill: am5.color(CONFIG.sphereFill),
      fillOpacity: 1,
      strokeOpacity: 0,
    });
    bgSeries.data.push({ geometry: am5map.getGeoRectangle(90, 180, -90, -180) });

    // Graticule (lat/long grid)
    var graticule = chart.series.push(am5map.GraticuleSeries.new(root, { step: 15 }));
    graticule.mapLines.template.setAll({
      stroke: am5.color(CONFIG.graticule),
      strokeOpacity: 0.5,
      strokeWidth: 0.5,
    });

    // Countries
    var polygonSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {
      geoJSON: am5geodata_worldLow,
    }));
    polygonSeries.mapPolygons.template.setAll({
      fill: am5.color(CONFIG.landFill),
      stroke: am5.color(CONFIG.landStroke),
      strokeWidth: 0.5,
      strokeOpacity: 0.6,
    });

    // ---------------------------------------------------------------------
    // Hover relational state (pin ↔ card), wired both directions.
    // ---------------------------------------------------------------------
    var dotByIndex = [];
    var nodeByIndex = [];    // whole bullet container (dot + halo) - dimmed as one
    var baseRadius = [];
    var pulseByIndex = [];
    var pulseAnim = [];

    // Grow the radius, not the scale - the mark keeps its visual weight.
    function setDotGrow(idx, mult) {
      var dot = dotByIndex[idx];
      if (!dot) return;
      var to = baseRadius[idx] * mult;
      if (reduced) { dot.set('radius', to); return; }
      dot.animate({ key: 'radius', to: to, duration: 220, easing: am5.ease.out(am5.ease.cubic) });
    }

    function setDotOpacity(idx, to) {
      var node = nodeByIndex[idx];
      if (!node) return;
      if (reduced) { node.set('opacity', to); return; }
      node.animate({ key: 'opacity', to: to, duration: 220, easing: am5.ease.out(am5.ease.cubic) });
    }

    // Looping gradient "sonar" pulse behind the hovered dot.
    function startPulse(idx) {
      var p = pulseByIndex[idx];
      if (!p || reduced) return;
      stopPulse(idx);
      p.set('forceHidden', false);
      pulseAnim[idx] = [
        p.animate({ key: 'scale', from: 0.8, to: CONFIG.pulseScale, duration: CONFIG.pulseDuration, loops: Infinity, easing: am5.ease.out(am5.ease.cubic) }),
        p.animate({ key: 'opacity', from: 0.6, to: 0, duration: CONFIG.pulseDuration, loops: Infinity, easing: am5.ease.out(am5.ease.cubic) }),
      ];
    }

    function stopPulse(idx) {
      var anims = pulseAnim[idx];
      if (anims) { anims.forEach(function (a) { if (a && a.stop) a.stop(); }); pulseAnim[idx] = null; }
      var p = pulseByIndex[idx];
      if (p) { p.set('opacity', 0); p.set('scale', 0.8); }
    }

    function activate(idx) {
      figure.classList.add('is-hovering');
      cards.forEach(function (c) {
        c.classList.toggle('is-active', +c.dataset.idx === idx);
      });
      // hovered dot grows + pulses; every other dot fades back (like the type).
      dotByIndex.forEach(function (d, i) {
        if (i === idx) return;
        setDotGrow(i, 1);
        setDotOpacity(i, CONFIG.dimOpacity);
        stopPulse(i);
      });
      setDotGrow(idx, CONFIG.hoverGrow);
      setDotOpacity(idx, 1);
      startPulse(idx);
    }

    function deactivate() {
      figure.classList.remove('is-hovering');
      cards.forEach(function (c) { c.classList.remove('is-active'); });
      dotByIndex.forEach(function (d, i) {
        setDotGrow(i, 1);
        setDotOpacity(i, 1);
        stopPulse(i);
      });
    }

    // Location dots - small anchors that grow when their pair is hovered.
    var pointSeries = chart.series.push(am5map.MapPointSeries.new(root, {}));
    pointSeries.bullets.push(function (root, series, dataItem) {
      var ctx = dataItem.dataContext;
      var isOffice = (ctx.kind === 'office');
      var accent = isOffice ? CONFIG.marker : CONFIG.markerPeople;
      var glow = isOffice ? CONFIG.markerGlow : CONFIG.markerPeopleGlow;

      var container = am5.Container.new(root, {});

      // Resting halo - offices only. A soft translucent ring that anchors the
      // HQ pins in the map (people stay plain smaller dots), and makes the
      // hover pulse read as an amplification of something already there.
      if (isOffice) {
        container.children.push(am5.Circle.new(root, {
          radius: CONFIG.haloRadius,
          fill: am5.color(accent),
          fillOpacity: CONFIG.haloOpacity,
          strokeOpacity: 0,
          forceInactive: true,
        }));
      }

      // Gradient pulse ring - sits behind the dot, hidden until hover.
      var pulse = am5.Circle.new(root, {
        radius: isOffice ? 5 : 4,
        fill: am5.color(accent),
        fillGradient: am5.RadialGradient.new(root, {
          stops: [
            { color: am5.color(glow), opacity: 0.9 },
            { color: am5.color(accent), opacity: 0 },
          ],
        }),
        strokeOpacity: 0,
        opacity: 0,
        scale: 0.8,
        forceInactive: true,
      });

      // Solid core - no hard white stroke; depth comes from the halo instead.
      var radius = isOffice ? CONFIG.dotRadiusOffice : CONFIG.dotRadiusPeople;
      var circle = am5.Circle.new(root, {
        radius: radius,
        fill: am5.color(accent),
        strokeOpacity: 0,
        cursorOverStyle: 'pointer',
      });

      container.children.push(pulse);
      container.children.push(circle);

      dotByIndex[ctx.idx] = circle;
      nodeByIndex[ctx.idx] = container;
      baseRadius[ctx.idx] = radius;
      pulseByIndex[ctx.idx] = pulse;
      circle.events.on('pointerover', function () { activate(ctx.idx); });
      circle.events.on('pointerout', function () { deactivate(); });
      circle.events.on('click', function () { frameLocation(ctx.idx); });
      return am5.Bullet.new(root, { sprite: container });
    });

    OFFICES.forEach(function (o, i) {
      pointSeries.data.push({
        geometry: { type: 'Point', coordinates: [o.lng, o.lat] },
        title: o.name,
        kind: o.type,
        idx: i,
      });
    });

    cards.forEach(function (c) {
      var idx = +c.dataset.idx;
      c.addEventListener('mouseenter', function () { activate(idx); });
      c.addEventListener('mouseleave', function () { deactivate(); });
      c.addEventListener('click', function () { frameLocation(idx); });
    });

    // --- Drag-fling inertia (the clusters stay put) ---
    var dragging = false;
    var velX = 0, velY = 0;
    var lastRX = 0, lastRY = 0, lastT = 0;
    var flingRAF = null;

    function clampTilt(y) {
      return Math.max(-CONFIG.tiltClamp, Math.min(CONFIG.tiltClamp, y));
    }

    function sampleVelocity() {
      if (!dragging) return;
      var now = performance.now();
      var rx = chart.get('rotationX', 0);
      var ry = chart.get('rotationY', 0);
      var dt = now - lastT;
      if (dt > 0) {
        var nvx = (rx - lastRX) / dt;
        var nvy = (ry - lastRY) / dt;
        velX = velX * 0.55 + nvx * 0.45;
        velY = velY * 0.55 + nvy * 0.45;
      }
      lastRX = rx; lastRY = ry; lastT = now;
      requestAnimationFrame(sampleVelocity);
    }

    function stopFling() {
      if (flingRAF) { cancelAnimationFrame(flingRAF); flingRAF = null; }
    }

    function startFling() {
      if (reduced) return;
      velX = Math.max(-CONFIG.maxFling, Math.min(CONFIG.maxFling, velX));
      velY = Math.max(-CONFIG.maxFling, Math.min(CONFIG.maxFling, velY));
      var prev = performance.now();
      function step() {
        var now = performance.now();
        var dt = now - prev;
        prev = now;
        var rx = chart.get('rotationX', 0) + velX * dt;
        var ry = clampTilt(chart.get('rotationY', 0) + velY * dt);
        chart.set('rotationX', rx);
        chart.set('rotationY', ry);
        if (ry === CONFIG.tiltClamp || ry === -CONFIG.tiltClamp) velY = 0;
        var decay = Math.exp(-dt / CONFIG.flingTau);
        velX *= decay;
        velY *= decay;
        if (Math.abs(velX) < CONFIG.minFling && Math.abs(velY) < CONFIG.minFling) {
          flingRAF = null;
          return;
        }
        flingRAF = requestAnimationFrame(step);
      }
      flingRAF = requestAnimationFrame(step);
    }

    chart.chartContainer.events.on('pointerdown', function () {
      stopFling();
      dragging = true;
      velX = velY = 0;
      lastRX = chart.get('rotationX', 0);
      lastRY = chart.get('rotationY', 0);
      lastT = performance.now();
      requestAnimationFrame(sampleVelocity);
    });

    window.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false;
      startFling();
    });

    // --- Click to frame: spin the globe so the chosen location sits dead-center.
    // No persistent selection state - this is purely the spin-and-frame gesture.
    function frameLocation(idx) {
      var o = OFFICES[idx];
      if (!o) return;
      stopFling();
      // Orthographic: visible center lng = -rotationX, center lat = -rotationY.
      var curX = chart.get('rotationX', 0);
      var targetX = -o.lng;
      while (targetX - curX > 180) targetX -= 360;   // take the shortest spin
      while (targetX - curX < -180) targetX += 360;
      var targetY = clampTilt(-o.lat);
      if (reduced) {
        chart.set('rotationX', targetX);
        chart.set('rotationY', targetY);
        return;
      }
      chart.animate({ key: 'rotationX', to: targetX, duration: CONFIG.frameDuration, easing: am5.ease.inOut(am5.ease.cubic) });
      chart.animate({ key: 'rotationY', to: targetY, duration: CONFIG.frameDuration, easing: am5.ease.inOut(am5.ease.cubic) });
    }

    chart.appear(900, 100);
  }

  function init() {
    var stage = document.getElementById('officeGlobe');
    if (!stage || stage.dataset.sbGlobe) return;

    if (!('IntersectionObserver' in window)) { build(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { io.disconnect(); build(); }
      });
    }, { rootMargin: '200px' });
    io.observe(stage);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Astro ClientRouter hook: pages re-arm the globe on astro:page-load. */
  window.__initOfficeGlobe = init;
})();
