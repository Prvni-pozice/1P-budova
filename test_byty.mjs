// test_byty.mjs — kontrola VARIANTY B (firemní budova s 5 jednotkami).
// Spouštět: node test_byty.mjs
//
// test_spec.mjs hlídá variantu A do detailu jejího programu (trampolíny, bar,
// šatny). Tady se hlídá to, co je na variantě B nové a co se dá snadno
// rozbít: že byty mají světlo, vlastní vstup, oddělený požární úsek, že
// jednotka 5 kryje bývalou díru za byty a že dílna zůstala, kde byla.

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
const U5 = S.blocks.filter((b) => b.unit === 5)

// ------------------------------------------------------------------ PLOCHY
console.log('\nPLOCHY')
const a = areaTotals(S)
ok(Math.abs(a.footprint - 504) < 0.01, 'půdorys etapy 1 = 504 m²', `${a.footprint}`)
ok(Math.abs(a.gf - 504) < 0.01, 'přízemí zaplňuje půdorys přesně', `${a.gf.toFixed(1)} m²`)
// Jednotka 5 zastropila střed → celek přerostl původní pásmo 750–850.
// To je záměr (98 m² pronajímatelné plochy navíc), ne chyba.
ok(a.total >= 800 && a.total <= 880, 'celkem 800–880 m² (jednotka 5 zvedla patro)', `${a.total.toFixed(0)} m²`)

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
for (const id of ['workshop', 'store-gf', 'plant', 'commons', 'wc-gf', 'meeting']) {
  const x = blk(id), y = SPEC.blocks.find((b) => b.id === id)
  ok(x && y && x.x0 === y.x0 && x.x1 === y.x1 && x.z0 === y.z0 && x.z1 === y.z1,
    `${id} beze změny proti variantě A`, x ? `x ${x.x0}–${x.x1}, z ${x.z0}–${x.z1}` : 'CHYBÍ')
}
ok(!S.blocks.some((b) => b.type === 'arena' || b.type === 'play'), 'aréna ani dětský koutek v modelu nejsou')
ok(!S.blocks.some((b) => b.id === 'store-w'), 'vysoký sklad zrušen — sklad je jen u dílny')
const storages = S.blocks.filter((b) => b.type === 'storage')
ok(storages.length === 1 && storages[0].id === 'store-gf', 'jediný sklad v domě sousedí s dílnou')

// -------------------------------------------------------- JÁDRO U RECEPCE
console.log('\nVNITŘNÍ JÁDRO (iterace 1)')
const core = blk('core')
const lobby = blk('lobby')
ok(Math.abs(core.z0 - lobby.z1) < 0.01 && core.x0 >= lobby.x0 && core.x1 <= lobby.x1,
  'schodiště stojí přímo za recepcí', `core z ${core.z0}–${core.z1}`)
ok((S.openPairs ?? []).some(([p, q]) => (p === 'lobby' && q === 'core') || (p === 'core' && q === 'lobby')),
  'recepce a jádro jsou jeden otevřený prostor — vejdeš a vidíš schody')
const stairsIt = fit.items.filter((it) => it.kind === 'stairs')
const coreStair = stairsIt.find((it) => it.block === 'core')
ok(!!coreStair, 'schodiště je v jádru', coreStair ? `(${coreStair.x.toFixed(1)}, ${coreStair.z.toFixed(1)})` : '')
ok(fit.items.some((it) => it.kind === 'elevator' && it.block === 'core'),
  'výtah vedle schodiště — bezbariérový přístup do patra')

// ------------------------------------------------------------------- BYTY
console.log('\nBYTY 1–4')
ok(S.program.flats.units === 4, 'program počítá se 4 byty')
const flatAreas = FLAT_IDS.map((n) => roomsOf(n).reduce((s, b) => s + area(b), 0))
ok(flatAreas.every((x) => Math.abs(x - 49) < 0.01), 'každý byt má 49 m²', flatAreas.map((x) => x.toFixed(1)).join(' / '))
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
ok(leaks.length === 0, 'z bytů 1–4 nevedou žádné dveře do zbytku domu',
  leaks.length ? leaks.map((l) => `${l.a}–${l.b}`).join(', ') : 'byty jsou oddělené')

