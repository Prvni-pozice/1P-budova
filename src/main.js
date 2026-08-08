import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { SPEC, TYPES, area } from './spec.js'
import { computeMEP, SERVICES, blockDemand } from './mep.js'
import { buildAll } from './building.js'
import { Cutaway } from './cutaway.js'
import { Env } from './env.js'
import { Quality } from './quality.js'
import { summaryText } from './ui.js'

// spec je živý — editace ho mění a model se z něj přegeneruje
const spec = structuredClone(SPEC)
const ORIGINAL = structuredClone(SPEC)

// ------------------------------------------------------------------ scéna
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.12
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0xffa877, 70, 300)

const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 900)
camera.position.set(-27, 19, 50)   // jihovýchod — vstupní průčelí proti slunci

const env = new Env(scene, 420)
env.applyEnvMap(renderer, scene)
env.focus(new THREE.Vector3(spec.stage1 / 2, spec.eaves / 2, spec.depth / 2))
const quality = new Quality(renderer, env.sun, scene.fog)

const orbit = new OrbitControls(camera, renderer.domElement)
orbit.target.set(spec.stage1 / 2, spec.eaves * 0.45, spec.depth / 2)
orbit.enableDamping = true
orbit.dampingFactor = 0.08
orbit.maxPolarAngle = Math.PI * 0.495
orbit.minDistance = 4
orbit.maxDistance = 220
orbit.update()

// ------------------------------------------------------------ přegenerování
let built = null
let mep = null
let cut = null
let cutMode = 'auto'
let levelFilter = 'all'
let selectedId = null

function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose()
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
    for (const m of mats) {
      if (m.map) m.map.dispose()
      m.dispose()
    }
  })
}

function rebuild() {
  if (built) {
    scene.remove(built.root)
    disposeTree(built.root)
  }
  mep = computeMEP(spec)
  built = buildAll(spec, mep)
  scene.add(built.root)
  cut = new Cutaway(built.walls, built.groups.roof, spec)
  cut.mode = cutMode
  applyLayers()
  applyMepToggles()
  document.getElementById('summary').textContent = summaryText(spec, mep)
  refreshSelection()
}

// -------------------------------------------------------------------- vrstvy
const $ = (id) => document.getElementById(id)
const chk = { blocks: $('ly-blocks'), labels: $('ly-labels'), structure: $('ly-structure'), stage2: $('ly-stage2') }

function levelVisible(b) {
  if (levelFilter === 'all') return true
  if (b.level === 'full') return true
  return String(b.level) === levelFilter
}

function applyLayers() {
  const g = built.groups
  g.blocks.visible = chk.blocks.checked
  g.labels.visible = chk.labels.checked
  g.structure.visible = chk.structure.checked
  g.stage2.visible = chk.stage2.checked
  for (const grp of [g.blocks, g.labels, g.slabs]) {
    for (const c of grp.children) {
      const b = c.userData.block
      c.visible = !b || levelVisible(b)
    }
  }
  // v pohledu na jedno podlaží nechceme strop nad hlavou
  if (levelFilter === '0') for (const c of g.slabs.children) c.visible = false
}

for (const c of Object.values(chk)) c.addEventListener('change', applyLayers)

// ------------------------------------------------------------------ rozvody
const mepOn = { vzt: true, heat: false, water: false, drain: false, elec: false }
const togglesEl = $('mep-toggles')
for (const s of SERVICES) {
  const lab = document.createElement('label')
  lab.className = 'chk'
  lab.innerHTML = `<input type="checkbox" ${mepOn[s.key] ? 'checked' : ''}>` +
    `<span class="sw" style="background:#${s.color.toString(16).padStart(6, '0')}"></span>` +
    `<span>${s.name}</span>`
  lab.querySelector('input').addEventListener('change', (e) => {
    mepOn[s.key] = e.target.checked
    applyMepToggles()
  })
  togglesEl.appendChild(lab)
}
function applyMepToggles() {
  for (const [key, grp] of Object.entries(built.mepByService)) grp.visible = !!mepOn[key]
}

