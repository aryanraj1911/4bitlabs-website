/* 4BitLabs: scroll-driven 3D robot for the home page
   1. Setup   2. Textures   3. Robot model
   4. Scroll keyframes   5. Panels   6. Render loop   7. Fallbacks */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const stage = document.querySelector("[data-stage]");
const mount = document.querySelector("[data-stage-canvas]");
const panels = [...document.querySelectorAll("[data-panel]")];
const dots = [...document.querySelectorAll("[data-dot]")];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = () => window.innerWidth <= 820;

/* ---------- 1. Setup ---------- */
function createRenderer() {
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile() ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !isMobile();
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    return renderer;
  } catch (err) {
    return null;
  }
}

function addLights(scene, renderer) {
  // image-based lighting gives metal and plastic believable reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 7, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -3;
  key.shadow.camera.right = key.shadow.camera.top = 3;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 5;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xd6effa, 0.6);
  fill.position.set(-5, 2, -3);
  scene.add(fill);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
}

/* ---------- 2. Textures (drawn with the canvas API) ---------- */
function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function traces(g, list, width, color) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = g.lineJoin = "round";
  list.forEach((t) => {
    g.beginPath();
    t.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  });
}

// controller board: blue PCB, traces, gold pads, white silkscreen
const controllerTexture = () =>
  canvasTexture(760, 960, (g, w, h) => {
    g.fillStyle = "#0b7fb8";
    g.fillRect(0, 0, w, h);
    traces(g, [
      [[90, 200], [250, 200], [300, 250], [300, 420]],
      [[680, 260], [520, 260], [470, 310], [470, 420]],
      [[120, 760], [260, 760], [330, 690], [330, 600]],
      [[640, 760], [540, 760], [470, 690], [470, 600]],
      [[380, 120], [380, 380]],
      [[150, 330], [150, 560], [230, 640]],
      [[610, 340], [610, 560], [540, 640]],
    ], 7, "#2aa3dc");
    g.fillStyle = "#e9c46a";
    [[90, 200], [680, 260], [120, 760], [640, 760], [380, 120], [150, 330], [610, 340]].forEach(([x, y]) => {
      g.beginPath();
      g.arc(x, y, 12, 0, Math.PI * 2);
      g.fill();
    });
    // mounting holes
    g.fillStyle = "#e9c46a";
    [[50, 50], [710, 50], [50, 910], [710, 910]].forEach(([x, y]) => {
      g.beginPath();
      g.arc(x, y, 24, 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = "#0b2233";
    [[50, 50], [710, 50], [50, 910], [710, 910]].forEach(([x, y]) => {
      g.beginPath();
      g.arc(x, y, 13, 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.font = "600 44px 'DM Sans', Arial, sans-serif";
    g.fillText("4BITS LABS", 210, 850);
    g.font = "24px 'IBM Plex Mono', monospace";
    g.fillText("CONTROLLER R1 · NAGPUR", 205, 890);
    ["D13", "D12", "D11", "D10", "D9", "D8"].forEach((t, i) => g.fillText(t, 640, 330 + i * 60));
    ["A0", "A1", "A2", "A3", "A4", "A5"].forEach((t, i) => g.fillText(t, 70, 420 + i * 60));
  });

const sensorTexture = () =>
  canvasTexture(900, 420, (g, w, h) => {
    g.fillStyle = "#0a6fa6";
    g.fillRect(0, 0, w, h);
    traces(g, [[[450, 40], [450, 120], [380, 190]], [[300, 360], [300, 300], [360, 260]], [[600, 360], [600, 300], [540, 260]]], 6, "#2a9ad2");
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.font = "600 40px 'IBM Plex Mono', monospace";
    g.fillText("HC-SR04", 365, 60);
    g.font = "30px 'IBM Plex Mono', monospace";
    g.fillText("T", 205, 400);
    g.fillText("R", 680, 400);
    ["VCC", "Trig", "Echo", "Gnd"].forEach((t, i) => g.fillText(t, 300 + i * 85, 400));
  });

// fine metal mesh on the front of the ultrasonic transducers
const meshTexture = () =>
  canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = "#3c434b";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#c9d1d9";
    g.lineWidth = 2;
    for (let i = 0; i < w; i += 8) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke();
    }
  });

// rows of holes on the black header strips
const headerTexture = () => {
  const tex = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = "#15181c";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#000";
    g.fillRect(22, 22, 20, 20);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
};

// printed wrap on the 18650 battery cells
const cellTexture = () =>
  canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = "#0a8fd0";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.font = "600 38px 'DM Sans', Arial";
    g.fillText("18650  3.7V", 130, 78);
  });

/* ---------- 3. Robot model ---------- */
const M = {
  acrylic: () => new THREE.MeshPhysicalMaterial({ color: 0xf7fbff, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  frosted: () => new THREE.MeshPhysicalMaterial({ color: 0xe9f1fa, roughness: 0.35, transmission: 0.55, thickness: 0.05, ior: 1.45 }),
  brass: () => new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 1, roughness: 0.32 }),
  steel: () => new THREE.MeshStandardMaterial({ color: 0xd9dee4, metalness: 1, roughness: 0.25 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.92 }),
  plastic: (color, roughness = 0.45) => new THREE.MeshStandardMaterial({ color, roughness }),
};

function mesh(geometry, material, cast = true) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

// a flat chassis plate with rounded corners and mounting holes
function plateGeometry(w, d, r, holes, depth = 0.045) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  holes.forEach(([hx, hy, hr]) => {
    const p = new THREE.Path();
    p.absarc(hx, hy, hr, 0, Math.PI * 2, true);
    s.holes.push(p);
  });
  const geo = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 20,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function holeGrid(w, d, step, r, skip = () => false) {
  const out = [];
  for (let x = -w / 2 + step; x < w / 2 - step / 2; x += step)
    for (let y = -d / 2 + step; y < d / 2 - step / 2; y += step)
      if (!skip(x, y)) out.push([x, y, r]);
  return out;
}

// each part remembers its assembled position and where it moves to when the kit "opens"
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

function screw(x, y, z) {
  const s = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.018, 16), M.steel(), false);
  s.position.set(x, y, z);
  return s;
}

