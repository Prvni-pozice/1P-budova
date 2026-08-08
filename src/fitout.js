// fitout.js — vybavení místností. Čistá data, žádný Three → testovatelné v Node.
//
// Počty se ODVOZUJÍ z programu (počty osob) podle norem, rozmístění je dané
// pravidlem na místnost. Souřadnice položek jsou relativní k rohu bloku
// (u podél x, v podél z), takže když se blok posune, vybavení jde s ním.
// Položka, která by po zmenšení bloku vypadla ven, se zahodí.

import { levelBase, TYPES } from './spec.js'

const TYPES_VZT = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, v.vzt]))

// rozměry [m] — w podél u, d podél v, h výška
export const FURN = {
  desk:       { w: 1.60, d: 0.80, h: 0.74, color: 0xd9cbb4, shape: 'table',   label: 'Pracovní stůl' },
  chair:      { w: 0.50, d: 0.52, h: 0.85, color: 0x4a4f57, shape: 'chair',   label: 'Židle' },
  sideboard:  { w: 0.80, d: 0.45, h: 0.75, color: 0xbfb5a5, shape: 'box',     label: 'Nízká skříňka' },
  cabinet:    { w: 0.80, d: 0.45, h: 1.80, color: 0xbfb5a5, shape: 'box',     label: 'Skříň' },
  pod:        { w: 1.20, d: 1.20, h: 2.20, color: 0x6b7280, shape: 'cubicle', label: 'Akustická budka' },
  mtable:     { w: 3.00, d: 1.20, h: 0.74, color: 0xd9cbb4, shape: 'table',   label: 'Jednací stůl' },
  table:      { w: 1.60, d: 0.80, h: 0.74, color: 0xd9cbb4, shape: 'table',   label: 'Stůl' },
  rtable:     { w: 0.80, d: 0.80, h: 0.74, color: 0xd9cbb4, shape: 'table',   label: 'Stolek' },
  partyTable: { w: 2.40, d: 0.90, h: 0.74, color: 0xd9a04a, shape: 'table',   label: 'Párty stůl' },
  bench:      { w: 2.40, d: 0.40, h: 0.45, color: 0xc7b299, shape: 'box',     label: 'Lavice' },
  screen:     { w: 1.90, d: 0.08, h: 1.10, color: 0x23272e, shape: 'box',     label: 'Obrazovka' },

  locker:     { w: 0.30, d: 0.50, h: 1.80, color: 0x53707e, shape: 'box',     label: 'Skříňka' },
  valuebox:   { w: 0.30, d: 0.40, h: 1.20, color: 0x53707e, shape: 'box',     label: 'Schránka na cennosti' },
  shoerack:   { w: 1.80, d: 0.40, h: 1.60, color: 0xa89c88, shape: 'rack',    label: 'Botník' },
  changing:   { w: 1.00, d: 1.00, h: 2.10, color: 0xcfd8de, shape: 'cubicle', label: 'Převlékací kabinka' },

  wc:         { w: 0.90, d: 1.50, h: 2.10, color: 0xd8dde3, shape: 'cubicle', label: 'WC kabina' },
  wcBF:       { w: 2.20, d: 2.40, h: 2.10, color: 0xb6dbe8, shape: 'cubicle', label: 'WC bezbariérové' },
  urinal:     { w: 0.45, d: 0.35, h: 1.20, color: 0xeef2f5, shape: 'box',     label: 'Pisoár' },
  basin:      { w: 0.60, d: 0.45, h: 0.85, color: 0xeef2f5, shape: 'box',     label: 'Umyvadlo' },
  shower:     { w: 0.90, d: 0.90, h: 2.10, color: 0xcbe6ea, shape: 'cubicle', label: 'Sprcha' },
  cleaning:   { w: 1.20, d: 1.20, h: 2.10, color: 0xa9b2bb, shape: 'cubicle', label: 'Úklidová komora' },

  kitchen:    { w: 2.40, d: 0.60, h: 0.90, color: 0xbfb5a5, shape: 'box',     label: 'Kuchyňská linka' },
  fridge:     { w: 0.60, d: 0.65, h: 1.85, color: 0xb8bec6, shape: 'box',     label: 'Lednice' },
  bar:        { w: 1.20, d: 0.65, h: 1.10, color: 0xa8763f, shape: 'box',     label: 'Barový pult' },
  backbar:    { w: 1.00, d: 0.45, h: 2.00, color: 0x8c6234, shape: 'box',     label: 'Zadní bar' },
  reception:  { w: 2.40, d: 0.80, h: 1.10, color: 0xa8763f, shape: 'box',     label: 'Recepce' },

  // trampolíny v běžném komerčním rastru: lože 2,10 × 3,05 m, rám s výplní 0,35 m
  tramp:      { w: 2.10, d: 3.05, h: 0.95, color: 0x2a6fb0, shape: 'tramp',   label: 'Trampolína 2,1 × 3,05' },
  walltramp:  { w: 0.30, d: 2.10, h: 3.00, color: 0x2a6fb0, shape: 'box',     label: 'Stěnová trampolína' },
  foampit:    { w: 4.55, d: 3.20, h: 1.10, color: 0xe8a33d, shape: 'pit',     label: 'Molitanová jáma' },
  firstaid:   { w: 0.80, d: 0.40, h: 1.80, color: 0xe23b3b, shape: 'box',     label: 'Ošetřovna / lékárnička' },
  hoop:       { w: 1.20, d: 0.30, h: 3.05, color: 0xe0554b, shape: 'hoop',    label: 'Basketbalový koš' },
  softplay:   { w: 2.20, d: 2.20, h: 2.10, color: 0xe98fb8, shape: 'cage',    label: 'Prolézačka' },
  net:        { w: 6.00, d: 0.08, h: 3.00, color: 0x8fd0e8, shape: 'net',     label: 'Ochranná síť' },

  simrig:     { w: 1.60, d: 2.20, h: 1.45, color: 0x8b6ae0, shape: 'rig',     label: 'Sim rig' },
  rack19:     { w: 0.60, d: 0.80, h: 1.90, color: 0x3b4048, shape: 'box',     label: '19" rack' },

  cage:       { w: 1.40, d: 1.40, h: 2.30, color: 0x4bc46a, shape: 'cage',    label: 'Posilovací klec' },
  gymbench:   { w: 1.20, d: 0.50, h: 0.45, color: 0x3f4a52, shape: 'box',     label: 'Lavička' },
  dumbbells:  { w: 2.00, d: 0.60, h: 0.90, color: 0x3f4a52, shape: 'rack',    label: 'Stojan s činkami' },
  mat:        { w: 2.00, d: 1.00, h: 0.05, color: 0x2f6f5f, shape: 'box',     label: 'Žíněnka' },
  mirror:     { w: 3.00, d: 0.06, h: 2.00, color: 0xcfe0e8, shape: 'box',     label: 'Zrcadlo' },

  workbench:  { w: 2.00, d: 0.80, h: 0.90, color: 0xb08a5a, shape: 'table',   label: 'Ponk' },
  toolcab:    { w: 1.00, d: 0.50, h: 1.90, color: 0x8a8f98, shape: 'box',     label: 'Skříň na nářadí' },
  carlift:    { w: 3.20, d: 0.40, h: 3.40, color: 0xc9a227, shape: 'lift',    label: 'Dvousloupový zvedák' },
  car:        { w: 1.85, d: 4.50, h: 1.45, color: 0x7d8590, shape: 'box',     label: 'Vozidlo (obrys)' },
  printer3d:  { w: 0.60, d: 0.60, h: 0.80, color: 0x7f8c9a, shape: 'box',     label: '3D tiskárna' },
  compressor: { w: 0.70, d: 0.50, h: 1.20, color: 0x6a7078, shape: 'box',     label: 'Kompresor' },
  toolcart:   { w: 0.75, d: 0.50, h: 1.00, color: 0xd05a2a, shape: 'box',     label: 'Dílenský vozík' },
  toolchest:  { w: 1.35, d: 0.55, h: 1.05, color: 0xd05a2a, shape: 'box',     label: 'Dílenská skříň se zásuvkami' },
  partshelf:  { w: 1.80, d: 0.50, h: 2.20, color: 0x9c7b4f, shape: 'rack',    label: 'Regál na díly' },
  tyrerack:   { w: 1.60, d: 0.60, h: 2.00, color: 0x3f4a52, shape: 'rack',    label: 'Regál na pneu' },
  oildrum:    { w: 0.62, d: 0.62, h: 0.90, color: 0x4a5a3a, shape: 'cyl',     label: 'Sud na olej' },
  airreel:    { w: 0.45, d: 0.30, h: 0.45, color: 0x6a7078, shape: 'box',     label: 'Naviják na vzduch' },
  hoist:      { w: 1.60, d: 2.00, h: 0.30, color: 0xc9a227, shape: 'box',     label: 'Nakládací otvor s kladkostrojem' },
  palrack:    { w: 2.70, d: 1.10, h: 2.40, color: 0x9c7b4f, shape: 'rack',    label: 'Paletový regál' },

  ahu:        { w: 3.00, d: 1.60, h: 2.00, color: 0x7fd4ff, shape: 'box',     label: 'VZT jednotka' },
  hpmodule:   { w: 1.30, d: 0.70, h: 1.50, color: 0xff8a4c, shape: 'box',     label: 'Hydraulický modul TČ' },
  tank:       { w: 0.80, d: 0.80, h: 1.90, color: 0x2ecc71, shape: 'cyl',     label: 'Akumulační nádrž' },
  board:      { w: 1.00, d: 0.30, h: 2.00, color: 0xffd54f, shape: 'box',     label: 'Rozvaděč' },

  cleansink:  { w: 0.60, d: 0.55, h: 0.60, color: 0xcdd3d8, shape: 'box',     label: 'Úklidová výlevka' },
  diffuser:   { w: 0.60, d: 0.60, h: 0.14, color: 0x7fd4ff, shape: 'box',     label: 'Vyústka VZT' },
  subboard:   { w: 0.80, d: 0.25, h: 1.60, color: 0xffd54f, shape: 'box',     label: 'Podružný rozvaděč' },
  extinguisher: { w: 0.25, d: 0.25, h: 0.75, color: 0xe23b3b, shape: 'cyl',   label: 'Hasicí přístroj' },
  stairs:     { w: 1.20, d: 4.60, h: 3.30, color: 0xb9b0a2, shape: 'stairs',  label: 'Schodiště' },
  glass:      { w: 4.00, d: 0.08, h: 3.00, color: 0x9fd4e8, shape: 'net',     label: 'Prosklená příčka' },
}