// koupelny nad sebou = dvě stoupačky na byty
const baths = S.blocks.filter((b) => b.id.endsWith('-bath') && b.flat)
const risers = new Set(baths.map((b) => `${b.x0.toFixed(2)}|${b.z0.toFixed(2)}`))
ok(risers.size === 2, 'koupelny bytů leží nad sebou → 2 stoupačky', `${risers.size} poloh pro ${baths.length} koupelen`)

// ------------------------------------------------------------- JEDNOTKA 5
console.log('\nJEDNOTKA 5 (iterace 2)')
ok(U5.length === 3, 'jednotka 5 má tři místnosti (hlavní, kuchyň, koupelna)')
const u5Area = U5.reduce((s, b) => s + area(b), 0)
ok(Math.abs(u5Area - 98) < 0.5, 'jednotka 5 má ~98 m²', `${u5Area.toFixed(1)} m²`)
ok(U5.every((b) => b.level === 1), 'jednotka 5 je celá v patře')

// jednotka 5 kryje CELÝ pás za byty — po díře nesmí zbýt nic
const upCover = (x, z) => S.blocks.some((b) =>
  (b.level === 1 || (b.level === 'full' && b.enclosed))
  && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1)
let holes = 0
for (let x = 7.25; x < 21; x += 0.5) for (let z = 7.25; z < 18; z += 0.5) if (!upCover(x, z)) holes++
ok(holes === 0, 'za byty v patře už není žádná díra dolů', `${holes} nekrytých buněk`)

// bez fasády → světlo dávají střešní okna
const skylights = fit.items.filter((it) => it.kind === 'skylight')
ok(skylights.length >= 6, 'jednotka 5 má střešní okna (jediné denní světlo)', `${skylights.length} ks`)
ok(skylights.every((it) => U5.some((b) => b.id === it.block)), 'všechna střešní okna patří jednotce 5')

// vstup z chodby u vnitřního schodiště
ok(S.links.some((l) => (l.a === 'corridor' && l.b === 'u5-w') || (l.a === 'u5-w' && l.b === 'corridor')),
  'jednotka 5 má vstup z chodby u schodiště')
ok(Array.isArray(S.compartments.byt5) && S.compartments.byt5.length === 3,
  'jednotka 5 je vlastní požární úsek')

// koupelna jednotky 5 navazuje na stoupačku koupelny bytu 3
const u5b = blk('u5-bath')
const f3b = blk('f3-bath')
ok(Math.abs(u5b.z0 - f3b.z1) < 0.01 && u5b.x0 === f3b.x0,
  'koupelna jednotky 5 sedí na stoupačce bytu 3', `z ${f3b.z1} → ${u5b.z0}`)

// vybavení: linka, koupelna kompletní, hlásič
{
  const ids = new Set(U5.map((b) => b.id))
  const its = fit.items.filter((it) => ids.has(it.block))
  const has = (k) => its.some((it) => it.kind === k)
  ok(has('kitchen') && has('shower') && has('wcbowl') && has('basin') && has('washer'),
    'jednotka 5: linka, sprcha, WC, umyvadlo, pračka', `${its.length} kusů`)
  ok(has('smoke'), 'jednotka 5: autonomní hlásič kouře')
}

// -------------------------------------------- VENKOVNÍ SCHODIŠTĚ (iterace 3)
console.log('\nVENKOVNÍ SCHODIŠTĚ A PAVLAČ (iterace 3)')
const st = S.exterior.stairs
const w = S.exterior.walkway
ok(Math.abs(st.z1) <= 3.0, 'schodiště jde podél fasády — vyčnívá max 3 m', `pás z ${st.z0} až ${st.z1}`)
const run = st.x1 - st.x0 - (st.landing ?? 0.9)
ok(run >= 5.0, 'rameno má dost běhu na 3,3 m výšky (sklon ≤ 33°)',
  `běh ${run.toFixed(1)} m, sklon ${(Math.atan2(3.3, run) * 180 / Math.PI).toFixed(0)}°`)
