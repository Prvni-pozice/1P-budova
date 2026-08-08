// mep.js — rozvody se POČÍTAJÍ ze spec.js, nekreslí se ručně.
//
// Princip trasování: strojovna je zdroj, z ní jde vodorovná páteř podél
// servisní stěny (spineZ) v každém podlaží, z páteře odbočka ke každému bloku.
// Páteř vždycky pokračuje až na hranici etapy 1, kde se zaslepí — tam se napojí
// etapa 2. Když se blok přesune nebo změní velikost, přepočte se i dimenze:
// průměr VZT potrubí vychází z průtoku, jistič z příkonu.

import { SPEC, TYPES, area, levelBase, blockHeight } from './spec.js'

export const SERVICES = [
  { key: 'vzt',   name: 'VZT',               color: 0x7fd4ff, dz: 0.0, dy: 0.0,  r: null },
  { key: 'heat',  name: 'Topení + chlazení', color: 0xff8a4c, dz: 0.7, dy: -0.5, r: 0.075 },
  { key: 'water', name: 'Voda (SV + TUV)',   color: 0x2ecc71, dz: 1.1, dy: -0.5, r: 0.055 },
  { key: 'drain', name: 'Kanalizace',        color: 0x9b7653, dz: 0.7, dy: 0.0,  r: 0.095 },
  { key: 'elec',  name: 'Elektro',           color: 0xffd54f, dz: 1.1, dy: 0.0,  r: 0.06  },
]

const AIR_SPEED = 5        // m/s v páteřním potrubí — z toho vychází průměr
const TUV_PEAK = 25        // l/h na m² mokrého provozu (hrubý odhad, k upřesnění)
const DIVERSITY = 0.6      // soudobost elektrického příkonu
const COP = 3.2            // topný faktor TČ

/** Průměr vzduchotechniky z průtoku — proto se mění, když se změní plocha. */
export function ductRadius(m3h) {
  return Math.max(0.06, Math.sqrt(m3h / 3600 / (Math.PI * AIR_SPEED)))
}

/** Nároky jednoho bloku. */
export function blockDemand(b) {
  const t = TYPES[b.type]
  const a = area(b)
  return {
    a,
    vzt: t.vzt * a,
    heat: (t.heat * a) / 1000,
    cool: (t.cool * a) / 1000,
    elec: (t.elec * a) / 1000,
    tuv: t.wet ? TUV_PEAK * a : 0,
    wet: t.wet,
  }
}

const levelOf = (b) => (b.level === 'full' ? 0 : b.level)

/** Výška páteře v daném podlaží (pod stropem); kanalizace jde u podlahy. */
function spineY(s, level, service) {
  if (service === 'drain') return 0.15
  return level === 1 ? s.eaves - 0.4 : s.clearGF - 0.4
}

/** Souběžné trasy se odsazují SMĚREM DOVNITŘ od servisní stěny. */
const inward = (s) => (s.spineZ < s.depth / 2 ? 1 : -1)

/** Napojovací bod bloku — hrana nejblíž k servisní páteři. */
function tapPoint(s, b) {
  const x = (b.x0 + b.x1) / 2
  const z = Math.min(Math.max(s.spineZ, b.z0), b.z1)
  const base = levelBase(s, levelOf(b))
  const y = b.level === 'full' ? Math.min(4.6, blockHeight(s, b) - 0.6) : base + blockHeight(s, b) * 0.55
  return { x, y, z }
}

/** Bloky, které daná služba obsluhuje. */
function served(s, key) {
  return s.blocks.filter((b) => {
    const d = blockDemand(b)
    if (key === 'water' || key === 'drain') return d.wet
    if (key === 'vzt') return d.vzt > 0
    if (key === 'heat') return d.heat > 0
    return d.elec > 0
  })
}

/**
 * Kompletní přepočet rozvodů. Vrací trasy k vykreslení a souhrnné dimenze.
 */
export function computeMEP(s = SPEC) {
  const plant = s.blocks.find((b) => b.type === 'plant')
  const plantX = plant ? (plant.x0 + plant.x1) / 2 : s.stage1 - 2
  const routes = []
  const perService = {}

  for (const svc of SERVICES) {
    const blocks = served(s, svc.key)
    if (!blocks.length) continue

    const levels = [...new Set(blocks.map(levelOf))].sort()
    const flowByLevel = {}
    for (const lvl of levels) {
      flowByLevel[lvl] = blocks.filter((b) => levelOf(b) === lvl).reduce((a, b) => a + blockDemand(b).vzt, 0)
    }

    for (const lvl of levels) {
      const y = spineY(s, lvl, svc.key) + svc.dy
      const z = s.spineZ + inward(s) * svc.dz
      const xs = blocks.filter((b) => levelOf(b) === lvl).map((b) => (b.x0 + b.x1) / 2)
      const x0 = Math.min(...xs, plantX)
      const x1 = s.stage1 - 0.4 // páteř končí zaslepená na hranici etapy 2
      const r = svc.r ?? ductRadius(flowByLevel[lvl])

      routes.push({ service: svc.key, kind: 'spine', color: svc.color, radius: r,
        points: [{ x: x0, y, z }, { x: x1, y, z }] })

      for (const b of blocks.filter((bb) => levelOf(bb) === lvl)) {
        const t = tapPoint(s, b)
        const br = svc.r ?? ductRadius(blockDemand(b).vzt)
        routes.push({ service: svc.key, kind: 'branch', color: svc.color, radius: br, block: b.id,
          points: [{ x: t.x, y, z }, { x: t.x, y, z: t.z }, { x: t.x, y: t.y, z: t.z }] })
      }
    }

    // stoupačka u strojovny propojující podlaží
    if (levels.length > 1) {
      const z = s.spineZ + inward(s) * svc.dz
      routes.push({ service: svc.key, kind: 'riser', color: svc.color, radius: svc.r ?? ductRadius(flowByLevel[1] ?? 0),
        points: [
          { x: plantX, y: spineY(s, 0, svc.key) + svc.dy, z },
          { x: plantX, y: spineY(s, 1, svc.key) + svc.dy, z },
        ] })
    }

    perService[svc.key] = blocks.length
  }

  // --- souhrnné dimenze ---
  const d = s.blocks.map(blockDemand)
  const sum = (f) => d.reduce((a, x) => a + f(x), 0)
  const vztTotal = sum((x) => x.vzt)
  const heatTotal = sum((x) => x.heat)
  const coolTotal = sum((x) => x.cool)
  const elecInstalled = sum((x) => x.elec)
  const hpElec = heatTotal / COP
  const coolElec = coolTotal / 3.0
  const elecCalc = elecInstalled * DIVERSITY + hpElec + coolElec
  const breaker = (elecCalc * 1000) / (Math.sqrt(3) * 400 * 0.9)

  const vztByZone = {}
  for (const b of s.blocks) {
    const t = TYPES[b.type]
    vztByZone[t.label] = (vztByZone[t.label] || 0) + blockDemand(b).vzt
  }

  return {
    routes,
    perService,
    totals: {
      vzt: vztTotal,
      vztDuct: ductRadius(vztTotal) * 2,
      heat: heatTotal,
      cool: coolTotal,
      elecInstalled,
      elecCalc,
      breaker,
      hpElec,
      tuv: sum((x) => x.tuv),
      wetArea: d.filter((x) => x.wet).reduce((a, x) => a + x.a, 0),
      vztByZone,
    },
  }
}