function buildWheel(side) {
  const wheel = new THREE.Group();
  const spin = new THREE.Group();

  // rubber tyre: a rounded profile turned around the axle
  const profile = [
    [0.235, -0.11], [0.31, -0.11], [0.332, -0.098], [0.342, -0.075],
    [0.342, 0.075], [0.332, 0.098], [0.31, 0.11], [0.235, 0.11],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tyreGeo = new THREE.LatheGeometry(profile, 64);
  tyreGeo.rotateZ(Math.PI / 2);
  const tyreMat = M.rubber();
  tyreMat.side = THREE.DoubleSide;
  spin.add(mesh(tyreGeo, tyreMat));

  // tread blocks around the tyre
  const treadCount = 30;
  const tread = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.022, 0.045), M.rubber(), treadCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < treadCount; i++) {
    const a = (i / treadCount) * Math.PI * 2;
    dummy.position.set(0, Math.cos(a) * 0.346, Math.sin(a) * 0.346);
    dummy.rotation.set(a, 0, 0);
    dummy.updateMatrix();
    tread.setMatrixAt(i, dummy.matrix);
  }
  tread.castShadow = true;
  spin.add(tread);

  // blue rim with five round cut-outs, facing outwards
  const rimShape = new THREE.Shape();
  rimShape.absarc(0, 0, 0.235, 0, Math.PI * 2, false);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0.055, 0, Math.PI * 2, true);
    rimShape.holes.push(h);
  }
  const hubHole = new THREE.Path();
  hubHole.absarc(0, 0, 0.03, 0, Math.PI * 2, true);
  rimShape.holes.push(hubHole);
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: 0.03, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, curveSegments: 28 });
  rimGeo.rotateY(Math.PI / 2);
  const rimMat = M.plastic(0x00abe4, 0.35);
  const rim = mesh(rimGeo, rimMat);
  rim.position.x = side > 0 ? 0.045 : -0.075;
  spin.add(rim);

  // dark inner barrel so you can't see through the rim
  const barrel = mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.16, 32, 1, true), M.plastic(0x10161c, 0.8));
  barrel.rotation.z = Math.PI / 2;
  barrel.material.side = THREE.DoubleSide;
  spin.add(barrel);

  const cap = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 16), M.steel());
  cap.rotation.z = Math.PI / 2;
  spin.add(cap);

  wheel.add(spin);
  return { wheel, spin };
}

