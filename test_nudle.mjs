// test_nudle.mjs — kontrola VARIANTY C (nudlové byty 3+kk přes rozpon).
// Spouštět: node test_nudle.mjs
//
// Hlídá to, co je na nudlích nové: řazení místností od jihu, chodbu se
// skříněmi a průchodem, střešní okna na severním konci (slepá stěna!),
// párování stoupaček A|B a to, že přízemí zůstalo jako ve verzi B.

import { SPEC_BYTY } from './src/spec-byty.js'
import { SPEC_NUDLE as S } from './src/spec-nudle.js'
import { areaTotals, area, levelBase } from './src/spec.js'
import { computeMEP } from './src/mep.js'
import { openingsFor, partitionsFor, openEdges } from './src/building.js'
import { fitoutAll, SVC, FURN, doorsFor } from './src/fitout.js'
import { walkGrid, findPath } from './src/walk.js'

let fail = 0
const ok = (cond, msg, extra = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${msg}${extra ? '  → ' + extra : ''}`)
  if (!cond) fail++
}

const blk = (id) => S.blocks.find((b) => b.id === id)
const fit = fitoutAll(S)
const mep = computeMEP(S)
const LETTERS = ['A', 'B', 'C']
const roomsOf = (l) => S.blocks.filter((b) => b.flat === l)

// ------------------------------------------------------------------ PLOCHY
console.log('\nPLOCHY')
const a = areaTotals(S)
ok(Math.abs(a.footprint - 504) < 0.01, 'půdorys etapy 1 = 504 m²', `${a.footprint}`)
ok(Math.abs(a.gf - 504) < 0.01, 'přízemí zaplňuje půdorys přesně', `${a.gf.toFixed(1)} m²`)
// nudle zastropily celé pole x 7–21 → patro je největší ze všech verzí
ok(a.total >= 890 && a.total <= 940, 'celkem 890–940 m² (nudle přes celý rozpon)', `${a.total.toFixed(0)} m²`)

let up1 = 0
for (let i = 0; i < S.blocks.length; i++) {
  for (let j = i + 1; j < S.blocks.length; j++) {
    const p = S.blocks[i], q = S.blocks[j]
    if (p.level !== 1 || q.level !== 1) continue
    if (p.x0 < q.x1 - 0.01 && p.x1 > q.x0 + 0.01 && p.z0 < q.z1 - 0.01 && p.z1 > q.z0 + 0.01) up1++
  }
}
ok(up1 === 0, 'bloky patra se nepřekrývají', `${up1} kolizí`)

// patro pole x 7–21 je beze zbytku pokryté nudlemi
const upCover = (x, z) => S.blocks.some((b) => b.level === 1
  && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1)
let holes = 0
for (let x = 7.25; x < 21; x += 0.5) for (let z = 0.25; z < 18; z += 0.5) if (!upCover(x, z)) holes++
ok(holes === 0, 'nudle kryjí celé pole x 7–21 — žádná díra', `${holes} nekrytých buněk`)

// ------------------------------------------------------ PŘÍZEMÍ = VERZE B
console.log('\nPŘÍZEMÍ ZŮSTALO Z VERZE B')
for (const id of ['lobby', 'core', 'office-gf', 'office-e', 'commons', 'wc-gf',
                  'gym', 'sim', 'rezerva-gf', 'wc-pub', 'rezerva-n', 'workshop', 'store-gf',
                  'f1-hall', 'f2-hall']) {
  const x = blk(id), y = SPEC_BYTY.blocks.find((b) => b.id === id)
  ok(x && y && x.x0 === y.x0 && x.x1 === y.x1 && x.z0 === y.z0 && x.z1 === y.z1,
    `${id} beze změny proti verzi B`, x ? '' : 'CHYBÍ')
}
ok(!S.blocks.some((b) => b.id.startsWith('u5-') || b.id.startsWith('f3-') || b.id.startsWith('f4-')),
  'jednotka 5 a byty 3, 4 v patře nejsou — nahradily je nudle')

// -------------------------------------------------------------- NUDLE
console.log('\nNUDLE')
const areas = LETTERS.map((l) => roomsOf(l).reduce((s, b) => s + area(b), 0))
ok(areas.every((x) => x > 83 && x < 85), 'každá nudle má ~84 m²', areas.map((x) => x.toFixed(1)).join(' / '))
ok(LETTERS.every((l) => roomsOf(l).length === 9), 'nudle má 9 místností (předsíň→dětský)')
ok(LETTERS.every((l) => roomsOf(l).every((b) => b.level === 1)), 'všechny nudle jsou v patře')

// pořadí od jihu: předsíň/obývák → wc → koupelna → šatna → ložnice → dětský
for (const l of LETTERS) {
  const r = (id) => roomsOf(l).find((b) => b.id.endsWith(id))
  ok(r('-hall').z0 === 0 && r('-liv').z0 === 0, `byt ${l}: vstup a obývák na jihu`)
  ok(r('-wc').z0 < r('-bath').z0 && r('-bath').z0 < r('-shatna').z0
    && r('-shatna').z0 < r('-bed').z0 && r('-bed').z1 === r('-kid').z0,
    `byt ${l}: WC → koupelna → šatna → ložnice → dětský, od jihu na sever`)
  ok(r('-kid').z1 === 18 && Math.abs((r('-kid').x1 - r('-kid').x0) - (areas[0] / 18)) < 0.1,
    `byt ${l}: dětský pokoj u severní stěny přes celou šířku`)
  // chodba 1,8 m podél WC/koupelny/šatny/ložnice
  const c = r('-corr')
  ok(Math.abs((c.x1 - c.x0) - 1.8) < 0.01 && c.z0 === 6.2 && c.z1 === 14.2,
    `byt ${l}: chodba 1,8 m (0,6 skříně + 1,2 průchod)`)
  const ward = fit.items.filter((it) => it.block === c.id && it.kind === 'wardrobe')
  ok(ward.length === 3, `byt ${l}: v chodbě tři skříně`, `${ward.length}`)
  ok(ward.every((w) => Math.min(w.x - c.x0, c.x1 - w.x) <= 0.35
      && Math.max(w.x - c.x0, c.x1 - w.x) - 0.3 >= 1.15),
    `byt ${l}: skříně u stěny, průchod ≥ 1,15 m zůstává`)
}

// --------------------------------------------------------------- SVĚTLO
console.log('\nSVĚTLO (sever je slepá stěna)')
ok(openingsFor(S, 'north').length === 0, 'severní stěna zůstává bez otvorů')
const southHoles = openingsFor(S, 'south')
const base1 = levelBase(S, 1)
for (const l of LETTERS) {
  const liv = roomsOf(l).find((b) => b.id.endsWith('-liv'))
  ok(southHoles.some((h) => Math.abs(h.v0 - (base1 + 0.9)) < 1e-6
    && h.x0 >= liv.x0 - 0.01 && h.x1 <= liv.x1 + 0.01),
    `byt ${l}: obývák má okno na jih`)
  const hall = roomsOf(l).find((b) => b.entry)
  ok(southHoles.some((h) => Math.abs(h.v0 - base1) < 1e-6
    && (h.x0 + h.x1) / 2 > hall.x0 && (h.x0 + h.x1) / 2 < hall.x1),
    `byt ${l}: vstupní dveře z pavlače`)
  const sky = (id) => fit.items.filter((it) => it.block === id && it.kind === 'skylight').length
  ok(sky(`n${l}-kid`) === 2, `byt ${l}: dětský pokoj má 2 střešní okna`)
  ok(sky(`n${l}-bed`) === 1, `byt ${l}: ložnice má střešní okno`)
}

// ------------------------------------------------------------ STOUPAČKY
console.log('\nSTOUPAČKY A POŽÁRNÍ ÚSEKY')
const bathA = blk('nA-bath'), bathB = blk('nB-bath'), bathC = blk('nC-bath')
ok(Math.abs(bathA.x1 - bathB.x0) < 0.01, 'koupelny A a B zády k sobě → společná stoupačka',
  `A do ${bathA.x1}, B od ${bathB.x0}`)
ok(Math.abs(bathC.x1 - 21) < 0.01, 'koupelna C u stěny dílny — stoupačka v technické stěně')
// kuchyň zády ke koupelnovému bloku (jedna stoupačka na byt)
for (const l of LETTERS) {
  const liv = blk(`n${l}-liv`), wc = blk(`n${l}-wc`)
  ok(Math.abs(liv.z1 - wc.z0) < 0.01 && liv.x0 === wc.x0,
    `byt ${l}: kuchyň zády k WC — instalace v jedné stěně`)
}
for (const l of LETTERS) {
  ok(Array.isArray(S.compartments[`byt${l}`]) && S.compartments[`byt${l}`].length === 9,
    `byt ${l} je samostatný požární úsek`)
}
const nudleIds = new Set(S.blocks.filter((b) => typeof b.flat === 'string').map((b) => b.id))
const leaks = S.links.filter((l) => nudleIds.has(l.a) !== nudleIds.has(l.b))
ok(leaks.length === 0, 'z nudlí nevedou žádné dveře do zbytku domu',
  leaks.length ? leaks.map((l) => `${l.a}–${l.b}`).join(', ') : 'jediný vstup je z pavlače')
const rails = S.blocks.filter((b) => b.level === 1 && typeof b.flat === 'string')
  .flatMap((b) => openEdges(S, b))
ok(rails.length === 0, 'nudle nemají žádnou volnou hranu se zábradlím', `${rails.length}`)

// -------------------------------------------------------- PAVLAČ A VSTUPY
console.log('\nPAVLAČ A VENKOVNÍ SCHODIŠTĚ')
const w = S.exterior.walkway
for (const l of LETTERS) {
  const hall = roomsOf(l).find((b) => b.entry)
  const cx = (hall.x0 + hall.x1) / 2
  ok(cx > w.x0 - 0.01 && cx < w.x1 - 0.5, `byt ${l}: pavlač dosáhne na vstup`,
    `dveře x ${cx.toFixed(1)}, pavlač ${w.x0}–${w.x1}`)
}
const st = S.exterior.stairs
ok(Math.abs(st.z1) <= 3.0, 'schodiště jde podél fasády — vyčnívá max 3 m', `pás z ${st.z0} až ${st.z1}`)
ok(st.x1 - st.x0 - (st.landing ?? 0.9) >= 5.0, 'rameno má dost běhu na 3,3 m výšky')

// ------------------------------------------------------------- VYBAVENÍ
console.log('\nVYBAVENÍ')
for (const l of LETTERS) {
  const ids = new Set(roomsOf(l).map((b) => b.id))
  const its = fit.items.filter((it) => ids.has(it.block))
  const has = (k) => its.some((it) => it.kind === k)
  ok(has('bed') && has('bedS') && has('kitchen') && has('shower') && has('wcbowl')
    && has('basin') && has('washer') && has('wardrobe'),
    `byt ${l}: postele, linka, sprcha, WC, umyvadla, pračka, skříně`, `${its.length} kusů`)
  ok(its.filter((it) => it.kind === 'smoke').length >= 2, `byt ${l}: hlásiče v předsíni i na chodbě`)
}
ok(fit.dropped === 0, 'nic z vybavení nevypadlo mimo místnost',
  fit.dropped ? JSON.stringify(fit.droppedBy) : 'vše se vešlo')

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

// ----------------------------------------------------------------- ROZVODY
console.log('\nROZVODY')
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
for (const l of LETTERS) {
  const bath = blk(`n${l}-bath`)
  ok(mep.routes.some((r) => ['water', 'drain'].includes(r.service)
    && r.points.some((p) => p.x > bath.x0 && p.x < bath.x1 && p.z > bath.z0 && p.z < bath.z1)),
    `byt ${l}: do koupelny jde voda i kanalizace`)
}

// --------------------------------------------------------------- EKONOMIKA
console.log('\nEKONOMIKA')
const badIds = Object.keys(S.economy.revenue).filter((id) => !S.blocks.some((b) => b.id === id))
ok(badIds.length === 0, 'ekonomika se odkazuje jen na existující bloky', badIds.join(', '))
const nudleRent = S.blocks.filter((b) => typeof b.flat === 'string')
  .reduce((s, b) => s + (S.economy.revenue[b.id] ?? 0), 0)
ok(Math.abs(nudleRent - 3 * 15500 * 12) < 30, 'nájem 3 nudlí sedí na 15 500 Kč/měs (odhad)',
  `${nudleRent.toLocaleString('cs-CZ')} Kč/rok`)
const gfRent = S.blocks.filter((b) => typeof b.flat === 'number')
  .reduce((s, b) => s + (S.economy.revenue[b.id] ?? 0), 0)
ok(Math.abs(gfRent - 2 * 12000 * 12) < 20, 'nájem 2 bytů v přízemí zůstal na 12 000 Kč/měs',
  `${gfRent.toLocaleString('cs-CZ')} Kč/rok`)
const revSum = Object.values(S.economy.revenue).reduce((s, v) => s + v, 0)
ok(revSum > S.economy.costsTotal, 'model počítá s kladným provozním výsledkem',
  `${((revSum - S.economy.costsTotal) / 1000).toFixed(0)} tis. Kč/rok`)

// ------------------------------------------------- PRŮCHODNOST (walk test)
console.log('\nPRŮCHODNOST (walk test)')
// v každé nudli se dá dojít od vstupních dveří do všech místností
const wg1 = walkGrid(S, 1, 0.28)
for (const l of LETTERS) {
  const rooms = roomsOf(l)
  const hall = rooms.find((b) => b.entry)
  const from = { x: (hall.x0 + hall.x1) / 2, z: 0.55 }
  const reaches = (b) => [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]
    .some(([fx, fz]) => findPath(wg1, from,
      { x: b.x0 + (b.x1 - b.x0) * fx, z: b.z0 + (b.z1 - b.z0) * fz }) !== null)
  const bad = rooms.filter((b) => b.id !== hall.id && !reaches(b))
  ok(bad.length === 0, `byt ${l}: ode dveří se dojde do všech místností`,
    bad.length ? bad.map((b) => b.id).join(', ') : `${rooms.length - 1} místností`)
}
// z nudle se do firemní části patra neprojde
ok(findPath(wg1, { x: 7.9, z: 0.55 }, { x: 6.4, z: 12.0 }) === null,
  'z nudle se do chodby firmy nedá — bydlení a provoz se nepotkají')
// přízemí funguje jako ve verzi B
const wg0 = walkGrid(S, 0, 0.3)
const vstup = { x: 3.5, z: 0.6 }
for (const [name, c] of Object.entries({
  'pata schodiště': { x: 4.2, z: 3.5 },
  'fitness': { x: 10.5, z: 10.5 },
  'kuchyňský kout': { x: 2.0, z: 16.5 },
})) {
  const d = findPath(wg0, vstup, c)
  ok(d !== null, `přízemí od vstupu: ${name}`, d !== null ? `${d.toFixed(1)} m` : 'CESTA NEEXISTUJE')
}

console.log(fail === 0 ? '\n✓ vše prošlo\n' : `\n✗ ${fail} selhalo\n`)
process.exit(fail ? 1 : 0)
