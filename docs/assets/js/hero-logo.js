/* ============================================================================
   Streetbeat hero - exact GLB logo + hybrid construction reveal
   - Loads the authored logo while the wordmark loader is running.
   - Evolves through the real mesh topology from structural tips, with the
     matte, token-driven green→teal→cyan surface following directly behind the
     moving wirefront as one continuous reveal.
   - Keeps the orbital guides, mesh hover, drag-to-spin, mobile treatment,
     parallax seam, off-screen pause, and baked-video fallback.
   - Cleans up every renderer/listener/resource on Astro client navigation.
   ========================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CONFIG = {
  spinIdle: 0.28,
  spinHover: 0.06,
  lineExpand: 0.2,
  ease: 3.5,
  camZ: 6.3,
  fov: 34,
  scale: 0.56,
  offsetX: 1.9,
  offsetY: -0.7,
  dragSensitivity: 0.0024,
  dragDamping: 7,
  dragMaxSpeed: 1,
  modelDiameter: 3.2,
};

const coarse = window.matchMedia('(pointer: coarse)').matches;
const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileMQ = window.matchMedia('(max-width: 680px)');

let everInit = false;

function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function easeOutCubic(value) {
  const p = 1 - clamp(value);
  return 1 - p * p * p;
}

function smoothstep(edge0, edge1, value) {
  const p = clamp((value - edge0) / (edge1 - edge0));
  return p * p * (3 - 2 * p);
}

function resolveTokenColor(token) {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  probe.style.position = 'fixed';
  probe.style.visibility = 'hidden';
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return new THREE.Color().setStyle(resolved);
}

function resolveGradientStops(token) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const matches = [...raw.matchAll(/(#[\da-f]{3,8}|rgba?\([^)]+\))\s+([\d.]+)%/gi)];
  if (matches.length !== 16) {
    throw new Error(`${token} must contain exactly sixteen color stops.`);
  }
  return {
    colors: matches.map((match) => new THREE.Color().setStyle(match[1])),
    stops: matches.map((match) => Number(match[2]) / 100),
  };
}

function resolveTokenNumber(token, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token);
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function resolveTokenPixels(token, fallback) {
  const probe = document.createElement('span');
  probe.style.position = 'fixed';
  probe.style.visibility = 'hidden';
  probe.style.width = `var(${token})`;
  document.body.appendChild(probe);
  const value = parseFloat(getComputedStyle(probe).width);
  probe.remove();
  return Number.isFinite(value) ? value : fallback;
}

function resolveTokenDuration(token, fallbackMs) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return fallbackMs;
  return raw.endsWith('ms') ? value : value * 1000;
}

/* Place + size the complete model/guides group for the current viewport. */
function applyLayout(container, camera, viewportHeight, dropPx = 0, variant = 'default') {
  const halfH = Math.tan((CONFIG.fov * Math.PI) / 180 / 2) * CONFIG.camZ;
  const dropWorld = viewportHeight > 0 ? dropPx * ((halfH * 2) / viewportHeight) : 0;

  if (variant === 'monument') {
    const monumentScale = resolveTokenNumber('--hero-logo-monument-scale', 2.35);
    container.scale.setScalar(monumentScale);
    container.position.x = 0;
    container.position.y = 0;
    return;
  }

  if (mobileMQ.matches) {
    container.scale.setScalar(0.46);
    container.position.x = 0;
    container.position.y = 0.95 - dropWorld;
    return;
  }

  const aspect = camera ? camera.aspect : 16 / 9;
  const halfW = halfH * aspect;
  const scaleMin = 0.46;
  const t = clamp((halfW - 1.7) / (3.0 - 1.7));
  const scale = scaleMin + (CONFIG.scale - scaleMin) * t;

  container.scale.setScalar(scale);
  const formExtent = (CONFIG.modelDiameter / 2) * scale + 0.15;
  container.position.x = Math.min(CONFIG.offsetX, halfW - formExtent);
  container.position.y = CONFIG.offsetY - dropWorld;
}

