// test_spec.mjs — kontrola, že se plochy i rozvody počítají ze spec.
// Spouštět: node test_spec.mjs
import { SPEC, TYPES, areaTotals, area, levelBase, roofY, ridgeY } from './src/spec.js'
import { computeMEP, blockDemand, ductRadius } from './src/mep.js'
import { openingsFor, pvLayout, stairOpening, openEdges, roofSlope, partitionsFor } from './src/building.js'
import { fitoutAll, fitoutFor, sanitaryFor, SVC, FURN, doorsFor, sharedEdge } from './src/fitout.js'
import { walkGrid, findPath } from './src/walk.js'

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
ok(Math.abs(a.up - 308) < 0.01, 'patro = 308 m² (technická místnost místo skladu)', `${a.up} m²`)
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
const NO_WINDOW_OK = ['wet', 'plant', 'arena', 'sim', 'meeting', 'play', 'circ', 'storage', 'lobby']
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
ok(Math.abs(t.wetArea - 70.2) < 0.01,
  'mokré provozy = dělené šatny 42 + WC přízemí 10,2 + sanita patra 18 m²', `${t.wetArea} m²`)
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
ok(fit.counts.diffuser > 20, 'vyústky VZT odvozené z průtoku', `${fit.counts.diffuser}`)
ok(fit.counts.extinguisher > 8, 'hasicí přístroje odvozené z plochy', `${fit.counts.extinguisher}`)
ok(fit.counts.subboard === 4, 'podružný rozvaděč na každou provozní zónu')
ok(fit.counts.carlift === 1, 'zvedák v dílně')
// bezbariérové WC je samostatná místnost s dveřmi přímo z lobby — kabina
// uvnitř dámské šatny nesplňovala přístup dle vyhl. 398/2009
const bfBlock = SPEC.blocks.find((b) => b.id === 'wc-bf')
ok(!!bfBlock && fit.items.some((it) => it.block === 'wc-bf' && it.kind === 'toilet')
  && fit.items.some((it) => it.block === 'wc-bf' && it.kind === 'basin'),
  'bezbariérové WC je samostatná místnost s mísou a umyvadlem')
ok(SPEC.links.some((l) => (l.a === 'lobby' && l.b === 'wc-bf') || (l.b === 'lobby' && l.a === 'wc-bf')),
  'bezbariérové WC má dveře přímo z lobby, ne přes šatnu')
ok((bfBlock.x1 - bfBlock.x0) >= 2.2 && (bfBlock.z1 - bfBlock.z0) >= 2.6,
  'bezbariérová místnost má min. 2,2 × 2,6 m',
  `${(bfBlock.x1 - bfBlock.x0).toFixed(1)} × ${(bfBlock.z1 - bfBlock.z0).toFixed(1)} m`)

const sPub = sanitaryFor(SPEC.program.arena.peak, { publicUse: true })
const sOff = sanitaryFor(SPEC.program.office.staffTarget)
// veřejná sanita je rozdělená na pánskou a dámskou, ale součet drží normu;
// k tomu kanceláře v přízemí a nová sanita patra (2 kabiny dámy + 1 páni)
const WC_1F = 3
// třetí dámskou kabinu dle normy plní bezbariérová místnost wc-bf (mísa
// se do počtu počítá, vyhl. 398/2009) — proto −1 kabina a +1 mísa
ok(fit.counts.wc + fit.counts.toilet === sPub.wcW + sPub.wcM + sOff.wcW + sOff.wcM + WC_1F,
  'počet WC kabin + bezbar. mísa odpovídá normě',
  `${fit.counts.wc}+${fit.counts.toilet} (veřejnost ${sPub.wcW + sPub.wcM} + kanceláře ${sOff.wcW + sOff.wcM} + patro ${WC_1F})`)
ok(fit.counts.basin === sPub.basins + sOff.basins + 2 + 1,
  'počet umyvadel odpovídá normě + 2 v patře + 1 v bezbar. WC', `${fit.counts.basin}`)
