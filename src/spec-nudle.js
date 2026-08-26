// spec-nudle.js — VARIANTA C: nudlové byty 3+kk napříč celou hloubkou haly.
//
// Zadání (26. 8. 2026): byty v patře jako „nudle" přes celý rozpon 18 m.
// Od jihu: vstup s malou předsíní, vedle průchozí obývák s kuchyňským
// koutem, za kuchyní WC a koupelna, pak šatní místnost, ložnice a na
// severním konci dětský pokoj. Podél WC/koupelny/šatny/ložnice chodba
// se skříněmi — 1,8 m (0,6 skříně + 1,2 m průchod; 1,5 m by nechalo
// průchod jen 0,9).
//
// Dvě věci, které z konceptu haly plynou:
//  - Okno na sever NEJDE — severní stěna je slepá (hranice pozemku).
//    Dětský pokoj a ložnice mají STŘEŠNÍ OKNA v severní rovině střechy:
//    stálé difuzní světlo bez oslnění a žádná kolize s FVE (ta je jen
//    na jižní rovině).
//  - Nudle funguje JEN V PATŘE. V přízemí je nad ložnicí a dětským
//    pokojem strop patra, střešní okno tam nedosáhne — místnosti by
//    zůstaly bez denního světla. Přízemí proto zůstává jako ve verzi B
//    (2 byty 2+kk s okny na jih + fitness, sim, rezerva).
//
// Pole x 7–21 (14 m) / 3 = tři nudle à ~4,67 m; 4,67 × 18 = ~84 m² (3+kk).
// Byty A a C jsou zrcadlené tak, aby se koupelnové pruhy A|B potkaly zády
// k sobě na společné stěně → dvě stoupačky na tři byty (třetí byt má
// vlastní u stěny dílny). Nájem 15 500 Kč/měs za 3+kk — ODHAD.
//
// Řez jednou nudlí (od jihu, chodbový pruh 1,8 m + pokojový pruh ~2,87 m):
//   z 0–2      předsíň (chodbový pruh, vstup z pavlače) | obývák u okna
//   z 0–6,2    obývák + KK (oba pruhy, openPair — jedna místnost)
//   z 6,2–7,5  WC          | chodba se skříněmi (z 6,2–14,2)
//   z 7,5–9,5  koupelna    |
//   z 9,5–11   šatna       |
//   z 11–14,2  ložnice ⌂   |
//   z 14,2–18  dětský pokoj ⌂⌂ (celá šířka, u slepé severní stěny)

import { SPEC_BYTY, TYPES } from './spec-byty.js'

export { TYPES }

const CH = 1.8                          // šířka chodbového pruhu
const RENT_NUDLE = 15500 * 12           // ODHAD: 3+kk 84 m², Pelhřimov

/**
 * Jedna nudle. X0..X1 je pole bytu, mirror = chodbový pruh na západě
 * (u zrcadlených bytů A a C), jinak na východě.
 */
