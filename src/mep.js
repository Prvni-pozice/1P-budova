// mep.js — rozvody se POČÍTAJÍ ze spec.js, nekreslí se ručně.
//
// Princip trasování: strojovna je zdroj, z ní jde vodorovná páteř podél
// servisní stěny (spineZ) v každém podlaží, z páteře odbočka ke každému bloku.
// Páteř vždycky pokračuje až na hranici etapy 1, kde se zaslepí — tam se napojí
// etapa 2. Když se blok přesune nebo změní velikost, přepočte se i dimenze:
// průměr VZT potrubí vychází z průtoku, jistič z příkonu.

import { SPEC, TYPES, area, levelBase, blockHeight } from './spec.js'
import { SVC, fitoutAll } from './fitout.js'

// Všechny trasy se drží STROPU (rozestup jen do stran, ne dolů) — svěšené
// rozvody půl metru pod stropem byly nesmysl. Kanalizace jde v podlaze.
export const SERVICES = [
  { key: 'vzt',   name: 'VZT',               color: 0x7fd4ff, dz: 0.0,  r: null },
  { key: 'heat',  name: 'Topení + chlazení', color: 0xff8a4c, dz: 0.55, r: 0.075 },
  { key: 'water', name: 'Voda (SV + TUV)',   color: 0x2ecc71, dz: 0.95, r: 0.055 },
  { key: 'drain', name: 'Kanalizace',        color: 0x9b7653, dz: 0.75, r: 0.095 },
  { key: 'elec',  name: 'Elektro',           color: 0xffd54f, dz: 1.25, r: 0.06  },
  { key: 'data',  name: 'Datové rozvody',    color: 0xc084fc, dz: 1.5,  r: 0.045 },
]

// průměry koncových větví — poslední metr k zařizovacímu předmětu
const TERMINAL_R = { water: 0.018, drain: 0.05, elec: 0.016, data: 0.012, heat: 0.02 }

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

/** Výška trasy: těsně pod stropem daného podlaží, odstupňovaná jen o průměr
 * potrubí. V patře pod spodní pásnicí vazníků (5,75 m); kanalizace v podlaze. */
const DROP1 = { vzt: 0.85, heat: 0.6, water: 0.5, elec: 0.4, data: 0.4 }
const DROP0 = { vzt: 0.45, heat: 0.22, water: 0.16, elec: 0.12, data: 0.1 }
function spineY(s, level, service) {
  if (service === 'drain') return 0.12
  return level === 1
    ? s.eaves - (DROP1[service] ?? 0.5)
    : s.clearGF - (DROP0[service] ?? 0.2)
}

/** Souběžné trasy se odsazují SMĚREM DOVNITŘ od servisní stěny. */
const inward = (s) => (s.spineZ < s.depth / 2 ? 1 : -1)

/** Napojovací bod bloku — hrana nejblíž k servisní páteři. */
function tapPoint(s, b) {
  const x = (b.x0 + b.x1) / 2
  const z = Math.min(Math.max(s.spineZ, b.z0), b.z1)
  const base = levelBase(s, levelOf(b))
  const y = b.level === 'full' ? blockHeight(s, b) - 0.5 : base + blockHeight(s, b) * 0.55
  return { x, y, z }
}

/**
 * Bloky, které daná služba obsluhuje. Rozhoduje se podle SKUTEČNÝCH předmětů
 * v místnosti, ne podle typu provozu — bar a strojovna nejsou „mokré provozy",
 * ale dřez i výlevka v nich stojí a vodu potřebují.
 */
function served(s, key, fitItems) {
  const withFixture = new Set(
    fitItems.filter((it) => SVC[it.kind]?.svc.includes(key)).map((it) => it.block),
  )
  return s.blocks.filter((b) => {
    if (withFixture.has(b.id)) return true
    if (key === 'data') return false          // data jdou jen ke koncovkám
    const d = blockDemand(b)
    if (key === 'water' || key === 'drain') return d.wet
    if (key === 'vzt') return d.vzt > 0
    if (key === 'heat') return d.heat > 0
    return d.elec > 0
  })
}

// špičkový odběr TUV podle zařizovacích předmětů [l/h] — ne paušál na m²
const TUV_FIXTURE = { shower: 600, basin: 60, kitchen: 120, bar: 120, cleansink: 90 }

/**
 * Koncové větve: z páteře k jednotlivým předmětům. Trasa jde vodorovně pod
 * stropem (u kanalizace u podlahy) nad předmět a pak svisle dolů na napojení.
 */
