// test_spec.mjs — kontrola, že se plochy i rozvody počítají ze spec.
// Spouštět: node test_spec.mjs
import { SPEC, areaTotals, area, roofY, ridgeY } from './src/spec.js'
import { computeMEP, blockDemand, ductRadius } from './src/mep.js'
import { openingsFor, pvLayout, stairOpening, openEdges, roofSlope } from './src/building.js'
import { fitoutAll, fitoutFor, sanitaryFor, SVC, FURN, doorsFor, sharedEdge } from './src/fitout.js'

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

// dvě střešní roviny se u hřebene nesmí překrývat, jinak z-fighting a problikávání
const sSlope = roofSlope(SPEC, -1)
const nSlope = roofSlope(SPEC, 1)
ok(Math.abs(nSlope.zFrom - sSlope.zTo) < 0.01, 'střešní roviny na sebe u hřebene přesně navazují',
  `přesah ${(sSlope.zTo - nSlope.zFrom).toFixed(3)} m`)
ok(Math.abs(sSlope.zTo - SPEC.depth / 2) < 1e-9, 'styk rovin je v ose hřebene', `z = ${sSlope.zTo}`)

console.log('\nKOMPAS')
// východ = −x, sever = +z; v pravotočivém prostoru musí být východ × sever = nahoru.
// Když tohle selže, je celý model zrcadlově převrácený.
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const up = cross([-1, 0, 0], [0, 0, 1])
ok(up[1] === 1, 'východ × sever = nahoru (kompas je pravotočivý)', `(${up})`)
ok(SPEC.blocks.find((b) => b.id === 'office-gf').x0 === 0, 'kanceláře na východním průčelí (x = 0)')
const NO_WINDOW_OK = ['wet', 'plant', 'arena', 'sim', 'meeting', 'play', 'circ', 'storage']
const atNorth = SPEC.blocks.filter((b) => b.z1 >= SPEC.depth)
ok(atNorth.every((b) => NO_WINDOW_OK.includes(b.type)),
  'u severní (slepé) stěny jsou jen provozy bez nároku na okna',
  atNorth.filter((b) => !NO_WINDOW_OK.includes(b.type)).map((b) => b.id).join(', ') || `${atNorth.length} bloků`)
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
ok(t.tuv > 1000 && t.tuv < 6000, 'špička TUV počítaná ze sprch a dřezů, ne paušálem', `${Math.round(t.tuv)} l/h`)

// každá páteř končí zaslepená na hranici etapy 2
const spines = mep.routes.filter((r) => r.kind === 'spine')
ok(spines.every((r) => Math.abs(r.points[1].x - (SPEC.stage1 - 0.4)) < 1e-9),
  'každá páteř dojede až na hranici etapy 2', `${spines.length} páteří`)

