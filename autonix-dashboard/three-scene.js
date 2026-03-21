// ═══════════════════════════════════════════════════════════════════
// Three.js / WebGL Scene — AUTONIX Command Center
// ═══════════════════════════════════════════════════════════════════
// Renders the 3D Digital Twin inside <canvas id="webgl-canvas">.
// Features: wireframe icosahedron, 3 orbital rings, radar sweep,
// starfield, data burst particles, and fire alert state.
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';

let scene, camera, renderer, clock;
let icosahedron, icosahedronWire;
let ringA, ringB, ringC;
let radarPlane;
let starField;
let gridLines;
let particles = [];
let animationId;
let canvasEl;

// ── STATUS COLORS ─────────────────────────────────────────────────
const COLOR_NOMINAL  = new THREE.Color(0x00BFFF);
const COLOR_WARNING  = new THREE.Color(0xFF6B35);
const COLOR_CRITICAL = new THREE.Color(0xFF4444);
const COLOR_GREEN    = new THREE.Color(0x00FF9C);

function getStatusColor(status) {
  if (status === 'critical') return COLOR_CRITICAL.clone();
  if (status === 'warning') return COLOR_WARNING.clone();
  return COLOR_NOMINAL.clone();
}

// ═══════════════════════════════════════════════════════════════════
// INIT THREE SCENE
// ═══════════════════════════════════════════════════════════════════
export function initThreeScene() {
  canvasEl = document.getElementById('webgl-canvas');
  if (!canvasEl) return;

  const panel = canvasEl.parentElement;

  // ── Core setup ──────────────────────────────────────────────────
  scene = new THREE.Scene();
  clock = new THREE.Clock();

  camera = new THREE.PerspectiveCamera(55, panel.clientWidth / panel.clientHeight, 0.1, 1000);
  camera.position.set(0, 2, 7);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: false });
  renderer.setClearColor(0x0a0a0a, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(panel.clientWidth, panel.clientHeight);

  // ── Ambient + Point lights ──────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x222222, 1));
  const pointLight = new THREE.PointLight(0x00BFFF, 0.8, 30);
  pointLight.position.set(3, 4, 5);
  scene.add(pointLight);

  // ── Perspective Grid (floor plane) ──────────────────────────────
  createGrid();

  // ── Star Field ──────────────────────────────────────────────────
  createStarField();

  // ── Central Icosahedron Wireframe ───────────────────────────────
  createIcosahedron();

  // ── Orbital Rings ───────────────────────────────────────────────
  createOrbitalRings();

  // ── Radar Sweep Plane ───────────────────────────────────────────
  createRadarSweep();

  // ── Resize handler ─────────────────────────────────────────────
  const resizeObserver = new ResizeObserver(() => {
    const w = panel.clientWidth;
    const h = panel.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObserver.observe(panel);

  // ── Start render loop ───────────────────────────────────────────
  animate();
}

// ═══════════════════════════════════════════════════════════════════
// SCENE OBJECTS
// ═══════════════════════════════════════════════════════════════════

function createGrid() {
  const gridSize = 40;
  const divisions = 40;
  const step = gridSize / divisions;
  const half = gridSize / 2;
  const vertices = [];

  for (let i = 0; i <= divisions; i++) {
    const pos = -half + i * step;
    // X-parallel lines
    vertices.push(-half, 0, pos, half, 0, pos);
    // Z-parallel lines
    vertices.push(pos, 0, -half, pos, 0, half);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.LineBasicMaterial({ color: 0x00BFFF, opacity: 0.03, transparent: true });
  gridLines = new THREE.LineSegments(geometry, material);
  gridLines.position.y = -3;
  scene.add(gridLines);
}

function createStarField() {
  const count = 600;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 80;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, sizeAttenuation: true });
  starField = new THREE.Points(geometry, material);
  scene.add(starField);
}

function createIcosahedron() {
  const icoGeo = new THREE.IcosahedronGeometry(2, 1);
  const wireGeo = new THREE.WireframeGeometry(icoGeo);
  const wireMat = new THREE.LineBasicMaterial({ color: 0x00BFFF, opacity: 0.8, transparent: true });
  icosahedronWire = new THREE.LineSegments(wireGeo, wireMat);
  scene.add(icosahedronWire);
}

function createOrbitalRings() {
  // Ring A: accent-blue, tilt 0°, maps to frequency_hz
  const geoA = new THREE.TorusGeometry(3.2, 0.015, 8, 80);
  const matA = new THREE.MeshBasicMaterial({ color: 0x00BFFF, opacity: 0.5, transparent: true });
  ringA = new THREE.Mesh(geoA, matA);
  scene.add(ringA);

  // Ring B: accent-orange, tilt 45°, maps to flame_intensity
  const geoB = new THREE.TorusGeometry(3.5, 0.015, 8, 80);
  const matB = new THREE.MeshBasicMaterial({ color: 0xFF6B35, opacity: 0.5, transparent: true });
  ringB = new THREE.Mesh(geoB, matB);
  ringB.rotation.x = Math.PI / 4;
  scene.add(ringB);

  // Ring C: accent-green, tilt 90°, maps to battery_level
  const geoC = new THREE.TorusGeometry(3.8, 0.015, 8, 80);
  const matC = new THREE.MeshBasicMaterial({ color: 0x00FF9C, opacity: 0.5, transparent: true });
  ringC = new THREE.Mesh(geoC, matC);
  ringC.rotation.x = Math.PI / 2;
  scene.add(ringC);
}

function createRadarSweep() {
  const geo = new THREE.PlaneGeometry(6, 0.02);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x00BFFF,
    opacity: 0.12,
    transparent: true,
    side: THREE.DoubleSide
  });
  radarPlane = new THREE.Mesh(geo, mat);
  scene.add(radarPlane);
}

