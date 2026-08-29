// audit.mjs — projektantská kontrola modelu.
// Spouštět: node audit.mjs            → obě verze budovy
//           node audit.mjs byty       → jen varianta B
// Hledá věci, které testy nehlídají kus po kusu: vzájemné kolize nábytku,
// přesahy přes hranice místností, závěsné předměty v konstrukci, vnější
// plochy v kolizi se vjezdy.
import { levelBase } from './src/spec.js'
import { fitoutAll, FURN } from './src/fitout.js'
import { computeMEP } from './src/mep.js'
import { stairOpening, openingsFor } from './src/building.js'
import { VARIANTS, variantFromArgv } from './src/variants.js'

const dims = (it) => {
  const f = FURN[it.kind]
  const turned = it.rot === 90 || it.rot === 270
  return { hx: (turned ? f.d : f.w) / 2, hz: (turned ? f.w : f.d) / 2, h: f.h }
}

// Dvojice, které se překrývat SMÍ (židle pod stolem, lavička v kleci, auto
// na zvedáku, cokoliv na žíněnce/rohoži, síť a příčka přes cokoli).
const PAIR_OK = new Set([
  'chair|desk', 'chair|hightable', 'chair|reception', 'chair|table', 'chair|rtable', 'chair|mtable', 'chair|partyTable',
  'cage|gymbench', 'car|carlift', 'net|tramp', 'net|softplay', 'foampit|net',
  'bench|glass', 'glass|reception', 'partition|partyTable', 'hoop|tramp',
  'printer3d|workbench',
])
const FLAT = new Set(['mat', 'entrymat', 'floordrain', 'pram'])
const CEIL = new Set(['diffuser', 'light', 'smoke', 'skylight'])
const WALLMOUNT = new Set(['picture', 'mirror', 'screen', 'emlight', 'exitsign',
  'co2', 'firstaid', 'airreel', 'hydrant', 'subboard', 'board', 'aircurtain', 'babychange',
  'sidelight', 'acpanel', 'louvre'])
const pairKey = (a, b) => [a, b].sort().join('|')

function auditSpec(SPEC) {
  const fit = fitoutAll(SPEC)
  const findings = []
  const add = (sev, what) => findings.push({ sev, what })
  const items = fit.items

  // ---------------------------------------------------- 1) vzájemné kolize
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]
      const b = items[j]
      if (a.y !== b.y && Math.abs(a.y - b.y) > 0.5) continue
      if (FLAT.has(a.kind) || FLAT.has(b.kind)) continue
      if (CEIL.has(a.kind) !== CEIL.has(b.kind)) continue
      if (PAIR_OK.has(pairKey(a.kind, b.kind))) continue
      if ((a.kind === 'stairs') !== (b.kind === 'stairs')) continue   // pod schody se chodí
      const da = dims(a)
      const db = dims(b)
      const ox = da.hx + db.hx - Math.abs(a.x - b.x)
      const oz = da.hz + db.hz - Math.abs(a.z - b.z)
      if (ox > 0.06 && oz > 0.06) {
        add('KOLIZE', `${a.kind}@${a.block}(${a.x.toFixed(1)},${a.z.toFixed(1)}) × ${b.kind}@${b.block}(${b.x.toFixed(1)},${b.z.toFixed(1)}) překryv ${ox.toFixed(2)}×${oz.toFixed(2)}`)
      }
    }
  }

  // ------------------------------------- 2) přesah přes hranici místnosti
  for (const it of items) {
    if (it.link || WALLMOUNT.has(it.kind)) continue      // dveře a závěsné na hranici patří
    const b = SPEC.blocks.find((x) => x.id === it.block)
    if (!b) continue
    const d = dims(it)
    const over = Math.max(b.x0 - (it.x - d.hx), (it.x + d.hx) - b.x1,
      b.z0 - (it.z - d.hz), (it.z + d.hz) - b.z1)
    if (over > 0.10) {
      add('PŘESAH', `${it.kind}@${it.block}(${it.x.toFixed(1)},${it.z.toFixed(1)}) přečnívá ${over.toFixed(2)} m z místnosti`)
    }
  }

  // ------------------------------- 3) nic nesmí stát ve vnějších otvorech
  // Vstupy jsou v úrovni podlahy PODLAŽÍ — ve variantě B jsou dveře bytů
  // i v patře (z pavlače), takže se prochází obě úrovně.
  for (const lvl of [0, 1]) {
    const base = levelBase(SPEC, lvl)
    const south = openingsFor(SPEC, 'south').filter((h) => Math.abs(h.v0 - base) < 1e-6)
    for (const it of items) {
      if (it.link || ['door', 'double', 'glazed', 'service', 'escape', 'entrymat', 'sidelight'].includes(it.kind)) continue
      if (Math.abs(it.y - base) > 1.2) continue
      const d = dims(it)
      for (const h of south) {
        if (it.z - d.hz < 0.6 && it.x + d.hx > h.x0 - 0.2 && it.x - d.hx < h.x1 + 0.2 && it.y < base + 1) {
          add('VSTUP', `${it.kind}@${it.block}(${it.x.toFixed(1)},${it.z.toFixed(1)}) stojí ve vnějším vstupu x ${h.x0}–${h.x1}`)
        }
      }
    }
  }

  // -------------------------------- 4) závěsné předměty vs. prostupy schodišť
  const stairs = items.filter((x) => x.kind === 'stairs')
  for (const st of stairs) {
    const o = stairOpening(st, FURN)
    for (const it of items) {
      if (it === st || it.kind === 'railing') continue
      if (!CEIL.has(it.kind) && it.kind !== 'extinguisher') continue
      if (it.y > 1) continue                            // jen přízemní strop
      const d = dims(it)
      if (it.x + d.hx > o.x0 && it.x - d.hx < o.x1 && it.z + d.hz > o.z0 && it.z - d.hz < o.z1) {
        add('PROSTUP', `${it.kind}@${it.block}(${it.x.toFixed(1)},${it.z.toFixed(1)}) visí v prostupu schodiště ${st.block}`)
      }
    }
  }

  // ------------------------------------------------------- 5) rozvody v cestě
  // vesnička (varianta D) MEP model nemá — kontroly 1–4 platí i pro ni
  const mep = SPEC.kind === 'village' ? { routes: [] } : computeMEP(SPEC)
  for (const r of mep.routes.filter((x) => x.kind === 'terminal' || x.kind === 'branch')) {
    for (const st of stairs) {
      const o = stairOpening(st, FURN)
      for (const p of r.points) {
        if (p.x > o.x0 && p.x < o.x1 && p.z > o.z0 && p.z < o.z1 && p.y > 2.95 && p.y < 3.55) {
          add('ROZVOD', `${r.service} větev do ${r.block} prochází prostupem schodiště ${st.block}`)
          break
        }
      }
    }
  }

  return findings
}

const only = variantFromArgv()
const run = only ? [only] : VARIANTS
let total = 0
for (const v of run) {
  const findings = auditSpec(v.spec)
  const bySev = {}
  for (const f of findings) bySev[f.sev] = (bySev[f.sev] || 0) + 1
  console.log(`\n=== AUDIT ${v.label}: ${findings.length} nálezů ===`, JSON.stringify(bySev), '\n')
  for (const f of findings) console.log(` [${f.sev}] ${f.what}`)
  total += findings.length
}
process.exit(total ? 1 : 0)
