// building.js — veškerá geometrie se generuje ze SPEC. Nic není napevno.
import * as THREE from 'three'
import { TYPES, area, levelBase, roofY, ridgeY, blockHeight } from './spec.js'
import { FURN, fitoutAll } from './fitout.js'

const deg = (d) => (d * Math.PI) / 180

// ---------------------------------------------------------------- pomocníci

/**
 * Stěna jako plocha s otvory. Lokální u = po délce stěny, v = výška.
 * Vysune se do tloušťky t a posune tak, aby lokální +Z byla VNĚJŠÍ normála.
 */
function wallGeom(profile, holes, t) {
  const shape = new THREE.Shape()
  shape.moveTo(profile[0][0], profile[0][1])
  for (let i = 1; i < profile.length; i++) shape.lineTo(profile[i][0], profile[i][1])
  shape.closePath()
  for (const h of holes) {
    const p = new THREE.Path()
    p.moveTo(h.u0, h.v0); p.lineTo(h.u1, h.v0); p.lineTo(h.u1, h.v1); p.lineTo(h.u0, h.v1)
    p.closePath()
    shape.holes.push(p)
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false })
  g.translate(0, 0, -t / 2)
  return g
}

/** Umístí stěnu z bodu A ve směru dir; lokální +Z vyjde jako vnější normála. */
function placeWall(mesh, ax, az, dx, dz) {
  mesh.position.set(ax, 0, az)
  mesh.rotation.y = Math.atan2(-dz, dx)
}

const pipeMats = new Map()
const pipeMat = (color) => {
  if (!pipeMats.has(color)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.25 })
    m.userData.shared = true      // přežívá přegenerování, disposeTree ho musí vynechat
    pipeMats.set(color, m)
  }
  return pipeMats.get(color)
}

function tube(points, radius, color) {
  const g = new THREE.Group()
  const mat = pipeMat(color)
  for (let i = 0; i < points.length - 1; i++) {
    const a = new THREE.Vector3(points[i].x, points[i].y, points[i].z)
    const b = new THREE.Vector3(points[i + 1].x, points[i + 1].y, points[i + 1].z)
    const len = a.distanceTo(b)
    if (len < 1e-4) continue
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10), mat)
    cyl.position.copy(a).lerp(b, 0.5)
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
    g.add(cyl)
  }
  for (let i = 1; i < points.length - 1; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), mat)
    s.position.set(points[i].x, points[i].y, points[i].z)
    g.add(s)
  }
  return g
}

function labelSprite(title, sub) {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 160
  const g = c.getContext('2d')
  g.fillStyle = 'rgba(18,16,24,0.82)'
  g.roundRect(6, 6, 500, 148, 18); g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 2; g.stroke()
  g.textAlign = 'center'
  g.fillStyle = '#fff'
  g.font = 'bold 46px system-ui, sans-serif'
  g.fillText(title, 256, 68)
  g.fillStyle = '#ffd7a8'
  g.font = '38px system-ui, sans-serif'
  g.fillText(sub, 256, 122)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  // depthTest zapnutý schválně: popisky se objeví teprve až se obálka otevře,
  // jinak by při pohledu zvenku prosvítaly skrz střechu.
  // sizeAttenuation vypnuté: popisek má pořád stejnou velikost na obrazovce,
  // jinak zblízka přeroste celý model.
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, sizeAttenuation: false,
  }))
  sp.scale.set(0.115, 0.036, 1)
  return sp
}

/**
 * Otvory v dlouhé stěně se ODVOZUJÍ z bloků, které se jí dotýkají — dílna si
 * s sebou nese vrata, lobby vstup, aréna prosklení. Stěny uvedené ve
 * spec.blindWalls (hranice pozemku) zůstanou slepé.
 */