ok(Math.abs(st.z1 - -w.depth) < 0.01, 'schodiště přiléhá k pavlači — podesta ústí přímo na ni')
ok(st.x0 >= w.x0 - 0.01, 'podesta schodiště leží v rozsahu pavlače')
for (const n of FLAT_IDS.filter((k) => roomsOf(k)[0].level === 1)) {
  const hall = roomsOf(n).find((b) => b.entry)
  const cx = (hall.x0 + hall.x1) / 2
  ok(cx > w.x0 + 0.5 && cx < w.x1 - 0.5, `byt ${n}: pavlač dosáhne na vstupní dveře`,
    `dveře x ${cx.toFixed(1)}, pavlač ${w.x0}–${w.x1}`)
}
ok(S.site.bays.every((b) => b.x + b.w / 2 < st.x0 || b.x - b.w / 2 > st.x1
    || S.site.parkRow + 2.5 < st.z0 - 0.5),
  'schodiště nezasahuje do parkovacích stání')

// ------------------------------------------------------- POŽÁRNÍ ODDĚLENÍ
console.log('\nPOŽÁRNÍ ÚSEKY')
const parts = partitionsFor(S)
const compOf = {}
for (const [name, ids] of Object.entries(S.compartments)) for (const id of ids) compOf[id] = name
const unitIds = new Set([...flatIds, ...U5.map((b) => b.id)])
const unitWalls = parts.filter((p) => p.blocks.some((id) => unitIds.has(id))
  && compOf[p.blocks[0]] !== compOf[p.blocks[1]])
ok(unitWalls.length > 0 && unitWalls.every((p) => p.fire),
  'stěny jednotek proti okolí jsou požárně dělicí', `${unitWalls.length} úseků`)
const railsOnFlats = S.blocks.filter((b) => b.level === 1 && (b.flat || b.unit))
  .flatMap((b) => openEdges(S, b))
ok(railsOnFlats.length === 0, 'jednotky v patře nemají volnou hranu se zábradlím',
  `${railsOnFlats.length} úseků`)

// ------------------------------------------------------------- VYBAVENÍ
console.log('\nVYBAVENÍ')
for (const n of FLAT_IDS) {
  const ids = new Set(roomsOf(n).map((b) => b.id))
  const its = fit.items.filter((it) => ids.has(it.block))
  const has = (k) => its.some((it) => it.kind === k)
  ok(has('bed') && has('kitchen') && has('shower') && has('wcbowl') && has('basin') && has('washer'),
    `byt ${n}: postel, linka, sprcha, WC, umyvadlo, pračka`, `${its.length} kusů`)
  ok(has('smoke'), `byt ${n}: autonomní hlásič kouře`)
}
ok(fit.counts.desk === S.program.office.desks, 'počet stolů kanceláří sedí s programem',
  `${fit.counts.desk} / ${S.program.office.desks}`)
ok(fit.dropped === 0, 'nic z vybavení nevypadlo mimo místnost',
  fit.dropped ? JSON.stringify(fit.droppedBy) : 'vše se vešlo')

