// ═══════════════════════════════════════════════════════════════════
// Three.js / WebGL Scene — AUTONIX Command Center
// ═══════════════════════════════════════════════════════════════════
// Renders the 3D Digital Twin inside <canvas id="webgl-canvas">.
// Features: wireframe geodesic globe, orbital rings, radar sweep,
// starfield, data burst particles, holographic rover, acoustic ripples,
// ultrasonic distance cone, obstacle cube, and fire alert state.
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/controls/OrbitControls.js';

// ── CORE ──────────────────────────────────────────────────────────
let scene, camera, renderer, clock, controls;
let icosahedron, outerShell;
let ringA, ringB, ringC;
let radarPlane;
let starField;
let gridLines;
let particles = [];
let animationId;
let canvasEl;

// ── FEATURE 1: Acoustic Ripple Pool ──────────────────────────────
let ripplePool        = [];
let rippleActive      = false;
let rippleColor       = 0x00BFFF;
let rippleSpawnTimer  = 0;
const RIPPLE_POOL_SIZE      = 12;
const RIPPLE_SPAWN_INTERVAL = 12;

// ── FEATURE 2: Ultrasonic Distance Cone ──────────────────────────
let coneMesh        = null;
let coneWireframe   = null;
let innerConeMesh   = null;
let coneTargetScale = 1.0;
let coneTargetColor = 0x00BFFF;
let coneBreathTimer = 0;

// ── ROVER ─────────────────────────────────────────────────────────
let roverGroup   = null;
let wheelsArray  = [];
let barrelMeshes = [];

// ── OBSTACLE CUBE ─────────────────────────────────────────────────
let obstacleCube = null;
let ghostCube    = null;
let cubeTargetX  = 6.5;
let cubeTimer    = 0;

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

// ─────────────────────────────────────────────────────────────────
// Shared wireframe rover material factory
// ─────────────────────────────────────────────────────────────────
function roverMat(opacity = 0.7) {
  return new THREE.MeshBasicMaterial({
    color:       0x00BFFF,
    wireframe:   true,
    transparent: true,
    opacity,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false
  });
}

// ═══════════════════════════════════════════════════════════════════
// FEATURE 1: ACOUSTIC RIPPLE POOL
// ═══════════════════════════════════════════════════════════════════

