// walk.js — průchodnost budovou očima návštěvníka. Bez Three → testovatelné.
//
// Mřížka 0,1 m po podlaží; překážky jsou obvodový plášť (s otvory dveří),
// příčky (s otvory dveří a wallGaps) a stojící vybavení. BFS pak ověří, že
// mezi dvěma body vede souvislá cesta pro člověka dané šířky — na rozdíl od
// topologického testu (links) tohle chytí i nábytek postavený napříč cestou.

import { levelBase } from './spec.js'
import { fitoutAll, FURN } from './fitout.js'
import { partitionsFor, openingsFor } from './building.js'

const CELL = 0.1

// co člověku v cestě nestojí
const DOOR_KINDS = new Set(['door', 'double', 'glazed', 'service', 'escape'])
const FLAT = new Set(['mat', 'entrymat', 'floordrain', 'pram', 'tramp'])
const CEIL = new Set(['diffuser', 'light', 'smoke', 'destrat', 'aircurtain', 'tyreloft'])
const WALLMOUNT = new Set(['picture', 'mirror', 'screen', 'emlight', 'exitsign', 'co2',
  'firstaid', 'airreel', 'hydrant', 'subboard', 'acpanel', 'louvre', 'babychange'])

/**
 * Postaví mapu průchodnosti jednoho podlaží.
 * clearance = poloměr člověka [m] — překážky se o něj nafouknou.
 */
export function walkGrid(S, level, clearance = 0.3) {
  const nx = Math.round(S.stage1 / CELL)
  const nz = Math.round(S.depth / CELL)
  const blocked = new Uint8Array(nx * nz)
  const idx = (ix, iz) => iz * nx + ix
  const base = levelBase(S, level)

  const blockRect = (x0, z0, x1, z1) => {
    const i0 = Math.max(0, Math.floor((x0 - clearance) / CELL))
    const i1 = Math.min(nx - 1, Math.ceil((x1 + clearance) / CELL))
    const j0 = Math.max(0, Math.floor((z0 - clearance) / CELL))
    const j1 = Math.min(nz - 1, Math.ceil((z1 + clearance) / CELL))
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[idx(i, j)] = 1
  }

  // 1) mimo bloky tohoto podlaží se nechodí (patro nepokrývá celý půdorys)
  const here = S.blocks.filter((b) => b.level === level || b.level === 'full')
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * CELL
      const z = (j + 0.5) * CELL
      if (!here.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1)) blocked[idx(i, j)] = 1
    }
  }

  // 2) obvodový plášť — jižní stěna má otvory dveří (v0 = 0)
  const southDoors = level === 0
    ? openingsFor(S, 'south').filter((h) => h.v0 === 0)
    : []
  blockRect(0, -0.3, S.stage1, S.wall)           // jih
  blockRect(0, S.depth - S.wall, S.stage1, S.depth + 0.3)  // sever
  blockRect(-0.3, 0, S.wall, S.depth)            // východ
  blockRect(S.stage1 - S.wall, 0, S.stage1 + 0.3, S.depth) // západ (štít etapy)
  for (const h of southDoors) {
    // otvor dveří průchodnost vrací — odblokuje pruh pláště
    const i0 = Math.max(0, Math.floor((h.x0 + 0.05) / CELL))
    const i1 = Math.min(nx - 1, Math.ceil((h.x1 - 0.05) / CELL))
    const j1 = Math.ceil((S.wall + clearance) / CELL)
    for (let j = 0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[idx(i, j)] = 0
  }

  // 3) příčky s otvory dveří a wallGaps. Dilatace o clearance jde jen
  // NAPŘÍČ příčkou — podél by zavřela dveřní otvory (0,9 m dveře by po
  // nafouknutí obou ostění zbyly na 0,16 m).
  const blockSeg = (axis, at, f, tt) => {
    const t = 0.06 + clearance
    if (axis === 'z') {
      const i0 = Math.max(0, Math.floor((at - t) / CELL))
      const i1 = Math.min(nx - 1, Math.ceil((at + t) / CELL))
      const j0 = Math.max(0, Math.floor(f / CELL))
      const j1 = Math.min(nz - 1, Math.ceil(tt / CELL))
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[idx(i, j)] = 1
    } else {
      const j0 = Math.max(0, Math.floor((at - t) / CELL))
      const j1 = Math.min(nz - 1, Math.ceil((at + t) / CELL))
      const i0 = Math.max(0, Math.floor(f / CELL))
      const i1 = Math.min(nx - 1, Math.ceil(tt / CELL))
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[idx(i, j)] = 1
    }
  }
  for (const p of partitionsFor(S)) {
    if (p.level !== level) continue
    const segs = []                                         // úseky mimo otvory
    let cur = p.from
    for (const [g0, g1] of [...p.gaps].sort((a, b) => a[0] - b[0])) {
      if (g0 > cur) segs.push([cur, g0])
      cur = Math.max(cur, g1)
    }
    if (cur < p.to) segs.push([cur, p.to])
    for (const [f, tt] of segs) blockSeg(p.axis, p.at, f, tt)
  }

  // 4) stojící vybavení (kromě dveří, plochých věcí a všeho nad hlavou)
  for (const it of fitoutAll(S).items) {
    const f = FURN[it.kind]
    if (!f || it.link || DOOR_KINDS.has(it.kind)) continue
    if (FLAT.has(it.kind) || CEIL.has(it.kind) || WALLMOUNT.has(it.kind)) continue
    if (Math.abs(it.y - base) > 1.2) continue               // jiné podlaží / zavěšené
    const turned = it.rot === 90 || it.rot === 270
    const rx = (turned ? f.d : f.w) / 2
    const rz = (turned ? f.w : f.d) / 2
    blockRect(it.x - rx, it.z - rz, it.x + rx, it.z + rz)
  }

  return { nx, nz, blocked, idx }
}

/** BFS: existuje cesta mezi dvěma body? Vrací délku v metrech, nebo null. */
export function findPath(grid, from, to) {
  const { nx, nz, blocked, idx } = grid
  const si = Math.round(from.x / CELL)
  const sj = Math.round(from.z / CELL)
  const ti = Math.round(to.x / CELL)
  const tj = Math.round(to.z / CELL)
  const inb = (i, j) => i >= 0 && i < nx && j >= 0 && j < nz

  // start/cíl bývají u dveří nebo u předmětu — najdi nejbližší volnou buňku
  const nearest = (ci, cj) => {
    for (let r = 0; r < 8; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const i = ci + di
        const j = cj + dj
        if (inb(i, j) && !blocked[idx(i, j)]) return [i, j]
      }
    }
    return null
  }
  const s = nearest(si, sj)
  const t = nearest(ti, tj)
  if (!s || !t) return null

  const dist = new Float32Array(nx * nz).fill(-1)
  dist[idx(s[0], s[1])] = 0
  const queue = [s]
  for (let q = 0; q < queue.length; q++) {
    const [i, j] = queue[q]
    if (i === t[0] && j === t[1]) return dist[idx(i, j)] * CELL
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di
      const nj = j + dj
      if (!inb(ni, nj) || blocked[idx(ni, nj)] || dist[idx(ni, nj)] >= 0) continue
      dist[idx(ni, nj)] = dist[idx(i, j)] + 1
      queue.push([ni, nj])
    }
  }
  return null
}
