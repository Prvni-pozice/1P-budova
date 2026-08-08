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
  binstore:   { w: 2.20, d: 1.00, h: 1.25, color: 0x5a6169, shape: 'box',     label: 'Nádoby na odpad' },
  pram:       { w: 2.60, d: 1.20, h: 0.12, color: 0x9aa7b0, shape: 'box',     label: 'Kočárkárna' },
  entrymat:   { w: 3.00, d: 1.60, h: 0.03, color: 0x3f4a52, shape: 'box',     label: 'Čisticí zóna' },
  babychange: { w: 0.90, d: 0.55, h: 0.95, color: 0xe98fb8, shape: 'box',     label: 'Přebalovací pult' },
  barstore:   { w: 1.60, d: 0.60, h: 2.00, color: 0x8c6234, shape: 'rack',    label: 'Sklad baru' },
  floordrain: { w: 0.30, d: 0.30, h: 0.04, color: 0x6a7078, shape: 'box',     label: 'Podlahová vpust' },
  railing:    { w: 3.00, d: 0.06, h: 1.10, color: 0xb9b0a2, shape: 'net',     label: 'Zábradlí' },
  door:       { w: 0.90, d: 0.12, h: 2.05, color: 0xa89c88, shape: 'door',    label: 'Dveře' },
  double:     { w: 1.60, d: 0.12, h: 2.05, color: 0xa89c88, shape: 'door',    label: 'Dvoukřídlé dveře' },
  glazed:     { w: 1.60, d: 0.12, h: 2.20, color: 0x9fd4e8, shape: 'door',    label: 'Prosklené dveře' },
  service:    { w: 0.90, d: 0.12, h: 2.05, color: 0x8a8f98, shape: 'door',    label: 'Servisní dveře' },
  escape:     { w: 0.90, d: 0.12, h: 2.05, color: 0x2fbf5f, shape: 'door',    label: 'Požární dveře s panikovým kováním' },
  light:      { w: 1.20, d: 0.14, h: 0.10, color: 0xfff2d0, shape: 'box',     label: 'Svítidlo' },
  emlight:    { w: 0.30, d: 0.12, h: 0.12, color: 0x4bc46a, shape: 'box',     label: 'Nouzové svítidlo' },
  exitsign:   { w: 0.35, d: 0.06, h: 0.16, color: 0x2fbf5f, shape: 'box',     label: 'Značka únikové cesty' },
  smoke:      { w: 0.14, d: 0.14, h: 0.06, color: 0xe23b3b, shape: 'cyl',     label: 'Detektor kouře' },
  hydrant:    { w: 0.65, d: 0.25, h: 0.75, color: 0xe23b3b, shape: 'box',     label: 'Nástěnný hydrant' },
  coatrack:   { w: 3.00, d: 0.40, h: 1.80, color: 0xa89c88, shape: 'rack',    label: 'Věšáková stěna' },
  partition:  { w: 3.60, d: 0.12, h: 2.40, color: 0xd9a04a, shape: 'net',     label: 'Posuvná příčka' },
  destrat:    { w: 0.90, d: 0.90, h: 0.30, color: 0x7fd4ff, shape: 'cyl',     label: 'Destratifikační ventilátor' },
  co2:        { w: 0.12, d: 0.06, h: 0.12, color: 0x4bc46a, shape: 'box',     label: 'Čidlo CO₂' },
  battery:    { w: 0.80, d: 0.40, h: 1.60, color: 0x4bc46a, shape: 'box',     label: 'Bateriové úložiště' },
  aircurtain: { w: 4.00, d: 0.35, h: 0.35, color: 0x7fd4ff, shape: 'box',     label: 'Vzduchová clona' },
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
  destrat:    { svc: ['elec'], conn: 0.20 },
  co2:        { svc: ['elec', 'data'], conn: 0.10 },
  battery:    { svc: ['elec'], conn: 1.00 },
  aircurtain: { svc: ['elec'], conn: 0.20 },
  coatrack:   { svc: [], conn: 0.20 },
  light:      { svc: ['elec'], conn: 0.10 },
  emlight:    { svc: ['elec'], conn: 0.08 },
  exitsign:   { svc: ['elec'], conn: 0.08 },
  smoke:      { svc: ['data'], conn: 0.05 },
  hydrant:    { svc: ['water'], conn: 0.50 },
  barstore:   { svc: [], conn: 0.20 },
  babychange: { svc: [], conn: 0.20 },
  floordrain: { svc: ['drain'], conn: 0.02 },
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
  /**
   * Židle otočená K ZADANÉMU BODU. Rotaci nikdy nepiš ručně — geometrie má
   * opěradlo na +z, takže při rot 0 člověk kouká na −z a je snadné se splést.
   * (Taky se to stalo: 40 ze 60 židlí sedělo zády ke stolu.)
   */
  const seat = (u, v, towardU, towardV) => {
    const rot = (Math.atan2(towardU - u, -(towardV - v)) * 180) / Math.PI
    put('chair', u, v, { rot: (rot + 360) % 360 })
  }
  /** židle kolem stolu se středem (u, v) */
  const around = (u, v, sides) => {
    for (const [du, dv] of sides) seat(u + du, v + dv, u, v)
  }
  /** bench stolů zády k sobě, židle ven */
  const desks = (u, v, n) => {
    for (let i = 0; i < n; i++) {
      const ux = u + i * 1.62
      put('desk', ux, v - 0.42)
      put('desk', ux, v + 0.42)
      seat(ux, v - 1.05, ux, v)
      seat(ux, v + 1.05, ux, v)
    }
  }
  return { items, put, row, desks, seat, around }
}

