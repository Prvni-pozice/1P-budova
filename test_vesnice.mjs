// test_vesnice.mjs — kontroly varianty D (kontejnerová vesnička).
// Spouštět: node test_vesnice.mjs
//
// Hlídá: modularitu (každá buňka = přesné násobky kontejnerů), rozestupy,
// buňky na hraně pozemku (plot), vnitřní dispozici bytu, denní světlo,
// dosažitelnost všech vstupů po zpevněných plochách a volno před dveřmi.
import { SPEC_VESNICE as S, CONT, containerCounts } from './src/spec-vesnice.js'
import { fitoutAll, fitoutFor, doorsFor, sharedEdge, FURN } from './src/fitout.js'
import { TYPES } from './src/spec.js'

let pass = 0
let fail = 0
const ok = (cond, msg) => {
  if (cond) pass++
  else { fail++; console.log(`  FAIL: ${msg}`) }
}
const near = (a, b, eps = 0.02) => Math.abs(a - b) < eps
const uArea = (u) => (u.x1 - u.x0) * (u.z1 - u.z0)
const ALL = [...S.units, ...S.future]

console.log('== Základ a modularita ==')
ok(S.kind === 'village', 'spec.kind = village')
const site = S.stage1 * S.depth
ok(site > 2700 && site < 3000, `výměra modelu ${site} m² ≈ parcela 2 850 m²`)
for (const u of ALL) {
  const c = CONT[u.kind]
  ok(c, `${u.id}: známý druh buňky ${u.kind}`)
  if (!c) continue
  // kontejner smí být otočený o 90° (sanita stojí na výšku)
  const fits = (near(u.x1 - u.x0, c.w) && near(u.z1 - u.z0, c.d))
    || (near(u.x1 - u.x0, c.d) && near(u.z1 - u.z0, c.w))
  ok(fits, `${u.id}: půdorys ${(u.x1 - u.x0).toFixed(2)}×${(u.z1 - u.z0).toFixed(2)} = ${u.kind} (${c.w}×${c.d})`)
}

console.log('== Kontejnerová bilance ==')
const c1 = containerCounts(S, [1])
const cA = containerCounts(S)
ok(S.units.length === 5, `etapa 1 má 5 buněk (${S.units.length})`)
ok(c1.c40 === 6 && c1.c20 === 2, `etapa 1: 6× 40' + 2× 20' (${c1.c40}+${c1.c20})`)
ok(cA.c40 === 16 && cA.c20 === 3, `finál: 16× 40' + 3× 20' = 19 ks (${cA.c40}+${cA.c20})`)

console.log('== Umístění na pozemku ==')
for (const u of ALL) {
  ok(u.x0 >= -0.01 && u.x1 <= S.stage1 + 0.01 && u.z0 >= -0.01 && u.z1 <= S.depth + 0.01,
    `${u.id}: uvnitř pozemku`)
}
// buňky, které dělají plot: sklad + technika PŘESNĚ na severní hraně
for (const id of ['u-tech', 'u-sklad-1', 'u-sklad-2', 'u-sklad-3']) {
  const u = ALL.find((x) => x.id === id)
  ok(u && near(u.z1, S.depth, 0.001), `${id}: stojí na severní hraně pozemku (plot)`)
}
// překryvy a rozestupy — kontejnery skladu na sebe navazují (souvislá stěna),
// jinak minimálně 2 m mezera (údržba, odstupy)
const TOUCH_OK = new Set(['u-sklad-1|u-sklad-2', 'u-sklad-2|u-sklad-3'])
for (let i = 0; i < ALL.length; i++) {
  for (let j = i + 1; j < ALL.length; j++) {
    const a = ALL[i]
    const b = ALL[j]
    const gx = Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1)
    const gz = Math.max(a.z0, b.z0) - Math.min(a.z1, b.z1)
    const gap = Math.max(gx, gz)
    ok(gap > -0.001, `${a.id} × ${b.id}: bez překryvu`)
    if (TOUCH_OK.has([a.id, b.id].sort().join('|'))) continue
    if (gx > -0.001 && gz > -0.001 && gap < 2.0 - 0.001) {
      // mezera se měří jen když se intervaly v druhé ose potkávají
      const meetX = a.x0 < b.x1 && b.x0 < a.x1
      const meetZ = a.z0 < b.z1 && b.z0 < a.z1
      if (meetX || meetZ) ok(false, `${a.id} × ${b.id}: mezera jen ${gap.toFixed(2)} m (< 2,0)`)
    }
  }
}