export function openingsFor(S, side) {
  if ((S.blindWalls ?? []).includes(side)) return []
  // z = 0 je JIH (vstupy), z = depth je SEVER (soused)
  const touches = (b) => (side === 'north' ? b.z1 >= S.depth - 0.01 : b.z0 <= 0.01)
  const out = []

  for (const b of S.blocks) {
    if (!touches(b)) continue
    const base = levelBase(S, b.level === 'full' ? 0 : b.level)
    const span = b.x1 - b.x0
    const cx = (b.x0 + b.x1) / 2

    if (b.type === 'workshop') {
      out.push({ x0: b.x0 + 0.4, x1: b.x0 + 1.6, v0: 0, v1: 2.2 })              // dveře pro personál
      const gs = b.x0 + 2.2
      const ge = Math.min(gs + S.gate.width, b.x1 - 0.5)
      if (ge > gs + 1.5) out.push({ x0: gs, x1: ge, v0: 0, v1: S.gate.height })  // vrata
    } else if (b.type === 'lobby') {
      out.push({ x0: cx - 1.5, x1: cx + 1.5, v0: 0, v1: 2.6 })                   // hlavní vstup
      if (span > 5) {
        // zásobování baru a odpad NESMÍ chodit hlavním vchodem přes lobby plné dětí
        out.push({ x0: b.x0 + 0.6, x1: b.x0 + 1.8, v0: 0, v1: 2.2 })             // zásobovací dveře
        out.push({ x0: cx + 1.8, x1: b.x1 - 0.6, v0: 1.0, v1: 2.8 })
      }
    } else if (b.type === 'arena') {
      // aréna je shromažďovací prostor — jediná úniková cesta přes lobby nestačí
      out.push({ x0: b.x0 + 0.3, x1: b.x0 + 1.5, v0: 0, v1: 2.2 })               // únikový východ
      const w = Math.min(4, span - 3)
      out.push({ x0: cx - w / 2, x1: cx + w / 2, v0: 1.0, v1: 4.4 })             // prosklení do arény
    } else if (b.type === 'plant') {
      out.push({ x0: cx - 1.0, x1: cx + 1.0, v0: 2.2, v1: 3.7 })                 // žaluzie VZT
    } else if (b.type === 'wet' || b.type === 'storage' || b.type === 'circ') {
      continue                                                                    // bez oken
    } else {
      const n = Math.max(1, Math.round(span / S.grid))                            // pásová okna po rastru
      for (let i = 0; i < n; i++) {
        const c = b.x0 + ((i + 0.5) * span) / n
        out.push({ x0: c - 1.5, x1: c + 1.5, v0: base + 0.9, v1: base + 2.4 })
      }
    }
  }
  // otvor nesmí prorazit okap a dva otvory se nesmí překrýt (rozbilo by to triangulaci)
  // vstupy a vrata (v0 = 0) mají přednost — při kolizi ustoupí okno, ne dveře
  const clean = out.filter((h) => h.v1 <= S.eaves - 0.15 && h.x1 - h.x0 > 0.3)
  clean.sort((a, b) => (a.v0 === 0 ? 0 : 1) - (b.v0 === 0 ? 0 : 1) || a.x0 - b.x0 || a.v0 - b.v0)
  return clean.filter((h, i) => !clean.some((o, j) =>
    j < i && o.x1 > h.x0 + 1e-6 && o.x0 < h.x1 - 1e-6 && o.v1 > h.v0 + 1e-6 && o.v0 < h.v1 - 1e-6))
}

/**
 * Volná pole jižní fasády — doplněk otvorů. Sem se vejde fasádní FVE.
 * Vrací intervaly x širší než 1,2 m mimo dosah jakéhokoli otvoru v pásu v0..v1.
 */
function freeBands(S, holes, v0, v1) {
  const busy = holes
    .filter((h) => h.v1 > v0 && h.v0 < v1)
    .map((h) => [h.x0 - 0.3, h.x1 + 0.3])
    .sort((a, b) => a[0] - b[0])
  const out = []
  let cursor = 0.3
  for (const [a, b] of busy) {
    if (a > cursor) out.push([cursor, Math.min(a, S.stage1 - 0.3)])
    cursor = Math.max(cursor, b)
  }
  if (cursor < S.stage1 - 0.3) out.push([cursor, S.stage1 - 0.3])
  return out.filter(([a, b]) => b - a > 1.2)
}

/** Plocha a výkon FVE — počítá se ze střechy a z volných polí fasády. */
export function pvLayout(S, southHoles) {
  const p = S.pv ?? {}
  const slope = Math.sqrt((S.depth / 2) ** 2 + (ridgeY(S) - S.eaves) ** 2)
  const panels = []
  let roofArea = 0
  let facadeArea = 0

  for (const [on, side] of [[p.roofSouth, -1], [p.roofNorth, 1]]) {
    if (!on) continue
    const w = S.stage1 - 1.2
    const l = slope - 1.0
    panels.push({ kind: 'roof', w, l, side })
    roofArea += w * l
  }

  const bandV0 = 1.0
  const bandV1 = S.eaves - 0.35
  const bands = p.facadeSouth ? freeBands(S, southHoles, bandV0, bandV1) : []
  for (const [a, b] of bands) {
    panels.push({ kind: 'facade', x0: a, x1: b, v0: bandV0, v1: bandV1 })
    facadeArea += (b - a) * (bandV1 - bandV0)
  }

  const cov = p.coverage ?? 0.85
  const wp = p.wp ?? 210
  return {
    panels,
    roofArea, facadeArea,
    roofKwp: (roofArea * cov * wp) / 1000,
    facadeKwp: (facadeArea * cov * wp) / 1000,
  }
}

