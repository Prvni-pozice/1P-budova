// spec-byty.js — VARIANTA B: firemní budova se čtyřmi nájemními byty.
//
// Zadání (23. 8. 2026): jump aréna se ruší, na jejím místě a na části lobby
// vznikají 4 byty 2+kk, dva v přízemí a dva v patře, každý s vlastním vstupem
// z venkovního pláště. Kanceláře vepředu a dílna vzadu zůstávají.
//
// Bydlení v této zóně je podle územního plánu PŘÍPUSTNÉ — ověřeno na stavebním
// úřadě, potvrzeno 23. 8. 2026. Hluk (TČ, VZT dílny, zvedák) se zatím neřeší;
// s byty na pozemku to jednou téma bude, ale teď to není zadání.
//
// ---------------------------------------------------------------------------
// PROČ TAKHLE — tři vazby, které dispozici určily:
//
// 1. Severní stěna je slepá (hranice pozemku), takže denní světlo je JEN
//    z jihu. Obytná místnost musí mít okno → všechny obytné pokoje se musí
//    vejít na jižní fasádu. Byt s obývákem i ložnicí na jihu potřebuje aspoň
//    6 m průčelí; čtyři byty ve dvou podlažích tedy zaberou 14 m jižní fasády.
//    Mezi kancelářemi (x 0–7) a dílnou (x 21–28) je přesně 14 m — celé pole
//    x 7–21 proto padne bytům a na vstup do firmy tam nezbude ani metr.
//
// 2. Vstup do firmy se proto stěhuje do východního pole: recepce x 0–7,
//    z 0–3,2 s portálem v jižní fasádě. Komunitní prostor kanceláří si drží
//    šířku i polohu, jen se zkrátí ze 102 na 80 m². To je jediný zásah do
//    kanceláří, které měly zůstat beze změny.
//
// 3. Byty jsou 7 × 7 m (rastr haly), tj. 49 m² — obývák s KK 20 m², ložnice
//    12 m², koupelna 6,5 m², předsíň 10 m². Ložnice i obývák mají okno na jih,
//    předsíň mezi nimi nese vstupní dveře. Koupelny všech čtyř bytů leží nad
//    sebou → dvě stoupačky na celý dům.
//
// Byty v patře se obsluhují VENKOVNÍM schodištěm a pavlačí (spec.exterior):
// žádná společná vnitřní chodba, žádné míchání provozu firmy s bydlením,
// bytová část je samostatný požární úsek přístupný jen zvenku.
//
// Fitness a sim racing sjely z patra do bezokenního středu přízemí. Není to
// jen výplň zbytku: posilovna nad byty by byla akustický problém (kročejový
// hluk činek), na terénu odpadá i nutnost dimenzovat mezipatro na 5 kN/m².
// Nad středem přízemí se proto strop NESTAVÍ — hala tam zůstává přes obě
// podlaží (level 'full'), což dá posilovně světlou výšku ~7 m a skladu regál
// do výšky. Ušetřených 121 m² stropu je reálná úspora, ne škrt v programu.

import { SPEC, TYPES } from './spec.js'

export { TYPES }

// ---------------------------------------------------------------------- byt
//
// Půdorys jednoho bytu 7 × 7 m, souřadnice u (podél x) od rohu bytu:
//
//   v=7  ┌──────────┬──────┬──────────┐
//        │ koupelna │ před-│ kuchyňský│   sever (bez oken)
//   v=4,6├──────────┤ síň  ├──────────┤
//        │ ložnice  │      │ obývák   │
//   v=0  └──────────┴──────┴──────────┘   jih — okna a vstupní dveře
//        u=0      2,7    4,1          7
//
// mirror otočí byt podle svislé osy. Používá se u bytů 2 a 4, aby obývací
// pokoje obou bytů sousedily s venkovním schodištěm uprostřed — pavlač pak
// běží před obývákem a NE před ložnicí (spaní za pavlačí je to nejhorší,
// co se dá udělat).
function flat(n, X0, level, mirror) {
  const p = `f${n}`
  const R = (id, name, type, a, b, z0, z1, extra = {}) => ({
    id: `${p}-${id}`,
    name: `${name} — byt ${n}`,
    type, level, mirror,
    x0: mirror ? X0 + 7 - b : X0 + a,
    x1: mirror ? X0 + 7 - a : X0 + b,
    z0, z1, flat: n,
    ...extra,
  })
  return [
    R('bed',  'Ložnice',          'flat', 0,   2.7, 0,   4.6, { layout: 'flat-bed' }),
    R('bath', 'Koupelna a WC',    'wet',  0,   2.7, 4.6, 7,   { layout: 'flat-bath' }),
    R('hall', 'Předsíň',          'flat', 2.7, 4.1, 0,   7,   { layout: 'flat-hall', entry: true }),
    R('liv',  'Obývací pokoj',    'flat', 4.1, 7,   0,   4.6, { layout: 'flat-liv' }),
    R('kit',  'Kuchyňský kout',   'flat', 4.1, 7,   4.6, 7,   { layout: 'flat-kit' }),
  ]
}

