import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { SPEC, TYPES, area } from './spec.js'
import { computeMEP, SERVICES, blockDemand } from './mep.js'
import { FURN } from './fitout.js'
import { openingsFor } from './building.js'
import { buildAll } from './building.js'
import { Cutaway } from './cutaway.js'
import { Env } from './env.js'
import { Quality } from './quality.js'
import { summaryText } from './ui.js'
import { makeCharacter } from './character.js'

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
camera.position.set(-27, 19, -50)  // jihovýchod (východ = −x, jih = −z)

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

// ------------------------------------------------------------------ postava
const char = makeCharacter()
char.group.visible = false
scene.add(char.group)
let floors = []          // po čem se dá chodit (podlahy, stropy, schodiště)
let camBlockers = []     // co nesmí zaclonit kameru za postavou
let doorMeshes = []      // dveře s pantem
let solids = []          // AABB překážky pro postavu
let southDoors = []      // otvory v jižní stěně (jediná průchozí)

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
      if (m.userData.shared) continue     // sdílené materiály potrubí žijí dál
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
  document.getElementById('summary').textContent = summaryText(spec, mep, built.pv, built.fit)
  refreshSelection()
  floors = [
    ...built.groups.ground.children,
    ...built.groups.slabs.children.filter((c) => !c.userData.rail),
    ...built.groups.furniture.children.filter((c) => c.userData.item?.kind === 'stairs'),
  ]
  // co zastavuje kameru (stěny, střecha, stropy) — zábradlí ne
  camBlockers = [
    ...built.groups.shell.children,
    ...built.groups.glass.children.filter((c) => c.geometry?.type !== 'BoxGeometry'),
    ...built.groups.roof.children,
    ...built.groups.slabs.children.filter((c) => !c.userData.rail),
  ]
  doorMeshes = built.groups.furniture.children.filter((c) => c.userData.doorPivot)
  // pevné překážky pro postavu: vyšší kusy nábytku; dveřmi a sítěmi se prochází
  const SOLID_SKIP = new Set(['stairs', 'door', 'double', 'glazed', 'service', 'escape',
    'entrymat', 'mat', 'floordrain', 'net', 'glass', 'partition', 'diffuser', 'light',
    'emlight', 'smoke', 'co2', 'exitsign', 'picture', 'hoist', 'aircurtain'])
  solids = built.fit.items
    .filter((it) => FURN[it.kind] && FURN[it.kind].h >= 0.55 && !SOLID_SKIP.has(it.kind))
    .map((it) => {
      const f = FURN[it.kind]
      const turned = it.rot === 90 || it.rot === 270
      return {
        x: it.x, z: it.z,
        hx: (turned ? f.d : f.w) / 2 + 0.24,
        hz: (turned ? f.w : f.d) / 2 + 0.24,
        yBase: it.y, yTop: it.y + f.h,
      }
    })
  southDoors = openingsFor(spec, 'south').filter((h) => h.v0 === 0).map((h) => [h.x0, h.x1])
}

// -------------------------------------------------------------------- vrstvy
const $ = (id) => document.getElementById(id)
const chk = { blocks: $('ly-blocks'), labels: $('ly-labels'), structure: $('ly-structure'),
  furniture: $('ly-furniture'), pv: $('ly-pv'), site: $('ly-site'), stage2: $('ly-stage2') }

function levelVisible(b) {
  if (levelFilter === 'all') return true
  if (b.level === 'full') return true
  return String(b.level) === levelFilter
}

/** Když je vidět vybavení, bloky ustoupí do pozadí — jinak by ho přebily. */
const blockOpacity = () => (chk.furniture.checked && chk.blocks.checked ? 0.17 : 0.42)

