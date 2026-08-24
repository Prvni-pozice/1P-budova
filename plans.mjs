// plans.mjs — 2D výkresy (SVG) generované ze SPEC.
//
// Stejné pravidlo jako u zbytku projektu: nic se nekreslí ručně. Půdorysy,
// řezy i situace čtou geometrii z src/spec.js a z generátorů v src/building.js
// (otvory, příčky) a src/fitout.js (vybavení). Když se změní spec, přegeneruje
// se výkres. Spouštět: node plans.mjs   → výstup do plans/
//
// Orientace výkresů (pozor, znaménka se snadno spletou):
//   půdorys + situace = SEVER NAHOŘE, VÝCHOD VPRAVO
//     model má x rostoucí na západ → px = (xmax − x), z rostoucí na sever → py = (zmax − z)
//   řez A–A = pohled k SEVERU  → vpravo je VÝCHOD  (right = forward × up = ẑ × ŷ = −x̂)
//   řez B–B = pohled k ZÁPADU  → vpravo je SEVER   (right = x̂ × ŷ = ẑ)
//
// POZOR: souřadnice v SVG musí mít DESETINNOU TEČKU. num() dělá českou čárku
// pro popisky, na geometrii je co(). Když se to zamění, prohlížeč souřadnici
// utne a celý výkres se sesype do rohu (stalo se).

import { writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { TYPES, area, levelBase, roofY, ridgeY } from './src/spec.js'
import { openingsFor, partitionsFor } from './src/building.js'
import { FURN, fitoutAll } from './src/fitout.js'
import { VARIANTS, variantFromArgv } from './src/variants.js'

// Bez argumentu se vygenerují obě verze — každá ve vlastním procesu, protože
// celý soubor pracuje s jedním modulovým `S`.
const VARIANT = variantFromArgv()
if (!VARIANT) {
  for (const v of VARIANTS) {
    const r = spawnSync(process.execPath, [process.argv[1], v.id], { stdio: 'inherit' })
    if (r.status) process.exit(r.status)
  }
  process.exit(0)
}

const S = VARIANT.spec
const OUT = VARIANT.id === VARIANTS[0].id ? 'plans' : `plans/${VARIANT.id}`
const DATE = '23. 8. 2026'
const LOC = 'Pozemek: ul. Kouřimského, Pelhřimov — nová odbočka mezi Optokonem a Wehou'

// ---------------------------------------------------------------- pomocníci

const co = (n, d = 1) => n.toFixed(d)                       // souřadnice — TEČKA
const num = (n, d = 2) => n.toFixed(d).replace('.', ',')     // popisek — ČÁRKA
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Zesvětlení barvy typu provozu na podklad půdorysu. */
function tint(hex, k) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255
  const m = (c) => Math.round(c + (255 - c) * k)
  return `#${[m(r), m(g), m(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** Otočení půdorysného obdélníku kusu vybavení. rot je ve stupních (viz building.js). */
function corners(cx, cz, w, d, rot) {
  const a = (rot * Math.PI) / 180
  const c = Math.cos(a), s = Math.sin(a)
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
    .map(([u, v]) => [cx + u * c - v * s, cz + u * s + v * c])
}

class Dwg {
  constructor(w, h) { this.w = w; this.h = h; this.b = [] }
  add(s) { this.b.push(s); return this }
  rect(x, y, w, h, cls, extra = '') {
    if (w <= 0 || h <= 0) return this
    return this.add(`<rect x="${co(x)}" y="${co(y)}" width="${co(w)}" height="${co(h)}" class="${cls}" ${extra}/>`)
  }
  line(x1, y1, x2, y2, cls, extra = '') {
    return this.add(`<line x1="${co(x1)}" y1="${co(y1)}" x2="${co(x2)}" y2="${co(y2)}" class="${cls}" ${extra}/>`)
  }
  poly(pts, cls, extra = '') {
    return this.add(`<polygon points="${pts.map((p) => `${co(p[0])},${co(p[1])}`).join(' ')}" class="${cls}" ${extra}/>`)
  }
  circle(x, y, r, extra = '') { return this.add(`<circle cx="${co(x)}" cy="${co(y)}" r="${co(r)}" ${extra}/>`) }
  path(d, cls, extra = '') { return this.add(`<path d="${d}" class="${cls}" ${extra}/>`) }
  text(x, y, s, cls = 'lbl', extra = '') {
    return this.add(`<text x="${co(x)}" y="${co(y)}" class="${cls}" ${extra}>${esc(s)}</text>`)
  }
  toString() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(this.w)}" height="${Math.ceil(this.h)}" viewBox="0 0 ${Math.ceil(this.w)} ${Math.ceil(this.h)}" font-family="Helvetica, Arial, sans-serif">
<style>
  .bg{fill:#ffffff}
  .wall{fill:#2b2f36;stroke:none}
  .walltemp{fill:#8f959d;stroke:#2b2f36;stroke-width:0.7;stroke-dasharray:4 3}
  .glassw{fill:#bcd9e6;stroke:#2b2f36;stroke-width:0.7}
  .part{fill:#5b616a;stroke:none}
  .partfire{fill:#b4544a;stroke:none}
  .room{stroke:none}
  .void{fill:#eceff3;stroke:#9aa1ab;stroke-width:0.8;stroke-dasharray:5 4}
  .furn{fill:#ffffff;fill-opacity:0.55;stroke:#6d747d;stroke-width:0.7}
  .furnkey{fill:#ffffff;fill-opacity:0.75;stroke:#2b2f36;stroke-width:1.1}
  .beyond{fill:#ffffff;fill-opacity:0.5;stroke:#a7adb6;stroke-width:0.7}
  .slab{fill:#7d848d;stroke:#2b2f36;stroke-width:0.6}
  .roof{fill:#4a505a;stroke:none}
  .ground{stroke:#2b2f36;stroke-width:2.2;fill:none}
  .grid{stroke:#c2c8d0;stroke-width:0.8;stroke-dasharray:9 4 2 4;fill:none}
  .dim{stroke:#2b2f36;stroke-width:0.7;fill:none}
  .lead{stroke:#8b929b;stroke-width:0.6;fill:none}
  .door{stroke:#2b2f36;stroke-width:0.9;fill:none}
  .frame{fill:none;stroke:#2b2f36;stroke-width:1.2}
  .thin{fill:none;stroke:#2b2f36;stroke-width:0.8}
  .hatch{fill:none;stroke:#2b2f36;stroke-width:0.7}
  text{fill:#20242a}
  .lbl{font-size:11px}
  .lblsm{font-size:9px;fill:#5b616a}
  .lblrm{font-size:11.5px;font-weight:700}
  .lblar{font-size:9.5px;fill:#4a505a}
  .ttl{font-size:19px;font-weight:700;letter-spacing:0.2px}
  .sub{font-size:11px;fill:#5b616a}
  .axis{font-size:10px;font-weight:700;fill:#2b2f36}
  .dimt{font-size:9.5px;fill:#2b2f36}
  .warn{font-size:9.5px;fill:#a3453c}
</style>
<rect class="bg" x="0" y="0" width="${Math.ceil(this.w)}" height="${Math.ceil(this.h)}"/>
${this.b.join('\n')}
</svg>
`
  }
}