function createRipplePool() {
  for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
    const geometry = new THREE.RingGeometry(0.2, 0.32, 80);
    const material = new THREE.MeshBasicMaterial({
      color:       0x00BFFF,
      transparent: true,
      opacity:     0.0,
      side:        THREE.DoubleSide,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;  // Flat on XZ plane
    mesh.position.y = -2.4;          // Sit just above grid level
    mesh.visible = false;
    scene.add(mesh);
    ripplePool.push({ mesh, active: false, scale: 0, opacity: 0, speed: 0 });
  }
}

function spawnRipple(color) {
  const activeCount = ripplePool.filter(r => r.active).length;
  const slot = ripplePool.find(r => !r.active);
  if (!slot) return;
  slot.active  = true;
  slot.scale   = 0.3 + activeCount * 0.3;  // Stagger starting scale
  slot.opacity = 0.9;
  slot.speed   = 0.05 + Math.random() * 0.04;  // 0.05–0.09
  slot.mesh.scale.set(slot.scale, slot.scale, slot.scale);
  slot.mesh.material.opacity = 0.9;
  slot.mesh.material.color.setHex(color);
  slot.mesh.visible = true;
}

function animateRipples() {
  for (const slot of ripplePool) {
    if (!slot.active) continue;
    slot.scale   += slot.speed;
    slot.opacity -= slot.speed * 0.6;
    slot.mesh.scale.set(slot.scale, slot.scale, slot.scale);
    slot.mesh.material.opacity = Math.max(0, slot.opacity);
    // Max scale 6.0 before fully fading
    if (slot.opacity <= 0 || slot.scale >= 6.0) {
      slot.active       = false;
      slot.mesh.visible = false;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// FEATURE 2: ULTRASONIC DISTANCE CONE (X-axis, right side of globe)
// ═══════════════════════════════════════════════════════════════════

function createDistanceCone() {
  const coneGeometry = new THREE.CylinderGeometry(0, 0.5, 4.0, 24, 4, true);

  // Outer solid cone
  const coneMaterial = new THREE.MeshBasicMaterial({
    color:       0x00BFFF,
    transparent: true,
    opacity:     0.12,
    side:        THREE.DoubleSide,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false
  });
  coneMesh = new THREE.Mesh(coneGeometry, coneMaterial);
  coneMesh.rotation.z = -Math.PI / 2;  // Point along +X axis
  coneMesh.position.set(2.5, -0.3, 0);

  // Wireframe overlay
  coneWireframe = new THREE.LineSegments(
    new THREE.WireframeGeometry(coneGeometry),
    new THREE.LineBasicMaterial({
      color:       0x00BFFF,
      transparent: true,
      opacity:     0.08,
      blending:    THREE.AdditiveBlending
    })
  );
  coneWireframe.rotation.z = -Math.PI / 2;
  coneWireframe.position.set(2.5, -0.3, 0);

  // Inner cone for tunnel depth effect
  const innerConeGeom = new THREE.CylinderGeometry(0, 0.25, 4.0, 16, 4, true);
  innerConeMesh = new THREE.Mesh(innerConeGeom, new THREE.MeshBasicMaterial({
    color:       0x00BFFF,
    transparent: true,
    opacity:     0.06,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false
  }));
  innerConeMesh.rotation.z = -Math.PI / 2;
  innerConeMesh.position.set(2.5, -0.3, 0);

  scene.add(coneMesh);
  scene.add(coneWireframe);
  scene.add(innerConeMesh);
}

function distanceToScale(distanceCm) {
  const clamped = Math.max(5, Math.min(200, distanceCm));
  return 0.4 + ((clamped - 5) / (200 - 5)) * (3.5 - 0.4);
}

function distanceToColor(distanceCm) {
  if (distanceCm > 100) return 0x00BFFF; // Blue  — Safe
  if (distanceCm > 40)  return 0xFF6B35; // Orange — Warning
  return 0xFF4444;                        // Red   — Critical
}

// ═══════════════════════════════════════════════════════════════════
// HOLOGRAPHIC ROVER (inside globe)
// ═══════════════════════════════════════════════════════════════════

function createRover() {
  roverGroup = new THREE.Group();

  // ── Main chassis ────────────────────────────────────────────────
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.25, 0.8),
    roverMat(0.7)
  );
  roverGroup.add(chassis);

  // ── Suspension arms (6: 3L + 3R) ────────────────────────────────
  const armPositions = [
    { x: -0.6, z: -0.3 }, { x: -0.6, z: 0 }, { x: -0.6, z: 0.3 },
    { x:  0.6, z: -0.3 }, { x:  0.6, z: 0 }, { x:  0.6, z: 0.3 }
  ];
  for (const p of armPositions) {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.06, 0.06),
      roverMat(0.5)
    );
    arm.position.set(p.x, -0.08, p.z);
    roverGroup.add(arm);
  }

  // ── Wheels (6: 3L + 3R) ─────────────────────────────────────────
  const wheelPositions = [
    { x: -0.82, z: -0.3 }, { x: -0.82, z: 0 }, { x: -0.82, z: 0.3 },
    { x:  0.82, z: -0.3 }, { x:  0.82, z: 0 }, { x:  0.82, z: 0.3 }
  ];
  for (const p of wheelPositions) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12),
      roverMat(0.65)
    );
    wheel.rotation.z = Math.PI / 2; // Stand upright like a wheel
    wheel.position.set(p.x, -0.18, p.z);
    roverGroup.add(wheel);
    wheelsArray.push(wheel);
  }

  // ── Camera mast ─────────────────────────────────────────────────
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8),
    roverMat(0.6)
  );
  mast.position.set(0.3, 0.35, -0.3);
  roverGroup.add(mast);

  // ── Camera head ─────────────────────────────────────────────────
  const camHead = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.1, 0.08),
    roverMat(0.7)
  );
  camHead.position.set(0.3, 0.62, -0.3);
  roverGroup.add(camHead);

  // ── Acoustic weapon barrel ───────────────────────────────────────
  const barrelOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.08, 0.5, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x00BFFF, wireframe: true, transparent: true,
      opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  barrelOuter.rotation.x = -Math.PI / 2;
  barrelOuter.position.set(-0.2, 0.22, -0.5);
  roverGroup.add(barrelOuter);
  barrelMeshes.push(barrelOuter);

  const barrelInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.04, 0.5, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x00BFFF, wireframe: true, transparent: true,
      opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  barrelInner.rotation.x = -Math.PI / 2;
  barrelInner.position.set(-0.2, 0.22, -0.5);
  roverGroup.add(barrelInner);
  barrelMeshes.push(barrelInner);

  roverGroup.scale.set(0.55, 0.55, 0.55);
  roverGroup.position.set(0, -0.3, 0);
  scene.add(roverGroup);
}