// každá šatna i sanita patra má obě pohlaví oddělená a po dvou sprchách dole
for (const [id, n] of [['wc-men', 2], ['wc-women', 2], ['wc-1f-w', 1], ['wc-1f-m', 1]]) {
  ok(fit.items.filter((it) => it.block === id && it.kind === 'shower').length === n,
    `${id}: ${n}× sprcha`, `${fit.items.filter((it) => it.block === id && it.kind === 'shower').length}`)
}
ok(fit.items.filter((it) => it.block === 'wc-men' && it.kind === 'urinal').length === 2,
  'pánská šatna má 2 pisoáry')
ok(['wc-1f-w', 'wc-1f-m'].every((id) => SPEC.links.some((l) =>
  (l.a === 'corridor' && l.b === id) || (l.b === 'corridor' && l.a === id))),
  'sanita patra visí na chodbě, dosáhne na ni kancelář i fitness')

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
const TABLES = ['desk', 'table', 'rtable', 'mtable', 'partyTable', 'hightable']
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
ok(doors.length >= 4, 'jižní stěna: vstup, únik arény, personál dílny, vrata', `${doors.length}`)
const arenaB = SPEC.blocks.find((b) => b.id === 'arena')
ok(doors.some((h) => h.x0 >= arenaB.x0 - 0.1 && h.x1 <= arenaB.x1 + 0.1),
  'aréna má vlastní únikový východ, nejen cestu přes lobby')
const lobbyB = SPEC.blocks.find((b) => b.id === 'lobby')
ok(doors.filter((h) => h.x0 >= lobbyB.x0 - 0.1 && h.x1 <= lobbyB.x1 + 0.1).length === 1,
  'lobby má jen hlavní vchod (zásobování zrušeno 9. 8.)')
ok(fit.items.some((it) => it.kind === 'cleansink' && ['gym', 'gym-n'].includes(it.block)),
  'úklidová výlevka je i v patře')

// v západní (1P) části smí být jen JEDNO schodiště — bývala tam dvě 1,3 m
// od sebe přes příčku; a veřejné patro musí mít bezbariérový přístup
ok(stairs.filter((st) => st.x < 14).length === 1, 'v 1P části je jediné sdílené schodiště',
  `${stairs.filter((st) => st.x < 14).length}`)
ok(fit.counts.elevator === 1, 'výtah pro bezbariérový přístup do patra existuje')
const elev = fit.items.find((it) => it.kind === 'elevator')
const shStair = stairs.find((st) => st.x < 14)
ok(Math.hypot(elev.x - shStair.x, elev.z - shStair.z) < 3.5, 'výtah stojí u sdíleného schodiště',
  `${Math.hypot(elev.x - shStair.x, elev.z - shStair.z).toFixed(1)} m`)

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
for (const [a, b] of SPEC.openPairs ?? []) { edges.get(a).add(b); edges.get(b).add(a) }
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
const tech = new Set(['workshop', 'plant', 'store-gf'])
const leaks = SPEC.links.filter((l) => tech.has(l.a) !== tech.has(l.b))
ok(leaks.length === 0, 'z dílny nevede do veřejné části žádné dveře',
  leaks.length ? leaks.map((l) => `${l.a}–${l.b}`).join(', ') : 'technická zóna je samostatná')
ok(SPEC.links.some((l) => tech.has(l.a) && tech.has(l.b) && l.type === 'service'),
  'dílna a sklad propojené jen servisními dveřmi')

console.log('\nPŘÍČKY A POŽÁRNÍ ÚSEKY')
const parts = partitionsFor(SPEC)
ok(parts.length >= 18, 'příčky se generují mezi všemi sousedy', `${parts.length} segmentů`)
const compOf = {}
for (const [n, ids] of Object.entries(SPEC.compartments)) for (const id of ids) compOf[id] = n
ok(parts.filter((p2) => p2.fire).every((p2) => compOf[p2.blocks[0]] !== compOf[p2.blocks[1]]),
  'požární stěny jsou přesně na hranicích úseků', `${parts.filter((p2) => p2.fire).length} požárních`)
// každé dveře z links mají otvor v příslušné příčce
const doorless = SPEC.links.filter((l) => !parts.some((p2) =>
  p2.blocks.includes(l.a) && p2.blocks.includes(l.b) && p2.gaps.length > 0))
ok(doorless.length === 0, 'každé dveře mají otvor v příčce',
  doorless.map((l) => `${l.a}–${l.b}`).join(', ') || `${SPEC.links.length} dveří`)