/** Titulkové pole dole. */
function titleBlock(d, { name, note, scaleBar, sc }) {
  const y = d.h - 96
  d.line(40, y, d.w - 40, y, 'frame')
  d.text(40, y + 24, `BUDOVA 1P — studie dispozice, etapa 1 · ${VARIANT.label.toUpperCase()}`, 'ttl')
  d.text(40, y + 42, name, 'sub')
  d.text(40, y + 57, LOC, 'sub')
  d.text(40, y + 72, `Generováno ze src/spec.js · ${DATE} · 18 × 56 m, etapa 1 = 18 × 28 m, rastr 7 m`, 'sub')
  d.text(40, y + 87, 'NENÍ projektová dokumentace — nástroj na hledání poměrů ploch před zadáním projektantovi.', 'warn')
  if (note) d.text(d.w - 40, y + 24, note, 'sub', 'text-anchor="end"')
  if (scaleBar) {
    const bx = d.w - 40 - scaleBar * sc, by = y + 62
    const step = scaleBar / 4
    for (let i = 0; i < 4; i++) d.rect(bx + i * step * sc, by, step * sc, 6, i % 2 ? 'wall' : 'frame')
    d.text(bx, by + 17, '0', 'dimt')
    d.text(bx + scaleBar * sc, by + 17, `${scaleBar} m`, 'dimt', 'text-anchor="end"')
  }
}

function northArrow(d, x, y, r = 15) {
  d.circle(x, y, r, 'fill="#fff" stroke="#2b2f36" stroke-width="1"')
  d.poly([[x, y - r - 5], [x - 4.5, y + r * 0.45], [x, y + r * 0.05], [x + 4.5, y + r * 0.45]], 'wall')
  d.text(x, y - r - 9, 'S', 'axis', 'text-anchor="middle"')
}

/** Kótovací řetězec podél osy. */
function dimChain(d, vals, map, fixed, horizontal) {
  for (let i = 0; i < vals.length - 1; i++) {
    const a = map(vals[i]), b = map(vals[i + 1])
    const t = num(Math.abs(vals[i + 1] - vals[i]), 2)
    if (horizontal) {
      d.line(a, fixed, b, fixed, 'dim')
      d.line(a, fixed - 4, a, fixed + 4, 'dim')
      d.line(b, fixed - 4, b, fixed + 4, 'dim')
      d.text((a + b) / 2, fixed - 5, t, 'dimt', 'text-anchor="middle"')
    } else {
      d.line(fixed, a, fixed, b, 'dim')
      d.line(fixed - 4, a, fixed + 4, a, 'dim')
      d.line(fixed - 4, b, fixed + 4, b, 'dim')
      const my = (a + b) / 2
      d.text(fixed - 6, my, t, 'dimt', `text-anchor="middle" transform="rotate(-90 ${co(fixed - 6)} ${co(my)})"`)
    }
  }
}

/**
 * Popisek místnosti. Zmenší se, když se do místnosti nevejde; když ani to
 * nestačí, zalomí se na pomlčce (Šatna + sprchy — dámy). V úzké místnosti
 * se celý otočí na výšku.
 */