console.log('== Bloky a byt ==')
const unitOf = {}
for (const u of S.units) for (const id of u.blocks) unitOf[id] = u
for (const b of S.blocks) {
  ok(b.level === 0, `${b.id}: level 0`)
  ok(TYPES[b.type], `${b.id}: známý typ ${b.type}`)
  const u = unitOf[b.id]
  ok(u, `${b.id}: patří do některé buňky`)
  if (u) {
    ok(b.x0 >= u.x0 - 0.01 && b.x1 <= u.x1 + 0.01 && b.z0 >= u.z0 - 0.01 && b.z1 <= u.z1 + 0.01,
      `${b.id}: uvnitř buňky ${u.id}`)
  }
}
// místnosti bytu buňku přesně vyskládají
const byt = S.units.find((u) => u.id === 'u-byt')
const rooms = byt.blocks.map((id) => S.blocks.find((b) => b.id === id))
const roomsArea = rooms.reduce((s, b) => s + (b.x1 - b.x0) * (b.z1 - b.z0), 0)
ok(near(roomsArea, uArea(byt), 0.05), `byt: místnosti pokrývají celou buňku (${roomsArea.toFixed(1)} vs ${uArea(byt).toFixed(1)} m²)`)
for (let i = 0; i < rooms.length; i++) {
  for (let j = i + 1; j < rooms.length; j++) {
    const a = rooms[i]
    const b = rooms[j]
    const oX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
    const oZ = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)
    ok(!(oX > 0.01 && oZ > 0.01), `byt: ${a.id} × ${b.id} bez překryvu`)
  }
}
// links sedí na skutečné sousednosti
for (const l of S.links) {
  const a = S.blocks.find((b) => b.id === l.a)
  const b = S.blocks.find((x) => x.id === l.b)
  ok(a && b, `link ${l.a}–${l.b}: bloky existují`)
  if (a && b) ok(sharedEdge(a, b), `link ${l.a}–${l.b}: bloky spolu sousedí`)
}
// z předsíně se dá do každé místnosti bytu (BFS po links)
{
  const adj = {}
  for (const l of S.links) {
    (adj[l.a] ??= []).push(l.b)
    ;(adj[l.b] ??= []).push(l.a)
  }
  const seen = new Set(['byt-predsin'])
  const q = ['byt-predsin']
  while (q.length) {
    for (const n of adj[q.shift()] ?? []) if (!seen.has(n)) { seen.add(n); q.push(n) }
  }
  for (const id of byt.blocks) ok(seen.has(id), `byt: ${id} dosažitelná z předsíně`)
}

console.log('== Otvory v obálkách ==')
const wallLen = (u, side) => (side === 's' || side === 'n' ? u.x1 - u.x0 : u.z1 - u.z0)
for (const u of S.units) {
  const doors = (u.openings ?? []).filter((o) => o.kind === 'door')
  ok(doors.length >= 1, `${u.id}: má vstupní dveře`)
  for (const o of doors) ok(o.v0 === 0 && o.v1 >= 2.0, `${u.id}: dveře od podlahy, výška ≥ 2,0 m`)
  for (const o of u.openings ?? []) {
    ok(o.u0 >= 0 && o.u1 <= wallLen(u, o.side) + 0.001 && o.u1 > o.u0,
      `${u.id}/${o.side}: otvor ${o.u0}–${o.u1} uvnitř stěny`)
    ok(o.v1 <= S.clearGF + 0.001, `${u.id}/${o.side}: otvor nepřesahuje světlou výšku`)
  }
  // otvory na téže stěně se nesmí překrývat (rozbilo by to triangulaci)
  for (const side of ['s', 'n', 'e', 'w']) {
    const hs = (u.openings ?? []).filter((o) => o.side === side)
    for (let i = 0; i < hs.length; i++) {
      for (let j = i + 1; j < hs.length; j++) {
        const a = hs[i]
        const b = hs[j]
        const over = a.u0 < b.u1 && b.u0 < a.u1 && a.v0 < b.v1 && b.v0 < a.v1
        ok(!over, `${u.id}/${side}: otvory se překrývají`)
      }
    }
  }
}
// vstup do bytu vede do předsíně (východní štít, rozsah dveří uvnitř předsíně)
{
  const d = byt.openings.find((o) => o.kind === 'door' && o.side === 'e')
  const p = S.blocks.find((b) => b.id === 'byt-predsin')
  ok(d, 'byt: vstupní dveře na východním štítu')
  if (d) {
    const z0 = byt.z0 + d.u0
    const z1 = byt.z0 + d.u1
    ok(z0 >= p.z0 - 0.01 && z1 <= p.z1 + 0.01, 'byt: vstup ústí do předsíně')
  }
}

