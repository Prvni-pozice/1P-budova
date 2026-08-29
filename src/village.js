// village.js — stavitel varianty D (kontejnerová vesnička). Vrací stejný
// kontrakt jako buildAll v building.js, aby main.js nemusel nic vědět navíc:
// { root, groups, walls, blockMeshes, mepByService, pv, fit, extraSolids,
//   cutSpec }.
//
// Každá buňka etapy 1 dostane vlastní obálku (stěny s otvory, plochá střecha,
// podlaha), vybavení jde přes společný fitoutAll — layouty 'ves-*' jsou ve
// fitout.js. Etapy 2 a 3 jsou jen poloprůhledné obrysy s popiskem.
import * as THREE from 'three'
import { TYPES, area, blockHeight } from './spec.js'
import { CONT } from './spec-vesnice.js'
import { FURN, fitoutAll } from './fitout.js'
import { wallGeom, placeWall, labelSprite, furnitureMesh, partitionsFor } from './building.js'
import { sharedMat, floorMat } from './textures.js'

const H = 2.9            // vnější výška kontejneru

/**
 * Mapování stran buňky na geometrii stěny. Lokální u ve spec:
 * s/n = vzdálenost od VÝCHODNÍHO rohu (x − x0), e/w = od JIŽNÍHO (z − z0).
 * wallGeom má u = po délce stěny ve směru dir — jih a západ běží obráceně,
 * takže se u otvorů zrcadlí (stejná past jako u jižní stěny haly).
 */
function sideDef(u, t, side) {
  const W = u.x1 - u.x0
  const D = u.z1 - u.z0
  switch (side) {
    case 's': return { len: W, ax: u.x1, az: u.z0 + t / 2, dx: -1, dz: 0, out: [0, 0, -1], mapU: (o) => [W - o.u1, W - o.u0] }
    case 'n': return { len: W, ax: u.x0, az: u.z1 - t / 2, dx: 1, dz: 0, out: [0, 0, 1], mapU: (o) => [o.u0, o.u1] }
    case 'e': return { len: D, ax: u.x0 + t / 2, az: u.z0, dx: 0, dz: 1, out: [-1, 0, 0], mapU: (o) => [o.u0, o.u1] }
    case 'w': return { len: D, ax: u.x1 - t / 2, az: u.z1, dx: 0, dz: -1, out: [1, 0, 0], mapU: (o) => [D - o.u1, D - o.u0] }
  }
}

/** Světové souřadnice bodu na stěně buňky (střed otvoru apod.). */
export function wallPoint(u, side, at) {
  switch (side) {
    case 's': return { x: u.x0 + at, z: u.z0, rot: 0 }
    case 'n': return { x: u.x0 + at, z: u.z1, rot: 0 }
    case 'e': return { x: u.x0, z: u.z0 + at, rot: 90 }
    case 'w': return { x: u.x1, z: u.z0 + at, rot: 90 }
  }
}

/** AABB segmenty stěn pro kolizi postavy — dveře (v0 = 0) nechávají mezeru. */
function wallSolids(u, t) {
  const out = []
  for (const side of ['s', 'n', 'e', 'w']) {
    const d = sideDef(u, t, side)
    const doors = (u.openings ?? []).filter((o) => o.side === side && o.v0 === 0)
      .map((o) => [o.u0, o.u1]).sort((a, b) => a[0] - b[0])
    const spans = []
    let cur = 0
    for (const [g0, g1] of doors) {
      if (g0 > cur + 0.05) spans.push([cur, g0])
      cur = Math.max(cur, g1)
    }
    if (cur < d.len - 0.05) spans.push([cur, d.len])
    for (const [f, g] of spans) {
      // f..g je v lokálním u SPEC (od východního/jižního rohu) — svět:
      const horiz = side === 's' || side === 'n'
      const box = horiz
        ? { x0: u.x0 + f, x1: u.x0 + g, z0: side === 's' ? u.z0 - t / 2 : u.z1 - t / 2, z1: side === 's' ? u.z0 + t / 2 : u.z1 + t / 2 }
        : { z0: u.z0 + f, z1: u.z0 + g, x0: side === 'e' ? u.x0 - t / 2 : u.x1 - t / 2, x1: side === 'e' ? u.x0 + t / 2 : u.x1 + t / 2 }
      out.push({
        x: (box.x0 + box.x1) / 2, z: (box.z0 + box.z1) / 2,
        hx: (box.x1 - box.x0) / 2 + 0.08, hz: (box.z1 - box.z0) / 2 + 0.08,
        yBase: 0, yTop: H,
      })
    }
  }
  return out
}