// ------------------------------------------------------------- dispozice

const LAYOUTS = {
  // ---------------------------------------------------------- kanceláře
  'office-gf': (S, b, P) => {
    const { items, put, row, desks, around } = maker(S, b)
    const n = P.office.desks
    desks(1.0, 2.8, Math.min(3, Math.ceil(n / 2)))            // 6 míst
    if (n > 6) desks(1.0, 6.4, Math.ceil((n - 6) / 2))        // zbytek
    row('sideboard', 1.2, 0.35, 4, 0.9)                       // pod jižními okny
    row('cabinet', 6.5, 1.2, 5, 0.9, { along: 'v', rot: 90 }) // úložná stěna
    // BEZ TOHOTO SCHODIŠTĚ je celé patro kanceláří (126 m²) nedostupné
    put('stairs', 6.4, 8.0, { note: 'ústí do chodby v patře, ne do místnosti' })
    put('pod', 4.6, 9.6)                                      // telefonní budka
    put('rtable', 2.4, 9.8)
    around(2.4, 9.8, [[-0.78, 0], [0.78, 0], [0, -0.78]])
    return items
  },
  'office-1f': (S, b) => {                                     // klidové místnosti
    const { items, put, around } = maker(S, b)
    for (const u of [1.4, 4.3]) {
      put('table', u, 2.4)
      around(u, 2.4, [[-1.05, 0], [1.05, 0]])
    }
    put('cabinet', 2.9, 4.4)
    return items
  },
  meeting: (S, b, P) => {
    const { items, put, row, seat, around } = maker(S, b)
    put('mtable', 2.9, 2.8)
    for (let i = 0; i < 4; i++) {
      seat(1.6 + i * 0.85, 1.9, 1.6 + i * 0.85, 2.8)
      seat(1.6 + i * 0.85, 3.7, 1.6 + i * 0.85, 2.8)
    }
    around(2.9, 2.8, [[-1.9, 0], [1.9, 0]])
    put('screen', 2.9, 5.85, { note: `projekce pro ${P.office.staffTarget + 2}` })
    put('co2', 0.15, 3.0, { rot: 90 })
    row('sideboard', 5.3, 1.0, 2, 0.9, { along: 'v', rot: 90 })
    return items
  },
  kitchen: (S, b, P) => {
    const { items, put, row, seat } = maker(S, b)
    const s = sanitaryFor(P.office.staffTarget)
    put('kitchen', 1.6, 5.6)                                   // linka u severní stěny
    put('fridge', 3.3, 5.6)
    put('table', 1.6, 3.4)
    for (const u of [1.0, 2.2]) { seat(u, 2.7, u, 3.4); seat(u, 4.1, u, 3.4) }
    put('cleaning', 3.2, 0.8)
    put('rack19', 5.4, 0.8, { note: 'serverovna' })
    put('cabinet', 6.4, 0.8)
    row('wc', 5.0, 5.1, s.wcW + s.wcM, 0.95)                   // kabiny u severní stěny
    row('urinal', 4.9, 3.6, s.urinals, 0.5)
    row('basin', 6.5, 3.4, s.basins, 0.7, { along: 'v', rot: 90 })
    return items
  },
  reserve: () => [],                                           // hrubá stavba
  corridor: (S, b) => {
    const { items, put } = maker(S, b)
    put('extinguisher', 0.6, 9.0)
    return items
  },

  // -------------------------------------------------------------- lobby
  lobby: (S, b, P) => {
    const { items, put, row, seat, around } = maker(S, b)
    put('entrymat', 4.6, 1.0)
    put('glass', 3.5, 2.1, { note: 'zádveří' })
    put('reception', 2.4, 3.7)
    put('bar', 4.5, 3.7)
    row('backbar', 1.4, 4.8, 3, 1.05)
    put('fridge', 4.8, 4.8)
    put('barstore', 6.0, 4.8, { note: 'zásoba baru — bez ní se doplňuje z auta' })
    // zouvací kout: do arény jen v protiskluzových ponožkách
    put('pram', 1.8, 1.3, { note: 'rodinný provoz bez odstavení kočárků nefunguje' })
    put('bench', 5.6, 3.0)
    put('shoerack', 6.6, 4.6, { rot: 90 })
    // 3 patra po 10 sloupcích; rodiny sdílejí, na 40 lidí ve špičce to stačí
    row('valuebox', 6.6, 6.0, 10, 0.32, { along: 'v', rot: 90, note: 'cennosti, 3 patra' })
    // schodiště podél západní stěny — přes severní konec se to nemačká
    put('stairs', 0.75, 8.2, { note: 'do fitness a sim racingu' })
    // dva sloupce, ne tři: při rozteči 1,5 m by si sousední stoly sdílely židli
    for (const v of [6.8, 8.6]) for (const u of [2.7, 5.1]) {
      put('rtable', u, v)
      around(u, v, [[-0.75, 0], [0.75, 0], [0, -0.75], [0, 0.75]])
    }
    put('partyTable', 4.0, 11.0, { note: 'vyhrazený stůl pro oslavy' })
    put('partition', 4.0, 9.9, { note: 'oddělí párty kout, jinak splyne s barem' })
    for (let i = 0; i < 4; i++) {
      const u = 3.1 + i * 0.6
      seat(u, 10.35, u, 11.0)
      seat(u, 11.65, u, 11.0)
    }
    put('glass', 6.95, 8.5, { rot: 90, note: 'výhled do arény' })
    put('hydrant', 0.4, 2.6, { rot: 90 })
    return items
  },

  // ------------------------------------------------------- šatny a WC
  wetcore: (S, b, P) => {
    const { items, put, row } = maker(S, b)
    const s = sanitaryFor(P.arena.peak, { publicUse: true })
    const lk = Math.ceil(P.gym.users * 1.5)
    // unisex šatna fitness s uzamykatelnými kabinkami — méně fixtur než 2× M/F
    row('locker', 0.45, 0.6, Math.ceil(lk / 2), 0.32, { along: 'v', rot: 90 })
    put('bench', 1.9, 2.4, { rot: 90 })
    row('changing', 3.2, 0.7, 3, 1.1, { along: 'v' })
    row('shower', 0.9, 5.3, 2, 1.0)
    row('basin', 3.3, 5.6, 2, 0.7)
    // veřejné WC z lobby
    row('wc', 4.9, 1.0, s.wcW + s.wcM, 0.95, { along: 'v' })
    row('urinal', 6.6, 1.0, s.urinals, 0.5, { along: 'v', rot: 90 })
    put('wcBF', 5.7, 4.7)
    put('babychange', 4.6, 5.6, { note: 'v rodinném provozu povinná výbava' })
    row('basin', 4.6, 3.2, s.basins, 0.7)
    return items
  },

  // -------------------------------------------------------------- aréna
  arena: (S, b, P) => {
    const { items, put, row } = maker(S, b)
    // u = 0 je stěna do lobby, odkud se vchází → 1,2 m vstupní ulička,
    // pole trampolín začíná až za ní. Bez toho se dveře otevřou na lóže.
    const COLS = [2.25, 4.70]                 // lože 2,10 → u 1,2–3,3 a 3,65–5,75
    put('coatrack', 3.0, 0.5)
    put('hoop', COLS[0], 0.9, { rot: 180 })
    for (const u of COLS) put('tramp', u, 2.9, { note: 'odrazová dráha do jámy' })
    put('foampit', 3.475, 6.4)
    for (let r = 0; r < Math.ceil((P.arena.beds - 2) / 2); r++) {
      for (const u of COLS) put('tramp', u, 9.9 + r * 3.4)
    }
    // sítě po obou stranách pole; jižní konec má měkké obklady, ne síť —
    // tudy se do arény vchází
    for (const u of [1.15, 5.85]) row('net', u, 4.4, 2, 6.0, { along: 'v', rot: 90 })
    put('firstaid', 6.4, 3.0, { rot: 270 })
    row('destrat', 3.5, 4.5, 2, 7.0, { along: 'v' })
    put('co2', 6.85, 8.0, { rot: 270, note: 'VZT na plný výkon jen když jsou tam lidi' })
    row('softplay', 2.2, 16.4, 2, 2.6, { note: 'batolecí zóna pod galerií' })
    put('stairs', 6.25, 15.2, { note: 'na galerii' })
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
      const u = 2.0 + i * 2.4
      put('cage', u, 8.2)
      put('gymbench', u, 8.2)                                  // lavička v kleci
    }
    put('dumbbells', 6.0, 7.0, { rot: 90 })
    row('gymbench', 5.6, 4.2, 2, 1.2, { along: 'v' })
    row('mat', 1.6, 2.0, 2, 2.2)
    row('mat', 1.6, 3.4, 2, 2.2)
    put('mirror', 3.5, 0.35)
    put('cleansink', 6.6, 11.5, { rot: 270, note: 'úklid v patře — voda se nenosí po schodech' })
    put('glass', 6.95, 9.0, { rot: 90, note: 'výhled do arény' })
    put('co2', 0.15, 6.0, { rot: 90 })
    return items
  },
  sim: (S, b, P) => {
    const { items, put, row, around } = maker(S, b)
    for (let i = 0; i < P.sim.rigs; i++) put('simrig', 1.6 + i * 2.4, 4.2)
    put('rack19', 6.4, 5.2)
    put('rtable', 2.0, 1.4)
    around(2.0, 1.4, [[-0.78, 0], [0.78, 0]])
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
    row('partshelf', 2.6, 11.6, 2, 2.6)
    put('tyrerack', 0.9, 11.6)
    put('oildrum', 6.6, 8.0)
    put('compressor', 6.6, 6.2)
    put('airreel', 6.6, 3.4, { rot: 270 })
    put('aircurtain', 4.2, 0.5, { note: 'nad vraty — jinak se při každém vjezdu vytopí ven' })
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
    put('hpmodule', 4.4, 1.0)
    row('tank', 4.8, 2.6, 2, 0.95)
    row('board', 6.4, 0.6, 3, 1.1, { along: 'v', rot: 90 })
    // provoz je odpolední a večerní → vlastní spotřeba FVE je slabá; baterie
    // vydělá víc než zdvojnásobení panelů, jehož přebytek by jen odtekl do sítě
    put('battery', 6.4, 4.2, { rot: 90 })
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

// osvětlenost podle ČSN EN 12464-1 [lx] a plocha na jedno svítidlo [m²]
const LUX = {
  office: 500, meeting: 500, sim: 300, gym: 300, lobby: 200, wet: 200, arena: 300,
  play: 300, workshop: 500, storage: 150, plant: 200, circ: 150, reserve: 0,
}
const M2_PER_LUM = (lux) => (lux >= 500 ? 8 : lux >= 300 ? 11 : 16)

// kde se sbírá voda na podlaze
const DRAINED = { wet: 2, workshop: 2, plant: 1 }

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

  // svítidla podle požadované osvětlenosti
  const lux = LUX[b.type] ?? 200
  if (lux > 0) {
    const nl = Math.min(28, Math.max(1, Math.round(a / M2_PER_LUM(lux))))
    const lc = Math.max(1, Math.round(Math.sqrt((nl * w) / d)))
    const lr = Math.ceil(nl / lc)
    for (let i = 0; i < nl; i++) {
      out.push({ kind: 'light', block: b.id, rot: 0, y: ceil + 0.08,
        x: b.x0 + (((i % lc) + 0.5) / lc) * w, z: b.z0 + ((Math.floor(i / lc) + 0.5) / lr) * d })
    }
  }

  // nouzové osvětlení a detekce kouře — bez nich se budova nezkolauduje
  if (a > 15) {
    out.push({ kind: 'emlight', block: b.id, x: b.x0 + w / 2, z: b.z0 + 0.35, y: base + 2.4, rot: 0 })
    const ns = Math.max(1, Math.ceil(a / 60))
    for (let i = 0; i < ns; i++) {
      out.push({ kind: 'smoke', block: b.id, rot: 0, y: ceil,
        x: b.x0 + ((i + 0.5) / ns) * w, z: b.z0 + d / 2 })
    }
  }

  // podlahové vpusti tam, kde se pracuje s vodou
  for (let i = 0; i < (DRAINED[b.type] ?? 0); i++) {
    out.push({ kind: 'floordrain', block: b.id, rot: 0, y: base,
      x: b.x0 + ((i + 0.5) / (DRAINED[b.type] ?? 1)) * w, z: b.z0 + d * 0.55 })
  }

  // podružný rozvaděč na zónu — kvůli podružnému měření po provozech
  if (ZONE_BOARDS[b.id]) {
    out.push({ kind: 'subboard', block: b.id, x: b.x1 - 0.45, z: b.z0 + 0.6, y: base, rot: 90,
      note: `podružné měření: ${ZONE_BOARDS[b.id]}` })
  }
  return out
}