console.log('== Denní světlo obytných místností ==')
// okno/prosklení místnosti = otvory buňky na stěnách, kde místnost sahá
// na obálku; plocha oken ≥ 1/10 podlahové plochy (hrubé kritérium OTN)
const lightFor = (roomId) => {
  const b = S.blocks.find((x) => x.id === roomId)
  const u = unitOf[roomId]
  let a = 0
  for (const o of u.openings ?? []) {
    if (o.kind === 'door' || o.kind === 'louvre') continue
    // je stěna s otvorem zároveň stěnou místnosti? A protíná otvor její rozsah?
    const onWall =
      (o.side === 's' && near(b.z0, u.z0, 0.01)) || (o.side === 'n' && near(b.z1, u.z1, 0.01))
      || (o.side === 'e' && near(b.x0, u.x0, 0.01)) || (o.side === 'w' && near(b.x1, u.x1, 0.01))
    if (!onWall) continue
    const [r0, r1] = o.side === 's' || o.side === 'n'
      ? [b.x0 - u.x0, b.x1 - u.x0] : [b.z0 - u.z0, b.z1 - u.z0]
    const w = Math.min(o.u1, r1) - Math.max(o.u0, r0)
    if (w > 0) a += w * (o.v1 - o.v0)
  }
  return a
}
for (const id of ['kanc-a', 'bar', 'byt-obyvak', 'byt-loznice']) {
  const b = S.blocks.find((x) => x.id === id)
  const floor = (b.x1 - b.x0) * (b.z1 - b.z0)
  const glass = lightFor(id)
  ok(glass >= floor / 10, `${id}: okna ${glass.toFixed(1)} m² ≥ 1/10 podlahy (${(floor / 10).toFixed(1)})`)
}

console.log('== Zpevněné plochy a dosažitelnost vstupů ==')
const paving = S.site.paving
const touches = (a, b) => a.x0 <= b.x1 + 0.05 && b.x0 <= a.x1 + 0.05
  && a.z0 <= b.z1 + 0.05 && b.z0 <= a.z1 + 0.05
// graf zpevněných ploch musí být souvislý od vjezdu
{
  const start = paving.findIndex((p) => p.x0 <= 0.01)
  ok(start >= 0, 'vjezd navazuje na ulici (x = 0)')
  const seen = new Set([start])
  const q = [start]
  while (q.length) {
    const i = q.shift()
    paving.forEach((p, j) => {
      if (!seen.has(j) && touches(paving[i], p)) { seen.add(j); q.push(j) }
    })
  }
  ok(seen.size === paving.length, `zpevněné plochy tvoří jeden celek (${seen.size}/${paving.length})`)
}
// každý vstup etapy 1 leží u zpevněné plochy
const doorPoint = (u, o) => {
  const at = (o.u0 + o.u1) / 2
  switch (o.side) {
    case 's': return { x: u.x0 + at, z: u.z0 }
    case 'n': return { x: u.x0 + at, z: u.z1 }
    case 'e': return { x: u.x0, z: u.z0 + at }
    case 'w': return { x: u.x1, z: u.z0 + at }
  }
}
for (const u of S.units) {
  for (const o of (u.openings ?? []).filter((x) => x.kind === 'door')) {
    const p = doorPoint(u, o)
    const nearPave = paving.some((r) =>
      p.x >= r.x0 - 0.8 && p.x <= r.x1 + 0.8 && p.z >= r.z0 - 0.8 && p.z <= r.z1 + 0.8)
    ok(nearPave, `${u.id}: vstup (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) navazuje na chodník`)
  }
}
// terasa přiléhá k jižní stěně obýváku
{
  const t = paving.find((p) => p.id === 'terasa')
  const o = S.blocks.find((b) => b.id === 'byt-obyvak')
  ok(t && near(t.z1, o.z0, 0.11) && t.x0 >= o.x0 - 0.5 && t.x1 <= o.x1 + 0.5,
    'terasa sedí u jižní stěny obýváku')
}