// každý blok s nárokem má odbočku
for (const key of ['vzt', 'elec']) {
  const tapped = new Set(mep.routes
    .filter((r) => r.service === key && (r.kind === 'branch' || r.kind === 'terminal'))
    .map((r) => r.block))
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
ok(fit.counts.tramp === SPEC.program.arena.beds, 'trampolíny v běžném rastru 2,10 × 3,05', `${fit.counts.tramp}`)
ok(fit.counts.foampit === 1, 'molitanová jáma je v aréně')
ok(fit.counts.car === 2, 'dvě vozidla v dílně — na zvedáku a odstavené', `${fit.counts.car}`)
ok(fit.counts.hoist === 1, 'sklad má nakládací otvor, jinak tam paletu nikdo nedostane')
ok(fit.counts.diffuser > 20, 'vyústky VZT odvozené z průtoku', `${fit.counts.diffuser}`)
ok(fit.counts.extinguisher > 8, 'hasicí přístroje odvozené z plochy', `${fit.counts.extinguisher}`)
ok(fit.counts.subboard === 4, 'podružný rozvaděč na každou provozní zónu')
ok(fit.counts.carlift === 1, 'zvedák v dílně')
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

console.log('\nERGONOMIE')
// geometrie židle má opěradlo na +z → při rot 0 člověk kouká na −z.
// Ruční rotace se tu opakovaně pletly, tohle to hlídá.
const TABLES = ['desk', 'table', 'rtable', 'mtable', 'partyTable']
const facingOf = (r) => ({ x: Math.sin(((r ?? 0) * Math.PI) / 180), z: -Math.cos(((r ?? 0) * Math.PI) / 180) })
const backwards = []
for (const c of fit.items.filter((it) => it.kind === 'chair')) {
  const near = fit.items
    .filter((t) => TABLES.includes(t.kind) && t.block === c.block)
    .map((t) => ({ t, d: Math.hypot(t.x - c.x, t.z - c.z) }))
    .sort((a, b) => a.d - b.d)[0]
  if (!near || near.d > 1.4) continue
  const f = facingOf(c.rot)
  if (f.x * (near.t.x - c.x) + f.z * (near.t.z - c.z) <= 0) backwards.push(c)
}
ok(backwards.length === 0, 'žádná židle nesedí zády ke svému stolu',
  backwards.length ? `${backwards.length} ks` : `${fit.counts.chair} židlí`)

console.log('\nOBRAZY')
const pics = fit.items.filter((i) => i.kind === 'picture')
ok(pics.length === 9, 'obrazy: 5× zasedačka + 1× sim racing + 3× fitness', `${pics.length} ks`)
ok(pics.every((p) => p.img && p.pw > 0 && p.ph > 0), 'každý obraz má soubor a rozměr rámu')
ok(pics.filter((p) => p.block === 'gym').length === 3 && pics.filter((p) => p.block === 'sim').length === 1
  && pics.filter((p) => p.block === 'meeting').length === 5, 'rozmístění sedí')
// obraz visí na stěně, ne uprostřed místnosti — ale NESMÍ být utopený v ní.
// Obvodová stěna má tloušťku 0,25 m od hrany bloku dovnitř, takže rám musí
// být 0,14–0,35 m od hrany (sim obraz byl na 0,10 a zmizel ve zdi).
ok(pics.every((p) => {
  const b = SPEC.blocks.find((x) => x.id === p.block)
  const d = Math.min(p.x - b.x0, b.x1 - p.x, p.z - b.z0, b.z1 - p.z)
  return d >= 0.14 && d <= 0.35
}), 'obrazy visí na stěnách a nejsou utopené ve zdi')

console.log('\nPŘÍSTUPNOST A ÚNIK')
// každý blok v patře musí mít pod sebou nebo vedle sebe schodiště —
// 126 m² kanceláří bylo v jedné verzi bez přístupu
const stairs = fit.items.filter((it) => it.kind === 'stairs')
const upper = SPEC.blocks.filter((b) => b.level === 1)
const touching = (a, b) => a.x0 <= b.x1 + 0.05 && a.x1 >= b.x0 - 0.05
                        && a.z0 <= b.z1 + 0.05 && a.z1 >= b.z0 - 0.05
// blok je obsloužený, když do něj ústí schodiště, nebo sousedí s obslouženým
const servedUp = new Set(upper
  .filter((b) => stairs.some((st) => st.x >= b.x0 - 1 && st.x <= b.x1 + 1
                                  && st.z >= b.z0 - 3 && st.z <= b.z1 + 3))
  .map((b) => b.id))
for (let pass = 0; pass < upper.length; pass++) {
  for (const b of upper) {
    if (servedUp.has(b.id)) continue
    if (upper.some((o) => servedUp.has(o.id) && touching(b, o))) servedUp.add(b.id)
  }
}
const unreachable = upper.filter((b) => !servedUp.has(b.id))
ok(unreachable.length === 0, 'každý blok v patře je dostupný ze schodiště',
  unreachable.length ? unreachable.map((b) => b.id).join(', ') : `${upper.length} bloků, ${stairs.length} schodišť`)

// KAŽDÉ schodiště musí mít nad sebou prostup, jinak končí u stropu
const noHole = []
for (const st of stairs) {
  const o = stairOpening(st, FURN)
  const above = SPEC.blocks.filter((b) => b.level === 1
    && o.x1 > b.x0 && o.x0 < b.x1 && o.z1 > b.z0 && o.z0 < b.z1)
  // prostup musí ležet celý v blocích patra, které nad schodištěm jsou
  const area = (o.x1 - o.x0) * (o.z1 - o.z0)
  const covered = above.reduce((a, b) => a
    + (Math.min(o.x1, b.x1) - Math.max(o.x0, b.x0)) * (Math.min(o.z1, b.z1) - Math.max(o.z0, b.z0)), 0)
  if (above.length === 0 || covered < area - 0.01) noHole.push(`${st.block} (kryto ${(covered / area * 100).toFixed(0)} %)`)
}
ok(noHole.length === 0, 'nad každým schodištěm je prostup ve stropě',
  noHole.length ? noHole.join(', ') : `${stairs.length} schodišť`)

// volné hrany mezipater musí mít zábradlí
const railed = SPEC.blocks.filter((b) => b.level === 1).flatMap((b) => openEdges(SPEC, b))
ok(railed.length > 0, 'volné hrany mezipater jsou zjištěné a dostanou zábradlí',
  `${railed.length} úseků`)

// do zasedačky se nesmí chodit skrz pronajatou jednotku
const corr = SPEC.blocks.find((b) => b.id === 'corridor')
const meet = SPEC.blocks.find((b) => b.id === 'meeting')
ok(corr && touching(corr, meet), 'zasedačka má dveře do chodby, ne přes rezervu')

const doors = openingsFor(SPEC, 'south').filter((h) => h.v0 === 0)
ok(doors.length >= 5, 'jižní stěna má dost dveří pro únik i zásobování', `${doors.length}`)
const arenaB = SPEC.blocks.find((b) => b.id === 'arena')
ok(doors.some((h) => h.x0 >= arenaB.x0 - 0.1 && h.x1 <= arenaB.x1 + 0.1),
  'aréna má vlastní únikový východ, nejen cestu přes lobby')
const lobbyB = SPEC.blocks.find((b) => b.id === 'lobby')
ok(doors.filter((h) => h.x0 >= lobbyB.x0 - 0.1 && h.x1 <= lobbyB.x1 + 0.1).length >= 2,
  'lobby má hlavní vchod i zásobovací dveře')
ok(fit.items.some((it) => it.kind === 'cleansink' && it.block === 'gym'),
  'úklidová výlevka je i v patře')

console.log('\nVNITŘNÍ DVEŘE A PROSTUPNOST')
const doorsIn = doorsFor(SPEC)
ok(doorsIn.length === SPEC.links.length, 'každé propojení ve spec má dveře',
  `${doorsIn.length}/${SPEC.links.length}`)
ok(SPEC.links.every((l) => sharedEdge(
  SPEC.blocks.find((b) => b.id === l.a), SPEC.blocks.find((b) => b.id === l.b))),
  'propojené bloky spolu opravdu sousedí')

// dveře nesmí ústit do nábytku
const blocked = []
for (const d of doorsIn) {
  const clear = 0.85                       // reálné minimum před vnitřními dveřmi
  for (const it of fit.items) {
    if (it.link || !FURN[it.kind] || it.y !== d.y) continue   // dveře navzájem neblokují
    const f = FURN[it.kind]
    if (f.h < 0.35) continue               // rohože, vpusti, vyznačená stání nepřekáží
    if (f.d <= 0.3 && f.w <= 1.1) continue // nástěnné drobnosti vedle dveří jsou v pořádku
    const turned = it.rot === 90 || it.rot === 270
    const rx = (turned ? f.d : f.w) / 2
    const rz = (turned ? f.w : f.d) / 2
    const dx = Math.max(0, Math.abs(it.x - d.x) - rx)
    const dz = Math.max(0, Math.abs(it.z - d.z) - rz)
    if (Math.hypot(dx, dz) < clear) { blocked.push(`${d.link}: ${it.kind}`); break }
  }
}
ok(blocked.length === 0, 'před žádnými dveřmi nestojí nábytek',
  blocked.length ? blocked.slice(0, 4).join(', ') : `${doorsIn.length} dveří`)

// z každé místnosti se musí dát dojít ven
const entrances = new Set()
for (const side of ['south', 'north']) {
  for (const h of openingsFor(SPEC, side)) {
    if (h.v0 > 0.01) continue
    const z = side === 'south' ? 0.2 : SPEC.depth - 0.2
    const b = SPEC.blocks.find((x) => (x.level === 0 || x.level === 'full')
      && (h.x0 + h.x1) / 2 > x.x0 && (h.x0 + h.x1) / 2 < x.x1 && z > x.z0 && z < x.z1)
    if (b) entrances.add(b.id)
  }
}
const edges = new Map(SPEC.blocks.map((b) => [b.id, new Set()]))
for (const l of SPEC.links) { edges.get(l.a).add(l.b); edges.get(l.b).add(l.a) }
for (const st of stairs) {                       // schodiště spojuje podlaží
  const to = SPEC.blocks.find((b) => b.level === 1
    && st.x > b.x0 - 1 && st.x < b.x1 + 1 && st.z > b.z0 - 3 && st.z < b.z1 + 3)
  if (to) { edges.get(st.block).add(to.id); edges.get(to.id).add(st.block) }
}
const seen = new Set(entrances)
const queue = [...entrances]
while (queue.length) for (const n of edges.get(queue.pop()) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n) }
const cutOff = SPEC.blocks.filter((b) => !seen.has(b.id))
ok(cutOff.length === 0, 'z každé místnosti se dá dojít ven',
  cutOff.length ? cutOff.map((b) => b.id).join(', ') : `${seen.size} místností, vchody: ${[...entrances].join(', ')}`)

