/* 4BitLabs: scroll-driven 3D robot for the home page
   1. Setup   2. Robot model   3. Scroll keyframes
   4. Panels   5. Render loop   6. Fallbacks */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const stage = document.querySelector("[data-stage]");
const mount = document.querySelector("[data-stage-canvas]");
const panels = [...document.querySelectorAll("[data-panel]")];
const dots = [...document.querySelectorAll("[data-dot]")];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = () => window.innerWidth <= 820;

const COLORS = {
  red: 0xe0301f,
  board: 0xc22a1b,
  plastic: 0xece9e1,
  ink: 0x1d1b18,
  grey: 0xb8b2a5,
  metal: 0xd9d6cf,
};

/* ---------- 1. Setup ---------- */
function createRenderer() {
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile() ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = !isMobile();
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    return renderer;
  } catch (err) {
    return null;
  }
}

function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d4c7, 1.4));

  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -4;
  key.shadow.camera.right = key.shadow.camera.top = 4;
  key.shadow.radius = 6;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xffe2dc, 0.9);
  rim.position.set(-5, 3, -4);
  scene.add(rim);

  // soft shadow on an invisible floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.ShadowMaterial({ opacity: 0.12 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
}

/* ---------- 2. Robot model ---------- */

// top of the circuit board: red PCB with traces, gold pads and silkscreen text
function boardTexture() {
  const c = document.createElement("canvas");
  c.width = 800;
  c.height = 1000;
  const g = c.getContext("2d");
  g.fillStyle = "#c22a1b";
  g.fillRect(0, 0, c.width, c.height);

  g.strokeStyle = "#e9604f";
  g.lineWidth = 9;
  g.lineCap = g.lineJoin = "round";
  const traces = [
    [[60, 120], [260, 120], [330, 190], [330, 420]],
    [[740, 160], [560, 160], [500, 220], [500, 380]],
    [[80, 880], [240, 880], [320, 800], [320, 640]],
    [[720, 860], [600, 860], [520, 780], [520, 640]],
    [[400, 60], [400, 300]],
    [[140, 300], [140, 560], [220, 640]],
    [[660, 320], [660, 560], [580, 640]],
  ];
  traces.forEach((t) => {
    g.beginPath();
    t.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  });

  g.fillStyle = "#f2d38f";
  [[60, 120], [740, 160], [80, 880], [720, 860], [400, 60], [140, 300], [660, 320]].forEach(([x, y]) => {
    g.beginPath();
    g.arc(x, y, 16, 0, Math.PI * 2);
    g.fill();
  });
  // header pin rows
  for (let i = 0; i < 10; i++) {
    g.fillRect(250 + i * 32, 940, 14, 14);
    g.fillRect(250 + i * 32, 30, 14, 14);
  }

  g.fillStyle = "rgba(255,255,255,0.85)";
  g.font = "bold 46px Archivo, Arial, sans-serif";
  g.fillText("4BITS LABS", 120, 760);
  g.font = "26px 'IBM Plex Mono', monospace";
  g.fillText("ROVER-01  ·  NAGPUR", 120, 800);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...opts });
}

function mesh(geometry, material) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// each part remembers its assembled position and where it flies to when the kit "opens"
function part(object, explodeOffset, explodeSpin = [0, 0, 0]) {
  const g = new THREE.Group();
  g.add(object);
  g.userData.home = object.position.clone();
  g.userData.offset = new THREE.Vector3(...explodeOffset);
  g.userData.spin = new THREE.Euler(...explodeSpin);
  object.position.set(0, 0, 0);
  g.position.copy(g.userData.home);
  return g;
}