function createSurfaceMaterial(surfaceGradient) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    uniforms: {
      uColorMix: { value: 0 },
      uReveal: { value: 0 },
      uGradientColors: { value: surfaceGradient.colors },
      uGradientStops: { value: surfaceGradient.stops },
    },
    vertexShader: /* glsl */`
      attribute float aBuildOrder;
      attribute vec2 aGradientPosition;
      varying vec3 vN;
      varying vec3 vView;
      varying vec2 vGradientPosition;
      varying float vBuildOrder;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - worldPosition.xyz);
        vGradientPosition = aGradientPosition;
        vBuildOrder = aBuildOrder;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uColorMix;
      uniform float uReveal;
      uniform vec3 uGradientColors[16];
      uniform float uGradientStops[16];
      varying vec3 vN;
      varying vec3 vView;
      varying vec2 vGradientPosition;
      varying float vBuildOrder;

      float gradientMix(float t, float start, float end) {
        return clamp((t - start) / max(end - start, 0.0001), 0.0, 1.0);
      }

      vec3 sampleGradient(float t) {
        if (t <= uGradientStops[0]) return uGradientColors[0];
        if (t <= uGradientStops[1]) return mix(uGradientColors[0], uGradientColors[1], gradientMix(t, uGradientStops[0], uGradientStops[1]));
        if (t <= uGradientStops[2]) return mix(uGradientColors[1], uGradientColors[2], gradientMix(t, uGradientStops[1], uGradientStops[2]));
        if (t <= uGradientStops[3]) return mix(uGradientColors[2], uGradientColors[3], gradientMix(t, uGradientStops[2], uGradientStops[3]));
        if (t <= uGradientStops[4]) return mix(uGradientColors[3], uGradientColors[4], gradientMix(t, uGradientStops[3], uGradientStops[4]));
        if (t <= uGradientStops[5]) return mix(uGradientColors[4], uGradientColors[5], gradientMix(t, uGradientStops[4], uGradientStops[5]));
        if (t <= uGradientStops[6]) return mix(uGradientColors[5], uGradientColors[6], gradientMix(t, uGradientStops[5], uGradientStops[6]));
        if (t <= uGradientStops[7]) return mix(uGradientColors[6], uGradientColors[7], gradientMix(t, uGradientStops[6], uGradientStops[7]));
        if (t <= uGradientStops[8]) return mix(uGradientColors[7], uGradientColors[8], gradientMix(t, uGradientStops[7], uGradientStops[8]));
        if (t <= uGradientStops[9]) return mix(uGradientColors[8], uGradientColors[9], gradientMix(t, uGradientStops[8], uGradientStops[9]));
        if (t <= uGradientStops[10]) return mix(uGradientColors[9], uGradientColors[10], gradientMix(t, uGradientStops[9], uGradientStops[10]));
        if (t <= uGradientStops[11]) return mix(uGradientColors[10], uGradientColors[11], gradientMix(t, uGradientStops[10], uGradientStops[11]));
        if (t <= uGradientStops[12]) return mix(uGradientColors[11], uGradientColors[12], gradientMix(t, uGradientStops[11], uGradientStops[12]));
        if (t <= uGradientStops[13]) return mix(uGradientColors[12], uGradientColors[13], gradientMix(t, uGradientStops[12], uGradientStops[13]));
        if (t <= uGradientStops[14]) return mix(uGradientColors[13], uGradientColors[14], gradientMix(t, uGradientStops[13], uGradientStops[14]));
        if (t <= uGradientStops[15]) return mix(uGradientColors[14], uGradientColors[15], gradientMix(t, uGradientStops[14], uGradientStops[15]));
        return uGradientColors[15];
      }

      void main() {
        float distanceBehind = uReveal - vBuildOrder;
        if (distanceBehind < 0.0) discard;

        vec3 normal = normalize(vN);
        if (!gl_FrontFacing) normal = -normal;
        vec3 viewDirection = normalize(vView);
        vec3 lightDirection = normalize(vec3(0.45, 0.85, 0.55));

        float wrappedDiffuse = clamp(dot(normal, lightDirection) * 0.42 + 0.58, 0.0, 1.0);
        float rim = pow(1.0 - clamp(dot(normal, viewDirection), 0.0, 1.0), 2.0);
        float broadHighlight = pow(max(dot(reflect(-lightDirection, normal), viewDirection), 0.0), 8.0);
        float gradientPosition = fract(atan(vGradientPosition.x, vGradientPosition.y) / 6.28318530718 - 0.25);
        vec3 gradientColor = sampleGradient(gradientPosition);
        float light = 0.90 + 0.10 * wrappedDiffuse;
        vec3 body = gradientColor * light;
        vec3 matte = body + gradientColor * rim * 0.025 + vec3(broadHighlight) * 0.015;
        vec3 interactive = matte * 1.025 + gradientColor * 0.01;
        vec3 color = mix(matte, interactive, uColorMix);

        float veil = 0.18;
        float alpha = smoothstep(0.0, veil, distanceBehind);
        float edgeGlow = 1.0 - smoothstep(0.0, veil, distanceBehind);
        color += uGradientColors[12] * edgeGlow * 0.72;
        alpha = clamp(alpha + edgeGlow * 0.58, 0.0, 1.0);
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
}

const BUILD_WELD_PRECISION = 10000;

function buildPositionKey(x, y, z) {
  return `${Math.round(x * BUILD_WELD_PRECISION)},${Math.round(y * BUILD_WELD_PRECISION)},${Math.round(z * BUILD_WELD_PRECISION)}`;
}

function pushDistance(heap, entry) {
  heap.push(entry);
  let child = heap.length - 1;
  while (child > 0) {
    const parent = Math.floor((child - 1) / 2);
    if (heap[parent][0] <= entry[0]) break;
    heap[child] = heap[parent];
    child = parent;
  }
  heap[child] = entry;
}

function popDistance(heap) {
  if (!heap.length) return null;
  const first = heap[0];
  const last = heap.pop();
  if (!heap.length) return first;
  let parent = 0;
  while (true) {
    const left = parent * 2 + 1;
    const right = left + 1;
    if (left >= heap.length) break;
    const child = right < heap.length && heap[right][0] < heap[left][0] ? right : left;
    if (heap[child][0] >= last[0]) break;
    heap[parent] = heap[child];
    parent = child;
  }
  heap[parent] = last;
  return first;
}

function addStructuralBuildOrder(geometry) {
  const position = geometry.getAttribute('position');
  if (!position) return;
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  const structuralExtent = geometry.boundingBox.getSize(new THREE.Vector3());
  const structuralAnchor = new THREE.Vector3(
    center.x - structuralExtent.x * 0.12,
    center.y + structuralExtent.y * 0.08,
    geometry.boundingBox.max.z,
  );

  /* Weld coincident GLB vertices into topology nodes. Authored hard edges often
     duplicate a position for different normals/UVs; treating those copies as
     disconnected would make the reveal restart at every shading seam. */
  const nodeByPosition = new Map();
  const nodes = [];
  const vertexNodes = new Uint32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const key = buildPositionKey(x, y, z);
    let nodeIndex = nodeByPosition.get(key);
    if (nodeIndex === undefined) {
      nodeIndex = nodes.length;
      nodeByPosition.set(key, nodeIndex);
      nodes.push({ position: new THREE.Vector3(x, y, z), neighbors: new Map() });
    }
    vertexNodes[i] = nodeIndex;
  }

  const connect = (a, b) => {
    if (a === b) return;
    const distance = nodes[a].position.distanceTo(nodes[b].position);
    const previousAB = nodes[a].neighbors.get(b);
    const previousBA = nodes[b].neighbors.get(a);
    if (previousAB === undefined || distance < previousAB) nodes[a].neighbors.set(b, distance);
    if (previousBA === undefined || distance < previousBA) nodes[b].neighbors.set(a, distance);
  };
  const index = geometry.index;
  const triangleCount = index ? index.count : position.count;
  for (let i = 0; i + 2 < triangleCount; i += 3) {
    const a = vertexNodes[index ? index.getX(i) : i];
    const b = vertexNodes[index ? index.getX(i + 1) : i + 1];
    const c = vertexNodes[index ? index.getX(i + 2) : i + 2];
    connect(a, b);
    connect(b, c);
    connect(c, a);
  }

  const distances = new Float64Array(nodes.length);
  distances.fill(Infinity);
  const visited = new Uint8Array(nodes.length);

  /* Each disconnected authored shell receives a root near a shared, visible
     front-face anchor. Dijkstra then advances by surface-edge length, so bends
     and separate blades determine the motion instead of a synthetic radius
     from the object's centre. */
  for (let start = 0; start < nodes.length; start++) {
    if (visited[start]) continue;
    const component = [];
    const stack = [start];
    visited[start] = 1;
    while (stack.length) {
      const current = stack.pop();
      component.push(current);
      nodes[current].neighbors.forEach((_, neighbor) => {
        if (visited[neighbor]) return;
        visited[neighbor] = 1;
        stack.push(neighbor);
      });
    }

    let root = component[0];
    let rootScore = Infinity;
    component.forEach((nodeIndex) => {
      const point = nodes[nodeIndex].position;
      const dx = (point.x - structuralAnchor.x) / Math.max(structuralExtent.x, 0.0001);
      const dy = (point.y - structuralAnchor.y) / Math.max(structuralExtent.y, 0.0001);
      const dz = (point.z - structuralAnchor.z) / Math.max(structuralExtent.z, 0.0001);
      const score = dx * dx + dy * dy + dz * dz * 0.35;
      if (score < rootScore) {
        root = nodeIndex;
        rootScore = score;
      }
    });

    const heap = [];
    pushDistance(heap, [0, root]);
    distances[root] = 0;
    let maxDistance = 0;
    while (heap.length) {
      const [distance, current] = popDistance(heap);
      if (distance !== distances[current]) continue;
      maxDistance = Math.max(maxDistance, distance);
      nodes[current].neighbors.forEach((weight, neighbor) => {
        const nextDistance = distance + weight;
        if (nextDistance >= distances[neighbor]) return;
        distances[neighbor] = nextDistance;
        pushDistance(heap, [nextDistance, neighbor]);
      });
    }

    const safeMaxDistance = maxDistance || 1;
    component.forEach((nodeIndex) => {
      const point = nodes[nodeIndex].position;
      const structuralProgress = distances[nodeIndex] / safeMaxDistance;
      const variation = (deterministicNoise(point.x, point.y, point.z) - 0.5)
        * 0.045 * structuralProgress * (1 - structuralProgress);
      distances[nodeIndex] = clamp(structuralProgress + variation);
    });
  }

  const order = new Float32Array(position.count);
  const gradientPosition = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    order[i] = distances[vertexNodes[i]];
    gradientPosition[i * 2] = position.getX(i) - center.x;
    gradientPosition[i * 2 + 1] = position.getY(i) - center.y;
  }
  geometry.setAttribute('aBuildOrder', new THREE.BufferAttribute(order, 1));
  geometry.setAttribute('aGradientPosition', new THREE.BufferAttribute(gradientPosition, 2));
}

function createWireMaterial(palette, maxOpacity) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uBuild: { value: 0 },
      uOpacity: { value: 0 },
      uMaxOpacity: { value: maxOpacity },
      uColor: { value: palette.lineHot },
      uColorLower: { value: palette.lineLower },
    },
    vertexShader: /* glsl */`
      attribute float aLineOrder;
      attribute vec2 aLineGradientPosition;
      varying float vLineOrder;
      varying vec2 vLineGradientPosition;
      void main() {
        vLineOrder = aLineOrder;
        vLineGradientPosition = aLineGradientPosition;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uBuild;
      uniform float uOpacity;
      uniform float uMaxOpacity;
      uniform vec3 uColor;
      uniform vec3 uColorLower;
      varying float vLineOrder;
      varying vec2 vLineGradientPosition;
      void main() {
        float drawn = 1.0 - smoothstep(uBuild, uBuild + 0.025, vLineOrder);
        float head = 1.0 - smoothstep(0.0, 0.075, abs(uBuild - vLineOrder));
        float alpha = drawn * uOpacity * uMaxOpacity * (0.58 + head * 0.72);
        if (alpha < 0.01) discard;
        float gradientPosition = fract(atan(vLineGradientPosition.x, vLineGradientPosition.y) / 6.28318530718 - 0.25);
        float cyanEntry = smoothstep(0.02, 0.06, gradientPosition);
        float cyanExit = 1.0 - smoothstep(0.43, 0.47, gradientPosition);
        float cyanSector = min(cyanEntry, cyanExit);
        vec3 lineColor = mix(uColor, uColorLower, cyanSector);
        gl_FragColor = vec4(lineColor + lineColor * head * 0.55, clamp(alpha, 0.0, 1.0));
      }
    `,
  });
}

function deterministicNoise(x, y, z) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function createWireOverlay(mesh, material) {
  const wireGeometry = new THREE.WireframeGeometry(mesh.geometry);
  const position = wireGeometry.getAttribute('position');
  const sourcePosition = mesh.geometry.getAttribute('position');
  const sourceOrder = mesh.geometry.getAttribute('aBuildOrder');
  const sourceGradientPosition = mesh.geometry.getAttribute('aGradientPosition');
  const orderByPosition = new Map();
  const gradientByPosition = new Map();
  for (let i = 0; i < sourcePosition.count; i++) {
    const key = buildPositionKey(sourcePosition.getX(i), sourcePosition.getY(i), sourcePosition.getZ(i));
    orderByPosition.set(key, sourceOrder.getX(i));
    gradientByPosition.set(key, [sourceGradientPosition.getX(i), sourceGradientPosition.getY(i)]);
  }

  const order = new Float32Array(position.count);
  const gradientPosition = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const key = buildPositionKey(position.getX(i), position.getY(i), position.getZ(i));
    order[i] = orderByPosition.get(key) ?? 0;
    const gradient = gradientByPosition.get(key) ?? [0, 0];
    gradientPosition[i * 2] = gradient[0];
    gradientPosition[i * 2 + 1] = gradient[1];
  }
  wireGeometry.setAttribute('aLineOrder', new THREE.BufferAttribute(order, 1));
  wireGeometry.setAttribute('aLineGradientPosition', new THREE.BufferAttribute(gradientPosition, 2));

  const wire = new THREE.LineSegments(wireGeometry, material);
  wire.renderOrder = 4;
  wire.scale.setScalar(1.0015);
  wire.frustumCulled = false;
  mesh.add(wire);
  return wire;
}

function prepareModel(gltf, spinner, surfaceMaterial, wireMaterial) {
  const model = gltf.scene;
  const normalized = new THREE.Group();
  const meshes = [];
  const wires = [];

  model.traverse((object) => {
    if (!object.isMesh) return;
    addStructuralBuildOrder(object.geometry);
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
    else object.material?.dispose();
    object.material = surfaceMaterial;
    object.castShadow = false;
    object.receiveShadow = false;
    meshes.push(object);
    wires.push(createWireOverlay(object, wireMaterial));
  });
  if (!meshes.length) throw new Error('Streetbeat logo GLB contains no meshes.');

  normalized.add(model);
  normalized.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  model.position.sub(center);
  normalized.scale.setScalar(maxDimension > 0 ? CONFIG.modelDiameter / maxDimension : 1);
  normalized.updateMatrixWorld(true);
  spinner.add(normalized);

  return { model: normalized, meshes, wires };
}

function buildConstructionLines(palette, baseAlpha) {
  const group = new THREE.Group();
  const uniforms = {
    uTime: { value: 0 },
    uHover: { value: 0 },
    uReveal: { value: 0 },
    uSpeed: { value: 0.16 },
    uBaseAlpha: { value: baseAlpha },
    uColorIdle: { value: palette.lineIdle },
    uColorHot: { value: palette.lineHot },
  };

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms,
    vertexShader: /* glsl */`
      attribute float aLen;
      attribute float aSeed;
      attribute float aSpeed;
      varying float vLen;
      varying float vSeed;
      varying float vSpeed;
      void main() {
        vLen = aLen;
        vSeed = aSeed;
        vSpeed = aSpeed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uTime;
      uniform float uHover;
      uniform float uReveal;
      uniform float uSpeed;
      uniform float uBaseAlpha;
      uniform vec3 uColorIdle;
      uniform vec3 uColorHot;
      varying float vLen;
      varying float vSeed;
      varying float vSpeed;
      void main() {
        float introAlpha = smoothstep(0.0, 1.0, uReveal);
        float head = fract(uTime * uSpeed * vSpeed + vSeed);
        float behind = fract(head - vLen);
        float trailLength = 0.42 + 0.16 * uHover;
        float trail = pow(smoothstep(trailLength, 0.0, behind), 1.5);
        float idleAlpha = (uBaseAlpha + 0.06 * uHover) * introAlpha;
        float glowAlpha = (0.85 + 0.35 * uHover) * trail * introAlpha;
        float alpha = clamp(idleAlpha + glowAlpha, 0.0, 1.0);
        if (alpha < 0.01) discard;
        vec3 color = mix(uColorIdle, uColorHot, trail);
        color += uColorHot * trail * (0.55 + 0.45 * uHover);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  const addPath = (points, seedValue, speed) => {
    const count = points.length;
    const positions = new Float32Array(count * 3);
    const lengths = new Float32Array(count);
    const seeds = new Float32Array(count);
    const speeds = new Float32Array(count);
    let total = 0;
    const cumulative = [0];
    for (let i = 1; i < count; i++) {
      total += points[i].distanceTo(points[i - 1]);
      cumulative.push(total);
    }
    for (let i = 0; i < count; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = points[i].z;
      lengths[i] = total > 0 ? cumulative[i] / total : 0;
      seeds[i] = seedValue;
      speeds[i] = speed;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aLen', new THREE.BufferAttribute(lengths, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    group.add(new THREE.Line(geometry, material));
  };

  const segments = 160;
  const addRing = (radius, rx, ry, rz, seedValue, speed) => {
    const rotation = new THREE.Euler(rx, ry, rz);
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0).applyEuler(rotation));
    }
    addPath(points, seedValue, speed);
  };

  addRing(2.05, 0, 0, 0, 0.0, 1.0);
  addRing(2.05, Math.PI / 2.2, 0.3, 0, 0.33, 0.78);
  addRing(1.7, Math.PI / 2, Math.PI / 3, 0.2, 0.66, 1.22);
  const lineLength = 80;
  addPath([new THREE.Vector3(0, -lineLength, 0), new THREE.Vector3(0, lineLength, 0)], 0.0, 0.5);
  addPath([new THREE.Vector3(-lineLength, 0, 0), new THREE.Vector3(lineLength, 0, 0)], 0.5, 0.5);

  return { group, material, uniforms };
}