// dílna zůstává oddělená od veřejné části
const tech = new Set(['workshop', 'plant', 'storage'])
const leaks = SPEC.links.filter((l) => tech.has(l.a) !== tech.has(l.b))
ok(leaks.length === 0, 'z dílny nevede do veřejné části žádné dveře',
  leaks.length ? leaks.map((l) => `${l.a}–${l.b}`).join(', ') : 'technická zóna je samostatná')
ok(SPEC.links.some((l) => tech.has(l.a) && tech.has(l.b) && l.type === 'service'),
  'dílna a strojovna propojené jen servisními dveřmi')

console.log('\nROZVODY KE KONCOVKÁM')
const terms = mep.routes.filter((r) => r.kind === 'terminal')
ok(terms.length > 100, 'koncové větve vedou k jednotlivým předmětům', `${terms.length} koncovek`)
ok(mep.routes.some((r) => r.service === 'data'), 'datové rozvody existují')

// každý předmět, který podle SVC něco potřebuje, to musí opravdu dostat
const needy = fit.items.filter((it) => SVC[it.kind])
const missing = []
for (const it of needy) {
  for (const key of SVC[it.kind].svc) {
    const hit = terms.some((r) => r.service === key
      && Math.abs(r.points[2].x - it.x) < 1e-6 && Math.abs(r.points[2].z - it.z) < 1e-6)
    if (!hit) missing.push(`${it.kind}/${key} v ${it.block}`)
  }
}
ok(missing.length === 0, 'ke každému předmětu vede každá přípojka, kterou potřebuje',
  missing.length ? missing.slice(0, 4).join(', ') : `${needy.length} předmětů`)