// ------------------------------------------------------------- tlačítkové skupiny
function group(ids, onPick) {
  const els = ids.map((id) => $(id))
  els.forEach((el, i) => el.addEventListener('click', () => {
    els.forEach((e) => e.classList.remove('on'))
    el.classList.add('on')
    onPick(i)
  }))
}

group(['cut-auto', 'cut-open', 'cut-solid'], (i) => {
  cutMode = ['auto', 'open', 'solid'][i]
  cut.mode = cutMode
})
group(['lvl-all', 'lvl-0', 'lvl-1'], (i) => {
  levelFilter = ['all', '0', '1'][i]
  applyLayers()
})
group(['cam-orbit', 'cam-walk'], (i) => setWalk(i === 1))

// ------------------------------------------------------------------ procházka
const walk = { on: false, yaw: 0, pitch: 0, keys: new Set() }
const hint = $('hint')

function setWalk(on) {
  walk.on = on
  orbit.enabled = !on
  if (on) {
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
    walk.yaw = e.y
    walk.pitch = e.x
    if (camera.position.y > 6) camera.position.y = 1.7
    renderer.domElement.requestPointerLock()
    hint.textContent = 'Procházka: WASD · Space/Shift výška · myš rozhlížení · Esc konec'
  } else {
    if (document.pointerLockElement) document.exitPointerLock()
    orbit.target.set(spec.stage1 / 2, spec.eaves * 0.45, spec.depth / 2)
    hint.textContent = 'Orbit: táhni myší · kolečko = zoom · pravé tlačítko = posun'
  }
}
renderer.domElement.addEventListener('click', () => {
  if (walk.on && !document.pointerLockElement) renderer.domElement.requestPointerLock()
})
document.addEventListener('pointerlockchange', () => {
  if (walk.on && !document.pointerLockElement) {
    $('cam-orbit').click()
  }
})
addEventListener('mousemove', (e) => {
  if (!walk.on || !document.pointerLockElement) return
  walk.yaw -= e.movementX * 0.0022
  walk.pitch = Math.max(-1.5, Math.min(1.5, walk.pitch - e.movementY * 0.0022))
})
addEventListener('keydown', (e) => walk.keys.add(e.code))
addEventListener('keyup', (e) => walk.keys.delete(e.code))

// ------------------------------------------------------------------- editace
let editMode = false
const editBtn = $('edit-toggle')
editBtn.addEventListener('click', () => {
  editMode = !editMode
  editBtn.classList.toggle('on', editMode)
  editBtn.textContent = editMode ? 'Editace zapnuta' : 'Editace vypnuta'
  hint.textContent = editMode
    ? 'Editace: klikni na blok a táhni · krok 0,5 m · rozvody se přepočtou po puštění'
    : 'Orbit: táhni myší · kolečko = zoom · pravé tlačítko = posun'
})

const ray = new THREE.Raycaster()
const ndc = new THREE.Vector2()
const plane = new THREE.Plane()
const hitPt = new THREE.Vector3()
const dragStart = new THREE.Vector3()
let dragging = null

function pick(ev) {
  ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  const vis = built.blockMeshes.filter((m) => m.visible && m.parent.visible)
  return ray.intersectObjects(vis, false)[0] ?? null
}

function movablesOf(id) {
  const out = []
  for (const grp of [built.groups.blocks, built.groups.labels, built.groups.slabs]) {
    for (const c of grp.children) if (c.userData.block?.id === id) out.push({ o: c, p: c.position.clone() })
  }
  return out
}

renderer.domElement.addEventListener('pointerdown', (ev) => {
  if (walk.on || ev.button !== 0) return
  const hit = pick(ev)
  if (!hit) return
  selectedId = hit.object.userData.block.id
  refreshSelection()
  if (!editMode) return
  orbit.enabled = false
  plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), hit.point)
  dragStart.copy(hit.point)
  dragging = { id: selectedId, items: movablesOf(selectedId) }
  ev.preventDefault()
})