/**
 * Vnitřní dveře a průchod obýváku do kuchyně pro jeden byt.
 * Všechny tři dveře jsou ve svislých hranách (osa z), takže `at` je
 * souřadnice z — a ta se zrcadlením bytu nemění.
 */
function flatLinks(n) {
  const p = `f${n}`
  return {
    links: [
      { a: `${p}-hall`, b: `${p}-bed`,  type: 'door', at: 1.0, note: `byt ${n}: ložnice` },
      { a: `${p}-hall`, b: `${p}-bath`, type: 'door', at: 5.3, note: `byt ${n}: koupelna` },
      { a: `${p}-hall`, b: `${p}-liv`,  type: 'door', at: 0.9, note: `byt ${n}: obývací pokoj` },
    ],
    openPairs: [[`${p}-liv`, `${p}-kit`]],
  }
}

const FLATS = [
  { n: 1, x: 7,  level: 0, mirror: false },
  { n: 2, x: 14, level: 0, mirror: true },
  { n: 3, x: 7,  level: 1, mirror: false },
  { n: 4, x: 14, level: 1, mirror: true },
]

const flatBlocks = FLATS.flatMap((f) => flat(f.n, f.x, f.level, f.mirror))
const flatLinkSet = FLATS.map((f) => flatLinks(f.n))

// Nájem 12 000 Kč/měsíc bez energií za byt (Zdeněk, 23. 8. 2026).
// 2+kk 49 m², novostavba, Pelhřimov — průmyslová zóna.
const RENT_PER_FLAT = 12000 * 12

// Výnos se rozpustí do místností bytu podle plochy, aby sloupec výnosnosti
// nad bytem byl rovný — jinak by „vydělával" jen obývák.
const flatRevenue = {}
for (const b of flatBlocks) {
  flatRevenue[b.id] = Math.round((RENT_PER_FLAT * (b.x1 - b.x0) * (b.z1 - b.z0)) / 49)
}