// koncovka nesmí viset ve vzduchu mimo svůj blok
const stray = terms.filter((r) => {
  const b = SPEC.blocks.find((x) => x.id === r.block)
  const p = r.points[2]
  return !b || p.x < b.x0 - 0.4 || p.x > b.x1 + 0.4 || p.z < b.z0 - 0.4 || p.z > b.z1 + 0.4
})
ok(stray.length === 0, 'žádná koncovka nekončí mimo svůj blok', `${stray.length}`)

console.log('\nPŘEPOČET PO ZMĚNĚ')
const bigger = structuredClone(SPEC)
const arena = bigger.blocks.find((b) => b.id === 'arena')
const before = computeMEP(bigger).totals.vzt
arena.z1 += 2 // aréna se zvětší
const after = computeMEP(bigger).totals.vzt
ok(after > before, 'zvětšení arény zvýší VZT', `${Math.round(before)} → ${Math.round(after)} m³/h`)
ok(ductRadius(after) > ductRadius(before), 'a zvětší i průměr páteřního potrubí',
  `ø ${(ductRadius(before) * 2).toFixed(2)} → ${(ductRadius(after) * 2).toFixed(2)} m`)

// voda se teď řídí předměty, ne typem místnosti: samotné smazání „mokrých"
// provozů ji nesmí odstranit, protože dřez na baru zůstává
const noWetRooms = structuredClone(SPEC)
noWetRooms.blocks = noWetRooms.blocks.filter((b) => b.type !== 'wet')
ok(computeMEP(noWetRooms).routes.some((r) => r.service === 'water' && r.block === 'lobby'),
  'dřez na baru si drží vodu i bez „mokrých" místností')

const noFixtures = structuredClone(SPEC)
noFixtures.blocks = noFixtures.blocks.filter((b) => ['arena', 'storage'].includes(b.id))
ok(computeMEP(noFixtures).routes.filter((r) => r.service === 'water').length === 0,
  'bez jediného vodovodního předmětu rozvod vody zmizí')

console.log(fail === 0 ? '\n✓ vše prošlo\n' : `\n✗ ${fail} selhalo\n`)
process.exit(fail ? 1 : 0)
