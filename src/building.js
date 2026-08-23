// building.js — veškerá geometrie se generuje ze SPEC. Nic není napevno.
import * as THREE from 'three'
import { TYPES, area, levelBase, roofY, ridgeY, blockHeight } from './spec.js'
import { FURN, fitoutAll } from './fitout.js'
import { sharedMat, floorMat } from './textures.js'

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
  // dvojnásobné rozlišení plátna, ať je text při větším měřítku ostrý
  const c = document.createElement('canvas')
  c.width = 1024; c.height = 320
  const g = c.getContext('2d')
  g.fillStyle = 'rgba(18,16,24,0.82)'
  g.roundRect(12, 12, 1000, 296, 36); g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 4; g.stroke()
  g.textAlign = 'center'
  g.fillStyle = '#fff'
  g.font = 'bold 92px system-ui, sans-serif'
  g.fillText(title, 512, 136)
  g.fillStyle = '#ffd7a8'
  g.font = '76px system-ui, sans-serif'
  g.fillText(sub, 512, 244)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  // depthTest zapnutý schválně: popisky se objeví teprve až se obálka otevře,
  // jinak by při pohledu zvenku prosvítaly skrz střechu.
  // sizeAttenuation vypnuté: popisek má pořád stejnou velikost na obrazovce,
  // jinak zblízka přeroste celý model.
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, sizeAttenuation: false,
  }))
  sp.scale.set(0.23, 0.072, 1)
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
      out.push({ x0: b.x0 + 0.4, x1: b.x0 + 1.6, v0: 0, v1: 2.0 })              // personál (900/1970)
      const gs = b.x0 + 2.2
      const ge = Math.min(gs + S.gate.width, b.x1 - 0.5)
      if (ge > gs + 1.5) {
        out.push({ x0: gs, x1: ge, v0: 0, v1: S.gate.height })                     // vrata
        // nadsvětlík v jednotném horním pásu fasády (4,3–5,6) přes dveře i vrata
        out.push({ x0: b.x0 + 0.4, x1: ge, v0: 4.3, v1: 5.6 })
      }
    } else if (b.type === 'lobby') {
      out.push({ x0: cx - 1.5, x1: cx + 1.5, v0: 0, v1: 2.6 })                   // hlavní vstup
      out.push({ x0: cx - 1.7, x1: cx + 1.7, v0: 4.1, v1: 5.35 })                 // okno patra v portálu
      // zásobování zrušeno (9. 8.) — boční okna drží rytmus pásů kanceláří
      if (span > 5) {
        out.push({ x0: b.x0 + 0.6, x1: cx - 1.8, v0: 0.9, v1: 2.4 })
        out.push({ x0: cx + 1.8, x1: b.x1 - 0.6, v0: 0.9, v1: 2.4 })
      }
    } else if (b.type === 'arena') {
      // aréna je shromažďovací prostor — jediná úniková cesta přes lobby nestačí
      out.push({ x0: b.x0 + 0.3, x1: b.x0 + 1.5, v0: 0, v1: 2.0 })               // únik (900/1970)
      // v2.2: žádný výklad — stejná okna jako kanceláře, jednotný rytmus fasády
      out.push({ x0: b.x0 + 1.9, x1: b.x1 - 1.2, v0: 0.9, v1: 2.4 })
      out.push({ x0: b.x0 + 1.9, x1: b.x1 - 1.2, v0: 4.3, v1: 5.6 })
    } else if (b.type === 'flat') {
      // Byt (varianta B). Předsíň si nese vlastní vstupní dveře, obytné
      // místnosti okno přes skoro celou šířku — denní světlo je z jihu
      // jediné, které byt může dostat. V patře sedí obojí na úrovni podlahy
      // patra, tedy na pavlači (viz spec.exterior).
      if (b.entry) {
        out.push({ x0: cx - 0.5, x1: cx + 0.5, v0: base, v1: base + 2.1 })
      } else {
        out.push({ x0: b.x0 + 0.35, x1: b.x1 - 0.35, v0: base + 0.9, v1: base + 2.4 })
      }
    } else if (b.type === 'plant') {
      out.push({ x0: cx - 1.9, x1: cx - 0.4, v0: 2.2, v1: 3.7 })                 // žaluzie sání
      out.push({ x0: cx + 0.4, x1: cx + 1.9, v0: 2.2, v1: 3.7 })                 // žaluzie výfuk
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
  // Blok přes obě podlaží se počítá jako krytí hrany jen tehdy, je-li to
  // uzavřená místnost (enclosed) — pak tam stojí stěna a zábradlí by v ní
  // jen trčelo. Galerie nad halou (aréna ve variantě A) enclosed nemá.
  const upper = S.blocks.filter((o) =>
    (o.level === 1 || (o.level === 'full' && o.enclosed)) && o.id !== b.id)
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

/**
 * Vnitřní příčky mezi sousedními místnostmi na stejném podlaží. Kde je
 * v spec.links dveřní propojení, nechává se otvor; spec.wallGaps přidává
 * další otvory (výtah). Stěna mezi různými požárními úseky je „fire" —
 * tlustší, s odolností (v modelu tónovaná).
 * Vrací segmenty i pro kolize postavy: { axis, at, from, to, base, top,
 * fire, level, gaps: [[od, do], …] }.
 */
export function partitionsFor(S) {
  const open = new Set((S.openPairs ?? []).map((p2) => [...p2].sort().join('|')))
  const comp = {}
  for (const [name, ids] of Object.entries(S.compartments ?? {})) {
    for (const id of ids) comp[id] = name
  }
  const present = (b, lvl) => b.level === 'full' || b.level === lvl
  const segs = []
  const near = (p, q) => Math.abs(p - q) < 0.05

  for (const lvl of [0, 1]) {
    const base = levelBase(S, lvl)
    const top = lvl === 1 ? S.eaves - 0.25 : S.clearGF
    for (let i = 0; i < S.blocks.length; i++) {
      for (let j = i + 1; j < S.blocks.length; j++) {
        const a = S.blocks[i]
        const b = S.blocks[j]
        if (!present(a, lvl) || !present(b, lvl)) continue
        let seg = null
        if (near(a.x1, b.x0) || near(a.x0, b.x1)) {
          const at = near(a.x1, b.x0) ? a.x1 : a.x0
          const f = Math.max(a.z0, b.z0)
          const t = Math.min(a.z1, b.z1)
          if (t - f > 0.6) seg = { axis: 'z', at, from: f, to: t }
        } else if (near(a.z1, b.z0) || near(a.z0, b.z1)) {
          const at = near(a.z1, b.z0) ? a.z1 : a.z0
          const f = Math.max(a.x0, b.x0)
          const t = Math.min(a.x1, b.x1)
          if (t - f > 0.6) seg = { axis: 'x', at, from: f, to: t }
        }
        if (!seg) continue
        if (open.has([a.id, b.id].sort().join('|'))) continue   // souvislý prostor
        // příčka nesmí projít obvodovým pláštěm až do jeho vnějšího líce —
        // koplanární čelo s fasádou dělá z-fighting (problikávání zvenku)
        if (seg.axis === 'z') {
          seg.from = Math.max(seg.from, 0.28)
          seg.to = Math.min(seg.to, S.depth - 0.28)
        } else {
          seg.from = Math.max(seg.from, 0.28)
          seg.to = Math.min(seg.to, S.stage1 - 0.28)
        }

        const gaps = []
        for (const l of S.links ?? []) {
          if (!((l.a === a.id && l.b === b.id) || (l.a === b.id && l.b === a.id))) continue
          const wd = (FURN[l.type ?? 'door']?.w ?? 0.9) + 0.16
          const pos = Math.min(Math.max(l.at ?? (seg.from + seg.to) / 2, seg.from + wd / 2), seg.to - wd / 2)
          gaps.push([pos - wd / 2, pos + wd / 2, 2.1])
        }
        for (const g of S.wallGaps ?? []) {
          if (!((g.a === a.id && g.b === b.id) || (g.a === b.id && g.b === a.id))) continue
          gaps.push([g.from, g.to, top - base])
        }
        // full–full dvojice se generuje jen jednou (v přízemí přes obě podlaží)
        if (a.level === 'full' && b.level === 'full' && lvl === 1) continue
        const both = a.level === 'full' && b.level === 'full'
        segs.push({
          ...seg, base, top: both ? S.eaves - 0.25 : top, level: lvl,
          fire: comp[a.id] !== comp[b.id], gaps,
          blocks: [a.id, b.id],
        })
      }
    }
  }
  return segs
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
      // sanita má PEVNÉ stěny (skleněné kabiny nešly přečíst); budky a výtah
      // zůstávají prosklené
      const wallM = f.solid
        ? new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.85 })
        : glassy
      g.add(box(w, h, t, wallM, 0, h / 2, -d / 2))
      g.add(box(t, h, d, wallM, -w / 2, h / 2, 0))
      g.add(box(t, h, d, wallM, w / 2, h / 2, 0))
      const white = new THREE.MeshStandardMaterial({ color: 0xf6f8f9, roughness: 0.4 })
      if (f.fix === 'wc') {
        g.add(box(0.4, 0.42, 0.18, white, 0, 0.6, -d / 2 + 0.16))          // nádržka
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.4, 12), white)
        bowl.position.set(0, 0.2, -d / 2 + 0.42)
        g.add(bowl)
      } else if (f.fix === 'shower') {
        g.add(box(w - 0.12, 0.06, d - 0.12, white, 0, 0.03, 0))            // vanička
        g.add(box(0.05, 1.9, 0.05, dark, 0, 0.98, -d / 2 + 0.1))           // stoupačka
        g.add(box(0.22, 0.05, 0.22, white, 0, 1.95, -d / 2 + 0.22))        // růžice
      } else if (f.fix === 'bench') {
        g.add(box(w - 0.2, 0.07, 0.35, new THREE.MeshStandardMaterial({ color: 0xc7b299, roughness: 0.8 }),
          0, 0.45, -d / 2 + 0.25))                                          // lavička
      }
      break
    }
    case 'sofa': {
      const sm = new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.9 })
      g.add(box(w, 0.36, d, sm, 0, 0.24, 0))                               // sedák
      g.add(box(w, 0.44, 0.2, sm, 0, 0.58, d / 2 - 0.1))                   // opěradlo
      g.add(box(0.18, 0.5, d, sm, -w / 2 + 0.09, 0.32, 0))                 // područky
      g.add(box(0.18, 0.5, d, sm, w / 2 - 0.09, 0.32, 0))
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
      // madla po obou stranách ve sklonu ramene
      const railLen = Math.hypot(d, h)
      for (const sx of [-1, 1]) {
        const rail = box(0.05, 0.05, railLen, dark, sx * (w / 2 + 0.04), h / 2 + 0.95, 0)
        rail.rotation.x = -Math.atan2(h, d)
        g.add(rail)
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
      // křídlo visí na pantu, aby se dalo otevřít, když k němu přijde postava
      const pivot = new THREE.Group()
      pivot.position.set(-w / 2, 0, 0)
      pivot.add(box(w - 0.02, h - 0.02, d * 0.5, leaf, (w - 0.02) / 2, h / 2, 0))
      pivot.add(box(0.05, 0.12, 0.05, jamb, w - 0.14, 1.05, d * 0.4))   // klika
      g.add(pivot)
      g.userData.doorPivot = pivot
      break
    }
    case 'picture': {
      const pw = item.pw ?? 0.8, ph = item.ph ?? 0.6, py = item.py ?? 1.5
      g.add(box(pw + 0.1, ph + 0.1, 0.05, mat, 0, py, -0.012))
      // fotka je MeshBasic, aby ji západ slunce nepřebarvil do oranžova
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(pw, ph),
        new THREE.MeshBasicMaterial({ color: 0x777777 }),
      )
      plane.position.set(0, py, 0.02)
      if (item.img) {
        new THREE.TextureLoader().load(item.img, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace
          const a = tex.image.width / tex.image.height
          const frame = pw / ph
          if (a > frame) plane.scale.y = frame / a
          else plane.scale.x = a / frame
          plane.material.map = tex
          plane.material.color.set(0xffffff)
          plane.material.needsUpdate = true
        })
      }
      g.add(plane)
      break
    }
    case 'net':
      g.add(box(w, h, Math.max(d, 0.04), glassy, 0, h / 2, 0))
      for (const sx of [-1, 1]) g.add(box(0.07, h, 0.07, dark, sx * (w / 2 - 0.04), h / 2, 0))
      break
    case 'basin': {
      g.add(box(w, h - 0.18, d, mat, 0, (h - 0.18) / 2, 0))                // skříňka
      const bowlM = new THREE.MeshStandardMaterial({ color: 0xf6f8f9, roughness: 0.35 })
      const bw = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.14, 12), bowlM)
      bw.position.set(0, h - 0.08, 0)
      g.add(bw)
      g.add(box(0.05, 0.24, 0.05, dark, 0, h + 0.06, -d / 2 + 0.1))        // baterie
      break
    }
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
  for (const k of ['ground', 'site', 'shell', 'glass', 'roof', 'pv', 'structure', 'partitions', 'slabs', 'furniture', 'blocks', 'labels', 'mep', 'econ', 'stage2']) {
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
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), sharedMat('grass'))
  ground.rotation.x = -Math.PI / 2
  ground.position.set(S.length / 2, -0.02, S.depth / 2)
  ground.receiveShadow = true
  groups.ground.add(ground)

  // musí vzniknout dřív než stropy — prostupy nad schodišti se berou odsud
  const fit = fitoutAll(S)

  const bays = Math.round(S.stage1 / S.grid)
  const northHoles = openingsFor(S, 'north')
  const southHoles = openingsFor(S, 'south')

  const shellMat = sharedMat('panelDark', { side: THREE.DoubleSide, roughness: 0.85 })

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
  const tempMat = new THREE.MeshStandardMaterial({ color: 0x484d54, roughness: 0.9, side: THREE.DoubleSide })
  addWall('západ (dočasný štít)',
    wallGeom([[0, 0], [S.depth, 0], [S.depth, S.eaves], [S.depth / 2, ridge], [0, S.eaves]], [], t),
    S.stage1 - t / 2, S.depth, 0, -1, [1, 0, 0], tempMat)

  // Východní průčelí — schválený návrh: prosklení jen PO OKAP, štítový
  // trojúhelník v antracitovém panelu (šikmé zasklení je drahé a špinavé),
  // přiznaný mezipatrový pás, sloupky à 1,5 m (po 4,5 m zesílené) a dubové
  // slunolamy na jižní třetině proti nízkému rannímu slunci.
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x9fd4e8, roughness: 0.08, metalness: 0, transmission: 0.72,
    transparent: true, opacity: 0.5, side: THREE.DoubleSide,
  })
  const east = new THREE.Mesh(
    wallGeom([[0, 0], [S.depth, 0], [S.depth, S.eaves], [0, S.eaves]], [], 0.06),
    glassMat,
  )
  placeWall(east, t / 2, 0, 0, 1)
  east.userData.outward = new THREE.Vector3(-1, 0, 0)
  east.userData.baseOpacity = 0.5
  east.name = 'východní průčelí (prosklené po okap)'
  groups.glass.add(east)
  walls.push(east)

  // štít v antracitu — patří k plášti, s cutaway mizí jako stěna
  const gableMat = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.8, side: THREE.DoubleSide })
  addWall('východní štít (antracit)',
    wallGeom([[0, S.eaves], [S.depth, S.eaves], [S.depth / 2, ridge]], [], t),
    t / 2, 0, 0, 1, [-1, 0, 0], gableMat)

  const mullMat = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.55, metalness: 0.35 })
  mullMat.userData.shared = true
  // sloupky à 1,5 m, každý třetí zesílený
  for (let z = 1.5; z < S.depth; z += 1.5) {
    const heavy = Math.abs(z % 4.5) < 0.01
    const m = new THREE.Mesh(new THREE.BoxGeometry(heavy ? 0.22 : 0.12, S.eaves, heavy ? 0.22 : 0.12), mullMat)
    m.position.set(t / 2, S.eaves / 2, z)
    groups.glass.add(m)
  }
  // mezipatrový pás — přiznaná deska patra
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, S.depth), mullMat)
  band.position.set(t / 2, S.clearGF + S.slab / 2 + 0.04, S.depth / 2)
  groups.glass.add(band)
  // horní paždík pod okapem
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, S.depth), mullMat)
  head.position.set(t / 2, S.eaves - 0.1, S.depth / 2)
  groups.glass.add(head)

  // dubové slunolamy à 0,75 m na jižní třetině (z 0–6; z=0 je jih)
  const finMat = new THREE.MeshStandardMaterial({ color: 0xb0793f, roughness: 0.75 })
  finMat.userData.shared = true
  for (let z = 0.4; z <= 6.0; z += 0.75) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, S.eaves - 0.1, 0.06), finMat)
    fin.position.set(-0.38, (S.eaves - 0.1) / 2, z)
    fin.castShadow = true
    groups.glass.add(fin)
  }

  // --- střecha ---
  // Roviny musí u hřebene KONČIT, ne se překrývat — půlmetrový přesah dvou
  // ploch přes sebe dělal z-fighting a střecha problikávala.
  const halfD = S.depth / 2
  const slopeCenter = (side) => roofSlope(S, side)
  const slope = roofSlope(S, -1).len
  const roofMat = sharedMat('roofSheet', { side: THREE.DoubleSide, roughness: 0.65, metalness: 0.25 })
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

  // --- podlaha přízemí + nášlapné vrstvy podle provozu ---
  const slabMat = new THREE.MeshStandardMaterial({ color: 0xcfc7bb, roughness: 0.9 })
  const floor = new THREE.Mesh(new THREE.BoxGeometry(S.stage1, 0.2, S.depth), slabMat)
  floor.position.set(S.stage1 / 2, -0.1, S.depth / 2)
  floor.receiveShadow = true
  groups.ground.add(floor)

  const FINISH = {
    office: ['wood', 1.6], meeting: ['wood', 1.6], lobby: ['wood', 1.6],
    wet: ['tile', 1.2], arena: ['rubber', 1.5], play: ['rubber', 1.5],
    gym: ['rubber', 1.5], sim: ['rubber', 1.5],
    workshop: ['concrete', 3.0], storage: ['concrete', 3.0], plant: ['concrete', 3.0],
    circ: ['concrete', 3.0], reserve: ['concrete', 3.0],
    flat: ['wood', 1.6],
  }
  const stairsForHoles = fit.items.filter((it) => it.kind === 'stairs')
  for (const b of S.blocks) {
    const fin = FINISH[b.type]
    if (!fin) continue
    const lvl = b.level === 'full' ? 0 : b.level
    const w = b.x1 - b.x0 - 0.08
    const d = b.z1 - b.z0 - 0.08
    // fitness má plovoucí podlahu (kročejový hluk činek nad lobby) — tlustší
    const th = b.type === 'gym' ? 0.14 : 0.04
    // nášlapná vrstva v patře MUSÍ mít stejné prostupy jako stropní deska —
    // plný kvádr se položil přes schodišťový otvor a dal se přejít
    const holes = lvl === 1
      ? stairsForHoles.map((it) => stairOpening(it, FURN))
          .filter((o) => o.x1 > b.x0 && o.x0 < b.x1 && o.z1 > b.z0 && o.z0 < b.z1)
          .map((o) => ({
            u0: Math.max(o.x0, b.x0 + 0.04) - b.x0 - 0.04,
            u1: Math.min(o.x1, b.x1 - 0.04) - b.x0 - 0.04,
            v0: Math.max(o.z0, b.z0 + 0.04) - b.z0 - 0.04,
            v1: Math.min(o.z1, b.z1 - 0.04) - b.z0 - 0.04,
          }))
      : []
    let m
    if (holes.length) {
      const g2 = wallGeom([[0, 0], [w, 0], [w, d], [0, d]], holes, th)
      g2.rotateX(-Math.PI / 2)
      m = new THREE.Mesh(g2, floorMat(fin[0], w, d, fin[1]))
      m.position.set(b.x0 + 0.04, levelBase(S, lvl) + th / 2, b.z0 + 0.04 + d)
    } else {
      m = new THREE.Mesh(new THREE.BoxGeometry(w, th, d), floorMat(fin[0], w, d, fin[1]))
      m.position.set((b.x0 + b.x1) / 2, levelBase(S, lvl) + th / 2, (b.z0 + b.z1) / 2)
    }
    m.receiveShadow = true
    m.userData.block = b
    groups.ground.add(m)
  }

  // --- vnitřní příčky s dveřními otvory; požární dělení je tlustší a tónované ---
  const partSegs = partitionsFor(S)
  const partMat = sharedMat('plaster', { roughness: 0.92 })
  const fireMat = new THREE.MeshStandardMaterial({ color: 0xd8b8b0, roughness: 0.9 })
  fireMat.userData.shared = true
  for (const seg of partSegs) {
    const t2 = seg.fire ? 0.2 : 0.1
    const h = seg.top - seg.base
    const spans = []
    let cur = seg.from
    const gaps = [...seg.gaps].sort((a, b2) => a[0] - b2[0])
    for (const [g0, g1, gh] of gaps) {
      if (g0 > cur + 0.05) spans.push([cur, g0, 0])
      spans.push([g0, g1, gh ?? 2.1])            // nadpraží nad otvorem
      cur = Math.max(cur, g1)
    }
    if (cur < seg.to - 0.05) spans.push([cur, seg.to, 0])
    for (const [f, t3, over] of spans) {
      const len = t3 - f
      if (len < 0.05) continue
      const hh = over > 0 ? Math.max(0, h - over) : h
      if (hh < 0.05) continue
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(seg.axis === 'x' ? len : t2, hh, seg.axis === 'x' ? t2 : len),
        seg.fire ? fireMat : partMat,
      )
      m.position.set(
        seg.axis === 'x' ? (f + t3) / 2 : seg.at,
        seg.base + (over > 0 ? over + hh / 2 : hh / 2),
        seg.axis === 'x' ? seg.at : (f + t3) / 2,
      )
      m.castShadow = true
      m.receiveShadow = true
      m.userData.level = seg.level
      groups.partitions.add(m)
    }
  }

  // --- vazníky přes rozpon na rastru (spodní pásnice 5,75 m — rozvody
  // v patře vedou POD ní, viz spineY v mep.js) ---
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.6, metalness: 0.4 })
  trussMat.userData.shared = true
  for (const tx of [S.grid, S.grid * 2, S.grid * 3]) {
    const chord = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, S.depth - 0.4), trussMat)
    chord.position.set(tx, 5.86, S.depth / 2)
    groups.structure.add(chord)
    for (const side of [-1, 1]) {
      const sl = roofSlope(S, side, 0)
      const tc = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, sl.len - 0.3), trussMat)
      tc.position.set(tx, sl.y - 0.12, sl.z)
      tc.rotation.x = side * deg(S.pitch)
      groups.structure.add(tc)
    }
    for (let i = 0; i < 7; i++) {                        // diagonály
      const z = 1.8 + i * 2.4
      const dg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), trussMat)
      dg.position.set(tx, 6.28, z)
      dg.rotation.x = (i % 2 ? 1 : -1) * 0.7
      groups.structure.add(dg)
    }
  }

  // --- sloupy mezipater (statika: fitness a sklad nesou 5+ kN/m²) ---
  const colMat2 = new THREE.MeshStandardMaterial({ color: 0x5a6169, roughness: 0.5, metalness: 0.5 })
  colMat2.userData.shared = true
  for (const [cx2, cz2] of [[7, 4], [7, 9], [14, 4], [14, 8], [15.4, 15.1], [18.6, 15.1], [23.3, 6.05], [26.9, 6.05]]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.2, S.clearGF, 0.2), colMat2)
    c.position.set(cx2, S.clearGF / 2, cz2)
    c.castShadow = true
    groups.structure.add(c)
  }

  // --- sokl po obvodu (detail obálky: tepelný most a ostřik) ---
  const soklMat = new THREE.MeshStandardMaterial({ color: 0x4c5157, roughness: 0.9 })
  soklMat.userData.shared = true
  for (const [wx, hz2, px, pz] of [
    [S.stage1 + 0.3, 0.08, S.stage1 / 2, -0.04],
    [S.stage1 + 0.3, 0.08, S.stage1 / 2, S.depth + 0.04],
    [0.08, S.depth + 0.3, -0.04, S.depth / 2],
    [0.08, S.depth + 0.3, S.stage1 + 0.04, S.depth / 2],
  ]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(wx, 0.45, hz2), soklMat)
    m.position.set(px, 0.225, pz)
    groups.site.add(m)
  }

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
      // zábradlí kolem prostupu — ale STRANA, KUDY SE VYCHÁZÍ ZE SCHODIŠTĚ,
      // zůstává volná (dřív ji přehrazovalo a schodiště vypadalo neprůchozí)
      const st = stairItems.find((it) => {
        const o = stairOpening(it, FURN)
        return o.x1 > b.x0 + h.u0 && o.x0 < b.x0 + h.u1 && o.z1 > b.z0 + h.v0 && o.z0 < b.z0 + h.v1
      })
      const exit = st ? ({ 0: 'v1', 180: 'v0', 90: 'u0', 270: 'u1' })[st.rot ?? 0] : null
      if (exit !== 'v0') rails.push({ x0: b.x0 + h.u0, x1: b.x0 + h.u1, z0: b.z0 + h.v0, z1: b.z0 + h.v0 })
      if (exit !== 'v1') rails.push({ x0: b.x0 + h.u0, x1: b.x0 + h.u1, z0: b.z0 + h.v1, z1: b.z0 + h.v1 })
      if (exit !== 'u0') rails.push({ x0: b.x0 + h.u0, x1: b.x0 + h.u0, z0: b.z0 + h.v0, z1: b.z0 + h.v1 })
      if (exit !== 'u1') rails.push({ x0: b.x0 + h.u1, x1: b.x0 + h.u1, z0: b.z0 + h.v0, z1: b.z0 + h.v1 })
    }
    for (const r of rails) {
      const len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0)
      if (len < 0.4) continue
      const rm = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 0.06), railMat)
      rm.userData.rail = true
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
  // Řada stání z −6,5 m: tři běžná, dvě bezbariérová (3,5 m) nejblíž vstupu,
  // dvě běžná — a pak MEZERA: pruh x 21–28,5 zůstává volný jako vjezd
  // k vratům dílny. Zbylá stání jsou na ploše etapy 2 (do její stavby).
  const park = S.site ?? { parkRow: -6.5, bays: [] }
  for (const b of park.bays) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.bf ? 0.05 : 0.04, 5.0),
      b.bf ? siteMat(0x2f6fa8) : asphalt)
    m.position.set(b.x, b.bf ? 0.03 : 0.02, park.parkRow)
    m.receiveShadow = true
    groups.site.add(m)
  }

  // --- venkovní schodiště a pavlač k bytům v patře (varianta B) ---
  // Nejlevnější způsob, jak dát dvěma bytům nahoře vlastní vstup: ocelová
  // konstrukce před jižní fasádou. Žádná společná chodba uvnitř, bytová část
  // se s provozem firmy nikde nepotká a je vlastní požární úsek.
  const ext = S.exterior
  if (ext?.walkway) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x6f7680, roughness: 0.55, metalness: 0.6 })
    steel.userData.shared = true
    const railM = new THREE.MeshStandardMaterial({
      color: 0xb9b0a2, roughness: 0.5, transparent: true, opacity: 0.6, depthWrite: false,
    })
    railM.userData.shared = true
    const w = ext.walkway
    const y = levelBase(S, w.level ?? 1)
    const len = w.x1 - w.x0
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, w.depth), steel)
    deck.position.set((w.x0 + w.x1) / 2, y - 0.06, -w.depth / 2)
    deck.castShadow = true
    deck.receiveShadow = true
    groups.site.add(deck)
    // zábradlí po vnější hraně + čela
    const rail = (l, x, z, turn, base = y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(l, 1.1, 0.06), railM)
      m.position.set(x, base + 0.55, z)
      if (turn) m.rotation.y = Math.PI / 2
      groups.site.add(m)
    }
    rail(len, (w.x0 + w.x1) / 2, -w.depth, false)
    rail(w.depth, w.x0, -w.depth / 2, true)
    rail(w.depth, w.x1, -w.depth / 2, true)
    // sloupky pavlače, ať to nevisí ve vzduchu; v poli schodiště se vynechají
    for (let x = w.x0 + 0.6; x < w.x1; x += 2.8) {
      if (ext.stairs && x > ext.stairs.x0 - 0.3 && x < ext.stairs.x1 + 0.3) continue
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, y, 0.12), steel)
      p.position.set(x, y / 2, -w.depth + 0.1)
      p.castShadow = true
      groups.site.add(p)
    }
    // Dvouramenné schodiště s mezipodestou. Rovné rameno by na 3,3 m výšky
    // potřebovalo 5,5 m běhu a stálo by uprostřed příjezdu — dvě ramena
    // vedle sebe to zkrátí na polovinu.
    const st = ext.stairs
    if (st) {
      const sw = st.x1 - st.x0
      const LAND = 1.2
      const run = st.out - w.depth - LAND        // běh jednoho ramene
      const slope = Math.atan2(y / 2, run)
      const zMid = -(w.depth + run / 2)
      // rameno 1 stoupá od terénu u fasády k mezipodestě (výš je konec na −z),
      // rameno 2 z mezipodesty zpět nahoru na pavlač (výš je konec na +z)
      for (const [i, sign] of [[0, 1], [1, -1]]) {
        const fl = new THREE.Mesh(
          new THREE.BoxGeometry(sw / 2 - 0.08, 0.1, Math.hypot(run, y / 2)), steel)
        fl.position.set(st.x0 + (i === 0 ? sw / 4 : (3 * sw) / 4), y * (i === 0 ? 0.25 : 0.75), zMid)
        fl.rotation.x = sign * slope
        fl.castShadow = true
        groups.site.add(fl)
      }
      const landing = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.12, LAND), steel)
      landing.position.set((st.x0 + st.x1) / 2, y / 2 - 0.06, -(st.out - LAND / 2))
      landing.castShadow = true
      groups.site.add(landing)
      rail(sw, (st.x0 + st.x1) / 2, -st.out, false, y / 2)   // zábradlí mezipodesty je o patro níž
      for (const x of [st.x0, st.x1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, y / 2, 0.12), steel)
        p.position.set(x, y / 4, -(st.out - LAND / 2))
        p.castShadow = true
        groups.site.add(p)
      }
    }
  }

  // POZOR: hledat podle ID — kuchyňský kout má taky typ 'lobby' a portál
  // se po komunitní přestavbě přestěhoval na jeho střed (x=2)
  const lobbyB = S.blocks.find((b) => b.id === 'lobby')
  if (lobbyB) {
    // ---- vstupní portál v2.2: bílý rám s limetkovým ostěním (jediná barva
    // na antracitové hale), bílá markýza s limetkovou hranou, logo 1P ----
    const cx = (lobbyB.x0 + lobbyB.x1) / 2
    const whiteM = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.6 })
    whiteM.userData.shared = true
    const limeM = new THREE.MeshStandardMaterial({ color: 0xbfe32e, roughness: 0.45 })
    limeM.userData.shared = true
    const portal = (geo, x, y, z) => {
      const m = new THREE.Mesh(geo, whiteM)
      m.position.set(x, y, z)
      m.castShadow = true
      m.userData.outward = new THREE.Vector3(0, 0, -1)
      m.userData.baseOpacity = 1
      groups.shell.add(m)
      walls.push(m)
      return m
    }
    portal(new THREE.BoxGeometry(0.38, 6.15, 0.34), cx - 1.86, 3.07, -0.16)   // pilíř západ
    portal(new THREE.BoxGeometry(0.38, 6.15, 0.34), cx + 1.86, 3.07, -0.16)   // pilíř východ
    portal(new THREE.BoxGeometry(4.1, 0.45, 0.34), cx, 5.93, -0.16)           // překlad
    const limePc = (geo, x, y, z) => {
      const m = portal(geo, x, y, z)
      m.material = limeM
      return m
    }
    limePc(new THREE.BoxGeometry(0.1, 5.5, 0.08), cx - 1.62, 2.85, -0.35)     // limetkové ostění
    limePc(new THREE.BoxGeometry(0.1, 5.5, 0.08), cx + 1.62, 2.85, -0.35)
    limePc(new THREE.BoxGeometry(3.34, 0.1, 0.08), cx, 5.65, -0.35)
    // markýza bílá s limetkovou hranou
    const canopy = portal(new THREE.BoxGeometry(4.0, 0.14, 1.7), cx, 2.9, -0.92)
    limePc(new THREE.BoxGeometry(4.0, 0.05, 0.07), cx, 2.8, -1.74)
    // logo 1P na překladu — limetka na antracitu
    const lc = document.createElement('canvas')
    lc.width = 256; lc.height = 128
    const lg = lc.getContext('2d')
    lg.fillStyle = '#f4f2ee'
    lg.fillRect(0, 0, 256, 128)
    lg.fillStyle = '#9bbf10'
    lg.font = '900 96px system-ui'
    lg.textAlign = 'center'
    lg.fillText('1P', 128, 96)
    const ltex = new THREE.CanvasTexture(lc)
    ltex.colorSpace = THREE.SRGBColorSpace
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.65),
      new THREE.MeshBasicMaterial({ map: ltex }))
    sign.position.set(cx, 5.05, -0.36)
    sign.rotation.y = Math.PI
    sign.userData.outward = new THREE.Vector3(0, 0, -1)
    sign.userData.baseOpacity = 1
    groups.shell.add(sign)
    walls.push(sign)
  }

  const bins = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.25, 1.1), siteMat(0x5a6169))
  bins.position.set(6.6, 0.63, -1.6)
  bins.castShadow = true
  groups.site.add(bins)                                // odpad — vynáší se hlavním vchodem

  const retention = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.1, 3.0), siteMat(0x3f6f8f, 0.5))
  retention.position.set(34, 0.05, -5.0)
  groups.site.add(retention)                           // retence dešťovky na celých 1 008 m²
  // lapol je podzemní — ve vjezdu je jen pojezdový poklop
  const lapol = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 16), siteMat(0x6a6a55))
  lapol.position.set(25.0, 0.03, -3.0)
  groups.site.add(lapol)                               // odlučovač ropných látek od dílny

  // --- ekonomika: sloupce výnosnosti nad bloky + bilance nad východní fasádou ---
  if (S.economy) {
    const M2_PER_M = 2500                      // 2 500 Kč/m²·rok = 1 m výšky sloupce
    const baseY = ridge + 0.7
    for (const [id, rev] of Object.entries(S.economy.revenue)) {
      const b = S.blocks.find((x) => x.id === id)
      if (!b || rev <= 0) continue
      const a = (b.x1 - b.x0) * (b.z1 - b.z0)
      const perM2 = rev / a
      const h = Math.max(0.3, perM2 / M2_PER_M)
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(b.x1 - b.x0 - 0.5, h, b.z1 - b.z0 - 0.5),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.58 - 0.42 * Math.min(1, perM2 / 16000), 0.75, 0.5),
          transparent: true, opacity: 0.45, depthWrite: false,
        }),
      )
      col.position.set((b.x0 + b.x1) / 2, baseY + h / 2, (b.z0 + b.z1) / 2)
      groups.econ.add(col)
      const lb = labelSprite(b.name, `${Math.round(perM2).toLocaleString('cs-CZ')} Kč/m²·rok`)
      lb.position.set((b.x0 + b.x1) / 2, baseY + h + 0.5, (b.z0 + b.z1) / 2)
      groups.econ.add(lb)
    }
    // bilance: jeden sloupec — spodek náklady (červeně), vršek zisk (limetkou)
    const M_PER_MIL = 1.6
    const revT = Object.values(S.economy.revenue).reduce((a2, v) => a2 + v, 0)
    const cost = S.economy.costsTotal
    const hCost = (cost / 1e6) * M_PER_MIL
    const hProfit = ((revT - cost) / 1e6) * M_PER_MIL
    const bx = -3.2
    const bz = S.depth / 2
    const costBox = new THREE.Mesh(new THREE.BoxGeometry(2.4, hCost, 2.4),
      new THREE.MeshStandardMaterial({ color: 0xd94f4f, transparent: true, opacity: 0.55, depthWrite: false }))
    costBox.position.set(bx, ridge + 0.7 + hCost / 2, bz)
    groups.econ.add(costBox)
    const profBox = new THREE.Mesh(new THREE.BoxGeometry(2.4, hProfit, 2.4),
      new THREE.MeshStandardMaterial({ color: 0xbfe32e, transparent: true, opacity: 0.6, depthWrite: false }))
    profBox.position.set(bx, ridge + 0.7 + hCost + hProfit / 2, bz)
    groups.econ.add(profBox)
    const l1 = labelSprite(`Výnosy ${(revT / 1e6).toFixed(2).replace('.', ',')} mil. Kč/rok`,
      `náklady ${(cost / 1e6).toFixed(2).replace('.', ',')} · zisk ${((revT - cost) / 1e6).toFixed(2).replace('.', ',')} mil.`)
    l1.position.set(bx, ridge + 1.4 + hCost + hProfit, bz)
    groups.econ.add(l1)
  }

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