// ═══════════════════════════════════════════════════════════════════
// OBSTACLE CUBE (tracks cone tip)
// ═══════════════════════════════════════════════════════════════════

function createObstacleCube() {
  obstacleCube = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.55, 0.55),
    new THREE.MeshBasicMaterial({
      color:       0x00BFFF,
      wireframe:   true,
      transparent: true,
      opacity:     0.85,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false
    })
  );
  obstacleCube.position.set(cubeTargetX, -0.3, 0);
  scene.add(obstacleCube);

  ghostCube = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 0.8),
    new THREE.MeshBasicMaterial({
      color:       0x00BFFF,
      wireframe:   true,
      transparent: true,
      opacity:     0.2,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false
    })
  );
  ghostCube.position.set(cubeTargetX, -0.3, 0);
  scene.add(ghostCube);
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

  // Atmospheric fog for depth falloff
  scene.fog = new THREE.FogExp2(0x0a0a0a, 0.04);

  // ── Camera — cinematic 3/4 overhead ─────────────────────────────
  camera = new THREE.PerspectiveCamera(60, panel.clientWidth / panel.clientHeight, 0.1, 1000);
  camera.position.set(0, 6, 10);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: false });
  renderer.setClearColor(0x0a0a0a, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(panel.clientWidth, panel.clientHeight);

  // ── OrbitControls ─────────────────────────────────────────────
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.05;
  controls.minDistance    = 5;
  controls.maxDistance    = 20;
  controls.maxPolarAngle  = Math.PI / 2.2;

  // ── Ambient + Point lights ──────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x222222, 1));
  const pointLight = new THREE.PointLight(0x00BFFF, 0.8, 30);
  pointLight.position.set(3, 4, 5);
  scene.add(pointLight);

  // ── Neon Ground Grid ────────────────────────────────────────────
  createGrid();

  // ── Star Field ──────────────────────────────────────────────────
  createStarField();

  // ── Upgraded Geodesic Globe ─────────────────────────────────────
  createIcosahedron();

  // ── Upgraded Orbital Rings ──────────────────────────────────────
  createOrbitalRings();

  // ── Radar Sweep Plane ───────────────────────────────────────────
  createRadarSweep();

  // ── Holographic Rover (inside globe) ────────────────────────────
  createRover();

  // ── Acoustic Ripple Pool ─────────────────────────────────────────
  createRipplePool();

  // ── Ultrasonic Cone (X-axis, right side) ─────────────────────────
  createDistanceCone();
  coneTargetScale = 1.0;

  // ── Obstacle Tracking Cube ───────────────────────────────────────
  createObstacleCube();

  // ── Resize handler ──────────────────────────────────────────────
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
  // Outer neon grid
  const gridHelper = new THREE.GridHelper(30, 30, 0x00BFFF, 0x00BFFF);
  gridHelper.position.y = -2.5;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.25;
  gridHelper.material.blending = THREE.AdditiveBlending;
  scene.add(gridHelper);

  // Inner denser grid
  const innerGrid = new THREE.GridHelper(10, 20, 0x00BFFF, 0x00BFFF);
  innerGrid.position.y = -2.49;
  innerGrid.material.transparent = true;
  innerGrid.material.opacity = 0.15;
  innerGrid.material.blending = THREE.AdditiveBlending;
  scene.add(innerGrid);

  gridLines = gridHelper; // keep reference for compat
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
  // High-detail geodesic globe
  const icoGeom = new THREE.IcosahedronGeometry(2.5, 3);
  icosahedron = new THREE.Mesh(icoGeom, new THREE.MeshBasicMaterial({
    color:       0x00BFFF,
    wireframe:   true,
    transparent: true,
    opacity:     0.35,
    blending:    THREE.AdditiveBlending
  }));
  scene.add(icosahedron);

  // Outer shell — counter-rotates for layered depth
  outerShell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.7, 2),
    new THREE.MeshBasicMaterial({
      color:       0x00BFFF,
      wireframe:   true,
      transparent: true,
      opacity:     0.08,
      blending:    THREE.AdditiveBlending
    })
  );
  scene.add(outerShell);
}