function buildRobot() {
  const robot = new THREE.Group();
  const parts = [];
  const wheels = [];
  const add = (p) => {
    robot.add(p);
    parts.push(p);
    return p;
  };

  // chassis
  const chassis = mesh(new RoundedBoxGeometry(1.7, 0.42, 2.1, 4, 0.1), mat(COLORS.plastic));
  chassis.position.set(0, 0.55, 0);
  add(part(chassis, [0, 0, 0]));

  // circuit board on top
  const sides = mat(COLORS.board);
  const top = mat(0xffffff, { map: boardTexture(), roughness: 0.45 });
  const pcb = mesh(new THREE.BoxGeometry(1.55, 0.05, 1.95), [sides, sides, top, sides, sides, sides]);
  pcb.position.set(0, 0.79, 0);
  add(part(pcb, [0, 0.42, 0], [0.12, 0, -0.08]));

  // microcontroller + chips
  const chipGroup = new THREE.Group();
  const mcu = mesh(new THREE.BoxGeometry(0.42, 0.07, 0.42), mat(COLORS.ink, { roughness: 0.35 }));
  chipGroup.add(mcu);
  for (let i = -1; i <= 1; i += 2) {
    const chip = mesh(new THREE.BoxGeometry(0.2, 0.05, 0.12), mat(COLORS.ink));
    chip.position.set(i * 0.42, 0, 0.32);
    chipGroup.add(chip);
  }
  chipGroup.position.set(0, 0.85, 0.05);
  add(part(chipGroup, [0, 0.82, 0.1], [0, 0.6, 0]));

  // battery pack
  const battery = mesh(new RoundedBoxGeometry(0.9, 0.24, 0.42, 2, 0.04), mat(0x3a3731, { roughness: 0.7 }));
  const label = mesh(new THREE.BoxGeometry(0.5, 0.245, 0.43), mat(COLORS.red));
  battery.add(label);
  battery.position.set(0, 0.95, -0.62);
  add(part(battery, [0, 0.6, -0.95], [0.3, 0.4, 0]));

  // ultrasonic sensor "eyes" on a bracket
  const head = new THREE.Group();
  const bracket = mesh(new THREE.BoxGeometry(0.1, 0.32, 0.1), mat(COLORS.grey, { metalness: 0.4 }));
  bracket.position.set(0, -0.2, 0);
  const sensorBoard = mesh(new THREE.BoxGeometry(0.95, 0.36, 0.05), mat(0x24221e));
  head.add(bracket, sensorBoard);
  for (let i = -1; i <= 1; i += 2) {
    const eye = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 32), mat(COLORS.metal, { metalness: 0.8, roughness: 0.25 }));
    eye.rotation.x = Math.PI / 2;
    eye.position.set(i * 0.25, 0, 0.1);
    const lens = mesh(new THREE.CircleGeometry(0.11, 32), mat(0x2b2925, { roughness: 1 }));
    lens.position.set(i * 0.25, 0, 0.181);
    head.add(eye, lens);
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), new THREE.MeshStandardMaterial({ color: COLORS.red, emissive: COLORS.red, emissiveIntensity: 2 }));
  led.position.set(0, 0.12, 0.04);
  head.add(led);
  head.position.set(0, 1.12, 0.82);
  add(part(head, [0, 0.55, 1.05], [-0.4, 0, 0]));

  // antenna with a glowing tip
  const antenna = new THREE.Group();
  const rod = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.75, 8), mat(COLORS.grey, { metalness: 0.6 }));
  rod.position.y = 0.375;
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 24, 24),
    new THREE.MeshStandardMaterial({ color: COLORS.red, emissive: COLORS.red, emissiveIntensity: 1.5 })
  );
  tip.position.y = 0.78;
  antenna.add(rod, tip);
  antenna.position.set(-0.55, 0.82, -0.78);
  add(part(antenna, [-0.35, 0.85, -0.4], [0, 0, 0.5]));

  // wheels
  const wheelSpots = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
  wheelSpots.forEach(([sx, sz]) => {
    const wheel = new THREE.Group();
    const spin = new THREE.Group(); // turns around the axle
    const tire = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 40), mat(COLORS.ink, { roughness: 0.9 }));
    tire.rotation.z = Math.PI / 2;
    const hub = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 6), mat(COLORS.red, { roughness: 0.4 }));
    hub.rotation.z = Math.PI / 2;
    const cap = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 16), mat(COLORS.metal, { metalness: 0.8, roughness: 0.3 }));
    cap.rotation.z = Math.PI / 2;
    spin.add(tire, hub, cap);
    wheel.add(spin);
    wheel.position.set(sx * 1.0, 0.36, sz * 0.66);
    const p = add(part(wheel, [sx * 0.7, 0.05, sz * 0.35], [0, sx * 0.5, 0]));
    wheels.push(spin);
    p.userData.isWheel = true;
  });

  return { robot, parts, wheels, tip, led };
}

/* ---------- 3. Scroll keyframes ---------- */
// t = scroll progress through the stage (0–1); "hold" pairs keep the robot still while a panel is read
const KEYS = [
  { t: 0.0, x: 0, rotY: -0.5, explode: 0, lift: 0, scale: 1 },
  { t: 0.1, x: 0, rotY: -0.5, explode: 0, lift: 0, scale: 1 },
  { t: 0.3, x: 1.7, rotY: 0.75, explode: 1, lift: 0.1, scale: 0.82 },
  { t: 0.42, x: 1.7, rotY: 0.95, explode: 1, lift: 0.1, scale: 0.82 },
  { t: 0.62, x: -1.45, rotY: 2.55, explode: 0, lift: 0, scale: 1 },
  { t: 0.74, x: -1.45, rotY: 2.7, explode: 0, lift: 0, scale: 1 },
  { t: 0.94, x: 1.45, rotY: 5.6, explode: 0, lift: 0, scale: 1 },
  { t: 1.0, x: 1.45, rotY: 5.65, explode: 0, lift: 0, scale: 1 },
];
const STEP_AT = [0, 0.2, 0.52, 0.84]; // where each text panel takes over

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

