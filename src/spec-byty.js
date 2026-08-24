// spec-byty.js — VARIANTA B: firemní budova s pěti nájemními jednotkami.
//
// Zadání (23. 8. 2026): jump aréna se ruší, na jejím místě a na části lobby
// vznikají 4 byty 2+kk, dva v přízemí a dva v patře, každý s vlastním vstupem
// z venkovního pláště. Kanceláře vepředu a dílna vzadu zůstávají.
//
// Bydlení v této zóně je podle územního plánu PŘÍPUSTNÉ — ověřeno na stavebním
// úřadě, potvrzeno 23. 8. 2026. Hluk (TČ, VZT dílny, zvedák) se zatím neřeší;
// s byty na pozemku to jednou téma bude, ale teď to není zadání.
//
// Revize 24. 8. 2026 (pět iterací, zadání Zdeňka):
//   1. VNITŘNÍ JÁDRO ZA RECEPCÍ — schodiště bylo hluboko ve středu dispozice
//      a chodilo se k němu přes komunitní prostor. Teď stojí přímo za pultem
//      recepce, otevřené do vstupní haly: vejdeš a vidíš schody i výtah.
//   2. JEDNOTKA 5 — za byty v patře zela díra dolů do fitness. Střed se
//      zastropil a vznikla pátá jednotka 98 m² (x 7–21, z 7–14): byt 3+kk
//      NEBO kancelář, podle nájemce. Nemá fasádu — světlo dávají STŘEŠNÍ OKNA
//      (plnohodnotné denní osvětlení i pro obytnou místnost). Vstup z vnitřní
//      chodby u schodiště — pro kancelář přirozené, pro byt je vnitřní
//      schodiště od recepce totéž co vstup bytového domu.
//   3. VENKOVNÍ SCHODIŠTĚ PODÉL FASÁDY — kolmé dvouramenné vyčnívalo 5,6 m
//      do předpolí. Teď jde jedno přímé rameno rovnoběžně s jižní stěnou
//      v pásu 1,2 m hned za pavlačí; nahoře podesta a vstup na pavlač.
//      Ocel, otevřené stupně, odstup 1,5 m od fasády — oknům přízemí zůstává
//      světlo. Nejlevnější možná konstrukce.
//   4. STŘED PŘÍZEMÍ — vysoký sklad zrušen (sklad zůstává jen u dílny).
//      Fitness 49 m² hned u jádra, sim racing za ním, šatna se sprchami
//      u severní stěny. Zbylých 61 m² je HRUBÁ REZERVA — nestaví se do ní
//      nic, dokud není nájemce nebo potřeba růstu (rozšíření fitness/simu).
//   5. EKONOMIKA A POŽÁRNÍ ÚSEKY — jednotka 5 jako vlastní požární úsek,
//      nájem 4 bytů à 12 000 Kč + jednotka 5 à 13 000 Kč (odhad).
//
// ---------------------------------------------------------------------------
// PROČ TAKHLE — vazby, které dispozici určily:
//
// 1. Severní stěna je slepá (hranice pozemku), takže fasádní světlo je JEN
//    z jihu. Obytná místnost musí mít okno → ložnice a obýváky čtyř bytů
//    zaberou celou jižní fasádu mezi kancelářemi a dílnou (x 7–21).
//    Na vstup do firmy tam nezbude ani metr → recepce jde do východního pole.
//
// 2. Jednotka 5 fasádu nemá žádnou — proto střešní okna. Nad ní už je jen
//    střecha (žádné druhé patro), takže světlíky jsou levné a účinné.
//
// 3. Byty v patře obsluhuje venkovní schodiště s pavlačí: žádná společná
//    vnitřní chodba, byty 1–4 se s provozem firmy nikde nepotkají.
//    Jednotka 5 je vědomá výjimka — sdílí vnitřní schodiště s firmou,
//    což jí zároveň umožňuje fungovat jako kancelář.
//
// 4. Fitness a sim racing jsou na terénu v bezokenním středu. Nad fitness
//    a simem teď bydlí jednotka 5 → fitness má těžkou plovoucí podlahu
//    (kročejový hluk) a jednotka je primárně nabízená jako kancelář;
//    jako byt s tím nájemce musí počítat (večerní provoz posilovny).

import { SPEC, TYPES } from './spec.js'

export { TYPES }