function createOrbitalRings() {
  // Ring A — orange, tilted
  const geoA = new THREE.TorusGeometry(2.0, 0.025, 16, 80);
  ringA = new THREE.Mesh(geoA, new THREE.MeshBasicMaterial({
    color: 0xFF6B35, opacity: 0.6, transparent: true,
    blending: THREE.AdditiveBlending
  }));
  ringA.rotation.x = Math.PI / 2.5;
  ringA.rotation.z = Math.PI / 6;
  scene.add(ringA);

  // Ring B — green, fully vertical
  const geoB = new THREE.TorusGeometry(2.2, 0.02, 16, 80);
  ringB = new THREE.Mesh(geoB, new THREE.MeshBasicMaterial({
    color: 0x00FF9C, opacity: 0.6, transparent: true,
    blending: THREE.AdditiveBlending
  }));
  scene.add(ringB);

  // Ring C — blue, tilted counter-rotate
  const geoC = new THREE.TorusGeometry(1.8, 0.02, 16, 80);
  ringC = new THREE.Mesh(geoC, new THREE.MeshBasicMaterial({
    color: 0x00BFFF, opacity: 0.6, transparent: true,
    blending: THREE.AdditiveBlending
  }));
  ringC.rotation.x = Math.PI / 3;
  ringC.rotation.z = Math.PI / 4;
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

  // 1. OrbitControls damping
  if (controls) controls.update();

  const elapsed = clock.getElapsedTime();

  // 2. Globe
  if (icosahedron) {
    icosahedron.rotation.y += 0.002;
    icosahedron.rotation.x += 0.0005;
    // Pulse opacity with intensity data: base 0.35
    icosahedron.material.opacity = 0.25 + 0.1 * ((Math.sin(elapsed * 0.8) + 1) / 2);
  }
  if (outerShell) outerShell.rotation.y -= 0.001;

  // 3. Orbital rings
  if (ringA) ringA.rotation.z += 0.008;
  if (ringB) ringB.rotation.y += 0.005;
  if (ringC) ringC.rotation.x -= 0.006;

  // 4. Radar sweep
  if (radarPlane) radarPlane.rotation.y += 0.02;

  // 5. Starfield drift
  if (starField) {
    starField.rotation.y += 0.0003;
    starField.rotation.x += 0.0001;
  }

  // 6. Rover bob + rotation + wheel spin + barrel pulse
  if (roverGroup) {
    roverGroup.position.y = -0.3 + Math.sin(elapsed * 0.8) * 0.08;
    roverGroup.rotation.y += 0.004;
    wheelsArray.forEach(w => { w.rotation.x += 0.06; });

    // Barrel pulse when weapon firing
    if (barrelMeshes.length >= 2) {
      if (rippleActive) {
        const barrelOpacity = 0.5 + Math.sin(elapsed * 8) * 0.3;
        barrelMeshes[0].material.opacity = Math.max(0.1, barrelOpacity);
        barrelMeshes[1].material.opacity = Math.max(0.05, barrelOpacity * 0.6);
      } else {
        barrelMeshes[0].material.opacity = 0.4;
        barrelMeshes[1].material.opacity = 0.25;
      }
    }
  }

  // 7. Ripple spawner + animator
  rippleSpawnTimer++;
  if (rippleActive && rippleSpawnTimer >= RIPPLE_SPAWN_INTERVAL) {
    spawnRipple(rippleColor);
    rippleSpawnTimer = 0;
  }
  animateRipples();

  // 8. Cone breath + scale lerp (X axis)
  if (coneMesh && coneWireframe && innerConeMesh) {
    coneBreathTimer += 0.03;
    const breathOpacity = 0.10 + Math.sin(coneBreathTimer) * 0.04;
    coneMesh.material.opacity      = breathOpacity;
    coneWireframe.material.opacity = breathOpacity * 0.6;
    innerConeMesh.material.opacity = breathOpacity * 0.4;
    coneMesh.scale.x      = THREE.MathUtils.lerp(coneMesh.scale.x, coneTargetScale, 0.08);
    coneWireframe.scale.x = coneMesh.scale.x;
    innerConeMesh.scale.x = coneMesh.scale.x;
  }

  // 9. Obstacle cube sync to cone tip
  if (obstacleCube && coneMesh && ghostCube) {
    const coneLength = 4.0 * coneMesh.scale.x;
    cubeTargetX = 2.5 + coneLength;
    obstacleCube.position.x = THREE.MathUtils.lerp(obstacleCube.position.x, cubeTargetX, 0.08);
    obstacleCube.position.y = -0.3;
    ghostCube.position.copy(obstacleCube.position);

    // Sync color to cone
    obstacleCube.material.color.copy(coneMesh.material.color);
    ghostCube.material.color.copy(coneMesh.material.color);

    // Spinning animation
    obstacleCube.rotation.x += 0.012;
    obstacleCube.rotation.y += 0.018;
    ghostCube.rotation.x    -= 0.008;
    ghostCube.rotation.y    -= 0.012;

    // Opacity pulse
    cubeTimer += 0.05;
    obstacleCube.material.opacity = 0.7 + Math.sin(cubeTimer * 2) * 0.15;
  }

  // 10. Data burst particles
  updateParticles(elapsed);

  renderer.render(scene, camera);
}