/**
 * Jaké přípojky která položka potřebuje. Odtud vede mep.js koncové větve —
 * tohle je rozdíl mezi „schéma páteře" a použitelným podkladem pro projektanta.
 * conn = výška napojení nad podlahou [m].
 */
export const SVC = {
  basin:      { svc: ['water', 'drain'], conn: 0.55 },
  wc:         { svc: ['water', 'drain'], conn: 0.30 },
  urinal:     { svc: ['water', 'drain'], conn: 0.60 },
  shower:     { svc: ['water', 'drain'], conn: 0.20 },
  cleansink:  { svc: ['water', 'drain'], conn: 0.50 },
  kitchen:    { svc: ['water', 'drain', 'elec'], conn: 0.60 },
  bar:        { svc: ['water', 'drain', 'elec'], conn: 0.60 },
  backbar:    { svc: ['elec'], conn: 0.90 },
  fridge:     { svc: ['elec'], conn: 0.30 },
  tank:       { svc: ['water'], conn: 1.20 },
  hpmodule:   { svc: ['elec', 'water'], conn: 1.00 },
  ahu:        { svc: ['elec', 'data'], conn: 1.40 },
  board:      { svc: ['elec'], conn: 1.60 },
  subboard:   { svc: ['elec'], conn: 1.40 },
  desk:       { svc: ['elec', 'data'], conn: 0.25 },
  mtable:     { svc: ['elec', 'data'], conn: 0.25 },
  screen:     { svc: ['elec', 'data'], conn: 1.10 },
  rack19:     { svc: ['elec', 'data'], conn: 1.20 },
  simrig:     { svc: ['elec', 'data'], conn: 0.30 },
  reception:  { svc: ['elec', 'data'], conn: 0.80 },
  printer3d:  { svc: ['elec', 'data'], conn: 0.30 },
  workbench:  { svc: ['elec'], conn: 0.90 },
  compressor: { svc: ['elec'], conn: 0.40 },
  carlift:    { svc: ['elec'], conn: 0.60 },       // 400 V
  hoist:      { svc: ['elec'], conn: 0.30 },
  airreel:    { svc: ['elec'], conn: 0.40 },
  diffuser:   { svc: ['vzt'], conn: null },        // napojení shora, řeší mep.js
  foampit:    { svc: ['elec'], conn: 0.30 },       // osvětlení jámy
  firstaid:   { svc: ['elec'], conn: 1.00 },
}