/**
 * Prostup ve stropě nad schodištěm. Bez něj schodiště končí u stropu — což
 * v modelu chvíli bylo. Otvor kryje horní část ramene, kde je podchodná
 * výška pod 2,1 m, plus 0,4 m výběhu.
 */
export function stairOpening(it, FURN) {
  const f = FURN.stairs
  const run = f.d
  const half = 0.7                       // 1,4 m široký otvor
  const from = 0.05 * run                // od místa, kde už podchodná výška nestačí
  const to = run / 2 + 0.4
  switch (it.rot ?? 0) {
    case 90:  return { x0: it.x - to, x1: it.x - from, z0: it.z - half, z1: it.z + half }
    case 270: return { x0: it.x + from, x1: it.x + to, z0: it.z - half, z1: it.z + half }
    case 180: return { x0: it.x - half, x1: it.x + half, z0: it.z - to, z1: it.z - from }
    default:  return { x0: it.x - half, x1: it.x + half, z0: it.z + from, z1: it.z + to }
  }
}

/** Volné hrany mezipatra — sem patří zábradlí, jinak se z něj dá spadnout. */
export function openEdges(S, b) {
  const upper = S.blocks.filter((o) => o.level === 1 && o.id !== b.id)
  const out = []
  const covered = (a0, a1, fixed, axis) => {
    // úsek hrany je krytý, když na něj navazuje jiný blok v patře nebo obvodová stěna
    const segs = []
    for (const o of upper) {
      if (axis === 'x' ? Math.abs(o.z0 - fixed) < 0.05 || Math.abs(o.z1 - fixed) < 0.05
                       : Math.abs(o.x0 - fixed) < 0.05 || Math.abs(o.x1 - fixed) < 0.05) {
        segs.push(axis === 'x' ? [o.x0, o.x1] : [o.z0, o.z1])
      }
    }
    const gaps = []
    let cur = a0
    for (const [g0, g1] of segs.sort((p, q) => p[0] - q[0])) {
      if (g0 > cur) gaps.push([cur, Math.min(g0, a1)])
      cur = Math.max(cur, g1)
    }
    if (cur < a1) gaps.push([cur, a1])
    return gaps.filter(([p, q]) => q - p > 0.4)
  }
  for (const [fixed, axis] of [[b.z0, 'x'], [b.z1, 'x']]) {
    if (fixed <= 0.3 || fixed >= S.depth - 0.3) continue          // obvodová stěna
    for (const [p, q] of covered(b.x0, b.x1, fixed, axis)) out.push({ x0: p, x1: q, z0: fixed, z1: fixed })
  }
  for (const [fixed, axis] of [[b.x0, 'z'], [b.x1, 'z']]) {
    if (fixed <= 0.3 || fixed >= S.stage1 - 0.3) continue
    for (const [p, q] of covered(b.z0, b.z1, fixed, axis)) out.push({ x0: fixed, x1: fixed, z0: p, z1: q })
  }
  return out
}

/**
 * Geometrie jedné střešní roviny. side = −1 jižní, +1 severní.
 * Roviny se u hřebene musí DOTÝKAT, ne překrývat — překryv dělá z-fighting
 * a střecha při pohybu kamery probliká.
 */
export function roofSlope(S, side, over = 0.5) {
  const ridge = ridgeY(S)
  const rise = ridge - S.eaves
  const halfD = S.depth / 2
  const diag = Math.hypot(halfD, rise)
  const eaveZ = side < 0 ? -over * (halfD / diag) : S.depth + over * (halfD / diag)
  const eaveY = S.eaves - over * (rise / diag)
  return {
    y: (eaveY + ridge) / 2,
    z: (eaveZ + halfD) / 2,
    len: diag + over,
    zFrom: Math.min(eaveZ, halfD),
    zTo: Math.max(eaveZ, halfD),
  }
}

