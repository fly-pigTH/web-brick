import * as THREE from 'three';
import { OrbitControls } from './lib/OrbitControls.js';
import { GLTFLoader } from './lib/GLTFLoader.js';

const SET = new URLSearchParams(location.search).get('set') || '42107';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1d24);
scene.fog = new THREE.Fog(0x1a1d24, 1500, 4000);

const camera = new THREE.PerspectiveCamera(42, 1, 1, 8000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xdde4f0, 0x3a3f48, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const grid = new THREE.GridHelper(3000, 60, 0x3a3f4b, 0x272b33);
scene.add(grid);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ---------------- 数据加载
const setIndex = await (await fetch('sets/index.json')).json();
const sel = document.getElementById('setsel');
for (const s of setIndex) {
  const o = document.createElement('option');
  o.value = s.id;
  o.textContent = `${s.id} · ${s.name} (${s.parts})`;
  if (s.id === SET) o.selected = true;
  sel.appendChild(o);
}
sel.onchange = () => location.search = '?set=' + sel.value;

const meta = await (await fetch(`sets/${SET}/set.json`)).json();
const seek = document.getElementById('seek');
seek.max = meta.pages;
const gltf = await new GLTFLoader().loadAsync(`sets/${SET}/lib.glb`);
const geos = {};
gltf.scene.traverse(n => { if (n.isMesh) geos[n.name] = n.geometry; });

const mats = {};
function matFor(id, ghost = false) {
  const key = id + (ghost ? '_g' : '');
  if (mats[key]) return mats[key];
  const [r, g, b, a] = meta.colors[id] || [0.6, 0.6, 0.6, 1];
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(r, g, b), roughness: 0.42, metalness: 0.05,
    transparent: ghost || a < 1, opacity: ghost ? 0.35 : a,
    side: THREE.DoubleSide, flatShading: true,
  });
  if (ghost) { m.emissive = new THREE.Color(0x2ee6ff); m.emissiveIntensity = 0.55; m.depthWrite = false; }
  mats[key] = m;
  return m;
}

// ---------------- 实例与分组
const parts = [];        // {grp, page, target(Vector3), group}
const pagesParts = Array.from({ length: meta.pages }, () => []);
const groupCenter = {}, groupN = {};
const bbox = new THREE.Box3();

for (const inst of meta.instances) {
  const grp = new THREE.Group();
  grp.position.fromArray(inst.p);
  grp.quaternion.set(inst.q[1], inst.q[2], inst.q[3], inst.q[0]);
  // MuJoCo z-up -> three y-up: 外层容器旋转
  for (const mid of inst.ms) {
    const mesh = new THREE.Mesh(geos[mid], matFor(mid));
    mesh.castShadow = true;
    mesh.userData.mid = mid;
    grp.add(mesh);
  }
  const part = { grp, page: inst.pg, target: grp.position.clone(), group: inst.g, placed: false };
  grp.userData.part = part;
  parts.push(part);
  pagesParts[inst.pg].push(part);
  bbox.expandByPoint(grp.position);
  groupCenter[inst.g] = (groupCenter[inst.g] || new THREE.Vector3()).add(grp.position);
  groupN[inst.g] = (groupN[inst.g] || 0) + 1;
}
for (const g in groupCenter) groupCenter[g].divideScalar(groupN[g]);
const allCenter = new THREE.Vector3();
parts.forEach(p => allCenter.add(p.target));
allCenter.divideScalar(parts.length);

const world = new THREE.Group();
world.rotation.x = -Math.PI / 2;   // z-up 数据 -> y-up 场景
parts.forEach(p => world.add(p.grp));
scene.add(world);

// 相机取景
const size = bbox.getSize(new THREE.Vector3()).length() || 300;
const c0 = bbox.getCenter(new THREE.Vector3());
const lookAt = new THREE.Vector3(c0.x, c0.z, -c0.y);
camera.position.set(lookAt.x + size * 0.85, lookAt.y + size * 0.55, lookAt.z + size * 0.85);
controls.target.copy(lookAt);
sun.position.set(lookAt.x + size, lookAt.y + size * 1.4, lookAt.z + size * 0.6);
sun.shadow.camera.left = sun.shadow.camera.bottom = -size;
sun.shadow.camera.right = sun.shadow.camera.top = size;
sun.shadow.camera.far = size * 5;