// ------------------------------------------------------------------- normy

/**
 * Počty zařizovacích předmětů podle počtu osob.
 * Kanceláře: NV 361/2007 (1 WC na 10 žen, 1 WC + 1 pisoár na 10 mužů,
 * 1 umyvadlo na 10 osob). Veřejnost: 1 kabina bezbariérová povinně
 * (vyhl. 398/2009).
 */
export function sanitaryFor(persons, { publicUse = false } = {}) {
  const half = Math.ceil(persons / 2)
  const wcW = Math.max(1, Math.ceil(half / 10)) + (publicUse ? 1 : 0)
  const wcM = Math.max(1, Math.ceil(half / 10))
  const urinals = publicUse ? 2 : Math.max(1, Math.ceil(half / 10))
  return {
    wcW, wcM, urinals,
    // 1 umyvadlo na 2 kabiny + 1 na 2 pisoáry (ČSN 73 4108)
    basins: Math.max(2, Math.ceil((wcW + wcM) / 2) + Math.ceil(urinals / 2)),
    wcBF: publicUse ? 1 : 0,
  }
}

/** Skříňky: špička + 25 % rezerva, zaokrouhleno na sloupce po dvou. */
export const lockersFor = (peak) => Math.ceil((peak * 1.25) / 2) * 2