// schodiště i výtah stojí v lobby a ústí do bloku 'core', který je BEZ příčky
// spojený s chodbou — nahoře se tedy vystupuje do chodby, ne do fitness
const coreB = SPEC.blocks.find((b) => b.id === 'core')
const elevIt = fit.items.find((it) => it.kind === 'elevator')
const stairIt = fit.items.find((it) => it.kind === 'stairs' && it.x < 14)
ok([elevIt, stairIt].every((it) => it.x > coreB.x0 && it.x < coreB.x1
  && it.z > coreB.z0 && it.z < coreB.z1), 'schodiště i výtah ústí do schodišťového jádra')
ok((SPEC.openPairs ?? []).some((p2) => p2.includes('corridor') && p2.includes('core')),
  'jádro je bez příčky spojené s chodbou')
ok(!parts.some((p2) => p2.blocks.includes('corridor') && p2.blocks.includes('core')),
  'mezi chodbou a jádrem se opravdu negeneruje příčka')
// a chodba musí zůstat průchozí — výtah v ní dřív stál přes celou šířku
const corrB = SPEC.blocks.find((b) => b.id === 'corridor')
const corrY = levelBase(SPEC, 1)
const acrossCorridor = fit.items.filter((it) => {
  const f = FURN[it.kind]
  if (!f || it.link || f.h < 1.0 || it.y !== corrY) return false
  const turned = it.rot === 90 || it.rot === 270
  const rx = (turned ? f.d : f.w) / 2
  return it.x - rx < corrB.x1 - 0.1 && it.x + rx > corrB.x0 + 0.1
      && it.z > corrB.z0 && it.z < corrB.z1
})
ok(acrossCorridor.length === 0, 'chodba není nikde přehrazená napříč',
  acrossCorridor.map((it) => `${it.kind} v ${it.block}`).join(', ') || 'průchozí po celé délce')

console.log('\nSTATIKA A TZB')
// páteř rozvodů v patře musí projít pod spodní pásnicí vazníků (5,75 m)
const upperSpines = mep.routes.filter((r) => r.kind === 'spine' && r.points[0].y > 4)
// mokré a vzduchové páteře pod pásnicí; elektro a data jedou NA pásnicích
ok(upperSpines.filter((r) => !['elec', 'data'].includes(r.service))
  .every((r) => r.points[0].y + r.radius < 5.72),
  'VZT/topení/voda v patře pod pásnicí vazníků')
ok(upperSpines.filter((r) => ['elec', 'data'].includes(r.service))
  .every((r) => r.points[0].y >= 5.7 && r.points[0].y <= 5.9),
  'elektro a data na kabelových trasách na pásnicích')
// denní světlo: pracovní místnosti se dotýkají fasády s okny (jih/východ)
const daylight = SPEC.blocks.filter((b) => ['office', 'meeting'].includes(b.type))
ok(daylight.every((b) => b.z0 <= 0.01 || b.x0 <= 0.01),
  'kanceláře a zasedačka mají denní světlo (jih nebo prosklený východ)')
// dílna: nadsvětlík nad vraty
ok(openingsFor(SPEC, 'south').some((h) => h.v0 >= 4.2 && h.x0 <= 23.4 && h.x1 >= 26),
  'dílna má nadsvětlík v horním pásu nad vraty')

// rozvody se drží stropu: žádný vodorovný běh (mimo kanalizaci a svody)
// nesmí viset níž než 0,5 m pod stropem svého podlaží
const lowRuns = []
for (const r of mep.routes) {
  if (r.service === 'drain') continue
  for (let i = 0; i < r.points.length - 1; i++) {
    const a2 = r.points[i]
    const b2 = r.points[i + 1]
    if (Math.abs(a2.y - b2.y) > 1e-6 || (a2.x === b2.x && a2.z === b2.z)) continue
    const lvlTop = a2.y > 3.4 ? SPEC.eaves : SPEC.clearGF
    if (a2.y > 1 && a2.y < lvlTop - 1.0) lowRuns.push(`${r.service}@${r.block ?? 'páteř'} y${a2.y.toFixed(2)}`)
  }
}
ok(lowRuns.length === 0, 'žádný rozvod nevisí níž než 1 m pod stropem',
  lowRuns.slice(0, 4).join(', ') || `${mep.routes.length} úseků`)

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