function roomLabel(d, cx, cy, name, sub, wpx) {
  const rot = wpx < 70 ? `transform="rotate(-90 ${co(cx)} ${co(cy)})"` : ''
  let lines = [name]
  let fs = 11.5
  if (!rot) {
    if (name.length * 7.0 > wpx) fs = 9.5
    if (name.length * 5.6 > wpx && name.includes(' — ')) {
      lines = name.split(' — ')
      fs = Math.max(...lines.map((l) => l.length)) * 7.0 > wpx ? 9.5 : 11.5
    } else if (name.length * 5.6 > wpx) fs = 8
  }
  const top = cy - 2 - (lines.length - 1) * fs * 0.55
  lines.forEach((l, i) => d.text(cx, top + i * fs * 1.1, l, 'lblrm',
    `text-anchor="middle" style="font-size:${fs}px" ${rot}`))
  if (sub) {
    d.text(cx, top + (lines.length - 1) * fs * 1.1 + fs, sub, 'lblar',
      `text-anchor="middle" style="font-size:${Math.max(7.5, fs - 2)}px" ${rot}`)
  }
}

/** Vysvětlivky — jeden řádek pod výkresem. */
function legend(d, x, y, entries) {
  let cx = x
  for (const [cls, txt, extra] of entries) {
    d.rect(cx, y - 8, 16, 9, cls, extra ?? '')
    d.text(cx + 21, y, txt, 'lblsm')
    cx += 21 + txt.length * 5.0 + 20
  }
}

// ------------------------------------------------------------------- vstupy

const fit = fitoutAll(S)
const items = fit.items
const parts = partitionsFor(S)
const southHoles = openingsFor(S, 'south')
const RIDGE = ridgeY(S)

// kusy, které v půdorysu jen dělají nepořádek (stropní / zavěšené na stěně)
const SKIP_PLAN = new Set(['light', 'emlight', 'smoke', 'diffuser', 'destrat', 'exitsign', 'skylight',
  'sidelight', 'aircurtain', 'co2', 'entrymat', 'picture', 'mirror', 'board', 'screen',
  'acpanel', 'subboard', 'firstaid', 'hydrant', 'extinguisher', 'coatrack'])
const DOORS = new Set(['door', 'double', 'glazed', 'service'])
const KEY = new Set(['stairs', 'elevator', 'carlift', 'tramp', 'foampit', 'simrig', 'cage',
  'car', 'ahu', 'tank', 'battery', 'bar', 'reception'])
// prochází stropem → musí být v OBOU půdorysech
const THROUGH = new Set(['stairs', 'elevator'])

const blockOf = (id) => S.blocks.find((b) => b.id === id)

// -------------------------------------------------------------- PŮDORYSY