/** Společná hrana dvou bloků, nebo null když spolu nesousedí. */
export function sharedEdge(a, b) {
  const near = (p, q) => Math.abs(p - q) < 0.05
  if (near(a.z1, b.z0) || near(a.z0, b.z1)) {
    const z = near(a.z1, b.z0) ? a.z1 : a.z0
    const p = Math.max(a.x0, b.x0)
    const q = Math.min(a.x1, b.x1)
    return q - p > 1.0 ? { axis: 'x', at: z, from: p, to: q } : null
  }
  if (near(a.x1, b.x0) || near(a.x0, b.x1)) {
    const x = near(a.x1, b.x0) ? a.x1 : a.x0
    const p = Math.max(a.z0, b.z0)
    const q = Math.min(a.z1, b.z1)
    return q - p > 1.0 ? { axis: 'z', at: x, from: p, to: q } : null
  }
  return null
}

/** Vnitřní dveře ze seznamu propojení ve spec. */
export function doorsFor(S) {
  const out = []
  for (const l of S.links ?? []) {
    const a = S.blocks.find((b) => b.id === l.a)
    const b = S.blocks.find((b) => b.id === l.b)
    if (!a || !b) continue
    const e = sharedEdge(a, b)
    if (!e) continue
    const kind = l.type ?? 'door'
    const half = FURN[kind].w / 2
    const pos = Math.min(Math.max(l.at ?? (e.from + e.to) / 2, e.from + half), e.to - half)
    const lvl = a.level === 'full' ? 0 : a.level
    out.push({
      kind, block: a.id, link: `${l.a}–${l.b}`, note: l.note,
      y: levelBase(S, lvl),
      x: e.axis === 'x' ? pos : e.at,
      z: e.axis === 'x' ? e.at : pos,
      rot: e.axis === 'x' ? 0 : 90,
    })
  }
  return out
}

/** Vybavení celé budovy + soupis počtů. */
export function fitoutAll(S) {
  const items = []
  for (const b of S.blocks) items.push(...fitoutFor(S, b), ...derivedFor(S, b))
  items.push(...doorsFor(S))
  const counts = {}
  for (const it of items) counts[it.kind] = (counts[it.kind] || 0) + 1
  // kde přesně se co nevešlo — jinak se hlásí jen číslo a nikdo neví kam sáhnout
  const droppedBy = {}
  for (const b of S.blocks) {
    if (b.fitout === 'shell' || !LAYOUTS[b.id]) continue
    const n = LAYOUTS[b.id](S, b, S.program).length - fitoutFor(S, b).length
    if (n > 0) droppedBy[b.id] = n
  }
  const dropped = Object.values(droppedBy).reduce((a, n) => a + n, 0)
  return { items, counts, dropped, droppedBy }
}
