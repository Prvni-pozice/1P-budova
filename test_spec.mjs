// test_spec.mjs — kontrola, že se plochy i rozvody počítají ze spec.
// Spouštět: node test_spec.mjs
import { SPEC, areaTotals, area, roofY, ridgeY } from './src/spec.js'
import { computeMEP, blockDemand, ductRadius } from './src/mep.js'
import { openingsFor, pvLayout } from './src/building.js'
import { fitoutAll, fitoutFor, sanitaryFor } from './src/fitout.js'

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
ok(Math.abs(a.up - 322) < 0.01, 'patro = 322 m²', `${a.up} m²`)
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

console.log('\nKOMPAS')
// východ = −x, sever = +z; v pravotočivém prostoru musí být východ × sever = nahoru.
// Když tohle selže, je celý model zrcadlově převrácený.
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const up = cross([-1, 0, 0], [0, 0, 1])
ok(up[1] === 1, 'východ × sever = nahoru (kompas je pravotočivý)', `(${up})`)
ok(SPEC.blocks.find((b) => b.id === 'office-gf').x0 === 0, 'kanceláře na východním průčelí (x = 0)')
ok(SPEC.blocks.filter((b) => b.z1 >= SPEC.depth).every((b) => ['wet', 'plant', 'arena', 'sim', 'meeting', 'play'].includes(b.type)),
  'u severní (slepé) stěny jsou jen provozy bez nároku na okna')
ok(SPEC.blocks.some((b) => b.type === 'workshop' && b.z0 === 0), 'dílna se dotýká jižní stěny → vrata z jihu')

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

console.log('\nFOTOVOLTAIKA')
const pv = pvLayout(SPEC, south)
ok(pv.roofKwp > 30 && pv.roofKwp < 70, 'střešní FVE 30–70 kWp', `${pv.roofKwp.toFixed(1)} kWp z ${Math.round(pv.roofArea)} m²`)
ok(pv.facadeKwp > 0, 'fasádní FVE se vejde mezi otvory', `${pv.facadeKwp.toFixed(1)} kWp z ${Math.round(pv.facadeArea)} m²`)
ok(pv.panels.filter((p) => p.kind === 'facade').every((p) =>
  !south.some((h) => h.x1 > p.x0 && h.x0 < p.x1 && h.v1 > p.v0 && h.v0 < p.v1)),
  'fasádní panely nepřekrývají žádný otvor')
const noPv = structuredClone(SPEC)
noPv.pv = { roofSouth: false, roofNorth: false, facadeSouth: false }
ok(pvLayout(noPv, south).panels.length === 0, 'FVE jde ve spec vypnout')

console.log('\nVYBAVENÍ')
const fit = fitoutAll(SPEC)
ok(fit.dropped === 0, 'všechno vybavení se vejde do svého bloku', `${fit.items.length} ks`)
ok(fit.counts.desk === SPEC.program.office.desks, 'počet stolů = počet míst v programu', `${fit.counts.desk}`)
ok(fit.counts.simrig === SPEC.program.sim.rigs, 'počet rigů sedí', `${fit.counts.simrig}`)
ok(fit.counts.cage === SPEC.program.gym.cages, 'počet klecí sedí', `${fit.counts.cage}`)
ok(fit.counts.tramp === SPEC.program.arena.beds + 1, 'trampolíny + 1 v dunk lane', `${fit.counts.tramp}`)
ok(fit.counts.carlift === 1 && fit.counts.car === 1, 'zvedák i obrys vozidla v dílně')
ok(fit.counts.wcBF === 1, 'bezbariérové WC je právě jedno (vyhl. 398/2009)')

const sPub = sanitaryFor(SPEC.program.arena.peak, { publicUse: true })
const sOff = sanitaryFor(SPEC.program.office.staffTarget)
ok(fit.counts.wc === sPub.wcW + sPub.wcM + sOff.wcW + sOff.wcM,
  'počet WC kabin odpovídá normě', `${fit.counts.wc} (veřejnost ${sPub.wcW + sPub.wcM} + kanceláře ${sOff.wcW + sOff.wcM})`)
ok(fit.counts.basin === sPub.basins + sOff.basins + 2,
  'počet umyvadel odpovídá normě + 2 v šatně', `${fit.counts.basin}`)

// v hrubé rezervě nesmí být nic vybaveno
ok(fit.items.every((it) => it.block !== 'reserve'), 'hrubá rezerva je prázdná')

// vybavení jde s blokem
const moved = structuredClone(SPEC)
const mb = moved.blocks.find((b) => b.id === 'sim')
mb.x0 -= 7; mb.x1 -= 7
const rigBefore = fitoutFor(SPEC, SPEC.blocks.find((b) => b.id === 'sim'))[0]
const rigAfter = fitoutFor(moved, mb)[0]
ok(Math.abs(rigAfter.x - (rigBefore.x - 7)) < 1e-9, 'vybavení se posune s blokem',
  `x ${rigBefore.x} → ${rigAfter.x}`)

// při zmenšení bloku se přebytek zahodí a nahlásí
const shrunk = structuredClone(SPEC)
const sb = shrunk.blocks.find((b) => b.id === 'gym')
sb.x1 = sb.x0 + 3
ok(fitoutFor(shrunk, sb).length < fitoutFor(SPEC, SPEC.blocks.find((b) => b.id === 'gym')).length,
  'zmenšení bloku vyhodí, co se nevejde')

// změna počtu lidí přepočte stoly i sanitu
const bigger2 = structuredClone(SPEC)
bigger2.program.office.desks = 6
bigger2.program.office.staffTarget = 30
const f2 = fitoutAll(bigger2)
ok(f2.counts.desk === 6, 'méně míst → méně stolů', `${f2.counts.desk}`)
ok(sanitaryFor(30).wcW > sOff.wcW, 'víc lidí → víc WC', `${sOff.wcW} → ${sanitaryFor(30).wcW}`)

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