function plan(level, file, name) {
  const SC = 27, ML = 96, MR = 165, MT = 92
  const W = S.stage1 * SC + ML + MR
  const H = S.depth * SC + MT + 250
  const d = new Dwg(W, H)
  const X = (x) => ML + (S.stage1 - x) * SC          // východ vpravo
  const Y = (z) => MT + (S.depth - z) * SC           // sever nahoře
  const cutH = levelBase(S, level) + 1.2

  const inLevel = (b) => (level === 0 ? b.level === 0 || b.level === 'full' : b.level === 1)

  // --- plochy místností
  for (const b of S.blocks.filter(inLevel)) {
    d.rect(X(b.x1), Y(b.z1), (b.x1 - b.x0) * SC, (b.z1 - b.z0) * SC, 'room',
      `fill="${tint(TYPES[b.type].color, b.fitout === 'shell' ? 0.9 : 0.8)}"`)
  }
  // v patře: dvouprostory (aréna, dílna) jako prostup
  if (level === 1) {
    for (const b of S.blocks.filter((x) => x.level === 'full')) {
      d.rect(X(b.x1), Y(b.z1), (b.x1 - b.x0) * SC, (b.z1 - b.z0) * SC, 'void')
      for (const c of S.blocks.filter((u) => u.level === 1 && u.x0 < b.x1 && u.x1 > b.x0 && u.z0 < b.z1 && u.z1 > b.z0)) {
        d.rect(X(Math.min(c.x1, b.x1)), Y(Math.min(c.z1, b.z1)),
          (Math.min(c.x1, b.x1) - Math.max(c.x0, b.x0)) * SC,
          (Math.min(c.z1, b.z1) - Math.max(c.z0, b.z0)) * SC, 'room',
          `fill="${tint(TYPES[c.type].color, 0.8)}"`)
      }
      d.text(X((b.x0 + b.x1) / 2), Y(b.z0 + 2.2), `${b.name} — otevřeno přes 2 podlaží`, 'lblsm', 'text-anchor="middle"')
    }
  }

  // --- rastr nosných rámů
  for (let i = 0; i <= S.stage1 / S.grid; i++) {
    const x = i * S.grid
    d.line(X(x), MT - 32, X(x), Y(0) + 20, 'grid')
    d.circle(X(x), MT - 42, 10, 'fill="#fff" stroke="#2b2f36" stroke-width="1"')
    d.text(X(x), MT - 38, String(i + 1), 'axis', 'text-anchor="middle"')
  }
  for (const [z, t] of [[0, 'A'], [S.depth, 'B']]) {
    d.circle(X(0) + 46, Y(z), 10, 'fill="#fff" stroke="#2b2f36" stroke-width="1"')
    d.text(X(0) + 46, Y(z) + 4, t, 'axis', 'text-anchor="middle"')
  }

  // --- obvodový plášť
  const t = S.wall
  d.rect(X(S.stage1), Y(S.depth), S.stage1 * SC, t * SC, 'wall')             // sever — slepá
  d.rect(X(S.stage1), Y(t), S.stage1 * SC, t * SC, 'wall')                   // jih
  d.rect(X(t), Y(S.depth), t * SC, S.depth * SC, 'glassw')                   // východ — prosklení
  d.rect(X(S.stage1), Y(S.depth), t * SC, S.depth * SC, 'walltemp')          // západ — dočasný štít
  for (let z = 1.5; z < S.depth; z += 1.5) d.line(X(t), Y(z), X(0), Y(z), 'thin')

  for (const h of southHoles.filter((o) => o.v0 < cutH && o.v1 > cutH)) {
    d.rect(X(h.x1), Y(t), (h.x1 - h.x0) * SC, t * SC, 'room', 'fill="#ffffff"')
    if (h.v0 === 0) {
      d.line(X(h.x0), Y(t), X(h.x0), Y(0), 'thin')
      d.line(X(h.x1), Y(t), X(h.x1), Y(0), 'thin')
    } else {
      d.line(X(h.x0), Y(t / 2), X(h.x1), Y(t / 2), 'thin')
    }
  }

  // --- příčky v rovině řezu
  for (const p of parts.filter((q) => q.base < cutH && q.top > cutH)) {
    const th = p.fire ? 0.2 : 0.1
    const cls = p.fire ? 'partfire' : 'part'
    const spans = []
    let cur = p.from
    for (const [g0, g1] of [...p.gaps].sort((a, b) => a[0] - b[0])) {
      if (g0 > cur + 0.02) spans.push([cur, g0])
      cur = Math.max(cur, g1)
    }
    if (cur < p.to - 0.02) spans.push([cur, p.to])
    for (const [a, b] of spans) {
      if (p.axis === 'z') d.rect(X(p.at + th / 2), Y(b), th * SC, (b - a) * SC, cls)
      else d.rect(X(b), Y(p.at + th / 2), (b - a) * SC, th * SC, cls)
    }
  }

  // --- vybavení
  const onLevel = (it) => {
    const b = blockOf(it.block)
    if (!b) return false
    if (level === 0) return b.level === 0 || (b.level === 'full' && it.y < 1.5)
    return b.level === 1 || (b.level === 'full' && it.y >= 1.5) || THROUGH.has(it.kind)
  }
  for (const it of items) {
    if (!onLevel(it) || SKIP_PLAN.has(it.kind) || DOORS.has(it.kind)) continue
    const f = FURN[it.kind]
    if (!f) continue
    d.poly(corners(it.x, it.z, f.w, f.d, it.rot ?? 0).map(([x, z]) => [X(x), Y(z)]),
      KEY.has(it.kind) ? 'furnkey' : 'furn')
  }
  // schodiště — stupně
  for (const it of items.filter((i) => i.kind === 'stairs' && onLevel(i))) {
    const f = FURN.stairs
    const rad = ((it.rot ?? 0) * Math.PI) / 180
    const c = Math.cos(rad), s = Math.sin(rad)
    for (let i = 1; i < 14; i++) {
      const v = -f.d / 2 + (i * f.d) / 14
      const q = (u) => [it.x + u * c - v * s, it.z + u * s + v * c]
      const [x1, z1] = q(-f.w / 2), [x2, z2] = q(f.w / 2)
      d.line(X(x1), Y(z1), X(x2), Y(z2), 'door')
    }
  }
  // dveře — křídlo + oblouk
  for (const it of items) {
    if (!DOORS.has(it.kind) || !onLevel(it)) continue
    const f = FURN[it.kind]
    const rad = ((it.rot ?? 0) * Math.PI) / 180
    const c = Math.cos(rad), s = Math.sin(rad)
    const hw = f.w / 2
    const p1 = [it.x - hw * c, it.z - hw * s]
    const p2 = [it.x + hw * c, it.z + hw * s]
    const sw = [p1[0] - f.w * s, p1[1] + f.w * c]
    d.line(X(p1[0]), Y(p1[1]), X(sw[0]), Y(sw[1]), 'door')
    d.path(`M ${co(X(sw[0]))} ${co(Y(sw[1]))} A ${co(f.w * SC)} ${co(f.w * SC)} 0 0 0 ${co(X(p2[0]))} ${co(Y(p2[1]))}`,
      'door', 'stroke-dasharray="3 2"')
  }

  // --- popisky místností
  for (const b of S.blocks.filter(inLevel)) {
    const cx = X((b.x0 + b.x1) / 2)
    const cy = b.id === 'arena' ? Y(9) : Y((b.z0 + b.z1) / 2)
    roomLabel(d, cx, cy, b.name, `${num(area(b), 1)} m²${b.fitout === 'shell' ? ' · shell' : ''}`, (b.x1 - b.x0) * SC)
  }

  // --- kóty
  dimChain(d, [0, 7, 14, 21, 28], X, Y(0) + 56, true)
  dimChain(d, [0, 28], X, Y(0) + 82, true)
  dimChain(d, [0, S.depth], Y, X(0) + 90, false)

  // --- světové strany
  d.text(X(S.stage1 / 2), Y(0) + 34, 'JIH — všechny vstupy a vjezdy', 'lblsm', 'text-anchor="middle"')
  d.text(X(S.stage1 / 2), Y(S.depth) - 12, 'SEVER — hranice pozemku, slepá stěna bez otvorů', 'lblsm', 'text-anchor="middle"')
  d.text(X(0) + 8, MT - 12, 'VÝCHOD — prosklené průčelí', 'lblsm', 'text-anchor="end"')
  d.text(X(S.stage1) - 8, MT - 12, 'ZÁPAD — dočasný štít (etapa 2)', 'lblsm')

  // --- stopy řezů
  if (level === 0) {
    const zA = 6.0, xB = 24.5
    d.line(X(S.stage1) - 34, Y(zA), X(0) + 22, Y(zA), 'dim', 'stroke-dasharray="12 4 3 4" stroke-width="1.4"')
    d.text(X(0) + 26, Y(zA) - 5, 'A', 'axis')
    d.text(X(S.stage1) - 38, Y(zA) - 5, 'A', 'axis', 'text-anchor="end"')
    d.line(X(xB), MT - 24, X(xB), Y(0) + 22, 'dim', 'stroke-dasharray="12 4 3 4" stroke-width="1.4"')
    d.text(X(xB) + 5, MT - 26, 'B', 'axis')
    d.text(X(xB) + 5, Y(0) + 34, 'B', 'axis')
  }

  northArrow(d, ML - 46, MT + 22)
  legend(d, ML, Y(0) + 124, [
    ['wall', 'obvodový plášť', ''],
    ['part', 'příčka', ''],
    ['partfire', 'požárně dělicí konstrukce', ''],
    ['glassw', 'prosklení', ''],
    ['walltemp', 'dočasný štít', ''],
    ...(level === 1 ? [['void', 'prostor přes 2 podlaží', '']] : []),
  ])
  titleBlock(d, {
    name: `${name} · vodorovný řez v úrovni +${num(cutH, 2)} m`,
    note: level === 0 ? 'přízemí 504 m² · světlá výška 3,00 m' : 'patro 308 m² · světlá výška 2,70 m',
    scaleBar: 10, sc: SC,
  })
  writeFileSync(`${OUT}/${file}`, d.toString())
  return file
}