function applyLayers() {
  const g = built.groups
  for (const m of built.blockMeshes) {
    m.userData.baseOpacity = blockOpacity()
    if (m.userData.block.id !== selectedId) m.material.opacity = m.userData.baseOpacity
  }
  g.blocks.visible = chk.blocks.checked
  g.labels.visible = chk.labels.checked
  g.structure.visible = chk.structure.checked
  g.pv.visible = chk.pv.checked
  g.furniture.visible = chk.furniture.checked
  g.site.visible = chk.site.checked
  g.stage2.visible = chk.stage2.checked
  for (const grp of [g.blocks, g.labels, g.slabs, g.furniture]) {
    for (const c of grp.children) {
      const b = c.userData.block
      c.visible = !b || levelVisible(b)
    }
  }
  // v pohledu na jedno podlaží nechceme strop nad hlavou
  if (levelFilter === '0') for (const c of g.slabs.children) c.visible = false
}

for (const c of Object.values(chk)) c.addEventListener('change', applyLayers)

// ------------------------------------------------- sbalení panelu na mobilu
const TOUCH = matchMedia('(pointer: coarse)').matches
const HINT_ORBIT = TOUCH
  ? 'Otáčení: táhni prstem · dvěma prsty zoom a posun'
  : 'Orbit: táhni myší · kolečko = zoom · pravé tlačítko = posun'

const panelToggle = $('panel-toggle')
function setPanelCollapsed(v) {
  document.body.classList.toggle('panel-collapsed', v)
  panelToggle.classList.toggle('on', !v)
  panelToggle.textContent = v ? '☰' : '✕'
  panelToggle.setAttribute('aria-expanded', String(!v))
  panelToggle.setAttribute('aria-label', v ? 'Zobrazit ovládání' : 'Skrýt ovládání')
}
panelToggle.addEventListener('click', () =>
  setPanelCollapsed(!document.body.classList.contains('panel-collapsed')))
// na úzkém displeji začni sbalený, ať je vidět model a ne panel
setPanelCollapsed(innerWidth <= 640)

// ------------------------------------------------------------------ rozvody
const mepOn = Object.fromEntries(SERVICES.map((s) => [s.key, s.key === 'vzt']))
const togglesEl = $('mep-toggles')
for (const s of SERVICES) {
  const lab = document.createElement('label')
  lab.className = 'chk'
  lab.innerHTML = `<input type="checkbox" data-svc="${s.key}" ${mepOn[s.key] ? 'checked' : ''}>` +
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
  for (const el of togglesEl.querySelectorAll('input')) el.checked = !!mepOn[el.dataset.svc]
}

const setAllMep = (on) => {
  for (const s of SERVICES) mepOn[s.key] = on
  applyMepToggles()
}
$('mep-all').addEventListener('click', () => setAllMep(true))
$('mep-none').addEventListener('click', () => setAllMep(false))