// ------------------------------------------------------------- vybavení

const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  return m
}

/**
 * Jeden kus vybavení. Tvary jsou schválně hrubé — jde o kontrolu, jestli se to
 * vejde a dá projít, ne o katalogový render.
 */
function furnitureMesh(item, FURN) {
  const f = FURN[item.kind]
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.72 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x3c4148, roughness: 0.6, metalness: 0.3 })
  const glassy = new THREE.MeshStandardMaterial({
    color: f.color, roughness: 0.15, transparent: true, opacity: 0.34, depthWrite: false,
  })
  const { w, d, h } = f

  switch (f.shape) {
    case 'table': {
      g.add(box(w, 0.04, d, mat, 0, h, 0))
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        g.add(box(0.06, h, 0.06, dark, sx * (w / 2 - 0.08), h / 2, sz * (d / 2 - 0.08)))
      }
      break
    }
    case 'chair':
      g.add(box(w, 0.05, d, mat, 0, 0.45, 0))
      g.add(box(w, 0.42, 0.05, mat, 0, 0.66, d / 2 - 0.03))
      g.add(box(0.05, 0.45, 0.05, dark, 0, 0.22, 0))
      break
    case 'cubicle': {
      const t = 0.05
      g.add(box(w, h, t, glassy, 0, h / 2, -d / 2))
      g.add(box(t, h, d, glassy, -w / 2, h / 2, 0))
      g.add(box(t, h, d, glassy, w / 2, h / 2, 0))
      break
    }
    case 'cyl': {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, h, 14), mat)
      m.position.y = h / 2
      g.add(m)
      break
    }
    case 'stairs': {
      const n = 14
      for (let i = 0; i < n; i++) {
        g.add(box(w, 0.06, d / n, mat, 0, ((i + 1) * h) / n, -d / 2 + ((i + 0.5) * d) / n))
      }
      break
    }
    case 'tramp':
      g.add(box(w, 0.12, d, new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.9 }), 0, h - 0.06, 0))
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        g.add(box(0.08, h, 0.08, dark, sx * (w / 2 - 0.05), h / 2, sz * (d / 2 - 0.05)))
      }
      break
    case 'cage':
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        g.add(box(0.09, h, 0.09, mat, sx * (w / 2 - 0.05), h / 2, sz * (d / 2 - 0.05)))
      }
      g.add(box(w, 0.08, 0.08, mat, 0, h, -d / 2 + 0.05))
      g.add(box(w, 0.08, 0.08, mat, 0, h, d / 2 - 0.05))
      break
    case 'rack': {
      const shelves = 3
      for (let i = 1; i <= shelves; i++) g.add(box(w, 0.05, d, mat, 0, (i * h) / shelves, 0))
      for (const sx of [-1, 1]) g.add(box(0.07, h, d, dark, sx * (w / 2 - 0.04), h / 2, 0))
      break
    }
    case 'rig':
      g.add(box(0.55, 0.5, 0.9, mat, 0, 0.4, d / 2 - 0.55))          // sedačka
      g.add(box(0.36, 0.36, 0.1, dark, 0, 0.78, d / 2 - 1.25))        // volant
      g.add(box(w, 0.42, 0.05, dark, 0, 1.15, -d / 2 + 0.25))         // trojmonitor
      g.add(box(0.06, 0.9, 0.06, dark, 0, 0.45, -d / 2 + 0.28))
      break
    case 'hoop':
      g.add(box(0.1, h, 0.1, dark, 0, h / 2, d / 2))
      g.add(box(w, 0.7, 0.05, mat, 0, h - 0.45, 0))
      g.add(box(0.45, 0.04, 0.45, mat, 0, h - 0.75, -0.2))
      break
    case 'lift':                                                       // dvousloupový zvedák
      for (const sx of [-1, 1]) {
        g.add(box(0.28, h, 0.32, mat, sx * (w / 2), h / 2, 0))
        g.add(box(0.16, 0.14, 1.5, mat, sx * (w / 2 - 0.85), 1.1, 0.7))
        g.add(box(0.16, 0.14, 1.5, mat, sx * (w / 2 - 0.85), 1.1, -0.7))
      }
      break
    case 'pit': {
      const t = 0.16
      const frame = new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.85 })
      for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        g.add(box(sx ? t : w, h, sz ? t : d, frame, (sx * (w - t)) / 2, h / 2, (sz * (d - t)) / 2))
      }
      // molitanové kostky
      const cube = new THREE.MeshStandardMaterial({ color: f.color, roughness: 1 })
      const nx = Math.max(2, Math.round(w / 0.55))
      const nz = Math.max(2, Math.round(d / 0.55))
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        g.add(box(0.42, 0.4, 0.42, cube,
          -w / 2 + ((i + 0.5) * w) / nx, 0.2 + ((i * 7 + j * 3) % 3) * 0.12, -d / 2 + ((j + 0.5) * d) / nz))
      }
      break
    }
    case 'door': {
      const jamb = new THREE.MeshStandardMaterial({ color: 0x6b6257, roughness: 0.7 })
      const t = 0.09
      g.add(box(t, h + t, d, jamb, -(w / 2 + t / 2), (h + t) / 2, 0))
      g.add(box(t, h + t, d, jamb, w / 2 + t / 2, (h + t) / 2, 0))
      g.add(box(w + 2 * t, t, d, jamb, 0, h + t / 2, 0))
      const leaf = new THREE.MeshStandardMaterial({
        color: f.color, roughness: 0.6,
        transparent: f.color === 0x9fd4e8, opacity: f.color === 0x9fd4e8 ? 0.45 : 1,
      })
      g.add(box(w - 0.02, h - 0.02, d * 0.5, leaf, 0, h / 2, 0))
      g.add(box(0.05, 0.12, 0.05, jamb, w / 2 - 0.12, 1.05, d * 0.4))   // klika
      break
    }
    case 'net':
      g.add(box(w, h, Math.max(d, 0.04), glassy, 0, h / 2, 0))
      for (const sx of [-1, 1]) g.add(box(0.07, h, 0.07, dark, sx * (w / 2 - 0.04), h / 2, 0))
      break
    default:
      g.add(box(w, h, d, mat, 0, h / 2, 0))
  }

  g.position.set(item.x, item.y, item.z)
  g.rotation.y = (-(item.rot ?? 0) * Math.PI) / 180
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  g.userData.item = item
  return g
}