// ---------------------------------------------------------------------- byt
//
// Půdorys jednoho bytu 7 × 7 m, souřadnice u (podél x) od rohu bytu:
//
//   v=7  ┌──────────┬──────┬──────────┐
//        │ koupelna │ před-│ kuchyňský│   sever (vnitřní stěna)
//   v=4,6├──────────┤ síň  ├──────────┤
//        │ ložnice  │      │ obývák   │
//   v=0  └──────────┴──────┴──────────┘   jih — okna a vstupní dveře
//        u=0      2,7    4,1          7
//
// mirror otočí byt podle svislé osy. Používá se u bytů 2 a 4, aby obývací
// pokoje obou bytů sousedily s venkovním schodištěm uprostřed — pavlač pak
// běží před obývákem a NE před ložnicí.
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
// Jednotka 5 (98 m², byt 3+kk nebo kancelář): 13 000 Kč/měs — ODHAD;
// jako kancelář (~1 600 Kč/m²/rok) i jako velký byt vychází podobně.
const RENT_UNIT5 = 13000 * 12

// Výnos se rozpustí do místností jednotky podle plochy, aby sloupec
// výnosnosti nad ní byl rovný — jinak by „vydělával" jen obývák.
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

  // Stání: řada na z = −9 — venkovní schodiště už vyčnívá jen 2,7 m (jde
  // podél fasády), takže předpolí stačí užší než dřív. Pruh x 21–28,5
  // zůstává volný jako vjezd k vratům dílny; zbytek stání na ploše etapy 2.
  // POZOR: skutečný počet stání pro 5 jednotek + firmu je věc situace.
  site: {
    parkRow: -9.0,
    bays: [
      { x: 1.7, w: 2.4 }, { x: 4.3, w: 2.4 }, { x: 6.9, w: 2.4 },
      { x: 9.55, w: 3.4, bf: true },
      { x: 16.4, w: 2.4 }, { x: 19.0, w: 2.4 },
      { x: 29.7, w: 2.4 }, { x: 32.3, w: 2.4 }, { x: 34.9, w: 2.4 }, { x: 37.5, w: 2.4 },
    ],
  },

  // Venkovní přístup k bytům v patře — iterace 3: jedno přímé ocelové rameno
  // PODÉL fasády v pásu z −1,5 až −2,7 (hned za pavlačí), stoupá od západu
  // (pata u x1) k východu (podesta u x0) a ústí na východní konec pavlače.
  // Otevřené stupně + odstup 1,5 m od stěny → okna přízemí nepřijdou o světlo.
  exterior: {
    walkway: { x0: 9.7, x1: 18.3, depth: 1.5, level: 1 },
    stairs: { x0: 9.7, x1: 15.9, z0: -2.7, z1: -1.5, landing: 0.9 },
  },

  program: {
    office: { staff: 8, staffTarget: 10, desks: 10 },
    // 4 byty 2+kk + jednotka 5 (byt 3+kk nebo kancelář)
    flats: { units: 4, layout: '2+kk', persons: 2, area: 49 },
    unit5: { area: 98, use: 'byt 3+kk nebo kancelář' },
    gym: { cages: 2, users: 8 },
    sim: { rigs: 2 },
    workshop: { carLift: true, benches: 3, printers: 2 },
    // špička veřejné části bez arény: fitness + sim + návštěva firmy
    visitors: { peak: 14 },
  },

  // Každá jednotka je vlastní požární úsek (stěny se tím v modelu automaticky
  // stanou tlustšími dělicími konstrukcemi). Byty 1–4 se dovnitř domu nikde
  // neotvírají; jednotka 5 má dveře do chodby — požární, jako v bytovém domě.
  compartments: {
    office: ['office-gf', 'office-e', 'commons', 'wc-gf',
             'office-1f', 'wc-1f', 'meeting', 'reserve'],
    public: ['lobby', 'core', 'core-1f', 'corridor',
             'gym', 'sim', 'wc-pub', 'rezerva-gf', 'rezerva-n'],
    tech:   ['workshop', 'store-gf', 'plant'],
    ...Object.fromEntries(FLATS.map((f) => [
      `byt${f.n}`, flatBlocks.filter((b) => b.flat === f.n).map((b) => b.id),
    ])),
    byt5: ['u5-main', 'u5-w', 'u5-bath'],
  },

  wallGaps: [],

  openPairs: [
    ['lobby', 'core'],             // vstupní hala: recepce a schodiště jeden prostor
    ['office-gf', 'office-e'],     // kanceláře do L kolem jádra — jedna místnost
    ['office-gf', 'commons'],      // kuchyňský kout teče do komunitního prostoru
    ['office-e', 'commons'],
    ['corridor', 'core-1f'],       // schodiště ústí do chodby, ne do místnosti
    ['rezerva-gf', 'rezerva-n'],   // hrubá rezerva středu je jeden prostor do L
    ['u5-w', 'u5-main'],           // kuchyňská část jednotky 5 teče do hlavní
    ...flatLinkSet.flatMap((f) => f.openPairs),
  ],

  links: [
    // --- firma, přízemí ---
    { a: 'lobby',     b: 'office-gf', type: 'door',    at: 1.5,  note: 'recepce → komunitní prostor' },
    { a: 'core',      b: 'gym',       type: 'double',  at: 8.0,  note: 'od schodiště rovnou do fitness' },
    { a: 'gym',       b: 'sim',       type: 'door',    at: 10.0 },
    { a: 'gym',       b: 'wc-pub',    type: 'door',    at: 8.7,  note: 'šatna a sprchy sportu' },
    { a: 'gym',       b: 'rezerva-n', type: 'service', at: 12.5, note: 'přístup do hrubé rezervy středu' },
    { a: 'office-e',  b: 'wc-gf',     type: 'door',    at: 5.5 },
    { a: 'core',      b: 'office-e',  type: 'door',    at: 5.5,  note: 'zaměstnanci: od schodiště do kanceláří' },
    // --- technická zóna: vlastní vrata z jihu, dovnitř firmy nevede nic ---
    { a: 'workshop',  b: 'store-gf',  type: 'service', at: 24.0, note: 'jediné vnitřní propojení technické zóny' },
    // --- patro ---
    { a: 'core-1f',   b: 'office-1f', type: 'door',    at: 4.5 },
    { a: 'core-1f',   b: 'wc-1f',     type: 'door',    at: 5.0 },
    { a: 'corridor',  b: 'reserve',   type: 'door',    at: 10.5, note: 'samostatný vstup do pronájmu' },
    { a: 'corridor',  b: 'meeting',   type: 'double',  at: 16.6 },
    { a: 'corridor',  b: 'u5-w',      type: 'door',    at: 10.0, note: 'vstup jednotky 5 — požární dveře jako v bytovém domě' },
    { a: 'u5-w',      b: 'u5-bath',   type: 'door',    at: 8.6,  note: 'jednotka 5: koupelna' },
    // --- byty ---
    ...flatLinkSet.flatMap((f) => f.links),
  ],

  economy: {
    // Odhad provozu bez arény a baru: energie, správa, pojištění, údržba,
    // účetnictví, úklid, obsluha fitness a sim racingu. ODHAD k ověření.
    costsTotal: 1180000,
    revenue: {
      ...flatRevenue,                        // 4 byty à 144 tis. Kč/rok
      // jednotka 5 — 156 tis. Kč/rok rozpuštěno po místnostech dle plochy
      'u5-main': Math.round((RENT_UNIT5 * 79.1) / 98),
      'u5-w':    Math.round((RENT_UNIT5 * 13.5) / 98),
      'u5-bath': Math.round((RENT_UNIT5 * 5.4) / 98),
      gym: 260000, sim: 300000,
      workshop: 200000, 'store-gf': 50000,
      'office-gf': 70000, 'office-e': 50000, commons: 32000,
      'office-1f': 45000, meeting: 60000,
      reserve: 35000,
    },
  },

  blocks: [
    // ================= PŘÍZEMÍ (504 m²) =================
    // --- východní pole: vstupní hala s recepcí a jádrem (iterace 1) ---
    // Recepce a schodiště jsou JEDEN prostor (openPair): vejdeš, vpravo pult,
    // před tebou schodiště a výtah. Vstup do firmy i k jednotce 5.
    { id: 'lobby',     name: 'Recepce a vstup',      type: 'lobby',    level: 0, x0: 0,   x1: 7,   z0: 0,    z1: 3.2,  layout: 'reception' },
    { id: 'core',      name: 'Schodiště a výtah',    type: 'circ',     level: 0, x0: 3.2, x1: 7,   z0: 3.2,  z1: 9,    layout: 'core-b' },
    // Kanceláře do L kolem jádra — západní pruh + pole za jádrem, openPair.
    { id: 'office-gf', name: 'Komunitní prostor',    type: 'office',   level: 0, x0: 0,   x1: 3.2, z0: 3.2,  z1: 14.6, layout: 'office-b' },
    { id: 'office-e',  name: 'Pracovní zóna',        type: 'office',   level: 0, x0: 3.2, x1: 7,   z0: 9,    z1: 14.6, layout: 'office-e' },
    { id: 'commons',   name: 'Kuchyňský kout',       type: 'lobby',    level: 0, x0: 0,   x1: 4,   z0: 14.6, z1: 18 },
    { id: 'wc-gf',     name: 'WC',                   type: 'wet',      level: 0, x0: 4,   x1: 7,   z0: 14.6, z1: 18 },

    // --- střední pole: byty na jihu (x 7–21, z 0–7) ---
    ...flatBlocks.filter((b) => b.level === 0),

    // --- střed přízemí (iterace 4): sport u jádra, rezerva dál ---
    { id: 'gym',       name: 'Fitness',              type: 'gym',      level: 0, x0: 7,  x1: 14, z0: 7,  z1: 14, layout: 'gym-b' },
    { id: 'sim',       name: 'Sim racing',           type: 'sim',      level: 0, x0: 14, x1: 18, z0: 7,  z1: 14, layout: 'sim-b' },
    { id: 'rezerva-gf', name: 'Rezerva středu',      type: 'reserve',  level: 0, x0: 18, x1: 21, z0: 7,  z1: 14, fitout: 'shell' },
    // Severní pruh: enclosed = uzavřené místnosti přes plnou výšku (nad nimi
    // už je jen střecha) — příčky k jednotce 5 se generují i v úrovni patra
    // a model tam nedává zábradlí.
    { id: 'wc-pub',    name: 'Šatna a sprchy sportu', type: 'wet',     level: 'full', enclosed: true, x0: 7,  x1: 11, z0: 14, z1: 18, layout: 'wc-pub' },
    { id: 'rezerva-n', name: 'Rezerva středu — sever', type: 'reserve', level: 'full', enclosed: true, x0: 11, x1: 21, z0: 14, z1: 18, fitout: 'shell' },

    // --- západní pole: dílna beze změny, sklad jen tady (iterace 4) ---
    { id: 'workshop',  name: 'Sdílená dílna',        type: 'workshop', level: 'full', enclosed: true, x0: 21, x1: 28, z0: 0,  z1: 13 },
    { id: 'store-gf',  name: 'Sklad',                type: 'storage',  level: 0, x0: 21, x1: 28, z0: 13, z1: 18 },

    // ================= PATRO (357 m²) =================
    // --- východní pole kolem jádra ---
    { id: 'office-1f', name: 'Klidové místnosti',    type: 'office',   level: 1, x0: 0,   x1: 7,   z0: 0,   z1: 3.2, layout: 'quiet-b' },
    { id: 'wc-1f',     name: 'WC a úklid patra',     type: 'wet',      level: 1, x0: 0,   x1: 3.2, z0: 3.2, z1: 9,   layout: 'wc-1f' },
    { id: 'core-1f',   name: 'Podesta schodiště',    type: 'circ',     level: 1, x0: 3.2, x1: 7,   z0: 3.2, z1: 9,   layout: 'core-1f-b' },
    { id: 'reserve',   name: 'Rezerva k pronájmu',   type: 'reserve',  level: 1, x0: 0,   x1: 5.8, z0: 9,   z1: 12,  fitout: 'shell' },
    { id: 'meeting',   name: 'Zasedačka / školicí',  type: 'meeting',  level: 1, x0: 0,   x1: 5.8, z0: 12,  z1: 18 },
    { id: 'corridor',  name: 'Chodba',               type: 'circ',     level: 1, x0: 5.8, x1: 7,   z0: 9,   z1: 18,  layout: 'corridor-b' },

    ...flatBlocks.filter((b) => b.level === 1),

    // --- jednotka 5 (iterace 2): 98 m², byt 3+kk nebo kancelář ---
    // Koupelna sedí hned nad hranicí koupelny bytu 3 → stoupačka se sdílí.
    { id: 'u5-bath',   name: 'Koupelna — jednotka 5', type: 'wet',     level: 1, x0: 7,   x1: 9.7, z0: 7,   z1: 9,   layout: 'u5-bath', unit: 5 },
    { id: 'u5-w',      name: 'Kuchyň — jednotka 5',  type: 'flat',     level: 1, x0: 7,   x1: 9.7, z0: 9,   z1: 14,  layout: 'u5-w',    unit: 5 },
    { id: 'u5-main',   name: 'Jednotka 5 — byt / kancelář', type: 'flat', level: 1, x0: 9.7, x1: 21, z0: 7, z1: 14,  layout: 'u5-main', unit: 5 },

    { id: 'plant',     name: 'Technická místnost',   type: 'plant',    level: 1, x0: 21, x1: 28, z0: 13, z1: 18 },
  ],
}