console.log('\nKOMUNITNÍ PŘÍZEMÍ')
ok(!SPEC.blocks.some((b) => b.id === 'kitchen'), 'stará kuchyňka s WC neexistuje')
ok((SPEC.openPairs ?? []).some((p2) => p2.includes('office-gf') && p2.includes('commons')),
  'pracovní zóna a kuchyňský kout jsou jeden prostor (bez příčky)')
ok(!parts.some((p2) => p2.blocks.includes('office-gf') && p2.blocks.includes('commons')),
  'příčka mezi nimi se opravdu negeneruje')
ok(SPEC.links.some((l) => (l.a === 'wc-gf' || l.b === 'wc-gf')),
  'záchody jsou jediná uzavřená část se svými dveřmi')
const wcItems = fit.items.filter((it) => it.block === 'wc-gf')
ok(wcItems.some((it) => it.kind === 'wc') && !fit.items.some((it) => it.block === 'commons' && it.kind === 'wc'),
  'WC kabiny jsou v WC zóně, žádná v kuchyňském koutě')
const commTables = fit.items.filter((it) => it.block === 'office-gf' && ['desk', 'hightable', 'rtable'].includes(it.kind))
ok(new Set(commTables.map((it) => it.kind)).size >= 2 && fit.counts.sofa >= 2,
  'komunitní prostor má aspoň 2 typy stolů a lounge', `typy: ${[...new Set(commTables.map((it) => it.kind))].join(', ')}`)

console.log('\nEKONOMIKA')
const eco = SPEC.economy
const badIds = Object.keys(eco.revenue).filter((id) => !SPEC.blocks.some((b) => b.id === id))
ok(badIds.length === 0, 'výnosy jen pro existující bloky', badIds.join(', ') || `${Object.keys(eco.revenue).length} bloků`)
const revSum = Object.values(eco.revenue).reduce((a2, v) => a2 + v, 0)
ok(revSum === 4376000, 'součet výnosů sedí na rozvahu 4,376 mil.', `${revSum.toLocaleString('cs-CZ')}`)
ok(eco.costsTotal === 2970000 && revSum > eco.costsTotal, 'náklady 2,97 mil. a kladný zisk')

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

console.log('\nPROFESNÍ REVIZE (17. 8.)')
// ZTI: kanalizace patra musí mít páteř V PATŘE a stoupačku s reálnou délkou —
// dřív obě páteře ležely na y 0,12 a „stoupačka" měla nulovou délku, takže
// sanita patra neměla svod
const drain1 = mep.routes.find((r) => r.service === 'drain' && r.kind === 'spine' && r.points[0].y > 3)
ok(!!drain1, 'kanalizace patra běží v podlaze patra', drain1 ? `y ${drain1.points[0].y.toFixed(2)}` : 'chybí')
const drainRiser = mep.routes.find((r) => r.service === 'drain' && r.kind === 'riser')
ok(!!drainRiser && Math.abs(drainRiser.points[0].y - drainRiser.points[1].y) > 2,
  'svod kanalizace z patra má reálnou délku',
  drainRiser ? `${Math.abs(drainRiser.points[0].y - drainRiser.points[1].y).toFixed(2)} m` : 'chybí')
// a klesá u mokrých bloků patra, ne u strojovny přes půl budovy
const wet1f = SPEC.blocks.filter((b) => b.level === 1 && TYPES[b.type].wet)
ok(!!drainRiser && wet1f.some((b) => drainRiser.points[0].x >= b.x0 - 1 && drainRiser.points[0].x <= b.x1 + 1),
  'svod kanalizace jde u mokrých bloků patra', `x ${drainRiser?.points[0].x.toFixed(1)}`)

// každý sanitární kus má v SVC vodu i kanalizaci — bezbariérová kabina
// (wcBF) je dřív neměla vůbec a rozvody ji míjely
for (const kind of ['wc', 'wcBF', 'toilet', 'basin', 'urinal', 'shower', 'cleansink', 'cleaning', 'kitchen', 'bar']) {
  ok(SVC[kind] && SVC[kind].svc.includes('water') && SVC[kind].svc.includes('drain'),
    `SVC: ${kind} má vodu i kanalizaci`)
}