console.log('== Parkování ==')
ok(S.site.bays.length >= 8, `≥ 8 stání (${S.site.bays.length})`)
ok(S.site.bays.some((b) => b.bf), 'bezbariérové stání existuje')
for (const b of S.site.bays) {
  ok(b.z1 - b.z0 >= (b.bf ? 3.4 : 2.4), `stání z ${b.z0}: šířka ${(b.z1 - b.z0).toFixed(1)} m`)
  const rect = { x0: S.site.parkX0, x1: S.site.parkX1, z0: b.z0, z1: b.z1 }
  for (const u of ALL) {
    const oX = Math.min(rect.x1, u.x1) - Math.max(rect.x0, u.x0)
    const oZ = Math.min(rect.z1, u.z1) - Math.max(rect.z0, u.z0)
    ok(!(oX > 0.01 && oZ > 0.01), `stání z ${b.z0} nekoliduje s ${u.id}`)
  }
}

console.log('== Vybavení a volno před dveřmi ==')
const fit = fitoutAll(S)
ok(fit.dropped === 0, `nic z vybavení nevypadlo (${fit.dropped})`)
// mokré místnosti mají vpust (SVC → kanalizace řeší projektant, tady aspoň vpust)
for (const id of ['byt-koupelna', 'sanita']) {
  ok(fit.items.some((it) => it.kind === 'floordrain' && it.block === id), `${id}: podlahová vpust`)
}
// před každými dveřmi (vnitřní i vstupní) musí zůstat 0,85 m volno z obou
// stran — počítá se i nábytek za stěnou v sousední místnosti (lekce 16. 8.)
const clearItems = fit.items.filter((it) => {
  const f = FURN[it.kind]
  return f && f.h >= 0.4 && it.y < 0.5
    && !['door', 'double', 'glazed', 'service', 'escape', 'skylight'].includes(it.kind)
})
const doorSpots = [
  ...doorsFor(S).map((d) => ({ x: d.x, z: d.z, rot: d.rot, what: d.link })),
  ...S.units.flatMap((u) => (u.openings ?? []).filter((o) => o.kind === 'door')
    .map((o) => {
      const p = doorPoint(u, o)
      return { x: p.x, z: p.z, rot: o.side === 'e' || o.side === 'w' ? 90 : 0, what: `vstup ${u.id}`, entry: true }
    })),
]
for (const d of doorSpots) {
  // u vstupů se kontroluje jen vnitřní strana (venku je chodník)
  const half = 0.45
  const depth = 0.85
  const zones = d.rot === 90
    ? [{ x0: d.x - depth, x1: d.x, z0: d.z - half, z1: d.z + half },
       { x0: d.x, x1: d.x + depth, z0: d.z - half, z1: d.z + half }]
    : [{ x0: d.x - half, x1: d.x + half, z0: d.z - depth, z1: d.z },
       { x0: d.x - half, x1: d.x + half, z0: d.z, z1: d.z + depth }]
  for (const zn of zones) {
    const hit = clearItems.find((it) => {
      const f = FURN[it.kind]
      const turned = it.rot === 90 || it.rot === 270
      const hx = (turned ? f.d : f.w) / 2
      const hz = (turned ? f.w : f.d) / 2
      return it.x + hx > zn.x0 + 0.02 && it.x - hx < zn.x1 - 0.02
          && it.z + hz > zn.z0 + 0.02 && it.z - hz < zn.z1 - 0.02
    })
    ok(!hit, `dveře ${d.what}: ${hit ? `${hit.kind}@${hit.block}` : ''} blokuje průchod`)
  }
}
// vybavení jednotlivých místností se vejde (fitoutFor filtruje — tady se
// hlídá, že layout nebyl navržený větší, než je místnost)
for (const b of S.blocks) {
  const gen = fitoutFor(S, b)
  ok(gen.length > 0, `${b.id}: má vybavení`)
}

console.log(`\n${pass} OK, ${fail} FAIL`)
process.exit(fail ? 1 : 0)
