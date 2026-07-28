// Neon Reef — a WebGPU-first Three.js scene that degrades to WebGL2 on its own.
// The point of the template: ONE renderer construction path (WebGPURenderer) that
// picks the best backend the browser actually has, so the same bundle is a WebGPU
// demo on Chrome/Edge and a WebGL2 demo everywhere else.
import * as THREE from 'three/webgpu';
import { color, mix, positionLocal, sin, time, uniform, vec3, vec4 } from 'three/tsl';

const hud = (t) => { document.getElementById('hud').textContent = t; };

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060d);
scene.fog = new THREE.Fog(0x05060d, 26, 74);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 9, 22);

const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setAnimationLoop(frame);
document.body.appendChild(renderer.domElement);

// ---- lights -------------------------------------------------------------
scene.add(new THREE.HemisphereLight(0x8899ff, 0x0a0a12, 1.1));
const key = new THREE.DirectionalLight(0xffe8d0, 2.2);
key.position.set(6, 14, 8);
scene.add(key);
for (const [x, z, c] of [[-14, -8, 0x22d3ee], [14, -6, 0xf472b6], [0, 12, 0xa78bfa]]) {
  const p = new THREE.PointLight(c, 260, 60);
  p.position.set(x, 7, z);
  scene.add(p);
}

// ---- a TSL node material: the vertex wave runs on the GPU, not the CPU ----
const amp = uniform(0.55);
const wave = sin(positionLocal.x.mul(0.55).add(time.mul(1.4)))
  .add(sin(positionLocal.z.mul(0.4).sub(time.mul(0.9))))
  .mul(amp);

const reef = new THREE.MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0.55 });
reef.positionNode = positionLocal.add(vec3(0, wave, 0));
reef.colorNode = mix(color(0x0e7490), color(0xf0abfc), wave.mul(0.6).add(0.5));
reef.emissiveNode = color(0x0891b2).mul(wave.abs().mul(0.7));

const floorGeo = new THREE.PlaneGeometry(90, 90, 160, 160);
floorGeo.rotateX(-Math.PI / 2);
scene.add(new THREE.Mesh(floorGeo, reef));

// ---- 900 instanced shards, one draw call ---------------------------------
const COUNT = 900;
const shard = new THREE.InstancedMesh(
  new THREE.IcosahedronGeometry(0.42, 0),
  new THREE.MeshStandardNodeMaterial({ roughness: 0.15, metalness: 0.9, emissiveNode: color(0x1e3a8a) }),
  COUNT,
);
const seeds = [];
const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
for (let i = 0; i < COUNT; i++) {
  const r = 4 + Math.random() * 32, a = Math.random() * Math.PI * 2;
  seeds.push({ r, a, y: 1 + Math.random() * 9, spin: 0.2 + Math.random() * 1.6, k: 0.15 + Math.random() * 0.5 });
  shard.setColorAt(i, new THREE.Color().setHSL(0.5 + Math.random() * 0.35, 0.85, 0.6));
}
scene.add(shard);

// ---- input: drag to orbit, wheel to dolly --------------------------------
let yaw = 0, pitch = 0.28, dist = 24, drag = false, px = 0, py = 0;
addEventListener('pointerdown', (ev) => { drag = true; px = ev.clientX; py = ev.clientY; });
addEventListener('pointerup', () => { drag = false; });
addEventListener('pointermove', (ev) => {
  if (!drag) return;
  yaw -= (ev.clientX - px) * 0.005;
  pitch = Math.max(0.05, Math.min(1.35, pitch + (ev.clientY - py) * 0.004));
  px = ev.clientX; py = ev.clientY;
});
addEventListener('wheel', (ev) => { dist = Math.max(8, Math.min(60, dist + ev.deltaY * 0.02)); }, { passive: true });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let frames = 0, mark = performance.now(), fps = 0;
function frame(t) {
  const sec = t * 0.001;
  for (let i = 0; i < COUNT; i++) {
    const o = seeds[i];
    const a = o.a + sec * o.k;
    e.set(sec * o.spin, a * 2, sec * o.spin * 0.6);
    q.setFromEuler(e);
    s.setScalar(0.7 + Math.sin(sec * 2 + i) * 0.2);
    m.compose(new THREE.Vector3(Math.cos(a) * o.r, o.y + Math.sin(sec + i) * 0.6, Math.sin(a) * o.r), q, s);
    shard.setMatrixAt(i, m);
  }
  shard.instanceMatrix.needsUpdate = true;

  camera.position.set(
    Math.sin(yaw) * Math.cos(pitch) * dist,
    Math.sin(pitch) * dist + 2,
    Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  camera.lookAt(0, 2, 0);
  renderer.render(scene, camera);

  if (++frames >= 30) {
    const now = performance.now();
    fps = Math.round((frames * 1000) / (now - mark));
    frames = 0; mark = now;
    hud(`${renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2'} · ${COUNT} instanced shards · ${fps} fps\ndrag to orbit · wheel to zoom`);
  }
}

hud('booting renderer…');