// VZT strojovny potřebuje sání a výfuk — severní stěna je slepá a jižní
// hrana bloku je vnitřní, žaluzie proto sedí v západním štítu etapy 1
const louvres = fit.items.filter((it) => it.kind === 'louvre' && it.block === 'plant')
ok(louvres.length === 2, 'strojovna má sání i výfuk (žaluzie ve štítu etapy 1)', `${louvres.length}`)
const plantB = SPEC.blocks.find((b) => b.id === 'plant')
ok(louvres.every((l) => Math.abs(l.x - plantB.x1) < 0.5), 'žaluzie sedí u západního štítu')

// požární voda: hydrant na každém podlaží
ok(fit.items.some((it) => it.kind === 'hydrant' && it.y < 1), 'hydrant v přízemí')
ok(fit.items.some((it) => it.kind === 'hydrant' && it.y > 3), 'hydrant v patře')

// rozhodnutí o přípojkách (17. 8.) je ve spec, ne jen v hlavě
ok(SPEC.utilities?.elecConnectionArea === 1008,
  'přípojka elektro dimenzovaná na obě etapy (1 008 m²)')
ok(SPEC.utilities?.mainBreaker === 'stage' && SPEC.utilities?.retention === 'stage',
  'hlavní jistič i retence per etapa')

console.log('\nPRŮCHODNOST NÁVŠTĚVNÍKA (walk test)')
// Mřížkový pathfinder přes plášť, příčky a nábytek — na rozdíl od
// topologického BFS přes links chytí i skříň postavenou napříč cestou.
// Před revizí 17. 8. se návštěvník od vstupu nedostal ke schodišti,
// šatnám ani do arény (barová linie přehradila lobby).
const wg0 = walkGrid(SPEC, 0, 0.3)
const vstup = { x: 10.5, z: 0.6 }
const cileGF = {
  'pata schodiště': { x: 7.6, z: 11.0 },
  'výtah': { x: 9.1, z: 7.0 },
  'šatna páni (sprchy)': { x: 7.75, z: 16.8 },
  'šatna dámy (sprchy)': { x: 12.7, z: 16.5 },
  'WC bezbariérové': { x: 10.65, z: 14.0 },
  'vstup do arény': { x: 14.6, z: 10.0 },
  'bar': { x: 11.2, z: 3.0 },
  'párty stůl': { x: 12.4, z: 9.0 },
  'komunitní prostor': { x: 6.7, z: 11.7 },
  'WC kanceláří': { x: 5.0, z: 16.0 },
  'kuchyňský kout': { x: 2.15, z: 17.3 },
}
for (const [name, c] of Object.entries(cileGF)) {
  const d = findPath(wg0, vstup, c)
  ok(d !== null, `od vstupu: ${name}`, d !== null ? `${d.toFixed(1)} m` : 'CESTA NEEXISTUJE')
}
const wg1 = walkGrid(SPEC, 1, 0.3)
const jadro = { x: 8.8, z: 8.5 }
const cile1F = {
  'klidové místnosti': { x: 2.9, z: 2.5 },
  'zasedačka': { x: 2.9, z: 16.5 },
  'dveře rezervy': { x: 5.8, z: 6.0 },
  'fitness': { x: 10.5, z: 2.5 },
  'volné váhy': { x: 12.0, z: 9.5 },
  'sim racing': { x: 12.0, z: 15.0 },
  'WC patra ženy': { x: 8.5, z: 13.5 },
  'WC patra muži': { x: 8.5, z: 16.5 },
}
for (const [name, c] of Object.entries(cile1F)) {
  const d = findPath(wg1, jadro, c)
  ok(d !== null, `z jádra patra: ${name}`, d !== null ? `${d.toFixed(1)} m` : 'CESTA NEEXISTUJE')
}
// technická zóna zůstává oddělená — z lobby se do dílny dojít NEDÁ
ok(findPath(wg0, vstup, { x: 24.5, z: 6.0 }) === null,
  'do dílny se z lobby vnitřkem nedá (technická zóna má vlastní vstup)')

console.log(fail === 0 ? '\n✓ vše prošlo\n' : `\n✗ ${fail} selhalo\n`)
process.exit(fail ? 1 : 0)