// ═══════════════════════════════════════════════════════════════════
// ANIMATION LOOP
// ═══════════════════════════════════════════════════════════════════

function animate() {
  animationId = requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();
  const delta = clock.getDelta();

  // ── Icosahedron rotation + opacity pulse ────────────────────────
  if (icosahedronWire) {
    icosahedronWire.rotation.x += 0.003;
    icosahedronWire.rotation.y += 0.005;
    // Pulse opacity: 0.5 → 1.0
    icosahedronWire.material.opacity = 0.5 + 0.5 * ((Math.sin(elapsed) + 1) / 2);
  }

  // ── Orbital rings rotation ──────────────────────────────────────
  if (ringA) ringA.rotation.z += 0.008;
  if (ringB) ringB.rotation.z += 0.012;
  if (ringC) ringC.rotation.z += 0.006;

  // ── Radar sweep rotation ────────────────────────────────────────
  if (radarPlane) radarPlane.rotation.y += 0.02;

  // ── Starfield drift ────────────────────────────────────────────
  if (starField) {
    starField.rotation.y += 0.0003;
    starField.rotation.x += 0.0001;
  }

  // ── Update data burst particles ─────────────────────────────────
  updateParticles(elapsed);

  renderer.render(scene, camera);
}

// ═══════════════════════════════════════════════════════════════════
// DATA BURST PARTICLES
// ═══════════════════════════════════════════════════════════════════

function spawnBurst(color, count = 20) {
  const burstColor = color instanceof THREE.Color ? color : new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(0.04, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: burstColor, transparent: true, opacity: 1.0 });
    const mesh = new THREE.Mesh(geo, mat);

    // Random direction
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    ).normalize().multiplyScalar(2 + Math.random() * 3);

    mesh.userData = {
      velocity: dir,
      spawnTime: clock.getElapsedTime(),
      lifespan: 1.5
    };

    scene.add(mesh);
    particles.push(mesh);
  }
}

function updateParticles(elapsed) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const age = elapsed - p.userData.spawnTime;
    const life = p.userData.lifespan;

    if (age >= life) {
      // Remove and dispose
      scene.remove(p);
      p.geometry.dispose();
      p.material.dispose();
      particles.splice(i, 1);
      continue;
    }

    // Move outward
    const speed = 0.02;
    p.position.x += p.userData.velocity.x * speed;
    p.position.y += p.userData.velocity.y * speed;
    p.position.z += p.userData.velocity.z * speed;

    // Fade out
    p.material.opacity = 1.0 - (age / life);
  }
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC: updateThreeScene(data)
// ═══════════════════════════════════════════════════════════════════
export function updateThreeScene(data) {
  if (!scene) return;
  const color = getStatusColor(data.status);
  spawnBurst(color, 20);
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC: triggerAlertState()
// ═══════════════════════════════════════════════════════════════════
let alertTimeout = null;

export function triggerAlertState() {
  if (!icosahedronWire) return;

  // Clear any existing alert timeout
  if (alertTimeout) clearTimeout(alertTimeout);

  // Transition to red immediately
  icosahedronWire.material.color.set(COLOR_CRITICAL);

  // Spawn large red burst (40 particles)
  spawnBurst(COLOR_CRITICAL, 40);

  // Hold red for 2 seconds, then transition back
  alertTimeout = setTimeout(() => {
    // Smoothly transition back via intermediate step
    const backTween = () => {
      icosahedronWire.material.color.set(COLOR_NOMINAL);
    };
    // Brief delay then restore
    setTimeout(backTween, 300);
    alertTimeout = null;
  }, 2000);
}