export function buildVillage(S) {
  const root = new THREE.Group()
  const groups = {}
  for (const k of ['ground', 'site', 'shell', 'glass', 'roof', 'pv', 'structure', 'partitions', 'slabs', 'furniture', 'blocks', 'labels', 'mep', 'econ', 'stage2']) {
    groups[k] = new THREE.Group()
    groups[k].name = k
    root.add(groups[k])
  }
  const t = S.wall
  const walls = []
  const blockMeshes = []
  const extraSolids = []

  // --- terén a ulice ---
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), sharedMat('grass'))
  ground.rotation.x = -Math.PI / 2
  ground.position.set(S.stage1 / 2, -0.02, S.depth / 2)
  ground.receiveShadow = true
  groups.ground.add(ground)

  const siteMat = (c, o = 1) => new THREE.MeshStandardMaterial({
    color: c, roughness: 0.9, transparent: o < 1, opacity: o, depthWrite: o > 0.9,
  })
  const street = new THREE.Mesh(new THREE.BoxGeometry(6, 0.04, S.depth + 30), siteMat(0x4a4a4a))
  street.position.set(-3.5, 0.01, S.depth / 2)
  street.receiveShadow = true
  groups.site.add(street)

  // --- zpevněné plochy ---
  const PAVE = { asphalt: siteMat(0x4a4a4a), paving: siteMat(0x9a948a), deck: siteMat(0xb0793f) }
  for (const p of S.site.paving) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(p.x1 - p.x0, p.mat === 'deck' ? 0.08 : 0.04, p.z1 - p.z0),
      PAVE[p.mat],
    )
    m.position.set((p.x0 + p.x1) / 2, p.mat === 'deck' ? 0.04 : 0.015, (p.z0 + p.z1) / 2)
    m.receiveShadow = true
    groups.ground.add(m)                  // po zpevněných plochách se chodí
  }

  // --- parkovací stání ---
  for (const b of S.site.bays) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(S.site.parkX1 - S.site.parkX0 - 0.1, b.bf ? 0.05 : 0.04, b.z1 - b.z0 - 0.12),
      b.bf ? siteMat(0x2f6fa8) : siteMat(0x565656))
    m.position.set((S.site.parkX0 + S.site.parkX1) / 2, b.bf ? 0.03 : 0.02, (b.z0 + b.z1) / 2)
    m.receiveShadow = true
    groups.site.add(m)
  }

  // --- plot po hranici pozemku ---
  // Mezery: vjezdová brána na východě a intervaly, kde na hraně stojí buňka
  // (sklad + technika na severu) — kontejner je tam plot sám.
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x565b61, roughness: 0.6, metalness: 0.4 })
  fenceMat.userData.shared = true
  const meshFence = new THREE.MeshStandardMaterial({
    color: 0x8a9199, roughness: 0.55, metalness: 0.5, transparent: true, opacity: 0.45, depthWrite: false,
  })
  meshFence.userData.shared = true
  const onEdge = (edge) => [...S.units, ...(S.future ?? [])].filter((u) => (
    edge === 'n' ? Math.abs(u.z1 - S.depth) < 0.01
    : edge === 's' ? Math.abs(u.z0) < 0.01
    : edge === 'e' ? Math.abs(u.x0) < 0.01 : Math.abs(u.x1 - S.stage1) < 0.01
  )).map((u) => (edge === 'n' || edge === 's' ? [u.x0, u.x1] : [u.z0, u.z1]))
  const fenceRun = (edge, from, to, fx, fz) => {
    // fx/fz: funkce pozice podél hranice
    const skips = [...onEdge(edge), ...(edge === 'e' ? [[S.site.gate.z0, S.site.gate.z1]] : [])]
      .sort((a, b) => a[0] - b[0])
    const segs = []
    let cur = from
    for (const [g0, g1] of skips) {
      if (g0 > cur + 0.1) segs.push([cur, g0])
      cur = Math.max(cur, g1)
    }
    if (cur < to - 0.1) segs.push([cur, to])
    for (const [f, g] of segs) {
      const len = g - f
      const mid = (f + g) / 2
      const rail = new THREE.Mesh(new THREE.BoxGeometry(
        Math.abs(fx(g) - fx(f)) || 0.05, 1.6, Math.abs(fz(g) - fz(f)) || 0.05), meshFence)
      rail.position.set(fx(mid), 0.85, fz(mid))
      groups.site.add(rail)
      for (let p = f + 0.2; p < g; p += 3) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 0.08), fenceMat)
        post.position.set(fx(p), 0.85, fz(p))
        groups.site.add(post)
      }
      void len
    }
  }
  fenceRun('n', 0, S.stage1, (p) => p, () => S.depth)
  fenceRun('s', 0, S.stage1, (p) => p, () => 0)
  fenceRun('e', 0, S.depth, () => 0, (p) => p)
  fenceRun('w', 0, S.depth, () => S.stage1, (p) => p)

  // --- stromy na návsi ---
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 })
  const leafM = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.9 })
  trunkM.userData.shared = true
  leafM.userData.shared = true
  for (const [tx, tz] of S.site.trees ?? []) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.2, 8), trunkM)
    trunk.position.set(tx, 1.1, tz)
    trunk.castShadow = true
    groups.site.add(trunk)
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), leafM)
    crown.position.set(tx, 3.1, tz)
    crown.castShadow = true
    groups.site.add(crown)
  }

  // vybavení musí vzniknout před podlahami kvůli kontraktu buildAll — tady
  // na pořadí nezáleží (žádné prostupy), ale drží se stejný tok
  const fit = fitoutAll(S)

  const shellMat = sharedMat('panelDark', { side: THREE.DoubleSide, roughness: 0.85 })
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x9fd4e8, roughness: 0.08, metalness: 0, transmission: 0.72,
    transparent: true, opacity: 0.5, side: THREE.DoubleSide,
  })
  const louvreMat = new THREE.MeshStandardMaterial({ color: 0x8a9199, roughness: 0.55, metalness: 0.4 })
  louvreMat.userData.shared = true
  const limeM = new THREE.MeshStandardMaterial({ color: 0xbfe32e, roughness: 0.45 })
  limeM.userData.shared = true
  const roofMat = sharedMat('roofSheet', { side: THREE.DoubleSide, roughness: 0.65, metalness: 0.25 })
  const slabMat = new THREE.MeshStandardMaterial({ color: 0xcfc7bb, roughness: 0.9 })
  slabMat.userData.shared = true

  // --- buňky etapy 1: obálka ---
  for (const u of S.units) {
    // stěny s otvory; vnější normála kvůli cutaway
    for (const side of ['s', 'n', 'e', 'w']) {
      const d = sideDef(u, t, side)
      const holes = (u.openings ?? []).filter((o) => o.side === side).map((o) => {
        const [a, b] = d.mapU(o)
        return { u0: a, u1: b, v0: o.v0, v1: o.v1 }
      })
      const m = new THREE.Mesh(
        wallGeom([[0, 0], [d.len, 0], [d.len, H], [0, H]], holes, t),
        shellMat.clone(),
      )
      placeWall(m, d.ax, d.az, d.dx, d.dz)
      m.castShadow = true
      m.receiveShadow = true
      m.userData.outward = new THREE.Vector3(...d.out)
      m.userData.baseOpacity = 1
      m.name = `${u.id} ${side}`
      groups.shell.add(m)
      walls.push(m)

      // výplně otvorů: sklo do oken, žaluzie do louvre, limetkové ostění dveří
      for (const o of (u.openings ?? []).filter((x) => x.side === side)) {
        const p0 = wallPoint(u, side, o.u0)
        const p1 = wallPoint(u, side, o.u1)
        const cx = (p0.x + p1.x) / 2
        const cz = (p0.z + p1.z) / 2
        const len = o.u1 - o.u0
        const cy = (o.v0 + o.v1) / 2
        const horiz = side === 's' || side === 'n'
        if (o.kind === 'window' || o.kind === 'glass') {
          const g = new THREE.Mesh(
            new THREE.BoxGeometry(horiz ? len : 0.05, o.v1 - o.v0, horiz ? 0.05 : len), glassMat.clone())
          g.position.set(cx, cy, cz)
          g.userData.outward = new THREE.Vector3(...d.out)
          g.userData.baseOpacity = 0.5
          groups.glass.add(g)
          walls.push(g)
        } else if (o.kind === 'louvre') {
          const g = new THREE.Mesh(
            new THREE.BoxGeometry(horiz ? len : 0.12, o.v1 - o.v0, horiz ? 0.12 : len), louvreMat)
          g.position.set(cx, cy, cz)
          groups.shell.add(g)
        } else if (o.kind === 'door') {
          // limetkové ostění — jediná barva na antracitu (brand 1P, jako hala)
          const off = 0.09
          const jx = horiz ? 0 : (side === 'e' ? -off : off)
          const jz = horiz ? (side === 's' ? -off : off) : 0
          const frame = new THREE.Mesh(new THREE.BoxGeometry(
            horiz ? len + 0.2 : 0.08, 0.08, horiz ? 0.08 : len + 0.2), limeM)
          frame.position.set(cx + jx, o.v1 + 0.06, cz + jz)
          groups.shell.add(frame)
          for (const sgn of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(
              horiz ? 0.08 : 0.08, o.v1 + 0.1, 0.08), limeM)
            post.position.set(
              horiz ? cx + sgn * (len / 2 + 0.06) + jx : cx + jx,
              (o.v1 + 0.1) / 2,
              horiz ? cz + jz : cz + sgn * (len / 2 + 0.06) + jz)
            groups.shell.add(post)
          }
          // dveřní křídlo s pantem — otevírá se, když přijde postava
          const doorItem = {
            kind: 'door', block: u.blocks[0], x: cx, z: cz, y: 0,
            rot: horiz ? 0 : 90, note: `vstup ${u.name}`, entry: u.id,
          }
          fit.items.push(doorItem)
          fit.counts.door = (fit.counts.door || 0) + 1
        }
      }
    }
    extraSolids.push(...wallSolids(u, t))

    // plochá střecha s přesahem + atika
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(u.x1 - u.x0 + 0.25, 0.14, u.z1 - u.z0 + 0.25), roofMat.clone())
    roof.position.set((u.x0 + u.x1) / 2, H + 0.07, (u.z0 + u.z1) / 2)
    roof.castShadow = true
    roof.receiveShadow = true
    roof.userData.baseOpacity = 1
    groups.roof.add(roof)

    // sokl — kontejner sedí na zemních vrutech / patkách
    const sokl = new THREE.Mesh(
      new THREE.BoxGeometry(u.x1 - u.x0 - 0.2, 0.18, u.z1 - u.z0 - 0.2),
      new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.9 }))
    sokl.position.set((u.x0 + u.x1) / 2, -0.06, (u.z0 + u.z1) / 2)
    groups.site.add(sokl)

    // popisek buňky nad střechou
    const a = (u.x1 - u.x0) * (u.z1 - u.z0)
    const sp = labelSprite(u.name, `${a.toFixed(0)} m² · ${CONT[u.kind].c40 ? CONT[u.kind].c40 + '× 40′' : ''}${CONT[u.kind].c20 ? CONT[u.kind].c20 + '× 20′' : ''}`)
    sp.position.set((u.x0 + u.x1) / 2, H + 1.1, (u.z0 + u.z1) / 2)
    groups.labels.add(sp)
  }

  // --- podlahy místností podle provozu ---
  const FINISH = {
    office: ['wood', 1.6], lobby: ['wood', 1.6], flat: ['wood', 1.6], circ: ['wood', 1.6],
    wet: ['tile', 1.2], plant: ['concrete', 3.0],
  }
  for (const b of S.blocks) {
    const fin = FINISH[b.type] ?? ['concrete', 3.0]
    const w = b.x1 - b.x0 - 0.06
    const d = b.z1 - b.z0 - 0.06
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), floorMat(fin[0], w, d, fin[1]))
    m.position.set((b.x0 + b.x1) / 2, 0.03, (b.z0 + b.z1) / 2)
    m.receiveShadow = true
    m.userData.block = b
    groups.ground.add(m)
  }

  // --- vnitřní příčky (jen byt) — stejný generátor jako u haly ---
  const partSegs = partitionsFor(S)
  const partMat = sharedMat('plaster', { roughness: 0.92 })
  for (const seg of partSegs) {
    const t2 = 0.08
    const h = S.clearGF
    const spans = []
    let cur = seg.from
    for (const [g0, g1, gh] of [...seg.gaps].sort((a, b) => a[0] - b[0])) {
      if (g0 > cur + 0.05) spans.push([cur, g0, 0])
      spans.push([g0, g1, gh ?? 2.1])
      cur = Math.max(cur, g1)
    }
    if (cur < seg.to - 0.05) spans.push([cur, seg.to, 0])
    for (const [f, g, over] of spans) {
      const len = g - f
      if (len < 0.05) continue
      const hh = over > 0 ? Math.max(0, h - over) : h
      if (hh < 0.05) continue
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(seg.axis === 'x' ? len : t2, hh, seg.axis === 'x' ? t2 : len), partMat)
      m.position.set(
        seg.axis === 'x' ? (f + g) / 2 : seg.at,
        over > 0 ? over + hh / 2 : hh / 2,
        seg.axis === 'x' ? seg.at : (f + g) / 2)
      m.castShadow = true
      m.receiveShadow = true
      m.userData.level = 0
      groups.partitions.add(m)
    }
  }

  // --- vybavení ---
  for (const it of fit.items) {
    const m = furnitureMesh(it, FURN)
    m.userData.block = S.blocks.find((b) => b.id === it.block)
    groups.furniture.add(m)
  }

  // --- funkční bloky (výběr, editace kót, vrstva Bloky) ---
  for (const b of S.blocks) {
    const ty = TYPES[b.type]
    const h = blockHeight(S, b)
    const geo = new THREE.BoxGeometry(b.x1 - b.x0 - 0.1, h - 0.1, b.z1 - b.z0 - 0.1)
    const mat = new THREE.MeshStandardMaterial({
      color: ty.color, roughness: 0.6, transparent: true, opacity: 0.42, depthWrite: false,
    })
    const m = new THREE.Mesh(geo, mat)
    m.position.set((b.x0 + b.x1) / 2, h / 2, (b.z0 + b.z1) / 2)
    m.userData.block = b
    m.userData.baseOpacity = 0.42
    groups.blocks.add(m)
    blockMeshes.push(m)
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: ty.color, transparent: true, opacity: 0.95 }))
    edges.position.copy(m.position)
    edges.userData.block = b
    groups.blocks.add(edges)
    const sp = labelSprite(b.name, `${area(b).toFixed(0)} m²`)
    sp.position.set((b.x0 + b.x1) / 2, h * 0.7, (b.z0 + b.z1) / 2)
    sp.userData.block = b
    groups.labels.add(sp)
  }

  // --- etapy 2 a 3 jen naznačené ---
  for (const u of S.future ?? []) {
    const geo = new THREE.BoxGeometry(u.x1 - u.x0, H, u.z1 - u.z0)
    const box = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false,
    }))
    box.position.set((u.x0 + u.x1) / 2, H / 2, (u.z0 + u.z1) / 2)
    groups.stage2.add(box)
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, dashSize: 0.6, gapSize: 0.4 }))
    edges.position.copy(box.position)
    edges.computeLineDistances()
    groups.stage2.add(edges)
    const a = (u.x1 - u.x0) * (u.z1 - u.z0)
    const sp = labelSprite(u.name, `etapa ${u.stage} · ${a.toFixed(0)} m²`)
    sp.position.set((u.x0 + u.x1) / 2, H + 0.9, (u.z0 + u.z1) / 2)
    groups.stage2.add(sp)
  }

  return {
    root, groups, walls, blockMeshes,
    mepByService: {},
    pv: null,
    fit,
    extraSolids,
    // cutaway: „uvnitř budovy“ u vesničky neexistuje — stěny se řídí jen
    // natočením ke kameře a vzdáleností od středu pozemku
    cutSpec: { stage1: S.stage1, depth: S.depth, eaves: S.eaves, noInside: true },
  }
}