/* Monument-only detail pass: the normal canvas keeps the browser-rendered CSS
   blur, while a second transparent WebGL canvas reveals the authored sharp
   wire/build state along a soft trail. This avoids approximating a wide blur
   with a small shader kernel (which can produce visible banding/line echoes). */
const TRAIL_POINT_COUNT = 18;

function createMonumentPostprocess(renderer, deblurRadius, lineRadius, trailOpacity) {
  const sharpTarget = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
  });
  const constructionTarget = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
  });
  sharpTarget.texture.minFilter = THREE.LinearFilter;
  sharpTarget.texture.magFilter = THREE.LinearFilter;
  constructionTarget.texture.minFilter = THREE.LinearFilter;
  constructionTarget.texture.magFilter = THREE.LinearFilter;

  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  const vertexShader = /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;

  const trailPoints = Array.from(
    { length: TRAIL_POINT_COUNT },
    () => new THREE.Vector3(-10, -10, 0),
  );
  const compositeUniforms = {
    tSharp: { value: sharpTarget.texture },
    tConstruction: { value: constructionTarget.texture },
    uAspect: { value: 1 },
    uDeblurRadius: { value: deblurRadius },
    uLineRadius: { value: lineRadius },
    uTrailOpacity: { value: trailOpacity },
    uGlobalConstructionClarity: { value: 0 },
    uTrailPoints: { value: trailPoints },
  };
  const compositeMaterial = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    transparent: true,
    uniforms: compositeUniforms,
    vertexShader,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D tSharp;
      uniform sampler2D tConstruction;
      uniform float uAspect;
      uniform float uDeblurRadius;
      uniform float uLineRadius;
      uniform float uTrailOpacity;
      uniform float uGlobalConstructionClarity;
      uniform vec3 uTrailPoints[${TRAIL_POINT_COUNT}];
      varying vec2 vUv;

      float trailClarity(vec2 uv, float radius) {
        float clarity = 0.0;
        for (int i = 0; i < ${TRAIL_POINT_COUNT}; i++) {
          vec2 delta = uv - uTrailPoints[i].xy;
          delta.x *= uAspect;
          float distanceFromPoint = length(delta);
          float normalizedDistance = distanceFromPoint / max(radius, 0.0001);
          float softFocus = exp(-1.55 * normalizedDistance * normalizedDistance);
          clarity = max(clarity, softFocus * uTrailPoints[i].z);
        }
        return pow(clamp(clarity, 0.0, 1.0), 1.2) * uTrailOpacity;
      }

      void main() {
        vec4 sharp = texture2D(tSharp, vUv);
        vec4 construction = texture2D(tConstruction, vUv);
        float sharpAlpha = sharp.a * trailClarity(vUv, uDeblurRadius);
        float constructionClarity = max(
          trailClarity(vUv, uLineRadius),
          uGlobalConstructionClarity
        );
        float constructionAlpha = construction.a * constructionClarity;
        float alpha = constructionAlpha + sharpAlpha * (1.0 - constructionAlpha);
        vec3 color = alpha > 0.0001
          ? (construction.rgb * constructionAlpha + sharp.rgb * sharpAlpha * (1.0 - constructionAlpha)) / alpha
          : vec3(0.0);
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const compositeScene = new THREE.Scene();
  compositeScene.add(new THREE.Mesh(quadGeometry, compositeMaterial));

  function resize(width, height, pixelRatio) {
    const renderWidth = Math.max(1, Math.round(width * pixelRatio));
    const renderHeight = Math.max(1, Math.round(height * pixelRatio));
    sharpTarget.setSize(renderWidth, renderHeight);
    constructionTarget.setSize(renderWidth, renderHeight);
    compositeUniforms.uAspect.value = width / height;
  }

  function render(scene, camera, enterDetailState, leaveDetailState) {
    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(sharpTarget);
    renderer.clear();
    renderer.render(scene, camera);
    enterDetailState();
    renderer.setRenderTarget(constructionTarget);
    renderer.clear();
    renderer.render(scene, camera);
    leaveDetailState();
    renderer.setRenderTarget(previousTarget);
    renderer.clear();
    renderer.render(compositeScene, postCamera);
  }

  function dispose() {
    sharpTarget.dispose();
    constructionTarget.dispose();
    compositeMaterial.dispose();
    quadGeometry.dispose();
  }

  return { compositeUniforms, resize, render, dispose, trailPoints };
}