// ---------------------------------------------------------------- ŘEZ A–A

function sectionA() {
  const SC = 27, ML = 96, MR = 285, MT = 76
  const HMAX = 9.2
  const W = S.stage1 * SC + ML + MR
  const H = HMAX * SC + MT + 250
  const d = new Dwg(W, H)
  const CUT = 6.0
  const X = (x) => ML + (S.stage1 - x) * SC
  const Yp = (y) => MT + (HMAX - y) * SC
  const yRoof = roofY(S, CUT)

  // pohled za rovinou řezu (z > CUT)
  for (const it of items) {
    if (it.z <= CUT || SKIP_PLAN.has(it.kind)) continue
    const f = FURN[it.kind]
    if (!f) continue
    const rad = ((it.rot ?? 0) * Math.PI) / 180
    const wx = Math.abs(f.w * Math.cos(rad)) + Math.abs(f.d * Math.sin(rad))
    d.rect(X(it.x + wx / 2), Yp(it.y + f.h), wx * SC, f.h * SC, 'beyond')
  }
  d.rect(X(S.stage1), Yp(S.eaves), S.stage1 * SC, S.eaves * SC, 'beyond', 'fill-opacity="0.2"')

  d.rect(X(S.stage1), Yp(0), S.stage1 * SC, 0.2 * SC, 'slab')
  d.line(X(S.stage1) - 40, Yp(-0.2), X(0) + 40, Yp(-0.2), 'ground')

  d.rect(X(S.wall), Yp(S.eaves), S.wall * SC, S.eaves * SC, 'glassw')
  d.rect(X(S.stage1), Yp(yRoof), S.wall * SC, yRoof * SC, 'walltemp')
  d.rect(X(S.stage1 + 0.4), Yp(yRoof + 0.18), (S.stage1 + 0.8) * SC, 0.18 * SC, 'roof')

  for (const b of S.blocks.filter((x) => x.level === 1 && x.z0 <= CUT && x.z1 >= CUT)) {
    d.rect(X(b.x1), Yp(S.clearGF + S.slab), (b.x1 - b.x0) * SC, S.slab * SC, 'slab')
  }
  for (const p of parts.filter((q) => q.axis === 'z' && q.from <= CUT && q.to >= CUT)) {
    const th = p.fire ? 0.2 : 0.1
    d.rect(X(p.at + th / 2), Yp(p.top), th * SC, (p.top - p.base) * SC, p.fire ? 'partfire' : 'part')
  }

  const label = (x, y, t1, t2) => {
    d.text(X(x), Yp(y), t1, 'lblrm', 'text-anchor="middle"')
    if (t2) d.text(X(x), Yp(y) + 12, t2, 'lblar', 'text-anchor="middle"')
  }
  label(3.5, 1.1, 'Komunitní prostor', 'sv. v. 3,00')
  label(10.5, 1.1, 'Lobby / recepce / bar', 'sv. v. 3,00')
  label(17.5, 2.4, 'Jump aréna', 'přes 2 podlaží · 6,00–7,06')
  label(24.5, 2.4, 'Sdílená dílna', 'přes 2 podlaží · 6,00–7,06')
  label(2.9, 4.5, 'Rezerva k pronájmu', 'shell · sv. v. 2,70')
  label(8.5, 4.5, 'Schodišťové jádro', 'výstup do chodby')
  label(12.0, 4.5, 'Fitness', 'volné váhy · sv. v. 2,70')
  d.text(X(6.4), Yp(5.4), 'chodba', 'lblar', 'text-anchor="middle"')

  // výškové kóty vpravo
  const xd = X(0) + 40
  const lvls = [[0, '± 0,000 — podlaha přízemí'], [S.clearGF, '+ 3,000 — podhled přízemí'],
    [S.clearGF + S.slab, '+ 3,300 — podlaha patra'], [S.eaves, '+ 6,000 — okap'],
    [yRoof, `+ ${num(yRoof, 3)} — podhled střechy v rovině řezu`]]
  lvls.forEach(([y, t], i) => {
    const ty = Yp(y) + (i === 1 ? 9 : i === 2 ? -3 : 3.5)
    d.line(X(0), Yp(y), xd - 4, Yp(y), 'lead')
    d.circle(xd, Yp(y), 2.4, 'fill="#2b2f36"')
    d.text(xd + 6, ty, t, 'dimt')
  })

  for (let i = 0; i <= S.stage1 / S.grid; i++) {
    const x = i * S.grid
    d.line(X(x), MT - 24, X(x), Yp(-0.2), 'grid')
    d.circle(X(x), MT - 34, 10, 'fill="#fff" stroke="#2b2f36" stroke-width="1"')
    d.text(X(x), MT - 30, String(i + 1), 'axis', 'text-anchor="middle"')
  }
  dimChain(d, [0, 7, 14, 21, 28], X, Yp(-0.2) + 46, true)
  dimChain(d, [0, 28], X, Yp(-0.2) + 72, true)

  d.text(X(S.stage1) - 4, MT - 6, 'ZÁPAD', 'lblsm')
  d.text(X(0) + 4, MT - 6, 'VÝCHOD', 'lblsm', 'text-anchor="end"')

  legend(d, ML, Yp(-0.2) + 116, [
    ['slab', 'řezaná konstrukce (deska)', ''],
    ['part', 'řezaná příčka', ''],
    ['partfire', 'požárně dělicí', ''],
    ['beyond', 'pohled za rovinou řezu', ''],
  ])
  titleBlock(d, {
    name: 'ŘEZ A–A · podélný, rovina z = 6,00 m od jižní stěny, pohled k severu',
    note: 'aréna a dílna přes dvě podlaží · vestavěné patro nad lobby a kancelářemi',
    scaleBar: 10, sc: SC,
  })
  writeFileSync(`${OUT}/03-rez-A-A.svg`, d.toString())
  return '03-rez-A-A.svg'
}