// Mezerník „kliká" na fokusované tlačítko — po klipnutí na Postavu pak skok
// postavu resetoval, protože Space znovu aktivoval režim. Tlačítka proto
// po kliknutí ztrácejí fokus a Space ve hře nescrolluje stránku.
document.addEventListener('click', (e) => {
  if (e.target instanceof HTMLButtonElement) e.target.blur()
})
addEventListener('keydown', (e) => {
  if ((walk.on || gta.on) && (e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault()
})

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
group(['cam-orbit', 'cam-walk', 'cam-gta'], (i) => setMode(['orbit', 'walk', 'gta'][i]))

// ------------------------------------------------------ procházka a postava
const walk = { on: false, yaw: 0, pitch: 0, keys: new Set() }
const gta = { on: false, yaw: Math.PI, pitch: 0.35, vy: 0, angle: 0, grounded: true }
const hint = $('hint')
hint.textContent = HINT_ORBIT

function lockPointer() {
  try {
    const p = renderer.domElement.requestPointerLock()
    if (p && p.catch) p.catch(() => {})
  } catch { /* headless nebo odmítnuto — nevadí */ }
}

function setMode(mode) {
  walk.on = mode === 'walk'
  gta.on = mode === 'gta'
  orbit.enabled = mode === 'orbit'
  char.group.visible = gta.on
  document.body.classList.toggle('touch-move', TOUCH && mode !== 'orbit')
  document.body.classList.toggle('touch-walk', TOUCH && mode === 'walk')
  document.body.classList.toggle('touch-gta', TOUCH && mode === 'gta')
  if (mode === 'walk') {
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
    walk.yaw = e.y
    walk.pitch = e.x
    if (camera.position.y > 6) camera.position.y = 1.7
    if (!TOUCH) lockPointer()
    hint.textContent = TOUCH
      ? 'Procházka: joystick pohyb · pravý prst rozhlížení · ▲▼ výška'
      : 'Procházka: WASD · Space/Shift výška · myš rozhlížení · Esc konec'
  } else if (mode === 'gta') {
    char.group.position.set(10.5, 0, -5)   // před hlavním vstupem
    char.group.rotation.y = 0
    gta.yaw = Math.PI
    gta.pitch = 0.35
    gta.vy = 0
    // jako v GTA: uvnitř plné stěny, kamera se jim vyhne. Jde ručně přepnout.
    gta.prevCut = cutMode
    $('cut-solid').click()
    if (!TOUCH) lockPointer()
    hint.textContent = TOUCH
      ? 'Postava: joystick pohyb (naplno sprint) · pravý prst kamera · ↑ skok'
      : 'Postava: WASD · Shift sprint · Space skok · myš kamera · Esc konec'
  } else {
    if (document.pointerLockElement) document.exitPointerLock()
    if (gta.prevCut) {
      $('cut-' + gta.prevCut).click()
      gta.prevCut = null
    }
    orbit.target.set(spec.stage1 / 2, spec.eaves * 0.45, spec.depth / 2)
    hint.textContent = HINT_ORBIT
  }
}
renderer.domElement.addEventListener('click', () => {
  if (!TOUCH && (walk.on || gta.on) && !document.pointerLockElement) lockPointer()
})
document.addEventListener('pointerlockchange', () => {
  // na dotyku pointer lock neexistuje — režim se ukončuje tlačítkem, ne Escapem
  if (!TOUCH && (walk.on || gta.on) && !document.pointerLockElement) {
    $('cam-orbit').click()
  }
})
addEventListener('mousemove', (e) => {
  if (!document.pointerLockElement) return
  if (walk.on) {
    walk.yaw -= e.movementX * 0.0022
    walk.pitch = Math.max(-1.5, Math.min(1.5, walk.pitch - e.movementY * 0.0022))
  } else if (gta.on) {
    gta.yaw -= e.movementX * 0.0025
    gta.pitch = Math.max(0.02, Math.min(1.25, gta.pitch + e.movementY * 0.0025))
  }
})

// ------------------------------------------- analogový joystick a kamera
// Výchylka udává poměr směrů (dopředu i do strany současně), naplno = sprint.
const joy = { id: null, x: 0, y: 0 }         // −1..1
const lookT = { id: null, px: 0, py: 0 }
const joyEl = $('joy')
const knobEl = $('joy-knob')

function joyApply(t) {
  const r = joyEl.getBoundingClientRect()
  const dx = t.clientX - (r.left + r.width / 2)
  const dy = t.clientY - (r.top + r.height / 2)
  const max = r.width / 2 - 10
  const len = Math.hypot(dx, dy)
  const k = len > max ? max / len : 1
  joy.x = (dx * k) / max
  joy.y = (dy * k) / max
  knobEl.style.transform = `translate(${dx * k}px, ${dy * k}px)`
  joyEl.classList.toggle('sprint', Math.hypot(joy.x, joy.y) > 0.92)
}
function joyReset() {
  joy.id = null
  joy.x = 0
  joy.y = 0
  knobEl.style.transform = ''
  joyEl.classList.remove('sprint')
}

joyEl.addEventListener('touchstart', (e) => {
  e.preventDefault()
  const t = e.changedTouches[0]
  joy.id = t.identifier
  joyApply(t)
}, { passive: false })

renderer.domElement.addEventListener('touchstart', (e) => {
  if (!walk.on && !gta.on) return
  e.preventDefault()
  for (const t of e.changedTouches) {
    if (t.identifier !== joy.id && lookT.id === null) {
      lookT.id = t.identifier
      lookT.px = t.clientX
      lookT.py = t.clientY
    }
  }
}, { passive: false })

addEventListener('touchmove', (e) => {
  if (!walk.on && !gta.on) return
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) {
      e.preventDefault()
      joyApply(t)
    } else if (t.identifier === lookT.id) {
      e.preventDefault()
      const dx = t.clientX - lookT.px
      const dy = t.clientY - lookT.py
      lookT.px = t.clientX
      lookT.py = t.clientY
      if (walk.on) {
        walk.yaw -= dx * 0.006
        walk.pitch = Math.max(-1.5, Math.min(1.5, walk.pitch - dy * 0.006))
      } else {
        gta.yaw -= dx * 0.006
        gta.pitch = Math.max(0.02, Math.min(1.25, gta.pitch + dy * 0.006))
      }
    }
  }
}, { passive: false })

addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) joyReset()
    if (t.identifier === lookT.id) lookT.id = null
  }
})
addEventListener('touchcancel', () => { joyReset(); lookT.id = null })

// tlačítka drží klávesu po dobu dotyku — zbytek jede přes stejnou logiku
for (const [id, code] of [['btn-jump', 'Space'], ['btn-up', 'Space'], ['btn-down', 'ControlLeft']]) {
  const el = $(id)
  el.addEventListener('touchstart', (e) => { e.preventDefault(); walk.keys.add(code) }, { passive: false })
  el.addEventListener('touchend', () => walk.keys.delete(code))
  el.addEventListener('touchcancel', () => walk.keys.delete(code))
}

// --------------------------------------------------------------- GTA smyčka
const downRay = new THREE.Raycaster()
const DOWN = new THREE.Vector3(0, -1, 0)
const GTA_WALK = 2.4
const GTA_RUN = 5.4

function gtaTick(dt) {
  const pos = char.group.position
  const old = pos.clone()
  const f = new THREE.Vector3(-Math.sin(gta.yaw), 0, -Math.cos(gta.yaw))
  const r = new THREE.Vector3(-f.z, 0, f.x)
  let ix = 0
  let iz = 0
  if (walk.keys.has('KeyW')) iz += 1
  if (walk.keys.has('KeyS')) iz -= 1
  if (walk.keys.has('KeyD')) ix += 1
  if (walk.keys.has('KeyA')) ix -= 1
  ix += joy.x
  iz -= joy.y
  const move = f.multiplyScalar(iz).addScaledVector(r, ix)
  const moving = move.lengthSq() > 0.01
  const speed = walk.keys.has('ShiftLeft') || Math.hypot(joy.x, joy.y) > 0.92 ? GTA_RUN : GTA_WALK
  if (moving) {
    if (move.lengthSq() > 1) move.normalize()
    pos.addScaledVector(move, speed * dt)
  }
  // postava kouká vždy po směru kamery — A/D jsou úskoky do stran, ne zatáčení
  // (f je po výpočtu pohybu zmutované, směr se bere přímo z yaw)
  const target = Math.atan2(-Math.sin(gta.yaw), -Math.cos(gta.yaw))
  const da = Math.atan2(Math.sin(target - gta.angle), Math.cos(target - gta.angle))
  gta.angle += da * Math.min(1, dt * 10)
  char.group.rotation.y = gta.angle

  // obvodový plášť: ven jen dveřmi v jižní stěně
  const t = 0.28
  const inX = pos.x > -t && pos.x < spec.stage1 + t
  const inZ = pos.z > -t && pos.z < spec.depth + t
  if (inX && Math.abs(pos.z - spec.depth) < t) pos.z = old.z
  if (inX && Math.abs(pos.z) < t
      && !southDoors.some((o) => pos.x > o[0] + 0.05 && pos.x < o[1] - 0.05)) pos.z = old.z
  if (inZ && Math.abs(pos.x) < t) pos.x = old.x
  if (inZ && Math.abs(pos.x - spec.stage1) < t) pos.x = old.x

  // nábytek: postava do něj naráží, neprochází jím
  for (const sB of solids) {
    if (pos.y > sB.yTop - 0.1 || pos.y + 1.7 < sB.yBase) continue
    const dx = pos.x - sB.x
    const dz = pos.z - sB.z
    if (Math.abs(dx) < sB.hx && Math.abs(dz) < sB.hz) {
      if (sB.hx - Math.abs(dx) < sB.hz - Math.abs(dz)) pos.x = sB.x + Math.sign(dx || 1) * sB.hx
      else pos.z = sB.z + Math.sign(dz || 1) * sB.hz
    }
  }

  // podlaha pod nohama. Limit 0,45 m nade dnem kroku je důležitý: bez něj
  // raycast na schodech chytil STROP nad hlavou a postava se teleportovala
  // na něj — přesně to „procházení stropem".
  downRay.set(new THREE.Vector3(pos.x, pos.y + 1.2, pos.z), DOWN)
  downRay.far = 60
  let floorY = 0
  for (const h of downRay.intersectObjects(floors, true)) {
    if (h.point.y <= pos.y + 0.45) { floorY = h.point.y; break }
  }

  gta.vy -= 18 * dt
  pos.y += gta.vy * dt
  if (pos.y <= floorY + 0.02) {
    pos.y = floorY
    gta.vy = 0
    gta.grounded = true
  } else {
    gta.grounded = false
  }
  if (gta.grounded && walk.keys.has('Space')) gta.vy = 6

  char.update(dt, moving, speed)

  // dveře se otevřou, když postava přijde — a zase se zavřou
  for (const dm of doorMeshes) {
    const ddx = pos.x - dm.position.x
    const ddz = pos.z - dm.position.z
    const near = ddx * ddx + ddz * ddz < 2.9 && Math.abs(pos.y - dm.position.y) < 2.2
    const p = dm.userData.doorPivot
    p.rotation.y += ((near ? 1.8 : 0) - p.rotation.y) * Math.min(1, dt * 6)
  }

  // kamera jako v GTA: sleduje postavu a nikdy neskáče skrz stěnu ani strop —
  // když je něco v cestě, přitáhne se před překážku
  const cp = gta.pitch
  const head = new THREE.Vector3(pos.x, pos.y + 1.4, pos.z)
  const dir = new THREE.Vector3(
    Math.sin(gta.yaw) * Math.cos(cp), 0.0 + Math.sin(cp), Math.cos(gta.yaw) * Math.cos(cp),
  ).normalize()
  let dist = 4.3
  downRay.set(head, dir)
  downRay.far = dist + 0.4
  const block = downRay.intersectObjects(camBlockers, false)[0]
  if (block) dist = Math.max(0.7, block.distance - 0.35)
  camera.position.copy(head).addScaledVector(dir, dist)
  camera.position.y = Math.max(camera.position.y, pos.y + 0.35)
  camera.lookAt(head)
}
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
    : HINT_ORBIT
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
  if (walk.on || gta.on || ev.button !== 0) return
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
window.__view = { camera, orbit, scene, spec, gta, walk, joy, lookT, get mep() { return mep }, get built() { return built }, rebuild }

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
    if (joy.id !== null) {
      camera.position.addScaledVector(fwd, -joy.y * sp)
      camera.position.addScaledVector(right, joy.x * sp)
    }
    if (walk.keys.has('Space')) camera.position.y += sp
    if (walk.keys.has('ControlLeft')) camera.position.y -= sp
  } else if (gta.on) {
    gtaTick(dt)
  } else {
    orbit.update()
  }

  cut.update(camera, dt)
  env.update(camera)
  quality.update(dt)
  renderer.render(scene, camera)
})