function createClarityTrail(postprocess, canvas, duration, sampleDuration, lag) {
  const history = [];
  const head = new THREE.Vector2();
  const target = new THREE.Vector2();
  let headReady = false;
  let sampleClock = 0;

  function update(delta, state) {
    for (let i = history.length - 1; i >= 0; i--) {
      history[i].age += delta;
      if (history[i].age >= duration) history.splice(i, 1);
    }

    if (state.inside) {
      const rect = canvas.getBoundingClientRect();
      target.set(
        clamp((state.px - rect.left) / rect.width),
        clamp(1 - (state.py - rect.top) / rect.height),
      );
      if (!headReady) {
        head.copy(target);
        headReady = true;
      }
      head.lerp(target, 1 - Math.exp(-lag * delta));
      sampleClock += delta;
      if (sampleClock >= sampleDuration) {
        sampleClock %= sampleDuration;
        history.unshift({ position: head.clone(), age: 0 });
        if (history.length > TRAIL_POINT_COUNT) history.pop();
      }
    } else {
      headReady = false;
      sampleClock = 0;
    }

    for (let i = 0; i < TRAIL_POINT_COUNT; i++) {
      const point = history[i];
      const uniform = postprocess.trailPoints[i];
      if (!point) {
        uniform.set(-10, -10, 0);
        continue;
      }
      const life = clamp(1 - point.age / duration);
      uniform.set(point.position.x, point.position.y, life * life);
    }
  }

  return { update };
}