function nudle(letter, X0, X1, mirror) {
  const W = X1 - X0
  const p = `n${letter}`
  // pokojový a chodbový pruh v absolutních souřadnicích
  const rooms = mirror ? [X0 + CH, X1] : [X0, X1 - CH]
  const chodba = mirror ? [X0, X0 + CH] : [X1 - CH, X1]
  const cx = (chodba[0] + chodba[1]) / 2

  const B = (id, name, type, [x0, x1], z0, z1, extra = {}) => ({
    id: `${p}-${id}`, name: `${name} — byt ${letter}`,
    type, level: 1, mirror, x0, x1, z0, z1, flat: letter,
    ...extra,
  })
  const blocks = [
    B('hall',   'Předsíň',          'flat', chodba, 0,    2,    { layout: 'nudle-hall', entry: true }),
    B('livw',   'Obývací pokoj',    'flat', chodba, 2,    6.2,  { layout: 'nudle-livw' }),
    B('liv',    'Obývák + KK',      'flat', rooms,  0,    6.2,  { layout: 'nudle-liv' }),
    B('corr',   'Chodba se skříněmi', 'flat', chodba, 6.2, 14.2, { layout: 'nudle-corr' }),
    B('wc',     'WC',               'wet',  rooms,  6.2,  7.5,  { layout: 'nudle-wc' }),
    B('bath',   'Koupelna',         'wet',  rooms,  7.5,  9.5,  { layout: 'nudle-bath' }),
    B('shatna', 'Šatna',            'flat', rooms,  9.5,  11,   { layout: 'nudle-shatna' }),
    B('bed',    'Ložnice',          'flat', rooms,  11,   14.2, { layout: 'nudle-bed' }),
    B('kid',    'Dětský pokoj',     'flat', [X0, X1], 14.2, 18, { layout: 'nudle-kid' }),
  ]
  const links = [
    // vodorovné hrany (osa x) → `at` je souřadnice x = střed chodbového pruhu
    { a: `${p}-hall`, b: `${p}-livw`, type: 'door', at: cx,    note: `byt ${letter}: z předsíně do obýváku` },
    { a: `${p}-livw`, b: `${p}-corr`, type: 'door', at: cx,    note: `byt ${letter}: obývák je průchozí do chodby` },
    { a: `${p}-corr`, b: `${p}-kid`,  type: 'door', at: cx,    note: `byt ${letter}: dětský pokoj` },
    // svislé hrany (osa z) → `at` je souřadnice z, zrcadlení ji nemění
    { a: `${p}-corr`, b: `${p}-wc`,     type: 'door', at: 6.85 },
    { a: `${p}-corr`, b: `${p}-bath`,   type: 'door', at: 8.5 },
    { a: `${p}-corr`, b: `${p}-shatna`, type: 'door', at: 10.25 },
    { a: `${p}-corr`, b: `${p}-bed`,    type: 'door', at: 12.6 },
  ]
  const area = W * 18
  const revenue = Object.fromEntries(blocks.map((b) => [
    b.id, Math.round((RENT_NUDLE * (b.x1 - b.x0) * (b.z1 - b.z0)) / area),
  ]))
  return { blocks, links, openPairs: [[`${p}-liv`, `${p}-livw`]], revenue, door: cx }
}

// A a C zrcadlené → koupelnové pruhy A|B zády k sobě na x 11,67
const NUDLE = [
  nudle('A', 7,     11.67, true),
  nudle('B', 11.67, 16.33, false),
  nudle('C', 16.33, 21,    true),
]

// --- varianta C = varianta B bez pater bytů 3, 4 a jednotky 5, plus nudle ---
const DROP = (id) => id.startsWith('f3-') || id.startsWith('f4-') || id.startsWith('u5-')

export const SPEC_NUDLE = {
  ...SPEC_BYTY,

  program: {
    ...SPEC_BYTY.program,
    flats: { units: 5, layout: '2× 2+kk + 3× 3+kk', persons: 2 },
    unit5: undefined,
  },

  // Pavlač obsluhuje tři vstupy (x ~7,9 / 15,4 / 17,2); schodiště podél
  // fasády jako ve verzi B, jen posunuté k východnímu konci pavlače.
  exterior: {
    walkway: { x0: 7.3, x1: 18.0, depth: 1.5, level: 1 },
    stairs: { x0: 7.3, x1: 13.5, z0: -2.7, z1: -1.5, landing: 0.9 },
  },

  compartments: {
    ...Object.fromEntries(Object.entries(SPEC_BYTY.compartments)
      .filter(([name]) => !['byt3', 'byt4', 'byt5'].includes(name))),
    ...Object.fromEntries(NUDLE.map((n, i) => [
      `byt${'ABC'[i]}`, n.blocks.map((b) => b.id),
    ])),
  },

  openPairs: [
    ...SPEC_BYTY.openPairs.filter((p) => !p.some(DROP)),
    ...NUDLE.flatMap((n) => n.openPairs),
  ],

  links: [
    ...SPEC_BYTY.links.filter((l) => !DROP(l.a) && !DROP(l.b)),
    ...NUDLE.flatMap((n) => n.links),
  ],

  economy: {
    costsTotal: SPEC_BYTY.economy.costsTotal,
    revenue: {
      ...Object.fromEntries(Object.entries(SPEC_BYTY.economy.revenue)
        .filter(([id]) => !DROP(id))),
      ...Object.assign({}, ...NUDLE.map((n) => n.revenue)),
    },
  },

  blocks: [
    ...SPEC_BYTY.blocks.filter((b) => !DROP(b.id)),
    ...NUDLE.flatMap((n) => n.blocks),
  ],
}