function buildMotor(side) {
  const motor = new THREE.Group();
  const body = mesh(new RoundedBoxGeometry(0.42, 0.2, 0.19, 3, 0.03), M.plastic(0xeef2f6, 0.5));
  const can = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.2, 24), M.steel());
  can.rotation.z = Math.PI / 2;
  can.position.x = -side * 0.29;
  const shaft = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 12), M.plastic(0xeef2f6));
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = side * 0.25;
  // two solder tabs with red/black leads
  const tabs = [0xc0392b, 0x1b1e22].map((c, i) => {
    const t = mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), M.steel(), false);
    t.position.set(-side * 0.4, 0.04 - i * 0.08, 0);
    return t;
  });
  motor.add(body, can, shaft, ...tabs);
  return motor;
}

function buildController() {
  const board = new THREE.Group();
  const top = new THREE.MeshStandardMaterial({ map: controllerTexture(), roughness: 0.42, metalness: 0.05 });
  const edge = M.plastic(0x0b6fa0, 0.5);
  board.add(mesh(new THREE.BoxGeometry(0.76, 0.03, 0.96), [edge, edge, top, edge, edge, edge]));

  const add = (geo, mat, x, y, z) => {
    const m = mesh(geo, mat);
    m.position.set(x, y, z);
    board.add(m);
    return m;
  };
  // microcontroller chip with legs
  add(new THREE.BoxGeometry(0.14, 0.035, 0.42), M.plastic(0x15181c, 0.35), 0.06, 0.032, 0.02);
  const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.012, 0.012), M.steel(), 28);
  const d = new THREE.Object3D();
  for (let i = 0; i < 28; i++) {
    const s = i < 14 ? -1 : 1;
    d.position.set(0.06 + s * 0.085, 0.022, -0.17 + (i % 14) * 0.028);
    d.updateMatrix();
    legs.setMatrixAt(i, d.matrix);
  }
  board.add(legs);
  // headers along both long edges
  const hTex = headerTexture();
  hTex.repeat.set(1, 14);
  const hTop = new THREE.MeshStandardMaterial({ map: hTex, roughness: 0.6 });
  const hSide = M.plastic(0x15181c, 0.6);
  [-0.33, 0.33].forEach((x) => {
    const strip = mesh(new THREE.BoxGeometry(0.06, 0.09, 0.66), [hSide, hSide, hTop, hSide, hSide, hSide]);
    strip.position.set(x, 0.06, 0.02);
    board.add(strip);
  });
  // USB port, power jack, crystal, reset button, LEDs
  add(new RoundedBoxGeometry(0.22, 0.14, 0.2, 2, 0.015), M.steel(), -0.12, 0.085, -0.43);
  add(new RoundedBoxGeometry(0.16, 0.13, 0.2, 2, 0.02), M.plastic(0x15181c, 0.5), 0.2, 0.08, -0.42);
  add(new RoundedBoxGeometry(0.1, 0.035, 0.04, 2, 0.012), M.steel(), -0.12, 0.032, 0.05);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16), M.plastic(0xe9f1fa, 0.4), -0.2, 0.03, -0.22);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x00abe4, emissive: 0x00abe4, emissiveIntensity: 2.5 });
  const led = add(new THREE.BoxGeometry(0.03, 0.015, 0.02), ledMat, -0.22, 0.024, 0.25);
  board.userData.led = led;
  return board;
}

