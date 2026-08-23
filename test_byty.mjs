// test_byty.mjs — kontrola VARIANTY B (firemní budova se 4 byty).
// Spouštět: node test_byty.mjs
//
// test_spec.mjs hlídá variantu A do detailu jejího programu (trampolíny, bar,
// šatny). Tady se hlídá to, co je na variantě B nové a co se dá snadno
// rozbít: že byty mají světlo, vlastní vstup, oddělený požární úsek a že
// zbytek domu (kanceláře, dílna) zůstal, kde byl.

import { SPEC, areaTotals, area, levelBase } from './src/spec.js'
import { SPEC_BYTY as S } from './src/spec-byty.js'
import { computeMEP } from './src/mep.js'
import { openingsFor, partitionsFor, openEdges } from './src/building.js'
import { fitoutAll, sanitaryFor, SVC, FURN, doorsFor } from './src/fitout.js'
import { walkGrid, findPath } from './src/walk.js'

let fail = 0
const ok = (cond, msg, extra = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${msg}${extra ? '  → ' + extra : ''}`)
  if (!cond) fail++
}

const blk = (id) => S.blocks.find((b) => b.id === id)
const fit = fitoutAll(S)
const mep = computeMEP(S)
const FLAT_IDS = [1, 2, 3, 4]
const roomsOf = (n) => S.blocks.filter((b) => b.flat === n)

// ------------------------------------------------------------------ PLOCHY
console.log('\nPLOCHY')
const a = areaTotals(S)
ok(Math.abs(a.footprint - 504) < 0.01, 'půdorys etapy 1 = 504 m²', `${a.footprint}`)
ok(Math.abs(a.gf - 504) < 0.01, 'přízemí zaplňuje půdorys přesně', `${a.gf.toFixed(1)} m²`)
ok(a.total >= 750 && a.total <= 850, 'celkem v cílovém pásmu 750–850 m²', `${a.total.toFixed(0)} m²`)

function coverage(spec) {
  const step = 0.5
  let covered = 0, overlap = 0, cells = 0
  for (let x = step / 2; x < spec.stage1; x += step) {
    for (let z = step / 2; z < spec.depth; z += step) {
      cells++
      const n = spec.blocks.filter(
        (b) => (b.level === 0 || b.level === 'full') && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1,
      ).length
      if (n >= 1) covered++
      if (n > 1) overlap++
    }
  }
  return { pct: covered / cells, overlapCells: overlap }
}
const cov = coverage(S)
ok(cov.pct > 0.999, 'přízemí bez děr', `pokryto ${(cov.pct * 100).toFixed(1)} %`)
ok(cov.overlapCells === 0, 'bloky přízemí se nepřekrývají', `${cov.overlapCells} kolizí`)

// patro se taky nesmí překrývat samo se sebou
let up1 = 0
for (let i = 0; i < S.blocks.length; i++) {
  for (let j = i + 1; j < S.blocks.length; j++) {
    const p = S.blocks[i], q = S.blocks[j]
    if (p.level !== 1 || q.level !== 1) continue
    if (p.x0 < q.x1 - 0.01 && p.x1 > q.x0 + 0.01 && p.z0 < q.z1 - 0.01 && p.z1 > q.z0 + 0.01) up1++
  }
}
ok(up1 === 0, 'bloky patra se nepřekrývají', `${up1} kolizí`)
ok(S.blocks.every((b) => b.x0 >= 0 && b.x1 <= S.stage1 && b.z0 >= 0 && b.z1 <= S.depth),
  'žádný blok nepřečnívá obrys etapy 1')

// --------------------------------------------------------------- CO ZŮSTALO
console.log('\nCO ZŮSTALO Z VARIANTY A')
for (const id of ['workshop', 'store-gf', 'plant', 'corridor', 'office-1f', 'meeting', 'reserve',
                  'commons', 'wc-gf']) {
  const x = blk(id), y = SPEC.blocks.find((b) => b.id === id)
  ok(x && y && x.x0 === y.x0 && x.x1 === y.x1 && x.z0 === y.z0 && x.z1 === y.z1,
    `${id} beze změny proti variantě A`, x ? `x ${x.x0}–${x.x1}, z ${x.z0}–${x.z1}` : 'CHYBÍ')
}
const off = blk('office-gf')
ok(off.x0 === 0 && off.x1 === 7, 'kanceláře drží východní pole x 0–7', `${area(off).toFixed(1)} m²`)
ok(!S.blocks.some((b) => b.type === 'arena' || b.type === 'play'), 'aréna ani dětský koutek v modelu nejsou')
const lobbyB = blk('lobby')
const lobbyA = SPEC.blocks.find((b) => b.id === 'lobby')
ok(area(lobbyB) < area(lobbyA) * 0.4, 'recepce je výrazně menší než lobby varianty A',
  `${area(lobbyB).toFixed(1)} vs ${area(lobbyA).toFixed(1)} m²`)
const gymB = area(blk('gym'))
const gymA = area(SPEC.blocks.find((b) => b.id === 'gym')) + area(SPEC.blocks.find((b) => b.id === 'gym-n'))
ok(gymB <= gymA, 'fitness se nezvětšilo', `${gymB.toFixed(0)} vs ${gymA.toFixed(0)} m²`)

// ------------------------------------------------------------------- BYTY
console.log('\nBYTY')
ok(S.program.flats.units === 4, 'program počítá se 4 byty')
const flatAreas = FLAT_IDS.map((n) => roomsOf(n).reduce((s, b) => s + area(b), 0))
ok(flatAreas.every((x) => Math.abs(x - 49) < 0.01), 'každý byt má 49 m²', flatAreas.map((x) => x.toFixed(1)).join(' / '))
ok(flatAreas.every((x) => x >= 40 && x <= 60), 'byty drží pásmo malého 2+kk (40–60 m²)')
const gfFlats = FLAT_IDS.filter((n) => roomsOf(n)[0].level === 0).length
ok(gfFlats === 2, 'dva byty v přízemí, dva v patře', `${gfFlats} + ${4 - gfFlats}`)

// obytná místnost musí mít okno — a jediná fasáda s okny je jižní
const southHoles = openingsFor(S, 'south')
for (const n of FLAT_IDS) {
  const rooms = roomsOf(n)
  const base = levelBase(S, rooms[0].level)
  const habitable = rooms.filter((b) => ['bed', 'liv'].some((k) => b.id.endsWith(k)))
  const lit = habitable.filter((b) => southHoles.some((h) =>
    Math.abs(h.v0 - (base + 0.9)) < 1e-6 && h.x0 >= b.x0 - 0.01 && h.x1 <= b.x1 + 0.01))
  ok(lit.length === 2, `byt ${n}: ložnice i obývák mají okno na jih`, `${lit.length}/2`)
}

// vlastní vstup zvenku, ne přes společnou chodbu
for (const n of FLAT_IDS) {
  const hall = roomsOf(n).find((b) => b.entry)
  const base = levelBase(S, hall.level)
  const door = southHoles.find((h) => Math.abs(h.v0 - base) < 1e-6
    && (h.x0 + h.x1) / 2 > hall.x0 && (h.x0 + h.x1) / 2 < hall.x1)
  ok(!!door, `byt ${n}: vlastní vstupní dveře v jižní fasádě`,
    door ? `x ${door.x0.toFixed(1)}–${door.x1.toFixed(1)}, v ${door.v0.toFixed(1)} m` : 'CHYBÍ')
}
const flatIds = new Set(S.blocks.filter((b) => b.flat).map((b) => b.id))
const leaks = S.links.filter((l) => flatIds.has(l.a) !== flatIds.has(l.b))
ok(leaks.length === 0, 'z bytů nevedou žádné dveře do zbytku domu',
  leaks.length ? leaks.map((l) => `${l.a}–${l.b}`).join(', ') : 'bytová část je oddělená')

// pavlač musí dosáhnout na obě horní vstupní dveře, jinak jsou byty nepřístupné
const w = S.exterior.walkway
for (const n of FLAT_IDS.filter((k) => roomsOf(k)[0].level === 1)) {
  const hall = roomsOf(n).find((b) => b.entry)
  const cx = (hall.x0 + hall.x1) / 2
  ok(cx > w.x0 + 0.5 && cx < w.x1 - 0.5, `byt ${n}: pavlač dosáhne na vstupní dveře`,
    `dveře x ${cx.toFixed(1)}, pavlač ${w.x0}–${w.x1}`)
}
ok(S.exterior.stairs.out > 4.5, 'venkovní schodiště má dost běhu na 3,3 m výšky',
  `vyčnívá ${S.exterior.stairs.out} m`)
const stX = (S.exterior.stairs.x0 + S.exterior.stairs.x1) / 2
ok(S.site.bays.every((b) => Math.abs(b.x - stX) > (b.w + (S.exterior.stairs.x1 - S.exterior.stairs.x0)) / 2),
  'venkovní schodiště nestojí v parkovacím stání')

// koupelny nad sebou = dvě stoupačky na celý dům, ne čtyři
const baths = S.blocks.filter((b) => b.id.endsWith('-bath'))
const risers = new Set(baths.map((b) => `${b.x0.toFixed(2)}|${b.z0.toFixed(2)}`))
ok(risers.size === 2, 'koupelny bytů leží nad sebou → 2 stoupačky', `${risers.size} poloh pro ${baths.length} koupelen`)

// každý byt = samostatný požární úsek
for (const n of FLAT_IDS) {
  ok(Array.isArray(S.compartments[`byt${n}`]) && S.compartments[`byt${n}`].length === 5,
    `byt ${n} je samostatný požární úsek`)
}
const parts = partitionsFor(S)
const compOf = {}
for (const [name, ids] of Object.entries(S.compartments)) for (const id of ids) compOf[id] = name
const flatWalls = parts.filter((p) => p.blocks.some((id) => flatIds.has(id))
  && !p.blocks.every((id) => compOf[id] === compOf[p.blocks[0]]))
ok(flatWalls.length > 0 && flatWalls.every((p) => p.fire),
  'stěny bytů proti okolí jsou požárně dělicí', `${flatWalls.length} úseků`)
const gymWall = parts.find((p) => p.blocks.includes('gym') && p.blocks.some((id) => flatIds.has(id)))
ok(!!gymWall, 'mezi fitness a byty stojí stěna, ne otevřená hrana mezipatra')

// hrana mezipatra u bytů nesmí dostat zábradlí — je tam stěna
const railsOnFlats = S.blocks.filter((b) => b.level === 1 && b.flat)
  .flatMap((b) => openEdges(S, b))
ok(railsOnFlats.length === 0, 'byty v patře nemají volnou hranu se zábradlím',
  `${railsOnFlats.length} úseků`)

// ------------------------------------------------------------- VYBAVENÍ BYTU
console.log('\nVYBAVENÍ BYTU')
for (const n of FLAT_IDS) {
  const ids = new Set(roomsOf(n).map((b) => b.id))
  const its = fit.items.filter((it) => ids.has(it.block))
  const has = (k) => its.some((it) => it.kind === k)
  ok(has('bed') && has('kitchen') && has('shower') && has('wcbowl') && has('basin') && has('washer'),
    `byt ${n}: postel, linka, sprcha, WC, umyvadlo, pračka`,
    `${its.length} kusů`)
  ok(has('smoke'), `byt ${n}: autonomní hlásič kouře`)
}
ok(fit.dropped === 0, 'nic z vybavení nevypadlo mimo místnost',
  fit.dropped ? JSON.stringify(fit.droppedBy) : 'vše se vešlo')

// nábytek nesmí stát ve dveřích
const blocked = []
for (const d of doorsFor(S)) {
  for (const it of fit.items) {
    if (it.link || ['light', 'smoke', 'diffuser', 'emlight', 'exitsign', 'co2'].includes(it.kind)) continue
    if (Math.abs(it.y - d.y) > 0.6) continue
    const f = FURN[it.kind]
    if (!f || f.h < 0.4) continue
    const turned = it.rot === 90 || it.rot === 270
    const rx = (turned ? f.d : f.w) / 2
    const rz = (turned ? f.w : f.d) / 2
    const dx = d.rot === 90 ? 0.35 : 0.6
    const dz = d.rot === 90 ? 0.6 : 0.35
    if (Math.abs(it.x - d.x) < rx + dx && Math.abs(it.z - d.z) < rz + dz) {
      blocked.push(`${it.kind}@${it.block} u dveří ${d.link}`)
    }
  }
}
ok(blocked.length === 0, 'před žádnými vnitřními dveřmi nestojí nábytek',
  blocked.length ? blocked.join(', ') : `${doorsFor(S).length} dveří volných`)

// ------------------------------------------------------------- PŘÍSTUPNOST
console.log('\nPŘÍSTUPNOST A ÚNIK')
const stairs = fit.items.filter((it) => it.kind === 'stairs')
const entrances = new Set()
for (const lvl of [0, 1]) {
  const base = levelBase(S, lvl)
  for (const h of openingsFor(S, 'south')) {
    if (Math.abs(h.v0 - base) > 1e-6) continue
    const cx = (h.x0 + h.x1) / 2
    const b = S.blocks.find((x) => (lvl === 0 ? x.level === 0 || x.level === 'full' : x.level === 1)
      && cx > x.x0 && cx < x.x1 && x.z0 < 0.3)
    if (b) entrances.add(b.id)
  }
}
const edges = new Map(S.blocks.map((b) => [b.id, new Set()]))
for (const l of S.links) { edges.get(l.a).add(l.b); edges.get(l.b).add(l.a) }
for (const [p, q] of S.openPairs ?? []) { edges.get(p).add(q); edges.get(q).add(p) }
for (const st of stairs) {
  const to = S.blocks.find((b) => b.level === 1
    && st.x > b.x0 - 1 && st.x < b.x1 + 1 && st.z > b.z0 - 3 && st.z < b.z1 + 3)
  if (to) { edges.get(st.block).add(to.id); edges.get(to.id).add(st.block) }
}
const seen = new Set(entrances)
const queue = [...entrances]
while (queue.length) for (const n of edges.get(queue.pop()) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n) }
const cutOff = S.blocks.filter((b) => !seen.has(b.id))
ok(cutOff.length === 0, 'z každé místnosti se dá dojít ven',
  cutOff.length ? cutOff.map((b) => b.id).join(', ') : `${seen.size} místností, ${entrances.size} vchodů`)

const tech = new Set(['workshop', 'plant', 'store-gf', 'store-w'])
const techLeaks = S.links.filter((l) => tech.has(l.a) !== tech.has(l.b))
ok(techLeaks.length === 0, 'z dílny nevede do zbytku domu žádné dveře',
  techLeaks.length ? techLeaks.map((l) => `${l.a}–${l.b}`).join(', ') : 'technická zóna je samostatná')

const elev = fit.items.find((it) => it.kind === 'elevator')
ok(!!elev, 'výtah pro bezbariérový přístup do patra firmy')

// ----------------------------------------------------------------- ROZVODY
console.log('\nROZVODY A SANITA')
ok(mep.routes.length > 0, 'trasy se vygenerovaly', `${mep.routes.length} úseků`)
const terms = mep.routes.filter((r) => r.kind === 'terminal')
const needy = fit.items.filter((it) => SVC[it.kind] && SVC[it.kind].svc.length)
const missing = []
for (const it of needy) {
  for (const svc of SVC[it.kind].svc) {
    if (svc === 'vzt') continue
    const hit = terms.some((r) => r.service === svc
      && r.points.some((p) => Math.hypot(p.x - it.x, p.z - it.z) < 1.2))
    if (!hit) missing.push(`${it.kind}@${it.block}/${svc}`)
  }
}
ok(missing.length === 0, 'ke každé koncovce vede větev',
  missing.length ? `${missing.length}: ${missing.slice(0, 5).join(', ')}` : `${needy.length} koncovek`)

for (const n of FLAT_IDS) {
  const bath = roomsOf(n).find((b) => b.id.endsWith('-bath'))
  const hasWater = mep.routes.some((r) => ['water', 'drain'].includes(r.service)
    && r.points.some((p) => p.x > bath.x0 && p.x < bath.x1 && p.z > bath.z0 && p.z < bath.z1))
  ok(hasWater, `byt ${n}: do koupelny jde voda i kanalizace`)
}
const sPub = sanitaryFor(S.program.visitors.peak, { publicUse: true })
const pubItems = fit.items.filter((it) => it.block === 'wc-pub')
ok(pubItems.some((it) => it.kind === 'wcBF'), 'veřejná část má bezbariérovou kabinu (vyhl. 398/2009)',
  `norma žádá ${sPub.wcBF}`)
ok(pubItems.filter((it) => it.kind === 'basin').length >= 2, 'u WC návštěvníků jsou aspoň dvě umyvadla')

// severní stěna zůstává slepá
ok(openingsFor(S, 'north').length === 0, 'severní stěna (soused) je bez otvorů')
const NO_WINDOW_OK = ['wet', 'plant', 'sim', 'meeting', 'circ', 'storage', 'lobby']
const atNorth = S.blocks.filter((b) => b.z1 >= S.depth)
ok(atNorth.every((b) => NO_WINDOW_OK.includes(b.type)),
  'u slepé stěny nestojí žádný byt ani jiný provoz s nárokem na okna',
  atNorth.filter((b) => !NO_WINDOW_OK.includes(b.type)).map((b) => b.id).join(', ') || `${atNorth.length} bloků`)

// --------------------------------------------------------------- EKONOMIKA
console.log('\nEKONOMIKA')
const badIds = Object.keys(S.economy.revenue).filter((id) => !S.blocks.some((b) => b.id === id))
ok(badIds.length === 0, 'ekonomika se odkazuje jen na existující bloky', badIds.join(', '))
const rentTotal = S.blocks.filter((b) => b.flat).reduce((s, b) => s + (S.economy.revenue[b.id] ?? 0), 0)
ok(Math.abs(rentTotal - 4 * 12000 * 12) < 20, 'nájem 4 bytů sedí na 12 000 Kč/měs',
  `${rentTotal.toLocaleString('cs-CZ')} Kč/rok`)
const revSum = Object.values(S.economy.revenue).reduce((s, v) => s + v, 0)
ok(revSum > S.economy.costsTotal, 'model počítá s kladným provozním výsledkem',
  `${((revSum - S.economy.costsTotal) / 1000).toFixed(0)} tis. Kč/rok`)

// ------------------------------------------------- PRŮCHODNOST (walk test)
console.log('\nPRŮCHODNOST (walk test)')
const wg0 = walkGrid(S, 0, 0.3)
const vstup = { x: 3.5, z: 0.6 }
const cileGF = {
  'pata schodiště': { x: 7.7, z: 8.0 },
  'výtah': { x: 9.1, z: 11.5 },
  'fitness': { x: 13.0, z: 10.5 },
  'sim racing': { x: 19.0, z: 10.5 },
  'WC návštěvníků': { x: 8.0, z: 15.0 },
  'komunitní prostor': { x: 3.5, z: 8.0 },
  'WC kanceláří': { x: 5.5, z: 16.0 },
  'kuchyňský kout': { x: 2.0, z: 16.5 },
}
for (const [name, c] of Object.entries(cileGF)) {
  const d = findPath(wg0, vstup, c)
  ok(d !== null, `od recepce: ${name}`, d !== null ? `${d.toFixed(1)} m` : 'CESTA NEEXISTUJE')
}
ok(findPath(wg0, vstup, { x: 24.5, z: 6.0 }) === null,
  'do dílny se z recepce vnitřkem nedá (technická zóna má vlastní vstup)')

// v bytě se musí dát dojít od vstupních dveří do každé místnosti
for (const n of FLAT_IDS) {
  const rooms = roomsOf(n)
  const lvl = rooms[0].level
  const grid = walkGrid(S, lvl, 0.28)
  const hall = rooms.find((b) => b.entry)
  const from = { x: (hall.x0 + hall.x1) / 2, z: 0.55 }
  // Cílem je místnost, ne její střed: v ložnici stojí uprostřed postel,
  // takže se zkouší několik bodů a stačí, když se dá dojít k některému.
  const reaches = (b) => [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]
    .some(([fx, fz]) => findPath(grid, from,
      { x: b.x0 + (b.x1 - b.x0) * fx, z: b.z0 + (b.z1 - b.z0) * fz }) !== null)
  const bad = rooms.filter((b) => b.id !== hall.id && !reaches(b))
  ok(bad.length === 0, `byt ${n}: ode dveří se dojde do všech místností`,
    bad.length ? bad.map((b) => b.id).join(', ') : `${rooms.length - 1} místností`)
}
// a naopak: z bytu se do firmy neprojde
const wgFlat = walkGrid(S, 0, 0.3)
ok(findPath(wgFlat, { x: 10.4, z: 0.55 }, { x: 3.5, z: 8.0 }) === null,
  'z bytu se dovnitř firmy nedá — bydlení a provoz se nepotkají')

console.log(fail === 0 ? '\n✓ vše prošlo\n' : `\n✗ ${fail} selhalo\n`)
process.exit(fail ? 1 : 0)