addEventListener('pointermove', (ev) => {
  if (!dragging) return
  ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  if (!ray.ray.intersectPlane(plane, hitPt)) return
  const dx = Math.round((hitPt.x - dragStart.x) * 2) / 2
  const dz = Math.round((hitPt.z - dragStart.z) * 2) / 2
  dragging.dx = dx
  dragging.dz = dz
  for (const it of dragging.items) it.o.position.set(it.p.x + dx, it.p.y, it.p.z + dz)
})

addEventListener('pointerup', () => {
  if (!dragging) return
  const { id, dx = 0, dz = 0 } = dragging
  dragging = null
  orbit.enabled = !walk.on
  if (dx === 0 && dz === 0) return
  const b = spec.blocks.find((x) => x.id === id)
  b.x0 += dx; b.x1 += dx; b.z0 += dz; b.z1 += dz
  rebuild()   // tady se přepočtou plochy i rozvody
})

// pole s kótami vybraného bloku
const fields = ['f-x0', 'f-x1', 'f-z0', 'f-z1'].map((id) => $(id))
for (const f of fields) {
  f.addEventListener('change', () => {
    const b = spec.blocks.find((x) => x.id === selectedId)
    if (!b) return
    const [x0, x1, z0, z1] = fields.map((el) => parseFloat(el.value))
    if ([x0, x1, z0, z1].some(Number.isNaN) || x1 <= x0 || z1 <= z0) { refreshSelection(); return }
    Object.assign(b, { x0, x1, z0, z1 })
    rebuild()
  })
}

function refreshSelection() {
  const b = spec.blocks.find((x) => x.id === selectedId)
  const info = $('sel')
  const box = $('sel-fields')
  for (const m of built.blockMeshes) {
    m.material.opacity = m.userData.block.id === selectedId ? 0.72 : m.userData.baseOpacity
  }
  if (!b) {
    info.textContent = editMode ? 'Klikni na blok.' : 'Nic není vybráno.'
    box.style.display = 'none'
    return
  }
  const d = blockDemand(b)
  info.innerHTML = `<b>${b.name}</b> — ${TYPES[b.type].label}<br>` +
    `${area(b).toFixed(0)} m² · ${Math.round(d.vzt)} m³/h · ${d.elec.toFixed(1)} kW`
  box.style.display = 'grid'
  const vals = [b.x0, b.x1, b.z0, b.z1]
  fields.forEach((el, i) => { el.value = vals[i] })
}

$('btn-reset').addEventListener('click', () => {
  spec.blocks = structuredClone(ORIGINAL.blocks)
  selectedId = null
  rebuild()
})

$('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'budova-spec.json'
  a.click()
  URL.revokeObjectURL(a.href)
})

// -------------------------------------------------------------------- smyčka
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

rebuild()

// ladicí přístup pro skriptované screenshoty (a rychlé zkoušení v konzoli)
window.__view = { camera, orbit, spec, get mep() { return mep }, rebuild }

const clock = new THREE.Clock()
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1)

  if (walk.on) {
    camera.quaternion.setFromEuler(new THREE.Euler(walk.pitch, walk.yaw, 0, 'YXZ'))
    const sp = (walk.keys.has('ShiftLeft') ? 14 : 5) * dt
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    fwd.y = 0; fwd.normalize()
    right.y = 0; right.normalize()
    if (walk.keys.has('KeyW')) camera.position.addScaledVector(fwd, sp)
    if (walk.keys.has('KeyS')) camera.position.addScaledVector(fwd, -sp)
    if (walk.keys.has('KeyA')) camera.position.addScaledVector(right, -sp)
    if (walk.keys.has('KeyD')) camera.position.addScaledVector(right, sp)
    if (walk.keys.has('Space')) camera.position.y += sp
    if (walk.keys.has('ControlLeft')) camera.position.y -= sp
  } else {
    orbit.update()
  }

  cut.update(camera, dt)
  env.update(camera)
  quality.update(dt)
  renderer.render(scene, camera)
})