export const SPEC_BYTY = {
  // --- obálka, rastr a sítě se z varianty A přebírají beze změny ---
  grid: SPEC.grid,
  length: SPEC.length,
  stage1: SPEC.stage1,
  depth: SPEC.depth,
  eaves: SPEC.eaves,
  pitch: SPEC.pitch,
  wall: SPEC.wall,
  slab: SPEC.slab,
  clearGF: SPEC.clearGF,
  spineZ: SPEC.spineZ,
  blindWalls: SPEC.blindWalls,
  gate: SPEC.gate,
  pv: SPEC.pv,
  utilities: SPEC.utilities,

  // Stání: řada odsunutá na z = −12, aby před jižní fasádou zbylo předpolí
  // pro venkovní schodiště (vyčnívá 5 m) a příjezd. Dvě stání u bytů,
  // bezbariérové u vstupu do firmy, zbytek na ploše etapy 2.
  // POZOR: skutečný počet stání pro 4 byty + firmu je věc situace, ne modelu.
  site: {
    parkRow: -12.0,
    bays: [
      { x: 1.7, w: 2.4 }, { x: 4.3, w: 2.4 }, { x: 6.9, w: 2.4 },
      { x: 9.55, w: 3.4, bf: true },
      { x: 16.4, w: 2.4 }, { x: 19.0, w: 2.4 },
      { x: 29.7, w: 2.4 }, { x: 32.3, w: 2.4 }, { x: 34.9, w: 2.4 }, { x: 37.5, w: 2.4 },
    ],
  },

  // Venkovní přístup k bytům v patře. Dvouramenné ocelové schodiště uprostřed
  // mezi byty, pavlač jen tak dlouhá, aby dosáhla na obě vstupní dveře.
  exterior: {
    walkway: { x0: 9.7, x1: 18.3, depth: 1.5, level: 1 },
    // out = kolik schodiště vyčnívá před jižní fasádu; 5,6 m dá dvěma
    // ramenům běh 2,9 m (sklon 30°) a mezipodestu 1,2 m
    stairs: { x0: 12.85, x1: 15.15, out: 5.6 },
  },

  program: {
    office: { staff: 8, staffTarget: 10, desks: 10 },
    // 4 byty 2+kk, obsazenost 2 osoby na byt (kolaudační předpoklad)
    flats: { units: 4, layout: '2+kk', persons: 2, area: 49 },
    gym: { cages: 2, users: 8 },
    sim: { rigs: 2 },
    workshop: { carLift: true, benches: 3, printers: 2 },
    // špička veřejné části bez arény: fitness + sim + návštěva firmy
    visitors: { peak: 14 },
  },

  // Každý byt je vlastní požární úsek (stěny bytů se tím v modelu automaticky
  // stanou tlustšími dělicími konstrukcemi). Bytová část se nikde nedotýká
  // technické zóny dveřmi — jen stěnou k dílně, která je tím pádem požární.
  compartments: {
    office: ['office-gf', 'commons', 'wc-gf', 'office-1f', 'meeting', 'reserve',
             'corridor', 'wc-1f'],
    public: ['lobby', 'core', 'core-1f', 'gym', 'sim', 'wc-pub'],
    tech:   ['workshop', 'store-gf', 'store-w', 'plant'],
    ...Object.fromEntries(FLATS.map((f) => [
      `byt${f.n}`, flatBlocks.filter((b) => b.flat === f.n).map((b) => b.id),
    ])),
  },

  wallGaps: [],

  openPairs: [
    ['office-gf', 'commons'],      // kuchyňský kout teče do komunitního prostoru
    ['corridor', 'core-1f'],       // schodiště ústí do chodby, ne do místnosti
    ...flatLinkSet.flatMap((f) => f.openPairs),
  ],

  links: [
    // --- firma, přízemí ---
    { a: 'lobby',     b: 'office-gf', type: 'double',  at: 2.0,  note: 'recepce → komunitní prostor' },
    { a: 'office-gf', b: 'wc-gf',     type: 'door',    at: 5.5 },
    { a: 'office-gf', b: 'core',      type: 'door',    at: 7.6,  note: 'ke schodišti a do fitness; jižněji než schodiště, aby se před dveřmi dalo stát' },
    { a: 'core',      b: 'gym',       type: 'double',  at: 12.0 },
    { a: 'core',      b: 'wc-pub',    type: 'door',    at: 8.9 },
    { a: 'gym',       b: 'sim',       type: 'door',    at: 10.5 },
    // --- technická zóna: vlastní vrata z jihu, dovnitř firmy nevede nic ---
    { a: 'workshop',  b: 'store-gf',  type: 'service', at: 24.0, note: 'jediné vnitřní propojení technické zóny' },
    { a: 'store-gf',  b: 'store-w',   type: 'service', at: 17.5, note: 'vysoký sklad pod halou' },
    // --- patro ---
    { a: 'corridor',  b: 'office-1f', type: 'door',    at: 4.0 },
    { a: 'corridor',  b: 'reserve',   type: 'door',    at: 8.5,  note: 'samostatný vstup do pronájmu' },
    { a: 'corridor',  b: 'meeting',   type: 'double',  at: 16.6 },
    { a: 'core-1f',   b: 'wc-1f',     type: 'door',    at: 8.9 },
    // --- byty ---
    ...flatLinkSet.flatMap((f) => f.links),
  ],

  economy: {
    // Odhad provozu bez arény a baru: energie, správa, pojištění, údržba,
    // účetnictví, úklid, obsluha fitness a sim racingu. ODHAD k ověření.
    costsTotal: 1180000,
    revenue: {
      ...flatRevenue,                        // 4 byty à 144 tis. Kč/rok
      gym: 260000, sim: 300000,              // fitness zvětšené na 49 m², sim beze změny
      workshop: 200000, 'store-gf': 50000, 'store-w': 60000,
      'office-gf': 120000, 'office-1f': 60000, meeting: 60000, commons: 32000,
      reserve: 74000,
    },
  },

  blocks: [
    // ================= PŘÍZEMÍ (504 m²) =================
    // --- východní pole: vstup do firmy a kanceláře (x 0–7) ---
    // Recepce je vědomě malá: zádveří, pult, čekání. Není to lobby s barem
    // jako ve variantě A — je to vstup do firmy a k službám, nic víc.
    { id: 'lobby',     name: 'Recepce a vstup',      type: 'lobby',    level: 0, x0: 0,  x1: 7,  z0: 0,    z1: 3.2, layout: 'reception' },
    { id: 'office-gf', name: 'Komunitní prostor',    type: 'office',   level: 0, x0: 0,  x1: 7,  z0: 3.2,  z1: 14.6, layout: 'office-b' },
    { id: 'commons',   name: 'Kuchyňský kout',       type: 'lobby',    level: 0, x0: 0,  x1: 4,  z0: 14.6, z1: 18 },
    { id: 'wc-gf',     name: 'WC',                   type: 'wet',      level: 0, x0: 4,  x1: 7,  z0: 14.6, z1: 18 },

    // --- střední pole: byty na jihu (x 7–21, z 0–7) ---
    ...flatBlocks.filter((b) => b.level === 0),

    // --- střed přízemí bez oken: komunikace a sport ---
    // Jádro je průchozí místnost (kanceláře → fitness), takže schodiště stojí
    // u západní stěny a podél něj zůstává 1,8 m chodby. Výtah je až za ním.
    { id: 'core',      name: 'Schodiště a výtah',    type: 'circ',     level: 0, x0: 7,  x1: 11, z0: 7,  z1: 14, layout: 'core-b' },
    { id: 'wc-pub',    name: 'WC a sprcha návštěvníků', type: 'wet',   level: 0, x0: 7,  x1: 11, z0: 14, z1: 18, layout: 'wc-pub' },
    // enclosed = plnohodnotná místnost přes obě podlaží, ne světlík. Bez toho
    // by model po hraně mezipatra vedl zábradlí i tam, kde je stěna bytu.
    { id: 'gym',       name: 'Fitness',              type: 'gym',      level: 'full', enclosed: true, x0: 11, x1: 17, z0: 7,  z1: 14, layout: 'gym-b' },
    { id: 'sim',       name: 'Sim racing',           type: 'sim',      level: 'full', enclosed: true, x0: 17, x1: 21, z0: 7,  z1: 14, layout: 'sim-b' },
    { id: 'store-w',   name: 'Vysoký sklad',         type: 'storage',  level: 'full', enclosed: true, x0: 11, x1: 21, z0: 14, z1: 18, layout: 'store-w' },

    // --- západní pole: dílna beze změny (x 21–28) ---
    { id: 'workshop',  name: 'Sdílená dílna',        type: 'workshop', level: 'full', enclosed: true, x0: 21, x1: 28, z0: 0,  z1: 13 },
    { id: 'store-gf',  name: 'Sklad',                type: 'storage',  level: 0, x0: 21, x1: 28, z0: 13, z1: 18 },

    // ================= PATRO (292 m²) =================
    { id: 'corridor',  name: 'Chodba',               type: 'circ',     level: 1, x0: 5.8, x1: 7,  z0: 0,  z1: 18 },
    { id: 'office-1f', name: 'Klidové místnosti',    type: 'office',   level: 1, x0: 0,  x1: 5.8, z0: 0,  z1: 5 },
    { id: 'reserve',   name: 'Rezerva k pronájmu',   type: 'reserve',  level: 1, x0: 0,  x1: 5.8, z0: 5,  z1: 12, fitout: 'shell' },
    { id: 'meeting',   name: 'Zasedačka / školicí',  type: 'meeting',  level: 1, x0: 0,  x1: 5.8, z0: 12, z1: 18 },

    ...flatBlocks.filter((b) => b.level === 1),

    { id: 'core-1f',   name: 'Podesta schodiště',    type: 'circ',     level: 1, x0: 7,  x1: 11, z0: 7,  z1: 14, layout: 'core' },
    { id: 'wc-1f',     name: 'WC a úklid patra',     type: 'wet',      level: 1, x0: 7,  x1: 11, z0: 14, z1: 18, layout: 'wc-1f' },
    { id: 'plant',     name: 'Technická místnost',   type: 'plant',    level: 1, x0: 21, x1: 28, z0: 13, z1: 18 },
  ],
}