// ---------------- 拼装状态机
let page = 0, placedCount = 0, exploded = false, autoTimer = null;
const anims = [];

function setGhost(part, ghost) {
  part.grp.children.forEach(m => { m.material = matFor(m.userData.mid, ghost); });
}
function refresh() {
  parts.forEach(p => {
    const vis = p.page < page || (p.page === page);
    p.grp.visible = vis && !(p.page > page);
    if (p.page < page && !p.placed) { p.placed = true; }
    if (p.page === page) setGhost(p, !p.placed);
    else if (p.grp.visible) setGhost(p, false);
  });
  placedCount = parts.filter(p => p.placed || p.page < page).length;
  document.getElementById('title').textContent = `LEGO ${meta.name}`;
  document.getElementById('stat').textContent =
    `步骤 ${Math.min(page + 1, meta.pages)}/${meta.pages} · 零件 ${placedCount}/${meta.count}`;
  document.getElementById('prog').style.width = (100 * placedCount / meta.count) + '%';
  seek.value = page;
}
function place(part) {
  if (part.placed || part.page !== page) return;
  part.placed = true;
  setGhost(part, false);
  part.grp.scale.setScalar(1.25);
  anims.push({ grp: part.grp, t: 0 });
  if (pagesParts[page].every(p => p.placed)) { page = Math.min(page + 1, meta.pages); }
  refresh();
}
function jumpTo(np) {
  page = Math.max(0, Math.min(np, meta.pages));
  parts.forEach(p => { p.placed = p.page < page; });
  refresh();
}

seek.addEventListener('input', () => jumpTo(+seek.value));
const SPEEDS = [1, 2, 4, 8];
let speedIdx = 0;
document.getElementById('speed').onclick = () => {
  speedIdx = (speedIdx + 1) % SPEEDS.length;
  document.getElementById('speed').textContent = SPEEDS[speedIdx] + '\u00d7';
};
document.getElementById('next').onclick = () => jumpTo(page + 1);
document.getElementById('prev').onclick = () => jumpTo(page - 1);
document.getElementById('reset').onclick = () => { stopAuto(); exploded = false; jumpTo(0); };
document.getElementById('explode').onclick = () => { exploded = !exploded; };
function stopAuto() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; document.getElementById('auto').textContent = '▶ 自动拼装'; }
}
document.getElementById('auto').onclick = () => {
  if (autoTimer) { stopAuto(); return; }
  document.getElementById('auto').textContent = '⏸ 暂停';
  autoTimer = setInterval(() => {
    for (let k = 0; k < SPEEDS[speedIdx]; k++) {
      const next = pagesParts[page]?.find(p => !p.placed);
      if (next) place(next);
      else if (page < meta.pages) { jumpTo(page + 1); }
      else { stopAuto(); break; }
    }
  }, 100);
};
addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); pagesParts[page]?.forEach(place); }
});

// 点击安装
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
canvas.addEventListener('pointerdown', e => {
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const ghosts = pagesParts[page]?.filter(p => !p.placed).flatMap(p => p.grp.children) || [];
  const hit = ray.intersectObjects(ghosts, false)[0];
  if (hit) place(hit.object.parent.userData.part);
});

// ---------------- 动画循环
function explodeOffset(part) {
  const d = groupCenter[part.group].clone().sub(allCenter);
  d.x *= 1.6; d.y *= 2.2; d.z = d.z * 1.3;
  const j = part.target.clone().sub(groupCenter[part.group]).multiplyScalar(0.8);
  return d.add(j).add(new THREE.Vector3(0, 0, size * 0.3));
}
function tick() {
  requestAnimationFrame(tick);
  const w = innerWidth, h = innerHeight;
  if (canvas.width !== w * renderer.getPixelRatio()) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i];
    a.t += 0.12;
    a.grp.scale.setScalar(1.25 - 0.25 * Math.min(a.t, 1));
    if (a.t >= 1) { a.grp.scale.setScalar(1); anims.splice(i, 1); }
  }
  parts.forEach(p => {
    if (!p.grp.visible) return;
    const want = exploded ? p.target.clone().add(explodeOffset(p)) : p.target;
    p.grp.position.lerp(want, 0.12);
  });
  controls.update();
  renderer.render(scene, camera);
}
refresh();
tick();