// ---------------------------------------------------------------- generátor

export function buildAll(spec, mep) {
  const root = new THREE.Group()
  const groups = {}
  for (const k of ['ground', 'site', 'shell', 'glass', 'roof', 'pv', 'structure', 'slabs', 'furniture', 'blocks', 'labels', 'mep', 'stage2']) {
    groups[k] = new THREE.Group()
    groups[k].name = k
    root.add(groups[k])
  }

  const S = spec
  const t = S.wall
  const ridge = ridgeY(S)
  const walls = []       // pro cutaway: userData.outward
  const blockMeshes = []
  const mepByService = {}

  // --- terén ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x4d9c45, roughness: 1 }),   // travnatá zelená
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.set(S.length / 2, -0.02, S.depth / 2)
  ground.receiveShadow = true
  groups.ground.add(ground)

  // musí vzniknout dřív než stropy — prostupy nad schodišti se berou odsud
  const fit = fitoutAll(S)

  const bays = Math.round(S.stage1 / S.grid)
  const northHoles = openingsFor(S, 'north')
  const southHoles = openingsFor(S, 'south')

  const shellMat = new THREE.MeshStandardMaterial({ color: 0xdcd6cc, roughness: 0.85, side: THREE.DoubleSide })

  const addWall = (name, geom, ax, az, dx, dz, outward, mat = shellMat) => {
    const m = new THREE.Mesh(geom, mat.clone())
    placeWall(m, ax, az, dx, dz)
    m.castShadow = true
    m.receiveShadow = true
    m.userData.outward = new THREE.Vector3(...outward)
    m.userData.baseOpacity = mat.opacity ?? 1
    m.name = name
    groups.shell.add(m)
    walls.push(m)
    return m
  }

  // JIŽNÍ stěna leží na z = 0 a běží od x=stage1 k x=0 → u = stage1 - x
  addWall('jih',
    wallGeom([[0, 0], [S.stage1, 0], [S.stage1, S.eaves], [0, S.eaves]],
      southHoles.map((h) => ({ u0: S.stage1 - h.x1, u1: S.stage1 - h.x0, v0: h.v0, v1: h.v1 })), t),
    S.stage1, t / 2, -1, 0, [0, 0, -1])

  // SEVERNÍ stěna leží na z = depth a běží od x=0 k x=stage1 → u = x
  addWall('sever (hranice pozemku)',
    wallGeom([[0, 0], [S.stage1, 0], [S.stage1, S.eaves], [0, S.eaves]],
      northHoles.map((h) => ({ u0: h.x0, u1: h.x1, v0: h.v0, v1: h.v1 })), t),
    0, S.depth - t / 2, 1, 0, [0, 0, 1])

  // Západní štít etapy 1 — DOČASNÝ, demontovatelný (jiný odstín)
  const tempMat = new THREE.MeshStandardMaterial({ color: 0xb9aa96, roughness: 0.9, side: THREE.DoubleSide })
  addWall('západ (dočasný štít)',
    wallGeom([[0, 0], [S.depth, 0], [S.depth, S.eaves], [S.depth / 2, ridge], [0, S.eaves]], [], t),
    S.stage1 - t / 2, S.depth, 0, -1, [1, 0, 0], tempMat)

  // Východní průčelí = celoprosklené (rám + sklo)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x9fd4e8, roughness: 0.08, metalness: 0, transmission: 0.72,
    transparent: true, opacity: 0.5, side: THREE.DoubleSide,
  })
  const east = new THREE.Mesh(
    wallGeom([[0, 0], [S.depth, 0], [S.depth, S.eaves], [S.depth / 2, ridge], [0, S.eaves]], [], 0.06),
    glassMat,
  )
  placeWall(east, t / 2, 0, 0, 1)
  east.userData.outward = new THREE.Vector3(-1, 0, 0)
  east.userData.baseOpacity = 0.5
  east.name = 'východní průčelí (prosklené)'
  groups.glass.add(east)
  walls.push(east)

  const mullMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.6, metalness: 0.4 })
  for (let z = 3; z < S.depth; z += 3) {
    const h = roofY(S, z)
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16), mullMat)
    m.position.set(t / 2, h / 2, z)
    groups.glass.add(m)
  }
  for (const y of [S.clearGF + S.slab / 2, S.eaves - 0.1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, S.depth), mullMat)
    m.position.set(t / 2, y, S.depth / 2)
    groups.glass.add(m)
  }

  // --- střecha ---
  // Roviny musí u hřebene KONČIT, ne se překrývat — půlmetrový přesah dvou
  // ploch přes sebe dělal z-fighting a střecha problikávala.
  const halfD = S.depth / 2
  const slopeCenter = (side) => roofSlope(S, side)
  const slope = roofSlope(S, -1).len
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x7d8590, roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide })
  for (const side of [-1, 1]) {
    const c = slopeCenter(side)
    const m = new THREE.Mesh(new THREE.BoxGeometry(S.stage1 + 0.8, 0.18, slope), roofMat.clone())
    m.position.set(S.stage1 / 2, c.y, c.z)
    m.rotation.x = side * deg(S.pitch)
    m.castShadow = true
    m.receiveShadow = true
    m.userData.baseOpacity = 1
    groups.roof.add(m)
  }
  const cap = new THREE.Mesh(new THREE.BoxGeometry(S.stage1 + 0.8, 0.16, 0.5), roofMat.clone())
  cap.position.set(S.stage1 / 2, ridge + 0.09, halfD)   // hřebenáč přes styk rovin
  cap.castShadow = true
  cap.userData.baseOpacity = 1
  groups.roof.add(cap)

  // --- fotovoltaika ---
  const pv = pvLayout(S, southHoles)
  const pvMat = new THREE.MeshStandardMaterial({ color: 0x16213d, roughness: 0.22, metalness: 0.75 })
  for (const p of pv.panels) {
    let m
    if (p.kind === 'roof') {
      const th = p.side * deg(S.pitch)
      const c = slopeCenter(p.side)
      m = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.07, p.l), pvMat.clone())
      m.position.set(S.stage1 / 2, c.y + 0.14 * Math.cos(th), c.z + 0.14 * Math.sin(th))
      m.rotation.x = th
      m.userData.outward = null            // s cutaway mizí zároveň se střechou
      // panel je skoro černý — poloprůhledný by dělal tmavý závoj přes půdorys,
      // takže se přepíná natvrdo
      m.userData.binary = true
    } else {
      m = new THREE.Mesh(new THREE.BoxGeometry(p.x1 - p.x0, p.v1 - p.v0, 0.06), pvMat.clone())
      m.position.set((p.x0 + p.x1) / 2, (p.v0 + p.v1) / 2, -0.05)
      m.userData.outward = new THREE.Vector3(0, 0, -1)   // mizí s jižní stěnou
      m.userData.binary = true
    }
    m.castShadow = true
    m.userData.baseOpacity = 1
    groups.pv.add(m)
    walls.push(m)
  }

  // --- nosná konstrukce (rámy po rastru) ---
  const colMat = new THREE.MeshStandardMaterial({ color: 0x5a6169, roughness: 0.5, metalness: 0.5 })
  for (let i = 0; i <= bays; i++) {
    const x = i * S.grid
    for (const z of [t + 0.1, S.depth - t - 0.1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, S.eaves, 0.32), colMat)
      c.position.set(Math.min(Math.max(x, 0.2), S.stage1 - 0.2), S.eaves / 2, z)
      c.castShadow = true
      groups.structure.add(c)
    }
  }

  // --- podlaha přízemí ---
  const slabMat = new THREE.MeshStandardMaterial({ color: 0xcfc7bb, roughness: 0.9 })
  const floor = new THREE.Mesh(new THREE.BoxGeometry(S.stage1, 0.2, S.depth), slabMat)
  floor.position.set(S.stage1 / 2, -0.1, S.depth / 2)
  floor.receiveShadow = true
  groups.ground.add(floor)

  // --- vestavěné stropy pod bloky v patře, s prostupy nad schodišti ---
  const stairItems = fit.items.filter((it) => it.kind === 'stairs')
  for (const b of S.blocks.filter((x) => x.level === 1)) {
    const holes = stairItems
      .map((it) => stairOpening(it, FURN))
      .filter((o) => o.x1 > b.x0 && o.x0 < b.x1 && o.z1 > b.z0 && o.z0 < b.z1)
      .map((o) => ({
        u0: Math.max(o.x0, b.x0) - b.x0, u1: Math.min(o.x1, b.x1) - b.x0,
        v0: Math.max(o.z0, b.z0) - b.z0, v1: Math.min(o.z1, b.z1) - b.z0,
      }))
    const g = wallGeom(
      [[0, 0], [b.x1 - b.x0, 0], [b.x1 - b.x0, b.z1 - b.z0], [0, b.z1 - b.z0]], holes, S.slab,
    )
    g.rotateX(-Math.PI / 2)
    const m = new THREE.Mesh(g, slabMat)
    m.position.set(b.x0, S.clearGF + S.slab / 2, b.z0 + (b.z1 - b.z0))
    m.castShadow = true
    m.receiveShadow = true
    m.userData.block = b
    groups.slabs.add(m)

    // zábradlí po volných hranách a kolem prostupu
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xb9b0a2, roughness: 0.5, transparent: true, opacity: 0.55, depthWrite: false,
    })
    const rails = openEdges(S, b)
    for (const h of holes) {
      rails.push({ x0: b.x0 + h.u0, x1: b.x0 + h.u1, z0: b.z0 + h.v0, z1: b.z0 + h.v0 })
      rails.push({ x0: b.x0 + h.u0, x1: b.x0 + h.u1, z0: b.z0 + h.v1, z1: b.z0 + h.v1 })
      rails.push({ x0: b.x0 + h.u0, x1: b.x0 + h.u0, z0: b.z0 + h.v0, z1: b.z0 + h.v1 })
    }
    for (const r of rails) {
      const len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0)
      if (len < 0.4) continue
      const rm = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 0.06), railMat)
      rm.position.set((r.x0 + r.x1) / 2, S.clearGF + S.slab + 0.55, (r.z0 + r.z1) / 2)
      if (Math.abs(r.z1 - r.z0) > Math.abs(r.x1 - r.x0)) rm.rotation.y = Math.PI / 2
      rm.userData.block = b
      groups.slabs.add(rm)
    }
  }

  // --- vybavení ---
  for (const it of fit.items) {
    const m = furnitureMesh(it, FURN)
    m.userData.block = S.blocks.find((b) => b.id === it.block)
    groups.furniture.add(m)
  }

  // --- funkční bloky ---
  for (const b of S.blocks) {
    const ty = TYPES[b.type]
    const h = blockHeight(S, b)
    const base = levelBase(S, b.level === 'full' ? 0 : b.level)
    const geo = new THREE.BoxGeometry(b.x1 - b.x0 - 0.12, h - 0.12, b.z1 - b.z0 - 0.12)
    const mat = new THREE.MeshStandardMaterial({
      color: ty.color, roughness: 0.6, transparent: true, opacity: 0.42, depthWrite: false,
    })
    const m = new THREE.Mesh(geo, mat)
    m.position.set((b.x0 + b.x1) / 2, base + h / 2, (b.z0 + b.z1) / 2)
    m.userData.block = b
    m.userData.baseOpacity = 0.42
    groups.blocks.add(m)
    blockMeshes.push(m)

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: ty.color, transparent: true, opacity: 0.95 }),
    )
    edges.position.copy(m.position)
    edges.userData.block = b
    groups.blocks.add(edges)

    const sp = labelSprite(b.name, `${area(b).toFixed(0)} m²`)
    sp.position.set((b.x0 + b.x1) / 2, base + h * 0.78, (b.z0 + b.z1) / 2)
    sp.userData.block = b
    groups.labels.add(sp)
  }

  // --- rozvody ---
  for (const r of mep.routes) {
    const g = tube(r.points, r.radius, r.color)
    g.userData.service = r.service
    if (!mepByService[r.service]) {
      mepByService[r.service] = new THREE.Group()
      groups.mep.add(mepByService[r.service])
    }
    mepByService[r.service].add(g)
  }

  // --- venkovní část stavby ---
  // Bez nich projekt není projekt: parkování včetně bezbariérového stání,
  // venkovní jednotky TČ, retence dešťovky a lapol z dílny.
  const siteMat = (c, o = 1) => new THREE.MeshStandardMaterial({
    color: c, roughness: 0.9, transparent: o < 1, opacity: o, depthWrite: o > 0.9,
  })
  const asphalt = siteMat(0x4a4a4a)
  for (let i = 0; i < 14; i++) {                       // stání 2,5 × 5 m jižně od budovy
    const bay = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 5.0), asphalt)
    bay.position.set(1.6 + i * 2.6, 0.02, -6.5)
    bay.receiveShadow = true
    groups.site.add(bay)
  }
  for (let i = 0; i < 2; i++) {                        // bezbariérová stání 3,5 m u vstupu
    const bay = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.05, 5.0), siteMat(0x2f6fa8))
    bay.position.set(8.0 + i * 3.6, 0.03, -1.2)
    groups.site.add(bay)
  }
  const shelter = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.12, 2.2), siteMat(0x8a8f98))
  shelter.position.set(3.0, 2.3, -1.6)
  groups.site.add(shelter)                             // přístřešek na kola
  for (const p of [-0.6, 0.6]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 0.12), siteMat(0x8a8f98))
    c.position.set(3.0 + p * 3.6, 1.15, -1.6)
    groups.site.add(c)
  }
  for (let i = 0; i < 3; i++) {                        // venkovní jednotky TČ u slepé severní stěny
    const u = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.55), siteMat(0xd0d5da))
    u.position.set(23.0 + i * 1.4, 0.75, S.depth + 1.0)
    u.castShadow = true
    groups.site.add(u)
  }
  const bins = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.25, 1.1), siteMat(0x5a6169))
  bins.position.set(8.2, 0.63, -2.4)
  bins.castShadow = true
  groups.site.add(bins)                                // odpad u zásobovacích dveří, ne v lobby

  const retention = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.1, 3.0), siteMat(0x3f6f8f, 0.5))
  retention.position.set(34, 0.05, -5.0)
  groups.site.add(retention)                           // retence dešťovky na celých 1 008 m²
  const lapol = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 16), siteMat(0x6a6a55))
  lapol.position.set(25.0, 0.05, -3.0)
  groups.site.add(lapol)                               // odlučovač ropných látek od dílny

  // --- etapa 2 jako obrys ---
  const s2w = S.length - S.stage1
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(s2w, S.eaves, S.depth),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, depthWrite: false }),
  )
  box.position.set(S.stage1 + s2w / 2, S.eaves / 2, S.depth / 2)
  groups.stage2.add(box)
  groups.stage2.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(box.geometry),
    new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, dashSize: 0.8, gapSize: 0.5 }),
  ).translateX(S.stage1 + s2w / 2).translateY(S.eaves / 2).translateZ(S.depth / 2))
  groups.stage2.children[1].computeLineDistances()
  const s2label = labelSprite('Etapa 2', `${(s2w * S.depth).toFixed(0)} m²`)
  s2label.position.set(S.stage1 + s2w / 2, S.eaves * 0.7, S.depth / 2)
  groups.stage2.add(s2label)

  return { root, groups, walls, blockMeshes, mepByService, pv, fit }
}