// -------------------------------------------------------------- pomocníci

function maker(S, b) {
  const items = []
  const y = levelBase(S, b.level === 'full' ? 0 : b.level)
  const put = (kind, u, v, o = {}) => {
    items.push({ kind, block: b.id, x: b.x0 + u, z: b.z0 + v, y, rot: o.rot ?? 0, note: o.note })
  }
  /** řada n kusů s roztečí step; rot=90 znamená, že řada běží podél v */
  const row = (kind, u, v, n, step, o = {}) => {
    for (let i = 0; i < n; i++) {
      const alongV = o.along === 'v'
      put(kind, u + (alongV ? 0 : i * step), v + (alongV ? i * step : 0), o)
    }
  }
  /** stůl s židlemi ze dvou stran */
  const desks = (u, v, n, o = {}) => {
    for (let i = 0; i < n; i++) {
      const ux = u + i * 1.62
      put('desk', ux, v - 0.42)
      put('desk', ux, v + 0.42)
      put('chair', ux, v - 1.05)
      put('chair', ux, v + 1.05, { rot: 180 })
    }
  }
  return { items, put, row, desks }
}

// ------------------------------------------------------------- dispozice

const LAYOUTS = {
  // ---------------------------------------------------------- kanceláře
  'office-gf': (S, b, P) => {
    const { items, put, row, desks } = maker(S, b)
    const n = P.office.desks
    desks(1.0, 2.8, Math.min(3, Math.ceil(n / 2)))            // 6 míst
    if (n > 6) desks(1.0, 6.4, Math.ceil((n - 6) / 2))        // zbytek
    row('sideboard', 1.2, 0.35, 4, 0.9)                       // pod jižními okny
    row('cabinet', 6.5, 1.2, 5, 0.9, { along: 'v', rot: 90 }) // úložná stěna
    put('pod', 5.8, 9.0)                                      // telefonní budka
    put('rtable', 2.4, 9.8)
    row('chair', 1.6, 9.8, 3, 0.8, { along: 'v' })
    return items
  },
  'office-1f': (S, b) => {                                     // klidové místnosti
    const { items, put } = maker(S, b)
    for (const u of [1.6, 5.0]) {
      put('table', u, 2.4)
      put('chair', u - 0.5, 2.4, { rot: 90 })
      put('chair', u + 0.5, 2.4, { rot: 270 })
    }
    put('cabinet', 3.3, 4.4)
    return items
  },
  meeting: (S, b, P) => {
    const { items, put, row } = maker(S, b)
    put('mtable', 3.5, 2.8)
    row('chair', 2.2, 1.9, 4, 0.85)                            // sever
    row('chair', 2.2, 3.7, 4, 0.85, { rot: 180 })              // jih
    put('chair', 1.6, 2.8, { rot: 90 })
    put('chair', 5.4, 2.8, { rot: 270 })
    put('screen', 3.5, 5.85, { note: `projekce pro ${P.office.staffTarget + 2}` })
    row('sideboard', 6.5, 1.0, 2, 0.9, { along: 'v', rot: 90 })
    return items
  },
  kitchen: (S, b, P) => {
    const { items, put, row } = maker(S, b)
    const s = sanitaryFor(P.office.staffTarget)
    put('kitchen', 1.6, 5.6)                                   // linka u severní stěny
    put('fridge', 3.3, 5.6)
    put('table', 1.6, 3.4)
    row('chair', 1.0, 2.7, 2, 1.2)
    row('chair', 1.0, 4.1, 2, 1.2, { rot: 180 })
    put('cleaning', 3.2, 0.8)
    put('rack19', 5.4, 0.8, { note: 'serverovna' })
    put('cabinet', 6.4, 0.8)
    row('wc', 5.0, 5.1, s.wcW + s.wcM, 0.95)                   // kabiny u severní stěny
    row('urinal', 4.9, 3.6, s.urinals, 0.5)
    row('basin', 6.5, 3.4, s.basins, 0.7, { along: 'v', rot: 90 })
    return items
  },
  reserve: () => [],                                           // hrubá stavba

  // -------------------------------------------------------------- lobby
  lobby: (S, b, P) => {
    const { items, put, row } = maker(S, b)
    put('glass', 3.5, 2.0, { note: 'zádveří' })
    put('reception', 2.4, 3.8)
    put('bar', 4.4, 3.8)
    row('backbar', 1.2, 4.9, 3, 1.05)
    put('fridge', 4.6, 4.9)
    // zouvací kout — bez bot a v protiskluzových ponožkách se do arény nesmí
    row('bench', 5.6, 1.2, 2, 1.4, { along: 'v' })
    put('shoerack', 6.6, 2.0, { rot: 90 })
    row('valuebox', 0.45, 6.0, Math.ceil(lockersFor(P.arena.peak) / 3), 0.32,
      { along: 'v', rot: 90, note: 'cennosti, 3 patra' })
    for (const v of [6.6, 8.6]) {
      for (const u of [2.4, 4.0, 5.6]) {
        put('rtable', u, v)
        put('chair', u - 0.75, v, { rot: 90 })
        put('chair', u + 0.75, v, { rot: 270 })
        put('chair', u, v - 0.75)
        put('chair', u, v + 0.75, { rot: 180 })
      }
    }
    put('partyTable', 3.6, 10.2, { note: 'vyhrazený stůl pro oslavy' })
    row('chair', 2.7, 9.55, 4, 0.6)
    row('chair', 2.7, 10.85, 4, 0.6, { rot: 180 })
    put('stairs', 3.0, 11.4, { rot: 90, note: 'do fitness a sim racingu' })
    put('glass', 6.95, 8.0, { rot: 90, note: 'výhled do arény' })
    return items
  },

  // ------------------------------------------------------- šatny a WC
  wetcore: (S, b, P) => {
    const { items, put, row } = maker(S, b)
    const s = sanitaryFor(P.arena.peak, { publicUse: true })
    const lk = Math.ceil(P.gym.users * 1.5)
    // unisex šatna fitness s uzamykatelnými kabinkami — méně fixtur než 2× M/F
    row('locker', 0.45, 0.6, Math.ceil(lk / 2), 0.32, { along: 'v', rot: 90 })
    put('bench', 1.9, 1.6, { rot: 90 })
    row('changing', 3.2, 0.7, 3, 1.1, { along: 'v' })
    row('shower', 0.9, 5.3, 2, 1.0)
    row('basin', 3.3, 5.6, 2, 0.7)
    // veřejné WC z lobby
    row('wc', 4.9, 1.0, s.wcW + s.wcM, 0.95, { along: 'v' })
    row('urinal', 6.6, 1.0, s.urinals, 0.5, { along: 'v', rot: 90 })
    put('wcBF', 5.7, 4.7)
    row('basin', 4.6, 3.2, s.basins, 0.7)
    return items
  },

  // -------------------------------------------------------------- aréna
  arena: (S, b, P) => {
    const { items, put, row } = maker(S, b)
    // rastr: lože 2,10 × 3,05 + výplň 0,35 → rozteč 2,45 × 3,40
    // u = 0 je stěna do lobby (prosklená), u = 7 stěna k dílně
    const COLS = [1.55, 4.00]
    put('tramp', COLS[0], 1.90, { note: 'odrazová dráha do jámy' })
    put('tramp', COLS[1], 1.90, { note: 'odrazová dráha do jámy' })
    put('foampit', 2.78, 5.40)
    for (let r = 0; r < Math.ceil((P.arena.beds - 2) / 2); r++) {
      for (const u of COLS) put('tramp', u, 8.90 + r * 3.40)
    }
    row('walltramp', 6.75, 9.0, 2, 3.0, { along: 'v', rot: 180 })
    put('hoop', COLS[0], 0.45, { rot: 180, note: 'koš nad odrazovou dráhou' })
    put('firstaid', 6.4, 2.2, { rot: 270 })
    put('net', 3.5, 0.35)                                    // k prosklení do lobby
    put('net', 0.35, 7.0, { rot: 90 })
    put('net', 5.35, 7.0, { rot: 90 })
    row('softplay', 2.2, 16.4, 2, 2.6, { note: 'batolecí zóna pod galerií' })
    put('stairs', 6.2, 15.2, { note: 'na galerii' })
    return items
  },
  play: (S, b) => {
    const { items, put } = maker(S, b)
    put('softplay', 2.0, 1.5)
    put('softplay', 4.8, 1.5)
    put('net', 3.5, 0.2)
    return items
  },

  // ------------------------------------------------------ fitness a sim
  gym: (S, b, P) => {
    const { items, put, row } = maker(S, b)
    for (let i = 0; i < P.gym.cages; i++) {
      const u = 1.4 + i * 2.4
      put('cage', u, 8.2)
      put('gymbench', u, 8.2)                                  // lavička v kleci
    }
    put('dumbbells', 6.0, 7.0, { rot: 90 })
    row('gymbench', 5.6, 4.2, 2, 1.2, { along: 'v' })
    row('mat', 1.6, 2.0, 2, 2.2)
    row('mat', 1.6, 3.4, 2, 2.2)
    put('mirror', 3.5, 0.35)
    put('glass', 6.95, 9.0, { rot: 90, note: 'výhled do arény' })
    return items
  },
  sim: (S, b, P) => {
    const { items, put, row } = maker(S, b)
    for (let i = 0; i < P.sim.rigs; i++) put('simrig', 1.6 + i * 2.4, 4.2)
    put('rack19', 6.4, 5.2)
    put('rtable', 2.0, 1.4)
    row('chair', 1.2, 1.4, 2, 1.6)
    put('fridge', 6.4, 1.2)
    return items
  },

  // ------------------------------------------------------- dílna a sklad
  workshop: (S, b, P) => {
    const { items, put, row } = maker(S, b)
    // u = 0 je stěna k aréně, v = 0 jižní stěna s vraty (u 2,2–6,2)
    if (P.workshop.carLift) {
      put('carlift', 4.2, 2.4, { note: 'světlá výška 4,2 m — nad tím nesmí být mezipatro' })
      put('car', 4.2, 3.0, { note: 'vozidlo na zvedáku' })
    }
    put('car', 4.4, 9.2, { note: 'odstavené vozidlo pod mezipatrem' })
    put('workbench', 1.4, 5.4, { rot: 90 })                  // pracoviště 3D tisku
    row('printer3d', 1.4, 4.6, P.workshop.printers, 0.8, { along: 'v' })
    row('workbench', 1.3, 7.6, P.workshop.benches, 2.1, { along: 'v', rot: 90 })
    row('toolchest', 0.6, 2.2, 2, 1.45, { along: 'v', rot: 90 })
    row('toolcart', 2.6, 5.2, 2, 2.6)
    row('partshelf', 2.6, 12.5, 2, 2.6)
    put('tyrerack', 0.9, 12.5)
    put('oildrum', 6.6, 12.4)
    put('compressor', 6.6, 6.2)
    put('airreel', 6.6, 3.4, { rot: 270 })
    put('cleansink', 6.6, 11.2, { rot: 270 })
    put('stairs', 6.3, 9.4, { note: 'na sklad' })
    return items
  },
  storage: (S, b) => {
    const { items, put, row } = maker(S, b)
    row('palrack', 1.6, 1.6, 3, 2.4, { along: 'v' })
    row('palrack', 5.4, 1.6, 3, 2.4, { along: 'v' })
    // bez nakládacího otvoru se paleta do patra nedostane — po schodech ji nikdo nevynese
    put('hoist', 3.5, 6.0, { note: 'kladkostroj nad otvorem' })
    return items
  },

  // ----------------------------------------------------------- strojovna
  plant: (S, b) => {
    const { items, put, row } = maker(S, b)
    row('ahu', 2.0, 1.1, 2, 1.9, { along: 'v' })
    put('hpmodule', 5.0, 1.0)
    row('tank', 4.8, 2.6, 2, 0.95)
    row('board', 6.4, 0.6, 3, 1.1, { along: 'v', rot: 90 })
    return items
  },
}

