// building.js — veškerá geometrie se generuje ze SPEC. Nic není napevno.
import * as THREE from 'three'
import { TYPES, area, levelBase, roofY, ridgeY, blockHeight } from './spec.js'

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

function tube(points, radius, color) {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.25 })
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
  const touches = (b) => (side === 'north' ? b.z0 <= 0.01 : b.z1 >= S.depth - 0.01)
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
        out.push({ x0: b.x0 + 0.6, x1: cx - 1.8, v0: 1.0, v1: 2.8 })
        out.push({ x0: cx + 1.8, x1: b.x1 - 0.6, v0: 1.0, v1: 2.8 })
      }
    } else if (b.type === 'arena') {
      const w = Math.min(5, span - 1.5)
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

// ---------------------------------------------------------------- generátor

export function buildAll(spec, mep) {
  const root = new THREE.Group()
  const groups = {}
  for (const k of ['ground', 'shell', 'glass', 'roof', 'structure', 'slabs', 'blocks', 'labels', 'mep', 'stage2', 'dims']) {
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
    new THREE.MeshStandardMaterial({ color: 0x6f7a52, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.set(S.length / 2, -0.02, S.depth / 2)
  ground.receiveShadow = true
  groups.ground.add(ground)

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

  // Severní stěna: běží od x=stage1 k x=0 → u = stage1 - x
  addWall('sever',
    wallGeom([[0, 0], [S.stage1, 0], [S.stage1, S.eaves], [0, S.eaves]],
      northHoles.map((h) => ({ u0: S.stage1 - h.x1, u1: S.stage1 - h.x0, v0: h.v0, v1: h.v1 })), t),
    S.stage1, t / 2, -1, 0, [0, 0, -1])

  // Jižní stěna: od x=0 k x=stage1 → u = x
  addWall('jih',
    wallGeom([[0, 0], [S.stage1, 0], [S.stage1, S.eaves], [0, S.eaves]],
      southHoles.map((h) => ({ u0: h.x0, u1: h.x1, v0: h.v0, v1: h.v1 })), t),
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
  const slope = Math.sqrt((S.depth / 2) ** 2 + (ridge - S.eaves) ** 2)
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x7d8590, roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide })
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(S.stage1 + 0.8, 0.18, slope + 0.5), roofMat.clone())
    m.position.set(S.stage1 / 2, (S.eaves + ridge) / 2, side < 0 ? S.depth / 4 : (S.depth * 3) / 4)
    m.rotation.x = side * deg(S.pitch)
    m.castShadow = true
    m.receiveShadow = true
    m.userData.baseOpacity = 1
    groups.roof.add(m)
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

  // --- vestavěné stropy pod bloky v patře ---
  for (const b of S.blocks.filter((x) => x.level === 1)) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(b.x1 - b.x0, S.slab, b.z1 - b.z0), slabMat,
    )
    m.position.set((b.x0 + b.x1) / 2, S.clearGF + S.slab / 2, (b.z0 + b.z1) / 2)
    m.castShadow = true
    m.receiveShadow = true
    m.userData.block = b
    groups.slabs.add(m)
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

  return { root, groups, walls, blockMeshes, mepByService }
}