function sample(t) {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const k = ease(THREE.MathUtils.clamp((t - a.t) / (b.t - a.t || 1), 0, 1));
  const out = {};
  for (const key of ["x", "rotY", "explode", "lift", "scale"]) out[key] = a[key] + (b[key] - a[key]) * k;
  return out;
}

function scrollProgress() {
  const rect = stage.getBoundingClientRect();
  const total = rect.height - window.innerHeight;
  return THREE.MathUtils.clamp(-rect.top / (total || 1), 0, 1);
}

/* ---------- 4. Text panels ---------- */
let currentStep = -1;
function setStep(step) {
  if (step === currentStep) return;
  currentStep = step;
  stage.dataset.step = step;
  panels.forEach((p, i) => {
    const on = i === step;
    p.classList.toggle("is-active", on);
    p.inert = !on;
  });
  dots.forEach((d, i) => d.classList.toggle("is-active", i === step));
}

/* ---------- 5. Render loop ---------- */
function start() {
  const renderer = createRenderer();
  if (!renderer) return fallback(false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  addLights(scene);

  const { robot, parts, wheels, tip, led } = buildRobot();
  scene.add(robot);
  mount.append(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");

  // camera framing depends on screen shape
  function resize() {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const mobile = isMobile();
    camera.position.set(0, mobile ? 2.6 : 2.0, mobile ? 10.5 : 8.2);
    camera.lookAt(0, mobile ? 0.05 : 0.55, 0);
    camera.updateProjectionMatrix();
    if (reduceMotion) renderer.render(scene, camera);
  }
  new ResizeObserver(resize).observe(mount);
  resize();

  const state = { x: 0, rotY: -0.5, explode: 0, lift: 0, scale: 1 }; // smoothed values
  const pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.x = e.clientX / window.innerWidth - 0.5;
    pointer.y = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  const clock = new THREE.Clock();
  let running = false;

  function frame() {
    if (!running) return;
    const time = clock.getElapsedTime();
    const p = reduceMotion ? 0 : scrollProgress();
    const target = sample(p);
    const mobile = isMobile();

    // ease toward the scroll target so fast scrolling still looks smooth
    for (const key in state) state[key] += (target[key] - state[key]) * 0.09;

    robot.position.x = mobile ? 0 : state.x;
    robot.position.y = state.lift + Math.sin(time * 1.4) * 0.04 + (mobile ? 1.1 : 0);
    robot.rotation.y = state.rotY + (mobile ? 0 : pointer.x * 0.25);
    robot.rotation.x = mobile ? 0 : pointer.y * 0.08;
    robot.scale.setScalar(state.scale * (mobile ? 0.62 : 1));

    parts.forEach((part) => {
      const { home, offset, spin } = part.userData;
      part.position.copy(home).addScaledVector(offset, state.explode);
      part.rotation.set(spin.x * state.explode, spin.y * state.explode, spin.z * state.explode);
    });

    // wheels roll with the robot's travel
    wheels.forEach((w) => (w.rotation.x = -state.rotY * 1.6 - state.x * 2));

    const glow = 1.2 + Math.sin(time * 3) * 0.8;
    tip.material.emissiveIntensity = glow;
    led.material.emissiveIntensity = glow + 0.5;

    let step = 0;
    STEP_AT.forEach((at, i) => { if (p >= at) step = i; });
    setStep(step);

    renderer.render(scene, camera);
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  // only render while the stage is on screen
  new IntersectionObserver(([entry]) => {
    const was = running;
    running = entry.isIntersecting;
    if (running && !was) {
      clock.getDelta();
      frame();
    }
  }).observe(stage);

  if (reduceMotion) fallback(true);
}

/* ---------- 6. Fallbacks ---------- */
// reduced motion: keep a still robot and show all text; no WebGL: text only
function fallback(keepCanvas) {
  stage.classList.add("is-static");
  if (!keepCanvas) mount.remove();
  panels.forEach((p) => {
    p.classList.add("is-active");
    p.inert = false;
  });
}

if (stage && mount) {
  setStep(0);
  start();
}
