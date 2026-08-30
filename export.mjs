// export.mjs — sbalí výkresy jedné varianty do jednoho ZIPu ke stažení.
// Spouštět: node export.mjs nudle
//
// Do balíčku jde: SVG (vektor pro projektanta), PNG (náhledy k prohlížení
// a vkládání do prezentací), 3D pohledy a stručné čtiCTIMNE. PNG se
// generují zvlášť (review-tools/svg2png.mjs), tenhle skript je jen balí.
import { readdirSync, existsSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { VARIANTS, variantById } from './src/variants.js'
import { areaTotals } from './src/spec.js'

const id = process.argv[2] ?? 'nudle'
const v = variantById(id)
if (v.id !== id) {
  console.error(`Neznámá varianta "${id}". Známé: ${VARIANTS.map((x) => x.id).join(', ')}`)
  process.exit(1)
}
const SRC = v.id === VARIANTS[0].id ? 'plans' : `plans/${v.id}`
if (!existsSync(SRC)) {
  console.error(`${SRC} neexistuje — spusť nejdřív: node plans.mjs ${v.id}`)
  process.exit(1)
}

const DATE = new Date().toLocaleDateString('cs-CZ')
const a = areaTotals(v.spec)
const files = readdirSync(SRC).filter((f) => /\.(svg|png)$/.test(f)).sort()
const iso = existsSync(join(SRC, '3d')) ? readdirSync(join(SRC, '3d')).filter((f) => f.endsWith('.png')).sort() : []

// Neúplný balíček je horší než žádný — chybějící PNG nebo 3D pohledy se
// snadno přehlédnou, když se skript pustí bez předchozích dvou kroků.
const svgs = files.filter((f) => f.endsWith('.svg'))
const missingPng = svgs.filter((f) => !files.includes(f.replace(/\.svg$/, '.png')))
if (missingPng.length) {
  console.error(`Chybí PNG k: ${missingPng.join(', ')}\n  → node ../review-tools/svg2png.mjs ${SRC} 2`)
  process.exit(1)
}
if (iso.length === 0) {
  console.error(`Chybí 3D pohledy v ${SRC}/3d\n  → node ../review-tools/shot-iso-hala.mjs URL#${v.id} ${SRC}/3d`)
  process.exit(1)
}

const readme = `BUDOVA 1P — ${v.label}
${v.sub}

Vygenerováno ${DATE} z modelu (src/spec-*.js). NENÍ projektová dokumentace —
je to studie poměrů ploch a dispozice před zadáním projektantovi.

Pozemek: ul. Kouřimského, Pelhřimov. Etapa 1 = 18 × 28 m, rastr 7 m,
okap 6,00 m, hřeben 7,59 m. Podlahová plocha ${Math.round(a.total)} m²
(přízemí ${Math.round(a.gf)}, patro ${Math.round(a.up)}), koeficient ${a.ratio.toFixed(2)}×.

OBSAH
  01-pudorys-prizemi   půdorys přízemí (± 0,000)
  02-pudorys-patro     půdorys patra (+ 3,300)
  03-rez-A-A           podélný řez, rovina z = 6,00 m, pohled k severu
  04-rez-B-B           příčný řez, rovina x = 24,50 m, pohled k západu
  05-situace           situace s obrysem etapy 2
  06-pohled-jih        jižní fasáda — vstupy, vrata, pavlač bytů
  07-pohled-sever      severní fasáda — slepá stěna na hranici pozemku
  08-pohled-vychod     východní průčelí — prosklení po okap
  09-pohled-zapad      západní štít — dočasný, demontovatelný

  Každý výkres je ve dvou formátech:
    .svg  vektor — otevře se v prohlížeči, Illustratoru i AutoCADu, dá se
          tisknout v libovolném měřítku bez ztráty ostrosti
    .png  rastr 2× — rovnou do prezentace, e-mailu nebo Wordu

  3d/    izometrie a kolmé pohledy z 3D modelu (perspektiva, materiály,
         stíny) — nejlíp je z nich vidět rytmus a hloubka oken
         iso-1..4    rohové izometrie (JV, JZ, SZ, SV)
         iso-5       ptačí nadhled
         ext-*       kolmé exteriérové pohledy pro porovnání s 2D
         ext-detail-vstup  detail vstupního portálu

ŽIVÝ MODEL
  http://116.203.103.27:5186/#${v.id}
  Přepínání verzí, řezy obálkou, vrstvy (rozvody, ekonomika) a průchod
  postavou. Výkresy se generují z téhož specu — když se změní model,
  přegeneruje se balíček příkazem: node plans.mjs ${v.id} && node export.mjs ${v.id}
`
writeFileSync(join(SRC, 'CTI-MNE.txt'), readme)

mkdirSync('export', { recursive: true })
const zip = `export/budova-1P-${v.id}-vykresy.zip`
// balí se přes python3 (na serveru není `zip`); zipfile umí rekurzivní adresář
const r = spawnSync('python3', ['-m', 'zipfile', '-c', zip, SRC], { stdio: 'inherit' })
if (r.status) {
  console.error('balení selhalo — chybí python3?')
  process.exit(1)
}
const size = statSync(zip).size / 1e6
console.log(`${zip} — ${files.length} výkresů (SVG+PNG) + ${iso.length} 3D pohledů, ${size.toFixed(1)} MB`)