// nábytek nesmí stát ve dveřích
const blocked = []
for (const d of doorsFor(S)) {
  for (const it of fit.items) {
    if (it.link || ['light', 'smoke', 'diffuser', 'emlight', 'exitsign', 'co2', 'skylight'].includes(it.kind)) continue
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
for (const s2 of stairsIt) {
  const to = S.blocks.find((b) => b.level === 1
    && s2.x > b.x0 - 1 && s2.x < b.x1 + 1 && s2.z > b.z0 - 3 && s2.z < b.z1 + 3)
  if (to) { edges.get(s2.block).add(to.id); edges.get(to.id).add(s2.block) }
}
const seen = new Set(entrances)
const queue = [...entrances]
while (queue.length) for (const n of edges.get(queue.pop()) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n) }
const cutOff = S.blocks.filter((b) => !seen.has(b.id))
ok(cutOff.length === 0, 'z každé místnosti se dá dojít ven',
  cutOff.length ? cutOff.map((b) => b.id).join(', ') : `${seen.size} místností, ${entrances.size} vchodů`)

const tech = new Set(['workshop', 'plant', 'store-gf'])
const techLeaks = S.links.filter((l) => tech.has(l.a) !== tech.has(l.b))
ok(techLeaks.length === 0, 'z dílny nevede do zbytku domu žádné dveře',
  techLeaks.length ? techLeaks.map((l) => `${l.a}–${l.b}`).join(', ') : 'technická zóna je samostatná')

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

// severní stěna zůstává slepá
ok(openingsFor(S, 'north').length === 0, 'severní stěna (soused) je bez otvorů')
const NO_WINDOW_OK = ['wet', 'plant', 'sim', 'meeting', 'circ', 'storage', 'lobby', 'reserve']
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
const u5Rent = U5.reduce((s, b) => s + (S.economy.revenue[b.id] ?? 0), 0)
ok(Math.abs(u5Rent - 13000 * 12) < 20, 'jednotka 5 nese 13 000 Kč/měs (odhad)',
  `${u5Rent.toLocaleString('cs-CZ')} Kč/rok`)
const revSum = Object.values(S.economy.revenue).reduce((s, v) => s + v, 0)
ok(revSum > S.economy.costsTotal, 'model počítá s kladným provozním výsledkem',
  `${((revSum - S.economy.costsTotal) / 1000).toFixed(0)} tis. Kč/rok`)

// ------------------------------------------------- PRŮCHODNOST (walk test)
console.log('\nPRŮCHODNOST (walk test)')
const wg0 = walkGrid(S, 0, 0.3)
const vstup = { x: 3.5, z: 0.6 }
const cileGF = {
  'pata schodiště': { x: 4.2, z: 3.5 },
  'výtah': { x: 5.5, z: 4.2 },
  'fitness': { x: 10.5, z: 10.5 },
  'sim racing': { x: 16.0, z: 10.5 },
  'šatna sportu': { x: 8.6, z: 14.6 },
  'komunitní prostor': { x: 1.6, z: 8.0 },
  'pracovní zóna': { x: 4.4, z: 10.5 },
  'WC kanceláří': { x: 5.5, z: 16.0 },
  'kuchyňský kout': { x: 2.0, z: 16.5 },
}
for (const [name, c] of Object.entries(cileGF)) {
  const d = findPath(wg0, vstup, c)
  ok(d !== null, `od vstupu: ${name}`, d !== null ? `${d.toFixed(1)} m` : 'CESTA NEEXISTUJE')
}
ok(findPath(wg0, vstup, { x: 24.5, z: 6.0 }) === null,
  'do dílny se od recepce vnitřkem nedá (technická zóna má vlastní vstup)')

const wg1 = walkGrid(S, 1, 0.3)
const podesta = { x: 5.0, z: 6.5 }
const cile1F = {
  'klidové místnosti': { x: 3.5, z: 1.6 },
  'WC patra': { x: 1.6, z: 6.0 },
  'rezerva': { x: 2.9, z: 10.5 },
  'zasedačka': { x: 4.5, z: 15.8 },
  'jednotka 5 — kuchyň': { x: 8.3, z: 11.0 },
  'jednotka 5 — hlavní prostor': { x: 15.0, z: 10.5 },
}
for (const [name, c] of Object.entries(cile1F)) {
  const d = findPath(wg1, podesta, c)
  ok(d !== null, `z podesty: ${name}`, d !== null ? `${d.toFixed(1)} m` : 'CESTA NEEXISTUJE')
}

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
ok(findPath(wg0, { x: 10.4, z: 0.55 }, { x: 1.6, z: 8.0 }) === null,
  'z bytu se dovnitř firmy nedá — byty 1–4 a provoz se nepotkají')

console.log(fail === 0 ? '\n✓ vše prošlo\n' : `\n✗ ${fail} selhalo\n`)
process.exit(fail ? 1 : 0)