function buildSensor() {
  const sensor = new THREE.Group();
  const front = new THREE.MeshStandardMaterial({ map: sensorTexture(), roughness: 0.45 });
  const edge = M.plastic(0x0a5f8e, 0.5);
  const pcb = mesh(new THREE.BoxGeometry(0.9, 0.42, 0.025), [edge, edge, edge, edge, front, edge]);
  sensor.add(pcb);
  const meshMat = new THREE.MeshStandardMaterial({ map: meshTexture(), metalness: 0.6, roughness: 0.45 });
  [-0.26, 0.26].forEach((x) => {
    const can = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 40, 1, true), M.steel());
    can.material.side = THREE.DoubleSide;
    can.rotation.x = Math.PI / 2;
    can.position.set(x, 0, 0.08);
    const grille = mesh(new THREE.CircleGeometry(0.155, 40), meshMat);
    grille.position.set(x, 0, 0.13);
    const ring = mesh(new THREE.TorusGeometry(0.157, 0.008, 8, 40), M.steel());
    ring.position.set(x, 0, 0.15);
    sensor.add(can, grille, ring);
  });
  // crystal and pins
  const xtal = mesh(new RoundedBoxGeometry(0.1, 0.04, 0.03, 2, 0.012), M.steel());
  xtal.position.set(0, 0.13, 0.025);
  sensor.add(xtal);
  for (let i = 0; i < 4; i++) {
    const pin = mesh(new THREE.BoxGeometry(0.018, 0.12, 0.018), M.brass(), false);
    pin.position.set(-0.13 + i * 0.087, -0.26, -0.01);
    sensor.add(pin);
  }
  // L-bracket that holds it to the chassis
  const bracket = mesh(new THREE.BoxGeometry(0.5, 0.025, 0.2), M.steel());
  bracket.position.set(0, -0.31, -0.08);
  sensor.add(bracket);
  return sensor;
}

function buildBattery() {
  const holder = new THREE.Group();
  const box = mesh(new RoundedBoxGeometry(0.82, 0.12, 0.5, 3, 0.03), M.plastic(0x15181c, 0.6));
  holder.add(box);
  const wrap = new THREE.MeshStandardMaterial({ map: cellTexture(), roughness: 0.3, metalness: 0.1 });
  [-0.11, 0.11].forEach((z) => {
    const cell = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.66, 32), [wrap, M.steel(), M.steel()]);
    cell.rotation.z = Math.PI / 2;
    cell.position.set(0, 0.08, z);
    holder.add(cell);
  });
  // spring contacts at the ends
  [-0.38, 0.38].forEach((x) => {
    const c = mesh(new THREE.BoxGeometry(0.02, 0.14, 0.4), M.steel(), false);
    c.position.set(x, 0.08, 0);
    holder.add(c);
  });
  // power switch
  const sw = mesh(new RoundedBoxGeometry(0.1, 0.06, 0.06, 2, 0.012), M.plastic(0xe9f1fa, 0.4));
  sw.position.set(0.3, 0.06, 0.28);
  holder.add(sw);
  return holder;
}

function buildDriver() {
  const d = new THREE.Group();
  const pcb = mesh(new THREE.BoxGeometry(0.5, 0.025, 0.5), M.plastic(0x0b6fa0, 0.5));
  d.add(pcb);
  // black heatsink with fins
  const sink = new THREE.Group();
  const base = mesh(new THREE.BoxGeometry(0.26, 0.04, 0.2), M.plastic(0x1b1e22, 0.5));
  sink.add(base);
  for (let i = 0; i < 7; i++) {
    const fin = mesh(new THREE.BoxGeometry(0.016, 0.16, 0.2), new THREE.MeshStandardMaterial({ color: 0x23282e, metalness: 0.6, roughness: 0.4 }));
    fin.position.set(-0.11 + i * 0.037, 0.1, 0);
    sink.add(fin);
  }
  sink.position.set(0, 0.03, -0.06);
  d.add(sink);
  // blue screw terminals
  [-0.17, 0.17].forEach((x) => {
    const t = mesh(new RoundedBoxGeometry(0.13, 0.1, 0.1, 2, 0.015), M.plastic(0x00abe4, 0.4));
    t.position.set(x, 0.06, 0.18);
    d.add(t);
  });
  return d;
}