function terminals(s, svcKey, spineZ, items) {
  const out = []
  for (const it of items) {
    const map = SVC[it.kind]
    if (!map || !map.svc.includes(svcKey)) continue
    const blk = s.blocks.find((b) => b.id === it.block)
    if (!blk) continue
    const lvl = blk.level === 'full' ? 0 : blk.level
    const base = levelBase(s, lvl)

    const full = blk.level === 'full'
    const highY = full ? blockHeight(s, blk) - 0.45 : null

    if (svcKey === 'vzt') {                    // vyústka se napojuje shora
      const y0 = spineY(s, lvl, svcKey)
      const runY = full ? highY : y0
      const r2 = Math.max(0.05, ductRadius(it.flow ?? 200))
      out.push({ service: svcKey, kind: 'terminal', block: it.block, radius: r2,
        points: full
          ? [{ x: it.x, y: y0, z: spineZ }, { x: it.x, y: runY, z: spineZ },
             { x: it.x, y: runY, z: it.z }, { x: it.x, y: it.y, z: it.z }]
          : [{ x: it.x, y: y0, z: spineZ }, { x: it.x, y: runY, z: it.z },
             { x: it.x, y: it.y, z: it.z }] })
      continue
    }
    const hug = svcKey === 'elec' || svcKey === 'data' ? 0.05 : 0.12
    const yLow = svcKey === 'drain' ? base + 0.12 : spineY(s, lvl, svcKey) - hug
    const runY = svcKey === 'drain' ? yLow : (full ? highY : yLow)
    const connY = it.y > base + 0.3 ? it.y : base + (map.conn ?? 0.4)
    const pts = full && svcKey !== 'drain'
      ? [{ x: it.x, y: yLow, z: spineZ }, { x: it.x, y: runY, z: spineZ },
         { x: it.x, y: runY, z: it.z }, { x: it.x, y: connY, z: it.z }]
      : [{ x: it.x, y: runY, z: spineZ }, { x: it.x, y: runY, z: it.z },
         { x: it.x, y: connY, z: it.z }]
    out.push({ service: svcKey, kind: 'terminal', block: it.block, radius: TERMINAL_R[svcKey], points: pts })
  }
  return out
}

/** Kompletní přepočet rozvodů. Vrací trasy k vykreslení a souhrnné dimenze. */
export function computeMEP(s = SPEC) {
  const fitItems = fitoutAll(s).items
  const plant = s.blocks.find((b) => b.type === 'plant')
  const plantX = plant ? (plant.x0 + plant.x1) / 2 : s.stage1 - 2
  const routes = []
  const perService = {}

  for (const svc of SERVICES) {
    const blocks = served(s, svc.key, fitItems)
    if (!blocks.length) continue

    const levels = [...new Set(blocks.map(levelOf))].sort()
    const flowByLevel = {}
    for (const lvl of levels) {
      flowByLevel[lvl] = blocks.filter((b) => levelOf(b) === lvl).reduce((a, b) => a + blockDemand(b).vzt, 0)
    }

    for (const lvl of levels) {
      const y = spineY(s, lvl, svc.key)
      const z = s.spineZ + inward(s) * svc.dz
      const xs = blocks.filter((b) => levelOf(b) === lvl).map((b) => (b.x0 + b.x1) / 2)
      const x0 = Math.min(...xs, plantX)
      const x1 = s.stage1 - 0.4 // páteř končí zaslepená na hranici etapy 2
      const r = svc.r ?? ductRadius(flowByLevel[lvl])

      routes.push({ service: svc.key, kind: 'spine', color: svc.color, radius: r,
        points: [{ x: x0, y, z }, { x: x1, y, z }] })

      for (const b of blocks.filter((bb) => levelOf(bb) === lvl)) {
        const own = fitItems.filter((it) => it.block === b.id && SVC[it.kind]?.svc.includes(svc.key))
        if (own.length) {
          // blok má konkrétní koncovky → vedeme k nim, ne jen doprostřed bloku
          for (const tr of terminals(s, svc.key, z, own)) routes.push({ ...tr, color: svc.color })
          continue
        }
        const t = tapPoint(s, b)
        const br = svc.r ?? ductRadius(blockDemand(b).vzt)
        // v hale s plnou výškou odbočka stoupne hned u páteře a běží nahoře
        const pts = b.level === 'full'
          ? [{ x: t.x, y, z }, { x: t.x, y: t.y, z }, { x: t.x, y: t.y, z: t.z }]
          : [{ x: t.x, y, z }, { x: t.x, y, z: t.z }, { x: t.x, y: t.y, z: t.z }]
        routes.push({ service: svc.key, kind: 'branch', color: svc.color, radius: br, block: b.id, points: pts })
      }
    }

    // stoupačka u strojovny propojující podlaží
    if (levels.length > 1) {
      const z = s.spineZ + inward(s) * svc.dz
      routes.push({ service: svc.key, kind: 'riser', color: svc.color, radius: svc.r ?? ductRadius(flowByLevel[1] ?? 0),
        points: [
          { x: plantX, y: spineY(s, 0, svc.key), z },
          { x: plantX, y: spineY(s, 1, svc.key), z },
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
      tuv: fitItems.reduce((a, it) => a + (TUV_FIXTURE[it.kind] ?? 0), 0),
      wetArea: d.filter((x) => x.wet).reduce((a, x) => a + x.a, 0),
      vztByZone,
    },
  }
}