function bindInteraction(hero, state, hitTest, enabled) {
  if (!enabled) return () => {};
  let activePointer = null;

  const leave = () => {
    if (state.dragging) return;
    state.inside = false;
    state.overLogo = false;
    hero.classList.remove('is-logo-hovered');
  };

  const move = (event) => {
    state.px = event.clientX;
    state.py = event.clientY;
    state.inside = true;

    if (state.dragging && event.pointerId === activePointer) {
      const elapsed = Math.max((event.timeStamp - state.dragLastTime) / 1000, 1 / 120);
      const rotation = (event.clientX - state.dragLastX) * CONFIG.dragSensitivity;
      state.spinAccum += rotation;
      state.dragVelocity = clamp(rotation / elapsed, -CONFIG.dragMaxSpeed, CONFIG.dragMaxSpeed);
      state.dragLastX = event.clientX;
      state.dragLastTime = event.timeStamp;
      event.preventDefault();
      return;
    }
  };

  const down = (event) => {
    if (!hitTest(event.clientX, event.clientY)) return;
    activePointer = event.pointerId;
    state.dragging = true;
    state.overLogo = true;
    state.dragVelocity = 0;
    state.dragLastX = event.clientX;
    state.dragLastTime = event.timeStamp;
    hero.classList.add('is-logo-hovered', 'is-logo-dragging');
    hero.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const end = (event) => {
    if (!state.dragging || event.pointerId !== activePointer) return;
    state.dragging = false;
    activePointer = null;
    hero.classList.remove('is-logo-dragging');
    if (!state.overLogo) hero.classList.remove('is-logo-hovered');
    if (hero.hasPointerCapture?.(event.pointerId)) hero.releasePointerCapture(event.pointerId);
  };

  hero.addEventListener('pointerleave', leave);
  hero.addEventListener('pointermove', move);
  hero.addEventListener('pointerdown', down);
  hero.addEventListener('pointerup', end);
  hero.addEventListener('pointercancel', end);
  return () => {
    hero.removeEventListener('pointerleave', leave);
    hero.removeEventListener('pointermove', move);
    hero.removeEventListener('pointerdown', down);
    hero.removeEventListener('pointerup', end);
    hero.removeEventListener('pointercancel', end);
    hero.classList.remove('is-logo-hovered', 'is-logo-dragging');
  };
}

function showVideoFallback(video, play = true) {
  if (!video) return;
  video.classList.add('is-fallback');
  video.load();
  if (play) video.play().catch(() => {});
}

function disposeObject(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
    else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function init() {
  const hero = document.querySelector('.hero');
  const video = document.getElementById('heroGraphic');
  const canvas = document.getElementById('heroCanvas');
  const detailCanvas = document.getElementById('heroDetailCanvas');
  if (!hero || !canvas || canvas.dataset.sbLogo) return;
  canvas.dataset.sbLogo = '1';

  const reduced = reducedMQ.matches;
  CONFIG.dragSensitivity = resolveTokenNumber('--hero-logo-drag-sensitivity', CONFIG.dragSensitivity);
  CONFIG.dragDamping = resolveTokenNumber('--hero-logo-drag-damping', CONFIG.dragDamping);
  CONFIG.dragMaxSpeed = resolveTokenNumber('--hero-logo-drag-max-speed', CONFIG.dragMaxSpeed);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    showVideoFallback(video, !reduced);
    return;
  }

  const pixelRatio = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const palette = {
    lineHot: resolveTokenColor('--accent-green'),
    lineIdle: resolveTokenColor('--lines-stroke-on-white'),
    lineDetail: resolveTokenColor('--accent-green-bright'),
    lineLower: resolveTokenColor('--accent-cyan'),
  };
  const surfaceGradient = resolveGradientStops('--gradient-green-teal-cyan-100');
  const lineAlpha = resolveTokenNumber('--lines-alpha-on-white', 0.24);
  const wireOpacity = resolveTokenNumber('--hero-logo-wire-opacity', 0.72);
  const wireFadeStart = resolveTokenNumber('--hero-logo-wire-fade-start', 0.72);
  const wireFadeEnd = resolveTokenNumber('--hero-logo-wire-fade-end', 0.88);
  const logoDrop = resolveTokenNumber('--space-48', 48);
  const logoVariant = canvas.dataset.logoVariant || 'default';
  const trailRadius = resolveTokenNumber('--hero-logo-trail-radius', 0.20);
  const trailDeblurRadius = resolveTokenNumber('--hero-logo-trail-deblur-radius', 0.25);
  const trailOpacity = resolveTokenNumber('--hero-logo-trail-opacity', 0.58);
  const trailDuration = resolveTokenDuration('--hero-logo-trail-duration', 900) / 1000;
  const trailSampleDuration = resolveTokenDuration('--hero-logo-trail-sample-duration', 45) / 1000;
  const trailLag = resolveTokenNumber('--hero-logo-trail-lag', 7);
  const trailWireOpacity = resolveTokenNumber('--hero-logo-trail-wire-opacity', 0.64);
  /* The wire shader's settled line contributes 58% of uMaxOpacity, then the
     monument composite applies the trail opacity. Convert the public token
     from final visual opacity into that internal gain so 0.64 means 64%. */
  const trailWireGain = trailWireOpacity / (0.58 * Math.max(trailOpacity, 0.0001));
  const fullDuration = resolveTokenDuration('--hero-logo-build-duration', 2000);
  const repeatDuration = resolveTokenDuration('--hero-logo-build-duration-repeat', 900);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CONFIG.fov, 1, 0.1, 100);
  camera.position.set(0, 0, CONFIG.camZ);
  const container = new THREE.Group();
  const spinner = new THREE.Group();
  const surfaceMaterial = createSurfaceMaterial(surfaceGradient);
  const wireMaterial = createWireMaterial(palette, wireOpacity);
  const guides = buildConstructionLines(palette, lineAlpha);
  const orbitalGuidesEnabled = logoVariant !== 'monument';
  guides.group.visible = orbitalGuidesEnabled;
  container.add(spinner);
  container.add(guides.group);
  scene.add(container);
  let monumentScrollOffset = 0;

  function applySceneLayout(viewportHeight) {
    applyLayout(container, camera, viewportHeight, logoDrop, logoVariant);
    if (logoVariant !== 'monument' || !viewportHeight) return;
    const halfHeight = Math.tan((CONFIG.fov * Math.PI) / 180 / 2) * CONFIG.camZ;
    container.position.y -= monumentScrollOffset * ((halfHeight * 2) / viewportHeight);
  }

  applySceneLayout(canvas.clientHeight || hero.clientHeight);

  let detailRenderer = null;
  if (logoVariant === 'monument' && detailCanvas && !coarse && !reduced) {
    try {
      detailRenderer = new THREE.WebGLRenderer({
        canvas: detailCanvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      detailRenderer.setPixelRatio(pixelRatio);
      detailRenderer.setClearAlpha(0);
      detailRenderer.outputColorSpace = THREE.SRGBColorSpace;
    } catch (error) {
      detailRenderer = null;
    }
  }
  const postprocess = detailRenderer
    ? createMonumentPostprocess(detailRenderer, trailDeblurRadius, trailRadius, trailOpacity)
    : null;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const state = {
    hover: 0,
    hoverT: 0,
    spinAccum: 0,
    px: 0,
    py: 0,
    inside: false,
    overLogo: false,
    dragging: false,
    dragVelocity: 0,
    dragLastX: 0,
    dragLastTime: 0,
  };
  const clarityTrail = postprocess
    ? createClarityTrail(postprocess, canvas, trailDuration, trailSampleDuration, trailLag)
    : null;

  const abortController = new AbortController();
  const loader = new GLTFLoader();
  const introPresent = document.documentElement.classList.contains('hero-intro');
  const abbreviated = !introPresent || everInit || window.__introSkipped;
  const buildDuration = abbreviated ? repeatDuration : fullDuration;
  everInit = true;

  let disposed = false;
  let modelReady = false;
  let armRequested = reduced;
  let armed = false;
  let buildStart = 0;
  let logoMeshes = [];

  function setMonumentScrollOffset(offsetPixels = 0) {
    if (logoVariant !== 'monument') return;
    monumentScrollOffset = Number.isFinite(offsetPixels) ? offsetPixels : 0;
    applySceneLayout(canvas.clientHeight || hero.clientHeight);
    if (reduced && modelReady) renderCurrentScene();
  }
  if (logoVariant === 'monument') window.__setHeroLogoScrollOffset = setMonumentScrollOffset;

  function logoHitAt(clientX, clientY) {
    if (!logoMeshes.length) return false;
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    container.updateMatrixWorld(true);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(logoMeshes, false).length > 0;
  }

  const unbindInteraction = bindInteraction(hero, state, logoHitAt, !reduced);
  let visible = true;
  let last = performance.now();
  let raf = 0;
  let observer = null;
  let armFallback = 0;

  const detailState = {
    surfaceColorWrite: true,
    wireColor: new THREE.Color(),
    wireBlending: THREE.AdditiveBlending,
    guideIdleColor: new THREE.Color(),
    guideHotColor: new THREE.Color(),
    wireBuild: 0,
    wireOpacity: 0,
    wireMaxOpacity: wireOpacity,
    guideHover: 0,
    guideReveal: 0,
    guidesVisible: true,
  };
  let detailBuildProgress = 0;

  function enterDetailState() {
    detailState.surfaceColorWrite = surfaceMaterial.colorWrite;
    detailState.wireColor.copy(wireMaterial.uniforms.uColor.value);
    detailState.wireBlending = wireMaterial.blending;
    detailState.guideIdleColor.copy(guides.uniforms.uColorIdle.value);
    detailState.guideHotColor.copy(guides.uniforms.uColorHot.value);
    detailState.wireBuild = wireMaterial.uniforms.uBuild.value;
    detailState.wireOpacity = wireMaterial.uniforms.uOpacity.value;
    detailState.wireMaxOpacity = wireMaterial.uniforms.uMaxOpacity.value;
    detailState.guideHover = guides.uniforms.uHover.value;
    detailState.guideReveal = guides.uniforms.uReveal.value;
    detailState.guidesVisible = guides.group.visible;
    surfaceMaterial.colorWrite = false;
    wireMaterial.uniforms.uColor.value.copy(palette.lineDetail);
    wireMaterial.blending = THREE.NormalBlending;
    guides.uniforms.uColorIdle.value.copy(palette.lineDetail);
    guides.uniforms.uColorHot.value.copy(palette.lineDetail);
    /* The hover/detail pass reuses the live construction mesh. During loading
       it receives the same progressive build threshold; once complete, that
       same value exposes the full topology under the cursor trail. */
    wireMaterial.uniforms.uBuild.value = detailBuildProgress;
    wireMaterial.uniforms.uOpacity.value = 1;
    wireMaterial.uniforms.uMaxOpacity.value = trailWireGain;
    guides.uniforms.uHover.value = 1;
    guides.uniforms.uReveal.value = 1;
    guides.group.visible = orbitalGuidesEnabled;
  }

  function leaveDetailState() {
    surfaceMaterial.colorWrite = detailState.surfaceColorWrite;
    wireMaterial.uniforms.uColor.value.copy(detailState.wireColor);
    wireMaterial.blending = detailState.wireBlending;
    guides.uniforms.uColorIdle.value.copy(detailState.guideIdleColor);
    guides.uniforms.uColorHot.value.copy(detailState.guideHotColor);
    wireMaterial.uniforms.uBuild.value = detailState.wireBuild;
    wireMaterial.uniforms.uOpacity.value = detailState.wireOpacity;
    wireMaterial.uniforms.uMaxOpacity.value = detailState.wireMaxOpacity;
    guides.uniforms.uHover.value = detailState.guideHover;
    guides.uniforms.uReveal.value = detailState.guideReveal;
    guides.group.visible = detailState.guidesVisible;
  }

  function renderCurrentScene() {
    renderer.render(scene, camera);
    postprocess?.render(scene, camera, enterDetailState, leaveDetailState);
  }

  function resize() {
    if (disposed) return;
    const width = canvas.clientWidth || hero.clientWidth;
    const height = canvas.clientHeight || hero.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    detailRenderer?.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    applySceneLayout(height);
    postprocess?.resize(width, height, renderer.getPixelRatio());
    if (reduced && modelReady) renderCurrentScene();
  }

  function startIfReady() {
    if (disposed || armed || !armRequested || !modelReady) return;
    armed = true;
    buildStart = performance.now();
    last = buildStart;
    canvas.classList.add('is-ready');
    if (reduced) {
      surfaceMaterial.uniforms.uReveal.value = 1.2;
      surfaceMaterial.uniforms.uColorMix.value = 0;
      wireMaterial.uniforms.uOpacity.value = 0;
      guides.group.visible = false;
      renderCurrentScene();
    }
  }

  function requestArm() {
    armRequested = true;
    startIfReady();
  }
  window.__armHeroLogo = requestArm;

  function fail(error) {
    if (disposed || error?.name === 'AbortError') return;
    console.warn('Streetbeat hero logo failed to load; using video fallback.', error);
    canvas.classList.remove('is-ready');
    showVideoFallback(video, !reduced);
  }

  const modelSrc = canvas.dataset.modelSrc || '/streetbeat-homepage-concept/assets/models/streetbeat-logo.glb';
  const modelUrl = new URL(modelSrc, window.location.href);
  const resourcePath = modelUrl.href.slice(0, modelUrl.href.lastIndexOf('/') + 1);
  fetch(modelUrl, { signal: abortController.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Streetbeat logo request failed (${response.status}).`);
      return response.arrayBuffer();
    })
    .then((buffer) => loader.parseAsync(buffer, resourcePath))
    .then((gltf) => {
      if (disposed) {
        disposeObject(gltf.scene);
        return;
      }
      const prepared = prepareModel(gltf, spinner, surfaceMaterial, wireMaterial);
      logoMeshes = prepared.meshes;
      modelReady = true;
      resize();
      startIfReady();
    })
    .catch(fail);

  const armDelay = introPresent ? 10000 : 200;
  armFallback = window.setTimeout(requestArm, armDelay);
  window.addEventListener('resize', resize);
  if (mobileMQ.addEventListener) mobileMQ.addEventListener('change', resize);
  resize();

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) last = performance.now();
    }, { threshold: 0 });
    observer.observe(hero);
  }

  function frame(now) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (!visible || !armed || reduced) {
      last = now;
      return;
    }

    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    const time = now / 1000;
    const ease = 1 - Math.exp(-CONFIG.ease * delta);
    const elapsed = now - buildStart;
    const progress = clamp(elapsed / buildDuration);

    /* One topology-driven growth wave: wire defines the moving front and the
       coloured surface resolves immediately behind it. The small local offset
       preserves legibility without reading as a second animation phase. */
    const evolutionProgress = smoothstep(0, 1, progress);
    const wireProgress = clamp(evolutionProgress * 1.04);
    const fillCatchUp = smoothstep(0.82, 1, evolutionProgress) * 0.245;
    const surfaceProgress = evolutionProgress - 0.045 + fillCatchUp;
    const wireFade = 1 - smoothstep(wireFadeStart, wireFadeEnd, progress);
    const guideReveal = easeOutCubic(progress / 0.72);

    wireMaterial.uniforms.uBuild.value = wireProgress;
    wireMaterial.uniforms.uOpacity.value = wireFade;
    surfaceMaterial.uniforms.uReveal.value = surfaceProgress;
    detailBuildProgress = wireProgress;
    if (postprocess) {
      /* The existing hover construction pass is globally clear only while the
         logo builds. It then returns to cursor-trail visibility - no duplicate
         wire geometry or second construction system. */
      postprocess.compositeUniforms.uGlobalConstructionClarity.value = wireFade * wireOpacity;
    }

    if (coarse) {
      state.hoverT = state.dragging ? 1 : 0.25 + 0.15 * Math.sin(time * 0.5);
    } else if (state.inside && logoMeshes.length) {
      state.overLogo = logoHitAt(state.px, state.py);
      state.hoverT = state.overLogo ? 1 : 0;
      hero.classList.toggle('is-logo-hovered', state.overLogo || state.dragging);
    } else {
      state.overLogo = false;
      state.hoverT = 0;
      if (!state.dragging) hero.classList.remove('is-logo-hovered');
    }

    state.hover += (state.hoverT - state.hover) * ease;

    if (!state.dragging) {
      const spin = CONFIG.spinIdle + (CONFIG.spinHover - CONFIG.spinIdle) * state.hover;
      state.spinAccum += (spin + state.dragVelocity) * delta;
      state.dragVelocity *= Math.exp(-CONFIG.dragDamping * delta);
    }
    spinner.rotation.y = state.spinAccum;

    surfaceMaterial.uniforms.uColorMix.value = state.hover;

    guides.group.rotation.y = -state.spinAccum * 0.35;
    guides.group.rotation.z = time * 0.05;
    const buildOvershoot = Math.sin(progress * Math.PI) * (1 - progress) * 0.08;
    guides.group.scale.setScalar(guideReveal * (1 + buildOvershoot + CONFIG.lineExpand * 0.5 * state.hover));
    guides.uniforms.uTime.value = time;
    guides.uniforms.uHover.value = state.hover;
    guides.uniforms.uReveal.value = guideReveal;

    clarityTrail?.update(delta, state);
    renderCurrentScene();
  }
  if (!reduced) raf = requestAnimationFrame(frame);

  function teardown() {
    if (disposed) return;
    disposed = true;
    abortController.abort();
    window.clearTimeout(armFallback);
    cancelAnimationFrame(raf);
    observer?.disconnect();
    unbindInteraction();
    window.removeEventListener('resize', resize);
    if (mobileMQ.removeEventListener) mobileMQ.removeEventListener('change', resize);
    document.removeEventListener('astro:before-swap', teardown);
    if (window.__armHeroLogo === requestArm) delete window.__armHeroLogo;
    if (window.__setHeroLogoScrollOffset === setMonumentScrollOffset) {
      delete window.__setHeroLogoScrollOffset;
    }
    canvas.classList.remove('is-ready');
    video?.pause();
    disposeObject(container);
    surfaceMaterial.dispose();
    wireMaterial.dispose();
    guides.material.dispose();
    postprocess?.dispose();
    detailRenderer?.dispose();
    detailRenderer?.forceContextLoss();
    renderer.dispose();
    renderer.forceContextLoss();
  }
  document.addEventListener('astro:before-swap', teardown, { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

window.__initHeroLogo = init;