// jumper wires, faded out when the kit comes apart
function wire(points, color, radius = 0.014) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const m = mesh(new THREE.TubeGeometry(curve, 48, radius, 8, false), new THREE.MeshStandardMaterial({ color, roughness: 0.5, transparent: true }));
  return m;
}

function buildRobot() {
  const robot = new THREE.Group();
  const parts = [];
  const spins = [];
  const add = (p) => {
    robot.add(p);
    parts.push(p);
    return p;
  };

  // heights (y): wheel axle 0.342, lower plate 0.5, standoffs to 0.9, upper plate 0.9
  const AXLE = 0.342, LOW = 0.5, HIGH = 0.9;

  // lower plate
  const lowHoles = holeGrid(1.5, 2.0, 0.2, 0.028, (x, y) => Math.abs(x) < 0.35 && Math.abs(y) < 0.5);
  const lower = mesh(plateGeometry(1.5, 2.0, 0.14, lowHoles), M.acrylic());
  lower.position.set(0, LOW, 0);
  lower.add(screw(0.6, 0.06, 0.75), screw(-0.6, 0.06, 0.75), screw(0.6, 0.06, -0.75), screw(-0.6, 0.06, -0.75));
  add(part(lower, [0, 0, 0]));

  // upper plate (frosted)
  const upHoles = [[0.52, 0.62, 0.03], [-0.52, 0.62, 0.03], [0.52, -0.62, 0.03], [-0.52, -0.62, 0.03],
    [0, 0.78, 0.06], [0.3, 0.78, 0.03], [-0.3, 0.78, 0.03]];
  const upper = mesh(plateGeometry(1.3, 1.7, 0.12, upHoles, 0.04), M.frosted());
  upper.position.set(0, HIGH, 0);
  upper.add(screw(0.52, 0.055, 0.62), screw(-0.52, 0.055, 0.62), screw(0.52, 0.055, -0.62), screw(-0.52, 0.055, -0.62));
  add(part(upper, [0, 0.55, 0], [0.06, 0, -0.04]));

  // brass hex standoffs
  [[0.52, 0.62], [-0.52, 0.62], [0.52, -0.62], [-0.52, -0.62]].forEach(([x, z]) => {
    const s = mesh(new THREE.CylinderGeometry(0.035, 0.035, HIGH - LOW - 0.045, 6), M.brass());
    s.position.set(x, (LOW + 0.045 + HIGH) / 2, z);
    add(part(s, [x * 0.15, 0.28, z * 0.1]));
  });

  // motors under the lower plate, wheels on their shafts
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
    const motor = buildMotor(sx);
    motor.position.set(sx * 0.48, AXLE + 0.02, sz * 0.66);
    add(part(motor, [sx * 0.3, -0.05, sz * 0.15]));

    const { wheel, spin } = buildWheel(sx);
    wheel.position.set(sx * 0.86, AXLE, sz * 0.66);
    add(part(wheel, [sx * 0.75, 0.05, sz * 0.3], [0, sx * 0.4, 0]));
    spins.push(spin);
  });

  // motor driver between the plates
  const driver = buildDriver();
  driver.position.set(0, LOW + 0.06, -0.2);
  add(part(driver, [0, 0.25, -0.85], [0, -0.3, 0]));

  // controller board and battery on top
  const controller = buildController();
  controller.position.set(0, HIGH + 0.075, 0.18);
  add(part(controller, [0, 1.05, 0.25], [0.18, 0.3, 0]));

  const battery = buildBattery();
  battery.position.set(0, HIGH + 0.11, -0.52);
  add(part(battery, [0, 0.8, -0.9], [0.25, -0.35, 0]));

  // ultrasonic sensor on the front edge
  const sensor = buildSensor();
  sensor.position.set(0, LOW + 0.36, 1.02);
  add(part(sensor, [0, 0.35, 0.85], [-0.3, 0, 0]));

  // wiring
  const wires = [
    wire([[-0.05, HIGH + 0.13, 0.5], [-0.05, HIGH + 0.25, 0.75], [-0.04, LOW + 0.2, 1.0]], 0x00abe4),
    wire([[0.05, HIGH + 0.13, 0.5], [0.06, HIGH + 0.28, 0.76], [0.05, LOW + 0.2, 1.0]], 0xf2f5f8),
    wire([[0.14, HIGH + 0.13, 0.5], [0.16, HIGH + 0.22, 0.78], [0.13, LOW + 0.2, 1.0]], 0x1b1e22),
    wire([[0.33, HIGH + 0.12, -0.1], [0.62, HIGH + 0.05, -0.2], [0.6, LOW + 0.1, -0.12], [0.17, LOW + 0.12, -0.05]], 0x7fd6f7),
    wire([[-0.3, HIGH + 0.12, -0.6], [-0.55, HIGH - 0.05, -0.75], [-0.2, LOW + 0.1, -0.4]], 0xc0392b, 0.018),
    wire([[-0.24, HIGH + 0.12, -0.6], [-0.5, HIGH - 0.08, -0.7], [-0.16, LOW + 0.1, -0.38]], 0x1b1e22, 0.018),
  ];
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
    wires.push(wire([[sx * 0.88 * 0.5 + sx * 0.0, AXLE + 0.06, sz * 0.66], [sx * 0.3, LOW - 0.05, sz * 0.4], [sx * 0.15, LOW + 0.08, -0.05]], sz > 0 ? 0xc0392b : 0x1b1e22, 0.012));
  });
  wires.forEach((w) => robot.add(w));

  return { robot, parts, spins, wires, led: controller.userData.led };
}