// ---------------------------------------------------------------- ŘEZ B–B

function sectionB() {
  const SC = 30, ML = 110, MR = 250, MT = 76
  const HMAX = 9.2
  const W = S.depth * SC + ML + MR
  const H = HMAX * SC + MT + 250
  const d = new Dwg(W, H)
  const CUT = 24.5
  const X = (z) => ML + z * SC                      // pohled k západu → sever vpravo
  const Yp = (y) => MT + (HMAX - y) * SC

  for (const it of items) {
    if (it.x <= CUT || SKIP_PLAN.has(it.kind)) continue
    const f = FURN[it.kind]
    if (!f) continue
    const rad = ((it.rot ?? 0) * Math.PI) / 180
    const wz = Math.abs(f.d * Math.cos(rad)) + Math.abs(f.w * Math.sin(rad))
    d.rect(X(it.z - wz / 2), Yp(it.y + f.h), wz * SC, f.h * SC, 'beyond')
  }
  d.poly([[X(0), Yp(S.eaves)], [X(S.depth / 2), Yp(RIDGE)], [X(S.depth), Yp(S.eaves)],
    [X(S.depth), Yp(0)], [X(0), Yp(0)]], 'beyond', 'fill-opacity="0.2"')

  d.rect(X(0), Yp(0), S.depth * SC, 0.2 * SC, 'slab')
  d.line(X(0) - 40, Yp(-0.2), X(S.depth) + 40, Yp(-0.2), 'ground')

  d.rect(X(0), Yp(S.eaves), S.wall * SC, S.eaves * SC, 'wall')
  d.rect(X(S.depth - S.wall), Yp(S.eaves), S.wall * SC, S.eaves * SC, 'wall')
  for (const h of southHoles.filter((o) => o.x0 <= CUT && o.x1 >= CUT)) {
    d.rect(X(0), Yp(h.v1), S.wall * SC, (h.v1 - h.v0) * SC, 'room',
      'fill="#ffffff" stroke="#2b2f36" stroke-width="0.8"')
  }

  const dz = 0.18 / Math.cos((S.pitch * Math.PI) / 180)
  d.poly([[X(-0.4), Yp(roofY(S, -0.4))], [X(S.depth / 2), Yp(RIDGE)], [X(S.depth + 0.4), Yp(roofY(S, S.depth + 0.4))],
    [X(S.depth + 0.4), Yp(roofY(S, S.depth + 0.4) + dz)], [X(S.depth / 2), Yp(RIDGE + dz)],
    [X(-0.4), Yp(roofY(S, -0.4) + dz)]], 'roof')

  for (const b of S.blocks.filter((x) => x.level === 1 && x.x0 <= CUT && x.x1 >= CUT)) {
    d.rect(X(b.z0), Yp(S.clearGF + S.slab), (b.z1 - b.z0) * SC, S.slab * SC, 'slab')
  }
  for (const p of parts.filter((q) => q.axis === 'x' && q.from <= CUT && q.to >= CUT)) {
    const th = p.fire ? 0.2 : 0.1
    d.rect(X(p.at - th / 2), Yp(p.top), th * SC, (p.top - p.base) * SC, p.fire ? 'partfire' : 'part')
  }

  const label = (z, y, t1, t2) => {
    d.text(X(z), Yp(y), t1, 'lblrm', 'text-anchor="middle"')
    if (t2) d.text(X(z), Yp(y) + 12, t2, 'lblar', 'text-anchor="middle"')
  }
  label(6.5, 5.6, 'Sdílená dílna', 'přes 2 podlaží')
  label(15.5, 1.1, 'Sklad', 'sv. v. 3,00')
  label(15.5, 4.2, 'Technická místnost', 'sv. v. 2,70')

  // světlá výška nad zvedákem
  const zc = 2.4
  d.line(X(zc), Yp(0), X(zc), Yp(4.2), 'dim', 'stroke-dasharray="4 3"')
  d.line(X(zc) - 22, Yp(4.2), X(zc) + 22, Yp(4.2), 'dim')
  d.text(X(zc) + 26, Yp(4.2) - 5, 'min. 4,20 nad zvedákem', 'dimt')
  d.text(X(zc) + 26, Yp(4.2) + 6, '(nad tím nesmí být mezipatro)', 'dimt')

  const xd = X(S.depth) + 40
  for (const [y, t] of [[0, '± 0,000 — podlaha přízemí'], [S.clearGF + S.slab, '+ 3,300 — podlaha patra'],
    [S.eaves, '+ 6,000 — okap'], [RIDGE, `+ ${num(RIDGE, 3)} — hřeben`]]) {
    d.line(X(S.depth), Yp(y), xd - 4, Yp(y), 'lead')
    d.circle(xd, Yp(y), 2.4, 'fill="#2b2f36"')
    d.text(xd + 6, Yp(y) + 3.5, t, 'dimt')
  }

  dimChain(d, [0, 9, 18], X, Yp(-0.2) + 46, true)
  dimChain(d, [0, 18], X, Yp(-0.2) + 72, true)
  d.text(X(0) - 6, MT - 6, 'JIH — vstupy a vrata', 'lblsm', 'text-anchor="end"')
  d.text(X(S.depth) + 6, MT - 6, 'SEVER — slepá stěna', 'lblsm')
  d.text(X(S.depth / 2), Yp(RIDGE) - 14, `sedlová střecha, sklon 10° · okap 6,00 · hřeben ${num(RIDGE, 2)}`,
    'lblsm', 'text-anchor="middle"')

  legend(d, ML, Yp(-0.2) + 116, [
    ['wall', 'řezaný plášť', ''],
    ['slab', 'řezaná deska', ''],
    ['roof', 'střešní plášť', ''],
    ['beyond', 'pohled za rovinou řezu', ''],
  ])
  titleBlock(d, {
    name: 'ŘEZ B–B · příčný, rovina x = 24,50 m od východního průčelí, pohled k západu',
    note: 'dílna přes 2 podlaží · sklad a technická místnost nad sebou',
    scaleBar: 10, sc: SC,
  })
  writeFileSync(`${OUT}/04-rez-B-B.svg`, d.toString())
  return '04-rez-B-B.svg'
}