/** Vybavení jednoho bloku ve světových souřadnicích. */
export function fitoutFor(S, b) {
  if (b.fitout === 'shell') return []
  const gen = LAYOUTS[b.id]
  if (!gen) return []
  const raw = gen(S, b, S.program)
  // co po zmenšení bloku vypadlo ven, zahoď — ať model nelže
  return raw.filter((it) => {
    const f = FURN[it.kind]
    const turned = it.rot === 90 || it.rot === 270
    const rx = (turned ? f.d : f.w) / 2
    const rz = (turned ? f.w : f.d) / 2
    return it.x - rx >= b.x0 - 0.35 && it.x + rx <= b.x1 + 0.35
        && it.z - rz >= b.z0 - 0.35 && it.z + rz <= b.z1 + 0.35
  })
}

/**
 * Položky, které nekreslím ručně do každé místnosti, ale plynou z pravidla:
 * vyústky VZT z průtoku, hasicí přístroje z plochy, podružné rozvaděče ze zón.
 */
const ZONE_BOARDS = { kitchen: 'kanceláře', lobby: 'veřejná část', gym: 'sport', workshop: 'dílna' }

function derivedFor(S, b) {
  if (b.fitout === 'shell') return []
  const out = []
  const base = levelBase(S, b.level === 'full' ? 0 : b.level)
  const w = b.x1 - b.x0
  const d = b.z1 - b.z0
  const a = w * d
  const ceil = base + (b.level === 'full' ? 4.6 : (b.level === 1 ? S.eaves - base : S.clearGF) - 0.25)

  // vyústky: jedna na 400 m³/h, rozmístěné do pravidelné mřížky
  const flow = (TYPES_VZT[b.type] ?? 0) * a
  const n = Math.min(12, Math.max(1, Math.ceil(flow / 400)))
  const cols = Math.max(1, Math.round(Math.sqrt((n * w) / d)))
  const rows = Math.ceil(n / cols)
  for (let i = 0; i < n; i++) {
    const cx = ((i % cols) + 0.5) / cols
    const cz = (Math.floor(i / cols) + 0.5) / rows
    out.push({ kind: 'diffuser', block: b.id, x: b.x0 + cx * w, z: b.z0 + cz * d,
      y: ceil, rot: 0, flow: flow / n })
  }

  // hasicí přístroje: 1 na 150 m², vždy aspoň jeden v místnosti nad 15 m²
  if (a > 15) {
    const ne = Math.max(1, Math.ceil(a / 150))
    for (let i = 0; i < ne; i++) {
      out.push({ kind: 'extinguisher', block: b.id, y: base, rot: 0,
        x: b.x0 + 0.5 + i * 1.0, z: b.z0 + 0.45 })
    }
  }

  // podružný rozvaděč na zónu — kvůli podružnému měření po provozech
  if (ZONE_BOARDS[b.id]) {
    out.push({ kind: 'subboard', block: b.id, x: b.x1 - 0.45, z: b.z0 + 0.6, y: base, rot: 90,
      note: `podružné měření: ${ZONE_BOARDS[b.id]}` })
  }
  return out
}

/** Vybavení celé budovy + soupis počtů. */
export function fitoutAll(S) {
  const items = []
  for (const b of S.blocks) items.push(...fitoutFor(S, b), ...derivedFor(S, b))
  const counts = {}
  for (const it of items) counts[it.kind] = (counts[it.kind] || 0) + 1
  const dropped = S.blocks.reduce((a, b) => {
    if (b.fitout === 'shell' || !LAYOUTS[b.id]) return a
    return a + (LAYOUTS[b.id](S, b, S.program).length - fitoutFor(S, b).length)
  }, 0)
  return { items, counts, dropped }
}