/* ---------- 4. Scroll keyframes ---------- */
// t = scroll progress through the stage (0–1); "hold" pairs keep the robot still while a panel is read
const KEYS = [
  { t: 0.0, x: 0, rotY: -0.55, explode: 0, lift: 0, scale: 1 },
  { t: 0.1, x: 0, rotY: -0.55, explode: 0, lift: 0, scale: 1 },
  { t: 0.3, x: 1.6, rotY: 0.7, explode: 1, lift: 0.05, scale: 0.85 },
  { t: 0.42, x: 1.6, rotY: 0.9, explode: 1, lift: 0.05, scale: 0.85 },
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

/* ---------- 5. Text panels ---------- */
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

/* ---------- 6. Render loop ---------- */
async function start() {
  const renderer = createRenderer();
  if (!renderer) return fallback(false);

  // the board textures use the site fonts, so wait for them (but not forever)
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  addLights(scene, renderer);

  const { robot, parts, spins, wires, led } = buildRobot();
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
    camera.position.set(0, mobile ? 2.6 : 2.1, mobile ? 10.5 : 7.6);
    camera.lookAt(0, mobile ? 0.05 : 0.5, 0);
    camera.updateProjectionMatrix();
    if (reduceMotion) renderer.render(scene, camera);
  }
  new ResizeObserver(resize).observe(mount);
  resize();

  const state = { x: 0, rotY: -0.55, explode: 0, lift: 0, scale: 1 }; // smoothed values
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
    robot.position.y = state.lift + Math.sin(time * 1.3) * 0.025 + (mobile ? 1.1 : 0);
    robot.rotation.y = state.rotY + (mobile ? 0 : pointer.x * 0.25);
    robot.rotation.x = mobile ? 0 : pointer.y * 0.06;
    robot.scale.setScalar(state.scale * (mobile ? 0.66 : 1));

    parts.forEach((part) => {
      const { home, offset, spin } = part.userData;
      part.position.copy(home).addScaledVector(offset, state.explode);
      part.rotation.set(spin.x * state.explode, spin.y * state.explode, spin.z * state.explode);
    });

    const wireOpacity = 1 - Math.min(1, state.explode * 3);
    wires.forEach((w) => {
      w.material.opacity = wireOpacity;
      w.visible = wireOpacity > 0.01;
    });

    // wheels roll with the robot's travel
    spins.forEach((s) => (s.rotation.x = -state.rotY * 1.6 - state.x * 2));

    led.material.emissiveIntensity = 1.5 + Math.sin(time * 3) * 1.2;

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
    if (running && !was) frame();
  }).observe(stage);

  if (reduceMotion) fallback(true);
}

/* ---------- 7. Fallbacks ---------- */
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