// ----------------------------------------------------------------- SITUACE

function site() {
  const SC = 11.5, ML = 80, MR = 130, MT = 80
  const xmin = -4, xmax = 60, zmin = -16, zmax = 23
  const W = (xmax - xmin) * SC + ML + MR
  const H = (zmax - zmin) * SC + MT + 200
  const d = new Dwg(W, H)
  const X = (x) => ML + (xmax - x) * SC
  const Y = (z) => MT + (zmax - z) * SC

  // zpevněná plocha na jihu
  d.rect(X(41), Y(0), 42 * SC, 10 * SC, 'room', 'fill="#eceef1"')

  // etapa 2 — obrys
  d.rect(X(S.length), Y(S.depth), (S.length - S.stage1) * SC, S.depth * SC, 'void')
  d.text(X((S.stage1 + S.length) / 2), Y(10.4), 'ETAPA 2', 'lblrm', 'text-anchor="middle"')
  d.text(X((S.stage1 + S.length) / 2), Y(9.2), '28 × 18 m = 504 m² · doporučeno rozšíření arény', 'lblar', 'text-anchor="middle"')
  d.text(X((S.stage1 + S.length) / 2), Y(8.2), '(obrys — zatím nestaví se)', 'lblsm', 'text-anchor="middle"')

  // etapa 1
  d.rect(X(S.stage1), Y(S.depth), S.stage1 * SC, S.depth * SC, 'room', 'fill="#ccd2d9"')
  d.rect(X(S.stage1), Y(S.depth), S.stage1 * SC, S.depth * SC, 'frame')
  d.line(X(S.stage1), Y(S.depth / 2), X(0), Y(S.depth / 2), 'dim', 'stroke-dasharray="8 4"')
  d.text(X(14), Y(12.6), 'ETAPA 1', 'lblrm', 'text-anchor="middle"')
  d.text(X(14), Y(11.5), '504 m² zastavěné · 812 m² podlažní plochy', 'lblar', 'text-anchor="middle"')
  d.text(X(14), Y(10.5), 'sedlová střecha 10°, okap 6,0 m, hřeben v ose (čerchovaně)', 'lblsm', 'text-anchor="middle"')
  d.text(X(14), Y(6.6), 'FVE jižní střešní rovina 38,9 kWp · fasáda 1,7 kWp', 'lblsm', 'text-anchor="middle"')
  d.text(X(14), Y(5.5), 'severní rovina vypnutá — rozhodnutí otevřené', 'lblsm', 'text-anchor="middle"')

  // hranice pozemku na severu
  d.line(X(S.length + 3), Y(S.depth), X(-3), Y(S.depth), 'frame', 'stroke-width="2.6"')
  for (let x = -3; x < S.length + 3; x += 2) d.line(X(x), Y(S.depth), X(x + 1.4), Y(S.depth + 1.6), 'hatch')
  d.text(X(S.length / 2), Y(S.depth) - 28, 'HRANICE POZEMKU — soused, průmyslová zóna · severní stěna slepá, bez otvorů',
    'lblsm', 'text-anchor="middle"')

  // parkovací stání
  const bay = (x, w, dis) => d.rect(X(x + w / 2), Y(-4.0), w * SC, 5 * SC, 'room',
    `fill="${dis ? '#9cc2e0' : '#c9ced5'}" stroke="#5b616a" stroke-width="0.7"`)
  for (let i = 0; i < 3; i++) bay(1.7 + i * 2.6, 2.4, false)
  bay(9.55, 3.4, true); bay(13.15, 3.4, true)
  for (let i = 0; i < 2; i++) bay(16.4 + i * 2.6, 2.4, false)
  for (let i = 0; i < 4; i++) bay(29.7 + i * 2.6, 2.4, false)
  d.text(X(11.35), Y(-6.3), 'BF', 'axis', 'text-anchor="middle"')
  d.text(X(9.5), Y(-9.6), '7 stání u etapy 1, z toho 2 bezbariérová (3,4 m)', 'lblsm', 'text-anchor="middle"')
  d.text(X(33.6), Y(-9.6), '4 stání na ploše etapy 2', 'lblsm', 'text-anchor="middle"')

  // vjezd k vratům dílny
  d.rect(X(28.5), Y(0), 7.5 * SC, 9 * SC, 'room', 'fill="#dfe3e8" stroke="#8b929b" stroke-width="0.8" stroke-dasharray="5 4"')
  d.text(X(24.75), Y(-7.0), 'vjezd k vratům', 'lblsm', 'text-anchor="middle"')

  // vstupy z jihu — popisky se střídají ve dvou výškách, ať se nepřekrývají
  const arrow = (x, txt, lvl) => {
    const zt = lvl ? -3.4 : -1.9
    d.line(X(x), Y(zt - 0.5), X(x), Y(-0.3), 'dim', 'stroke-width="1.5"')
    d.poly([[X(x), Y(0)], [X(x) - 4, Y(-1.0)], [X(x) + 4, Y(-1.0)]], 'wall')
    d.text(X(x), Y(zt) + 10, txt, 'lblsm', 'text-anchor="middle"')
  }
  arrow(10.5, 'hlavní vstup', 0)
  arrow(14.9, 'únik z arény', 1)
  arrow(22.0, 'personál dílny', 0)
  arrow(25.2, 'vrata 4,0 × 4,0 m', 1)

  // venkovní prvky
  d.rect(X(6.6 + 1.2), Y(-1.05), 2.4 * SC, 1.1 * SC, 'furnkey')
  d.text(X(4.6), Y(-2.0), 'odpad', 'lblsm')
  d.rect(X(37), Y(-3.5), 6 * SC, 3 * SC, 'room', 'fill="#a9c6d8" stroke="#2b2f36" stroke-width="0.8"')
  d.text(X(34), Y(-7.0), 'retence dešťovky', 'lblsm', 'text-anchor="middle"')
  d.circle(X(25), Y(-3), 0.7 * SC, 'fill="#cfcfae" stroke="#2b2f36" stroke-width="0.8"')
  d.text(X(25) + 18, Y(-3) + 3, 'lapol (dílna)', 'lblsm')

  // kóty — pod zpevněnou plochou, ne přes budovu
  dimChain(d, [0, 28, 56], X, Y(-11.5), true)
  dimChain(d, [0, 56], X, Y(-13.4), true)
  dimChain(d, [0, S.depth], Y, X(0) + 52, false)

  d.text(X(S.length / 2), Y(-15.2), 'Hranice pozemku mimo severní stranu nejsou součástí modelu — doplnit z katastru.',
    'warn', 'text-anchor="middle"')

  northArrow(d, ML - 34, MT + 22)
  legend(d, ML, Y(zmin) + 42, [
    ['room', 'etapa 1 — zastavěno', 'fill="#ccd2d9" stroke="#2b2f36" stroke-width="0.8"'],
    ['void', 'etapa 2 — obrys', ''],
    ['room', 'parkování', 'fill="#c9ced5" stroke="#5b616a" stroke-width="0.7"'],
    ['room', 'bezbariérové stání', 'fill="#9cc2e0" stroke="#5b616a" stroke-width="0.7"'],
    ['room', 'retence dešťovky', 'fill="#a9c6d8" stroke="#2b2f36" stroke-width="0.8"'],
  ])
  titleBlock(d, {
    name: 'SITUACE · etapa 1 + obrys etapy 2, celkem 18 × 56 m = 1 008 m² zastavěné plochy',
    note: 'sever nahoře · východ vpravo',
    scaleBar: 20, sc: SC,
  })
  writeFileSync(`${OUT}/05-situace.svg`, d.toString())
  return '05-situace.svg'
}

// -------------------------------------------------------------------- běh

mkdirSync(OUT, { recursive: true })
const made = [
  plan(0, '01-pudorys-prizemi.svg', 'PŮDORYS PŘÍZEMÍ (± 0,000)'),
  plan(1, '02-pudorys-patro.svg', 'PŮDORYS PATRA (+ 3,300)'),
  sectionA(),
  sectionB(),
  site(),
]
console.log(`${VARIANT.label}:`)
console.log(made.map((f) => `  ${OUT}/${f}`).join('\n'))
