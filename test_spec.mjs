// test_spec.mjs — kontrola, že se plochy i rozvody počítají ze spec.
// Spouštět: node test_spec.mjs
import { SPEC, areaTotals, area, roofY, ridgeY } from './src/spec.js'
import { computeMEP, blockDemand, ductRadius } from './src/mep.js'
import { openingsFor } from './src/building.js'

let fail = 0
const ok = (cond, msg, extra = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${msg}${extra ? '  → ' + extra : ''}`)
  if (!cond) fail++
}

// --- půdorys je beze zbytku pokrytý a nic se nepřekrývá ---
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
  return { pct: covered / cells, overlap: (overlap / cells) * step * step * (cells / (cells)) , overlapCells: overlap }
}

const a = areaTotals(SPEC)
console.log('\nPLOCHY')
ok(Math.abs(a.footprint - 504) < 0.01, 'půdorys etapy 1 = 504 m²', `${a.footprint}`)
ok(Math.abs(a.gf - 504) < 0.01, 'přízemí zaplňuje půdorys přesně', `${a.gf} m²`)
ok(Math.abs(a.up - 336) < 0.01, 'patro = 336 m²', `${a.up} m²`)
ok(a.total >= 750 && a.total <= 850, 'celkem v cílovém pásmu 750–850 m²', `${a.total} m²`)

const cov = coverage(SPEC)
ok(cov.pct > 0.999, 'přízemí bez děr', `pokryto ${(cov.pct * 100).toFixed(1)} %`)
ok(cov.overlapCells === 0, 'bloky přízemí se nepřekrývají', `${cov.overlapCells} kolizí`)

// bloky nevyčnívají z etapy 1
ok(SPEC.blocks.every((b) => b.x0 >= 0 && b.x1 <= SPEC.stage1 && b.z0 >= 0 && b.z1 <= SPEC.depth),
  'žádný blok nepřečnívá obrys etapy 1')

console.log('\nGEOMETRIE')
ok(Math.abs(roofY(SPEC, 0) - SPEC.eaves) < 1e-9, 'u severní stěny je výška = okap', `${roofY(SPEC, 0)} m`)
ok(ridgeY(SPEC) > SPEC.eaves, 'hřeben je nad okapem', `${ridgeY(SPEC).toFixed(2)} m`)
const upperClear = SPEC.eaves - (SPEC.clearGF + SPEC.slab)
ok(upperClear >= 2.5, 'světlá výška patra ≥ 2,5 m', `${upperClear.toFixed(2)} m`)

console.log('\nOTVORY V PLÁŠTI')
const north = openingsFor(SPEC, 'north')
const south = openingsFor(SPEC, 'south')
ok(north.length === 0, 'severní stěna (soused) je slepá', `${north.length} otvorů`)
ok(south.length > 5, 'jižní stěna má vstupy a okna', `${south.length} otvorů`)
ok(south.every((h) => h.v1 <= SPEC.eaves - 0.15), 'žádný otvor neprorazí okap')
const overlaps = south.filter((h, i) => south.some((o, j) =>
  j < i && o.x1 > h.x0 + 1e-6 && o.x0 < h.x1 - 1e-6 && o.v1 > h.v0 + 1e-6 && o.v0 < h.v1 - 1e-6))
ok(overlaps.length === 0, 'otvory se nepřekrývají (jinak se rozbije triangulace)', `${overlaps.length}`)

// vrata jsou tam, kde je dílna — po zrcadlení dispozice se přesunou s ní
const gateOf = (s) => openingsFor(s, 'south').find((h) => h.v0 === 0 && h.v1 === s.gate.height)
const mirrored = structuredClone(SPEC)
for (const b of mirrored.blocks) {
  const [x0, x1] = [mirrored.stage1 - b.x1, mirrored.stage1 - b.x0]
  b.x0 = x0; b.x1 = x1
}
const g1 = gateOf(SPEC)
const g2 = gateOf(mirrored)
const ws = mirrored.blocks.find((b) => b.id === 'workshop')
ok(g1 && g2 && g2.x0 >= ws.x0 && g2.x1 <= ws.x1,
  'vrata se přesunou s dílnou', `x ${g1?.x0} → ${g2?.x0} (dílna ${ws.x0}–${ws.x1})`)

console.log('\nROZVODY')
const mep = computeMEP(SPEC)
const t = mep.totals
ok(mep.routes.length > 0, 'trasy se vygenerovaly', `${mep.routes.length} úseků`)
ok(t.vzt > 8000 && t.vzt < 14000, 'VZT celkem v řádu 8–14 tis. m³/h', `${Math.round(t.vzt)} m³/h`)
ok(t.heat > 20 && t.heat < 60, 'tepelná ztráta 20–60 kW', `${t.heat.toFixed(1)} kW`)
ok(t.breaker > 40 && t.breaker < 200, 'hlavní jistič v rozumném rozsahu', `${t.breaker.toFixed(0)} A`)
ok(t.wetArea === 84, 'mokré provozy = 84 m²', `${t.wetArea} m²`)

// každá páteř končí zaslepená na hranici etapy 2
const spines = mep.routes.filter((r) => r.kind === 'spine')
ok(spines.every((r) => Math.abs(r.points[1].x - (SPEC.stage1 - 0.4)) < 1e-9),
  'každá páteř dojede až na hranici etapy 2', `${spines.length} páteří`)

// každý blok s nárokem má odbočku
for (const key of ['vzt', 'elec']) {
  const tapped = new Set(mep.routes.filter((r) => r.service === key && r.kind === 'branch').map((r) => r.block))
  const need = SPEC.blocks.filter((b) => blockDemand(b)[key === 'vzt' ? 'vzt' : 'elec'] > 0)
  ok(need.every((b) => tapped.has(b.id)), `${key}: každý blok má odbočku`, `${tapped.size}/${need.length}`)
}

console.log('\nPŘEPOČET PO ZMĚNĚ')
const bigger = structuredClone(SPEC)
const arena = bigger.blocks.find((b) => b.id === 'arena')
const before = computeMEP(bigger).totals.vzt
arena.z1 += 2 // aréna se zvětší
const after = computeMEP(bigger).totals.vzt
ok(after > before, 'zvětšení arény zvýší VZT', `${Math.round(before)} → ${Math.round(after)} m³/h`)
ok(ductRadius(after) > ductRadius(before), 'a zvětší i průměr páteřního potrubí',
  `ø ${(ductRadius(before) * 2).toFixed(2)} → ${(ductRadius(after) * 2).toFixed(2)} m`)

const noWet = structuredClone(SPEC)
noWet.blocks = noWet.blocks.filter((b) => b.type !== 'wet')
const mw = computeMEP(noWet)
ok(mw.routes.filter((r) => r.service === 'water').length === 0,
  'bez mokrých provozů zmizí rozvod vody')

console.log(fail === 0 ? '\n✓ vše prošlo\n' : `\n✗ ${fail} selhalo\n`)
process.exit(fail ? 1 : 0)