// ═══════════════════════════════════════════════════════════════════
// DATA BURST PARTICLES (existing — preserved)
// ═══════════════════════════════════════════════════════════════════

function spawnBurst(color, count = 20) {
  const burstColor = color instanceof THREE.Color ? color : new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(0.04, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: burstColor, transparent: true, opacity: 1.0 });
    const mesh = new THREE.Mesh(geo, mat);

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
      scene.remove(p);
      p.geometry.dispose();
      p.material.dispose();
      particles.splice(i, 1);
      continue;
    }

    const speed = 0.02;
    p.position.x += p.userData.velocity.x * speed;
    p.position.y += p.userData.velocity.y * speed;
    p.position.z += p.userData.velocity.z * speed;
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

  // Acoustic Ripples — frequency_hz
  if (data.metric_name === 'frequency_hz') {
    const val = parseFloat(data.metric_value);
    if (val > 0) {
      rippleActive = true;
      rippleColor  = (data.status === 'critical') ? 0xFF4444 : 0x00BFFF;
    } else {
      rippleActive = false;
    }
  }

  // Ultrasonic Cone — target_distance_cm
  if (data.metric_name === 'target_distance_cm') {
    const dist  = parseFloat(data.metric_value);
    const col   = distanceToColor(dist);
    coneTargetScale = distanceToScale(dist);
    if (coneMesh)      coneMesh.material.color.setHex(col);
    if (coneWireframe) coneWireframe.material.color.setHex(col);
    if (innerConeMesh) innerConeMesh.material.color.setHex(col);
  }

  // Battery level — rings[B] color change
  if (data.metric_name === 'battery_level') {
    const val = parseFloat(data.metric_value);
    if (ringB) {
      ringB.material.color.setHex(val > 50 ? 0x00FF9C : 0xFF6B35);
    }
  }

  // Flame intensity — globe opacity mapping
  if (data.metric_name === 'flame_intensity' && icosahedron) {
    const val = parseFloat(data.metric_value);
    icosahedron.material.opacity = 0.25 + (val / 100) * 0.35;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC: triggerAlertState()
// ═══════════════════════════════════════════════════════════════════
let alertTimeout = null;

export function triggerAlertState() {
  if (!icosahedron) return;

  if (alertTimeout) clearTimeout(alertTimeout);

  // Transition globe to red
  icosahedron.material.color.set(COLOR_CRITICAL);

  // Large red burst
  spawnBurst(COLOR_CRITICAL, 40);

  // 5 instant red ripples for strong impact
  rippleActive = true;
  rippleColor  = 0xFF4444;
  for (let i = 0; i < 5; i++) spawnRipple(0xFF4444);

  alertTimeout = setTimeout(() => {
    setTimeout(() => { icosahedron.material.color.set(COLOR_NOMINAL); }, 300);
    setTimeout(() => { rippleColor = 0x00BFFF; }, 1000);
    alertTimeout = null;
  }, 2000);
}
