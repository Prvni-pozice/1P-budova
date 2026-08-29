// fitout.js — vybavení místností. Čistá data, žádný Three → testovatelné v Node.
//
// Počty se ODVOZUJÍ z programu (počty osob) podle norem, rozmístění je dané
// pravidlem na místnost. Souřadnice položek jsou relativní k rohu bloku
// (u podél x, v podél z), takže když se blok posune, vybavení jde s ním.
// Položka, která by po zmenšení bloku vypadla ven, se zahodí.

import { levelBase, TYPES, blockHeight } from './spec.js'

const TYPES_VZT = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, v.vzt]))

// rozměry [m] — w podél u, d podél v, h výška
export const FURN = {
  desk:       { w: 1.60, d: 0.80, h: 0.74, color: 0xd9cbb4, shape: 'table',   label: 'Pracovní stůl' },
  chair:      { w: 0.50, d: 0.52, h: 0.85, color: 0x4a4f57, shape: 'chair',   label: 'Židle' },
  sideboard:  { w: 0.80, d: 0.45, h: 0.75, color: 0xbfb5a5, shape: 'box',     label: 'Nízká skříňka' },
  cabinet:    { w: 0.80, d: 0.45, h: 1.80, color: 0xbfb5a5, shape: 'box',     label: 'Skříň' },
  pod:        { w: 1.20, d: 1.20, h: 2.20, color: 0x6b7280, shape: 'cubicle', label: 'Akustická budka' },
  mtable:     { w: 3.00, d: 1.20, h: 0.74, color: 0xd9cbb4, shape: 'table',   label: 'Jednací stůl' },
  hightable:  { w: 2.20, d: 0.70, h: 1.05, color: 0xd9cbb4, shape: 'table',   label: 'Vysoký komunitní stůl' },
  sofa:       { w: 1.90, d: 0.85, h: 0.78, color: 0x6c8f74, shape: 'sofa',    label: 'Pohovka' },
  table:      { w: 1.60, d: 0.80, h: 0.74, color: 0xd9cbb4, shape: 'table',   label: 'Stůl' },
  rtable:     { w: 0.80, d: 0.80, h: 0.74, color: 0xd9cbb4, shape: 'table',   label: 'Stolek' },
  partyTable: { w: 2.40, d: 0.90, h: 0.74, color: 0xd9a04a, shape: 'table',   label: 'Párty stůl' },
  bench:      { w: 2.40, d: 0.40, h: 0.45, color: 0xc7b299, shape: 'box',     label: 'Lavice' },
  screen:     { w: 1.90, d: 0.08, h: 1.10, color: 0x23272e, shape: 'box',     label: 'Obrazovka' },

  locker:     { w: 0.30, d: 0.50, h: 1.80, color: 0x53707e, shape: 'box',     label: 'Skříňka' },
  valuebox:   { w: 0.30, d: 0.40, h: 1.20, color: 0x53707e, shape: 'box',     label: 'Schránka na cennosti' },
  shoerack:   { w: 1.80, d: 0.40, h: 1.60, color: 0xa89c88, shape: 'rack',    label: 'Botník' },
  changing:   { w: 1.00, d: 1.00, h: 2.10, color: 0xe3e0d8, shape: 'cubicle', solid: true, fix: 'bench', label: 'Převlékací kabinka' },

  wc:         { w: 0.90, d: 1.50, h: 2.10, color: 0xe8ebee, shape: 'cubicle', solid: true, fix: 'wc', label: 'WC kabina' },
  // mísa bez kabiny — do samostatné bezbariérové místnosti (stěny má vlastní)
  toilet:     { w: 0.45, d: 0.70, h: 0.80, color: 0xeef2f5, shape: 'box',     label: 'WC mísa (bezbariérová, s madly)' },
  wcBF:       { w: 2.20, d: 2.40, h: 2.10, color: 0xdde8ee, shape: 'cubicle', solid: true, fix: 'wc', label: 'WC bezbariérové' },
  urinal:     { w: 0.45, d: 0.35, h: 1.20, color: 0xeef2f5, shape: 'box',     label: 'Pisoár' },
  basin:      { w: 0.60, d: 0.45, h: 0.85, color: 0xd9dde1, shape: 'basin',   label: 'Umyvadlo' },
  shower:     { w: 0.90, d: 0.90, h: 2.10, color: 0xd6e9ee, shape: 'cubicle', solid: true, fix: 'shower', label: 'Sprcha' },
  cleaning:   { w: 1.20, d: 1.20, h: 2.10, color: 0xb6bcc4, shape: 'cubicle', solid: true, label: 'Úklidová komora' },

  kitchen:    { w: 2.40, d: 0.60, h: 0.90, color: 0xbfb5a5, shape: 'box',     label: 'Kuchyňská linka' },
  // vybavení bytů (varianta B)
  bed:        { w: 1.60, d: 2.00, h: 0.55, color: 0xc9b7a0, shape: 'box',     label: 'Manželská postel' },
  bedS:       { w: 0.90, d: 2.00, h: 0.55, color: 0xc9b7a0, shape: 'box',     label: 'Postel jednolůžko' },
  wardrobe:   { w: 1.60, d: 0.60, h: 2.10, color: 0xbfb5a5, shape: 'box',     label: 'Šatní skříň' },
  washer:     { w: 0.60, d: 0.60, h: 0.85, color: 0xdfe3e6, shape: 'box',     label: 'Pračka' },
  wcbowl:     { w: 0.40, d: 0.65, h: 0.80, color: 0xeef2f5, shape: 'box',     label: 'WC mísa' },
  skylight:   { w: 1.00, d: 1.40, h: 0.08, color: 0x9fd4e8, shape: 'box',     label: 'Střešní okno' },
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
  tyreloft:   { w: 3.20, d: 1.60, h: 0.55, color: 0x3f4a52, shape: 'rack',    label: 'Závěsný sklad pneu' },
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
  service:    { w: 0.90, d: 0.12, h: 2.00, color: 0x8a8f98, shape: 'door',    label: 'Servisní dveře' },
  escape:     { w: 0.90, d: 0.12, h: 2.00, color: 0x2fbf5f, shape: 'door',    label: 'Požární dveře s panikovým kováním' },
  picture:    { w: 0.90, d: 0.08, h: 1.00, color: 0x4a4033, shape: 'picture', label: 'Obraz' },
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
  elevator:   { w: 1.40, d: 1.60, h: 5.70, color: 0x9fb6c4, shape: 'cubicle', label: 'Výtahová šachta (bezbariérový přístup)' },
  glass:      { w: 4.00, d: 0.08, h: 3.00, color: 0x9fd4e8, shape: 'net',     label: 'Prosklená příčka' },
  sidelight:  { w: 1.90, d: 0.08, h: 2.60, color: 0x9fd4e8, shape: 'net',     label: 'Boční sklo zádveří' },
  acpanel:    { w: 1.20, d: 0.06, h: 1.00, color: 0x3a3f47, shape: 'box',     label: 'Akustický panel' },
  louvre:     { w: 1.50, d: 0.15, h: 1.20, color: 0x8a9199, shape: 'box',     label: 'Protidešťová žaluzie VZT' },
}

/**
 * Jaké přípojky která položka potřebuje. Odtud vede mep.js koncové větve —
 * tohle je rozdíl mezi „schéma páteře" a použitelným podkladem pro projektanta.
 * conn = výška napojení nad podlahou [m].
 */
export const SVC = {
  basin:      { svc: ['water', 'drain'], conn: 0.55 },
  wc:         { svc: ['water', 'drain'], conn: 0.30 },
  toilet:     { svc: ['water', 'drain'], conn: 0.30 },
  wcBF:       { svc: ['water', 'drain'], conn: 0.30 },   // chybělo — bezbar. kabina byla bez vody
  cleaning:   { svc: ['water', 'drain'], conn: 0.50 },   // úklidová komora má výlevku uvnitř
  urinal:     { svc: ['water', 'drain'], conn: 0.60 },
  shower:     { svc: ['water', 'drain'], conn: 0.20 },
  wcbowl:     { svc: ['water', 'drain'], conn: 0.30 },
  washer:     { svc: ['water', 'drain', 'elec'], conn: 0.70 },
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
  hightable:  { svc: ['elec'], conn: 0.95 },
  screen:     { svc: ['elec', 'data'], conn: 1.10 },
  rack19:     { svc: ['elec', 'data'], conn: 1.20 },
  simrig:     { svc: ['elec', 'data'], conn: 0.30 },
  reception:  { svc: ['elec', 'data'], conn: 0.80 },
  printer3d:  { svc: ['elec', 'data'], conn: 0.30 },
  workbench:  { svc: ['elec'], conn: 0.90 },
  compressor: { svc: ['elec'], conn: 0.40 },
  carlift:    { svc: ['elec'], conn: 0.60 },       // 400 V
  elevator:   { svc: ['elec'], conn: 1.20 },
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
  // Zrcadlený blok (b.mirror) překlopí u i rotaci. Píše se tedy jen jedna
  // dispozice bytu a druhý byt na patře je její zrcadlo — bez druhého layoutu
  // a bez rizika, že se obě verze rozejdou.
  const W = b.x1 - b.x0
  const put = (kind, u, v, o = {}) => {
    const rot = o.rot ?? 0
    items.push({ kind, block: b.id,
      x: b.x0 + (b.mirror ? W - u : u), z: b.z0 + v, y: y + (o.dy ?? 0),
      rot: b.mirror ? (360 - rot) % 360 : rot, note: o.note,
      ...(o.img && { img: o.img, pw: o.pw, ph: o.ph, py: o.py }) })
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
    const { items, put, row, desks, seat } = maker(S, b)
    // typ 1: klasické pracovní stoly (bench) — počet z programu
    const n1 = Math.ceil(P.office.desks / 2 / 2)
    desks(1.0, 2.8, n1)
    desks(1.0, 6.4, Math.max(0, Math.ceil(P.office.desks / 2) - n1))
    // typ 2: vysoký komunitní stůl se stoličkami
    put('hightable', 2.2, 9.7)
    for (const du of [-0.8, 0, 0.8]) {
      seat(2.2 + du, 10.4, 2.2 + du, 9.7)
      seat(2.2 + du, 9.0, 2.2 + du, 9.7)
    }
    // typ 3: lounge — pohovky se stolkem; jižněji od hrany kuchyňského
    // koutu, aby zůstal průchod do commons (openPair, žádné dveře)
    put('sofa', 0.95, 12.9, { rot: 90 })
    put('sofa', 2.3, 13.55, { rot: 180 })
    put('rtable', 2.2, 12.6)
    // vybavení volně při stěnách, ať prostor působí společně
    row('sideboard', 1.2, 0.35, 4, 0.9)
    row('cabinet', 6.55, 6.4, 3, 0.9, { along: 'v', rot: 90 })
    put('pod', 5.7, 5.7, { note: 'akustická budka na hovory' })
    // u v 11,7 jsou dveře do lobby — skříň a tiskárna jim uhýbají
    put('rack19', 6.55, 9.8, { rot: 90, note: 'uzamykatelná serverová skříň' })
    put('printer3d', 6.55, 13.6, { rot: 90, note: 'sdílená tiskárna' })
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
    put('co2', 0.15, 3.0, { rot: 90, dy: 1.6 })
    row('sideboard', 5.3, 1.0, 2, 0.9, { along: 'v', rot: 90 })
    // galerie: jižní stěna tři rámy, západní dva (dveře jsou až u v 4,6)
    put('picture', 1.2, 0.15, { img: '/art/zasedacka1.jpg', pw: 0.8,  ph: 1.05, py: 1.6, note: 'portrét' })
    put('picture', 2.9, 0.15, { img: '/art/zasedacka4.jpg', pw: 1.35, ph: 0.95, py: 1.6 })
    put('picture', 4.6, 0.15, { img: '/art/zasedacka5.jpg', pw: 1.35, ph: 0.95, py: 1.6 })
    put('picture', 5.65, 1.4, { rot: 90, img: '/art/zasedacka2.jpg', pw: 0.85, ph: 1.1, py: 1.6 })
    put('picture', 5.65, 3.0, { rot: 90, img: '/art/zasedacka3.jpg', pw: 0.85, ph: 1.1, py: 1.6 })
    return items
  },
  commons: (S, b) => {
    const { items, put, row, seat } = maker(S, b)
    // kuchyňský kout volně u stěn — bez dveří, teče do komunitního prostoru
    put('kitchen', 2.15, 3.0)
    put('fridge', 3.68, 2.95)
    put('hightable', 1.15, 1.0, { note: 'jídelní stůl u proskleného štítu' })
    for (const du of [-0.7, 0.7]) {
      seat(1.15 + du, 1.7, 1.15 + du, 1.0)
      seat(1.15 + du, 0.35, 1.15 + du, 1.0)
    }
    return items
  },
  'wc-gf': (S, b, P) => {
    const { items, put, row } = maker(S, b)
    // jediná uzavřená část komunitní zóny; dveře jsou u východní stěny
    const sOff = sanitaryFor(P.office.staffTarget)
    row('wc', 0.75, 2.55, sOff.wcW + sOff.wcM, 1.0, { rot: 180 })
    put('urinal', 0.35, 1.5, { rot: 270 })
    row('basin', 2.7, 1.7, sOff.basins, 0.7, { along: 'v', rot: 90 })
    return items
  },
  reserve: () => [],  reserve: () => [],                                           // hrubá stavba
  corridor: (S, b) => {
    const { items, put } = maker(S, b)
    // ke stěně, ne do osy chodby — chodba má jen 1,2 m; a dál od dveří
    // (na z 4,0 stál přímo v otvoru dveří klidových místností)
    put('extinguisher', 0.16, 10.0)
    put('hydrant', 0.15, 8.0, { rot: 270, dy: 0.6, note: 'hydrant patra — dole je jen v lobby' })
    return items
  },

  // -------------------------------------------------------------- lobby
  lobby: (S, b, P) => {
    const { items, put, row, seat, around } = maker(S, b)
    put('entrymat', 4.6, 1.0)
    put('glazed', 3.5, 0.14, { note: 'hlavní vstupní dveře' })
    put('exitsign', 3.5, 0.45, { dy: 2.35 })
    // zádveří jako skutečný vestibul: pevná boční skla + prosklené dveře
    // uprostřed, které se před postavou samy otevřou (jediná cesta dál)
    put('sidelight', 1.75, 2.1)
    put('sidelight', 5.25, 2.1)
    put('glazed', 3.5, 2.1, { note: 'vnitřní dveře zádveří' })
    put('sidelight', 2.62, 1.1, { rot: 90 })
    put('sidelight', 4.38, 1.1, { rot: 90 })
    // Rozložení lobby stojí na jednom pravidle: západ patří jádru a baru,
    // střed a východ zůstávají volné pro hlavní trasu vstup → posezení →
    // severní pruh (šatny, aréna, schodiště). Ověřuje to walk test —
    // původní rozložení přehradilo lobby barovou linií po celé šířce
    // a návštěvník se od vstupu nedostal ani ke schodišti, ani do arény.
    put('reception', 1.8, 3.7)
    put('bar', 5.1, 3.7)
    // zadní bar podél západní stěny (ne za barmanem — tam vede přístup
    // ke kapse výtahu), zásoba a úklid pod schodištěm
    row('backbar', 0.25, 3.55, 2, 1.1, { along: 'v', rot: 90 })
    put('fridge', 0.3, 2.5)
    put('barstore', 0.3, 6.0, { rot: 90, note: 'zásoba baru pod schodištěm' })
    put('pram', 1.8, 1.3, { note: 'rodinný provoz bez odstavení kočárků nefunguje' })
    // zouvací kout u jižní stěny vpravo od vstupu — do arény jen
    // v protiskluzových ponožkách; u stěny arény přehrazoval průchod
    put('gymbench', 5.75, 1.0)
    put('shoerack', 6.55, 2.1, { rot: 90 })
    // 3 patra sloupců; rodiny sdílejí, na 40 lidí ve špičce to stačí.
    // U jižní stěny vpravo od vstupu — východní stěna je průchod do arény.
    row('valuebox', 5.5, 0.35, 3, 0.32, { note: 'cennosti, 3 patra' })
    // Schodišťové jádro u západní stěny: schodiště stoupá na SEVER a ústí
    // nahoře do jádra a odtud do chodby, výtah stojí vedle něj.
    put('stairs', 0.6, 8.3, { rot: 180, note: 'výstup na jih, do jádra a odtud do chodby' })
    put('elevator', 2.1, 8.5, { note: 'bezbariérový přístup do patra, u schodiště' })
    // úklidová komora pod VYSOKOU částí ramene — u severního pruhu
    // zužovala cestu k pánské šatně na 0,3 m
    put('cleaning', 1.35, 6.95, { note: 'úklidová komora pod schodištěm' })
    // Vyhrazený stůl pro oslavy (party místnost se nestaví — jen stůl u baru).
    // SEVERNÍ PRUH LOBBY (v > 10) MUSÍ ZŮSTAT PRÁZDNÝ: je to cesta
    // kavárna → šatny → aréna, kterou si Zdeněk vyžádal. Šest míst — krajní
    // sloupec židlí by uzavřel průchod podél arény.
    put('partyTable', 4.05, 9.0, { note: 'vyhrazený stůl pro oslavy' })
    for (let i = 0; i < 3; i++) {
      const u = 3.45 + i * 0.6
      seat(u, 8.25, u, 9.0)
      seat(u, 9.75, u, 9.0)
    }
    // prosklení do arény zůstává v JIŽNÍ části stěny — severní část stěny
    // (v 8–12) je vynechaná, tudy se do arény vchází
    put('glass', 6.95, 4.5, { rot: 90, note: 'výhled do arény' })
    // na západní stěně pod sebou: hydrant, lékárnička, lednice, zadní bar
    put('hydrant', 0.4, 0.7, { rot: 90, dy: 0.6 })
    put('firstaid', 0.15, 1.6, { rot: 90, note: 'lékárnička + AED u recepce' })
    return items
  },

  // ------------------------------------------------------- šatny a WC
  // Dělené šatny (16. 8.). Obě mají stejnou logiku: od vstupu (v = 0, ze
  // severního pruhu lobby) šatnová část se skříňkami a lavicí, vzadu mokrá
  // část — 2 sprchy, umyvadla, kabiny. Pánská má navíc 2 pisoáry, dámská
  // nese bezbariérovou kabinu a přebalovací pult (jsou jen jednou v domě).
  // Počty kabin z normy na POLOVINU špičky, protože blok obsluhuje jedno pohlaví.
  // Pánská 3 × 6 m. Vstup v u = 1,5 od severního pruhu lobby, před dveřmi
  // musí zůstat 0,85 m volných — proto šatnová část začíná až na v = 1,0
  // a kabiny na v = 1,6. Kabiny jdou na východ HLOUBKOU (rot 90), jinak se
  // do 3 m šířky nevejdou.
  // V šířce 3 m se vejde jen JEDNA hluboká řada — skříňky a umyvadla na
  // západní stěně (0,5 m), kabiny a pisoáry na východní (1,5 m), sprchy
  // u severní stěny, střední ulička ~1 m po celé hloubce. Původní layout
  // měl lavici napříč a do mokré části se nedalo projít.
  'wc-men': (S, b, P) => {
    const { items, put, row } = maker(S, b)
    const s = sanitaryFor(P.arena.peak, { publicUse: true })
    put('gymbench', 0.35, 1.5, { rot: 90 })
    row('locker', 0.25, 2.55, 4, 0.32, { along: 'v', rot: 90 })
    row('urinal', 2.8, 1.5, 2, 0.55, { along: 'v', rot: 90 })
    for (let i = 0; i < s.wcM; i++) put('wc', 2.25, 3.0 + i * 0.95, { rot: 270 })
    row('basin', 0.3, 4.2, Math.floor(s.basins / 2), 0.55, { along: 'v', rot: 90 })
    row('shower', 0.75, 5.55, 2, 1.0)
    return items
  },
  // Bezbariérové WC — samostatná místnost 2,6 × 2,8 m s dveřmi přímo z lobby
  // (kabina uvnitř šatny nesplňovala přístup dle vyhl. 398/2009). Mísa má
  // volný manévrovací prostor, umyvadlo u západní stěny, přebalovací pult
  // tady (bezbariérová + přebalovací bývá jedna místnost).
  'wc-bf': (S, b) => {
    const { items, put } = maker(S, b)
    put('toilet', 0.65, 2.3, { rot: 180, note: 'mísa s madly, přístup z obou stran' })
    put('basin', 0.45, 0.9, { rot: 270 })
    put('babychange', 2.3, 1.3, { rot: 90, note: 'v rodinném provozu povinná výbava' })
    return items
  },
  // Vstupní ulička dámské šatny (1,4 × 2,8) — skříňky podél západní stěny,
  // průchod 0,9 m do hlavní části. Skříňky až od v 1,2, ať neblokují dveře.
  'wc-women-s': (S, b, P) => {
    const { items, put, row } = maker(S, b)
    row('locker', 0.25, 1.2, 3, 0.32, { along: 'v', rot: 90 })
    put('basin', 0.25, 2.5, { rot: 90 })
    return items
  },
  // Hlavní část dámské šatny 4 × 3,2 m: kabiny a sprchy u severní stěny,
  // lavice na jihu, umyvadla u východní stěny. Vstup JV rohem z uličky.
  // Kabiny jsou 2 běžné — třetí dámskou kabinu dle normy plní bezbariérová
  // místnost wc-bf hned vedle (počítá se do počtu, vyhl. 398/2009).
  'wc-women': (S, b, P) => {
    const { items, put, row } = maker(S, b)
    const s = sanitaryFor(P.arena.peak, { publicUse: true })
    row('wc', 0.75, 2.4, s.wcW - 1, 1.0, { rot: 180 })
    row('shower', 2.7, 2.55, 2, 0.9)
    put('gymbench', 0.85, 0.35)
    put('basin', 2.65, 0.35)
    return items
  },

  // Sanita patra 3 × 3 m — malá, ale úplná: kabina, sprcha, umyvadlo.
  // Visí na CHODBĚ, takže na ni dosáhne kancelář i zasedačka, nejen fitness.
  // Dveře jsou u jižního rohu (v = 0,6), aby před nimi zbylo volné místo.
  'wc-1f-w': (S, b) => {
    const { items, put, row } = maker(S, b)
    row('wc', 2.25, 0.55, 2, 1.0, { along: 'v', rot: 90 })
    put('shower', 1.5, 2.5)
    put('basin', 2.75, 2.6, { rot: 90 })
    return items
  },
  'wc-1f-m': (S, b) => {
    const { items, put, row } = maker(S, b)
    put('wc', 2.25, 0.55, { rot: 90 })
    row('urinal', 2.8, 1.6, 2, 0.55, { along: 'v', rot: 90 })
    put('shower', 1.5, 2.5)
    put('basin', 0.8, 0.5)
    return items
  },

  // Jádro samo nic nenese — schodiště a výtah stojí PŘÍZEMÍM v lobby
  // (odtud se do nich vstupuje) a jen prorážejí strop do tohoto bloku.
  // Kdyby seděly v bloku patra, měly by patu ve výšce 3,3 m.
  core: () => [],

  // -------------------------------------------------------------- aréna
  arena: (S, b, P) => {
    const { items, put, row } = maker(S, b)
    // u = 0 je stěna do lobby, odkud se vchází → 1,2 m vstupní ulička,
    // pole trampolín začíná až za ní. Bez toho se dveře otevřou na lóže.
    const COLS = [2.25, 4.70]                 // lože 2,10 → u 1,2–3,3 a 3,65–5,75
    put('coatrack', 0.35, 4.6, { rot: 90, note: 'odkládání u vstupu' })
    put('escape', 0.9, 0.14, { note: 'únikový východ' })
    put('exitsign', 0.9, 0.45, { dy: 2.35 })
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
    row('destrat', 3.5, 4.5, 2, 7.0, { along: 'v', dy: 5.2 })
    put('co2', 6.85, 8.0, { rot: 270, dy: 1.6, note: 'VZT na plný výkon jen když jsou tam lidi' })
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
  // Fitness je po vestavbě sanity a jádra do L: jižní pás (7×6,6) nese
  // stroje a rozcvičovnu, severní výběžek (4×5,4) volné váhy u prosklení
  // do arény. Mezi nimi není příčka, je to jedna místnost.
  gym: (S, b, P) => {
    const { items, put, row } = maker(S, b)
    for (let i = 0; i < P.gym.cages; i++) {
      const u = 2.2 + i * 1.8
      put('cage', u, 4.0)
      put('gymbench', u, 4.0)                                  // lavička v kleci
    }
    row('mat', 1.7, 1.0, 2, 2.2)
    // lavičky u jižní stěny — u stěny arény zavíraly průchod do gym-n
    row('gymbench', 3.3, 0.35, 2, 1.7)
    put('picture', 0.15, 1.0, { rot: 270, img: '/art/posilka1.jpg', pw: 1.5, ph: 0.85, py: 1.6 })
    put('picture', 0.15, 2.5, { rot: 270, img: '/art/posilka2.jpg', pw: 1.2, ph: 1.0, py: 1.6 })
    put('picture', 0.15, 4.0, { rot: 270, img: '/art/posilka3.jpg', pw: 1.2, ph: 1.0, py: 1.6 })
    put('exitsign', 0.35, 2.5, { rot: 90, dy: 2.3, note: 'směr úniku na chodbu' })
    put('co2', 0.15, 4.4, { rot: 90, dy: 1.6 })
    return items
  },
  'gym-n': (S, b) => {
    const { items, put } = maker(S, b)
    // stojan podél západní stěny — napříč místností přehradil vstup z gym
    put('dumbbells', 0.35, 2.0, { rot: 90 })
    put('gymbench', 2.6, 2.6)
    put('mat', 2.0, 4.0)
    put('glass', 3.95, 3.5, { rot: 90, note: 'výhled do arény' })
    put('mirror', 0.06, 4.8, { rot: 90, note: 'zrcadlo u volných vah' })
    put('cleansink', 0.3, 6.7, { rot: 270, note: 'úklid v patře — voda se nenosí po schodech' })
    return items
  },
  sim: (S, b, P) => {
    const { items, put, row, around } = maker(S, b)
    for (let i = 0; i < P.sim.rigs; i++) put('simrig', 1.0 + i * 2.0, 4.5)
    put('picture', 2.0, 5.68, { rot: 180, img: '/art/sim.jpg', pw: 1.0, ph: 1.3, py: 1.45,
      note: 'foto ze závodů' })
    put('rack19', 3.6, 0.6)
    row('acpanel', 1.2, 5.87, 2, 1.6, { rot: 180, dy: 1.3 })
    put('rtable', 1.1, 1.3)
    around(1.1, 1.3, [[-0.78, 0], [0.78, 0]])
    put('fridge', 3.6, 1.9)
    return items
  },

  // ------------------------------------------------------- dílna a sklad
  workshop: (S, b, P) => {
    const { items, put, row } = maker(S, b)
    // u = 0 je stěna k aréně, v = 0 jižní stěna s vraty (u 2,2–6,2)
    put('service', 1.0, 0.14, { note: 'vstup pro personál' })
    put('exitsign', 1.0, 0.45, { dy: 2.35 })
    if (P.workshop.carLift) {
      put('carlift', 4.2, 2.4, { note: 'světlá výška 4,2 m — nad tím nesmí být mezipatro' })
      put('car', 4.2, 3.0, { note: 'vozidlo na zvedáku' })
    }
    put('car', 4.4, 9.2, { note: 'odstavené vozidlo pod mezipatrem' })
    put('workbench', 1.8, 4.4, { rot: 90 })                  // pracoviště 3D tisku
    row('printer3d', 1.8, 3.95, P.workshop.printers, 0.8, { along: 'v', dy: 0.92,
      note: 'tiskárny stojí na ponku' })
    row('workbench', 1.3, 6.6, P.workshop.benches, 2.1, { along: 'v', rot: 90 })
    row('toolchest', 0.6, 2.2, 2, 1.45, { along: 'v', rot: 90 })
    row('toolcart', 0.55, 5.9, 2, 1.1, { along: 'v' })
    put('oildrum', 6.6, 5.3)
    put('compressor', 6.6, 6.2)
    put('airreel', 6.6, 3.4, { rot: 270, dy: 1.2 })
    put('aircurtain', 4.2, 0.5, { dy: 4.15, note: 'nad vraty — jinak se při každém vjezdu vytopí ven' })
    put('cleansink', 0.4, 12.6, { rot: 270 })
    put('tyreloft', 4.2, 2.4, { dy: 4.5, note: 'závěsný sklad pneu nad zvedákem' })
    return items
  },
  'store-gf': (S, b) => {
    const { items, put, row } = maker(S, b)
    // sklad v přízemí — paletové regály obsluhované vozíkem přímo z dílny
    row('palrack', 1.75, 4.4, 2, 2.9)
    put('palrack', 0.55, 2.4, { rot: 90 })
    put('partshelf', 4.9, 0.55)
    put('stairs', 6.3, 2.3, { note: 'do technické místnosti v patře' })
    return items
  },

  // ----------------------------------------------------------- strojovna
  plant: (S, b) => {
    const { items, put, row } = maker(S, b)
    // VZT jednotky u severní stěny vedle sebe, hydraulika TČ a nádrže
    // uprostřed, rozvaděče u jižní stěny, baterie u východní. Před vším
    // zůstává manipulační prostor — servis se dělá zepředu.
    row('ahu', 2.1, 3.9, 2, 3.1)
    put('hpmodule', 1.5, 1.6)
    row('tank', 3.2, 1.6, 2, 1.0)
    row('board', 1.6, 0.35, 3, 1.1)
    put('battery', 6.5, 1.5, { rot: 90 })
    // Sání a výfuk VZT: severní stěna je slepá (soused) a jižní hrana bloku
    // je vnitřní (nad dílnou) — žaluzie proto jdou do ZÁPADNÍHO štítu etapy 1.
    // Při dostavbě etapy 2 se přesunou na střechu (výdechové hlavice).
    put('louvre', 6.85, 1.2, { rot: 90, dy: 1.6, note: 'sání — štít etapy 1' })
    put('louvre', 6.85, 3.4, { rot: 90, dy: 1.6, note: 'výfuk — štít etapy 1' })
    return items
  },

  // ==================================================================
  // VARIANTA B — s pěti jednotkami. Bloky, které mají ve verzi A stejné id,
  // ale jiný rozměr, si dispozici vybírají přes `layout` ve spec-byty.js.
  // ==================================================================

  // Recepce 7 × 3,2 m: zádveří, pult, dvě křesla. Vstup je uprostřed
  // (portál v jižní fasádě); za recepcí je otevřené jádro se schodištěm
  // (openPair), dveře do komunitního prostoru u západní stěny.
  reception: (S, b) => {
    const { items, put, seat } = maker(S, b)
    put('entrymat', 3.5, 1.0)
    put('glazed', 3.5, 0.14, { note: 'hlavní vstup do firmy a k jednotce 5' })
    put('exitsign', 3.5, 0.45, { dy: 2.35 })
    put('reception', 5.6, 2.5, { note: 'pult — vidí na vstup i na schodiště' })
    seat(5.6, 3.0, 5.6, 2.5)
    put('sofa', 0.55, 1.3, { rot: 90, note: 'čekání' })
    put('rtable', 1.7, 1.3)
    put('hydrant', 6.8, 0.45, { rot: 90, dy: 0.6 })
    put('firstaid', 6.78, 1.6, { rot: 90, note: 'lékárnička + AED u pultu' })
    return items
  },

  // Jádro za recepcí (iterace 1): 3,8 × 5,8 m, otevřené do vstupní haly.
  // Schodiště podél východní stěny stoupá na sever a ústí do podesty patra;
  // výtah u západní stěny na severním konci, aby nestál v nástupu schodů.
  'core-b': (S, b) => {
    const { items, put } = maker(S, b)
    // Schodiště podél ZÁPADNÍ stěny (vidíš ho hned od vstupu), výtah
    // u východní stěny na jižním konci. Východní stěna u severu zůstává
    // volná — vedou tam dveře do fitness (z 7–9) a na sever do kanceláří.
    put('stairs', 0.6, 2.9, { note: 'nástup hned za recepcí, výstup na sever do podesty' })
    put('elevator', 3.15, 1.0, { note: 'bezbariérový přístup do patra i k jednotce 5' })
    put('exitsign', 2.0, 0.3, { dy: 2.35, note: 'směr úniku přes recepci' })
    return items
  },
  // Podesta v patře: jen bezpečnostní výbava, prostor je průchod do chodby.
  'core-1f-b': (S, b) => {
    const { items, put } = maker(S, b)
    put('hydrant', 0.15, 2.2, { rot: 90, dy: 0.6, note: 'hydrant patra' })
    put('extinguisher', 0.16, 3.4)
    return items
  },
  'corridor-b': (S, b) => {
    const { items, put } = maker(S, b)
    put('extinguisher', 0.16, 4.5)
    return items
  },

  // Západní pruh komunitního prostoru 3,2 × 11,4: lounge, vysoký stůl
  // a dvě dvojice stolů. Pruh u kuchyňského koutu (v > 10,8) zůstává
  // průchozí — openPair do commons nemá dveře, jen volný průchod.
  'office-b': (S, b, P) => {
    const { items, put, desks, seat } = maker(S, b)
    // jižní 2 m pruhu zůstávají volné — je to nástup od dveří z recepce.
    // Tři bench dvojice podél západního okna; severní konec pruhu zůstává
    // prázdný jako cesta ke kuchyňskému koutu — vysoký stůl se sezením
    // je hned vedle v commons, do 3,2 m pruhu se druhý nevešel.
    desks(1.0, 2.8, 1)
    desks(1.0, 5.5, 1)
    desks(1.0, 8.2, 1)
    return items
  },
  // Pracovní zóna za jádrem 3,8 × 5,6: zbytek stolů z programu, budka,
  // server a tiskárna. S office-b tvoří jednu místnost do L (openPair).
  'office-e': (S, b, P) => {
    const { items, put, desks } = maker(S, b)
    desks(1.15, 2.6, 2)
    put('pod', 3.1, 4.6, { note: 'akustická budka na hovory' })
    put('rack19', 3.45, 0.6, { rot: 90, note: 'uzamykatelná serverová skříň' })
    put('printer3d', 3.45, 1.35, { rot: 90, note: 'sdílená tiskárna' })
    return items
  },
  // Fitness 7 × 7 u jádra (iterace 4). Nad ním bydlí jednotka 5 —
  // těžká plovoucí podlaha (FINISH gym 0,14) tlumí kročejový hluk.
  'gym-b': (S, b, P) => {
    const { items, put, row } = maker(S, b)
    for (let i = 0; i < P.gym.cages; i++) {
      const u = 2.4 + i * 1.9
      put('cage', u, 5.4)
      put('gymbench', u, 5.4)
    }
    put('dumbbells', 5.8, 4.0, { rot: 90 })
    row('mat', 1.7, 2.9, 2, 2.4)
    row('gymbench', 4.9, 1.9, 2, 1.4, { along: 'v' })
    put('mirror', 3.0, 0.06, { note: 'zrcadlo na stěně k bytům — zároveň akustický obklad' })
    put('picture', 0.15, 3.4, { rot: 270, img: '/art/posilka1.jpg', pw: 1.5, ph: 0.85, py: 1.6 })
    put('picture', 0.15, 5.2, { rot: 270, img: '/art/posilka2.jpg', pw: 1.2, ph: 1.0, py: 1.6 })
    put('cleansink', 6.7, 6.6, { rot: 270, note: 'úklid sportovní části' })
    put('co2', 0.15, 6.5, { rot: 90, dy: 1.6 })
    put('exitsign', 0.35, 1.5, { rot: 90, dy: 2.3, note: 'směr úniku přes jádro a recepci' })
    return items
  },

  'sim-b': (S, b, P) => {
    const { items, put, row, around } = maker(S, b)
    for (let i = 0; i < P.sim.rigs; i++) put('simrig', 1.2 + i * 1.7, 1.6)
    put('rtable', 2.0, 4.6)
    around(2.0, 4.6, [[-0.78, 0], [0.78, 0]])
    put('fridge', 3.6, 6.5)
    put('rack19', 0.5, 6.4)
    put('picture', 2.0, 6.9, { rot: 180, img: '/art/sim.jpg', pw: 1.0, ph: 1.3, py: 1.45 })
    row('acpanel', 1.2, 6.87, 2, 1.6, { rot: 180, dy: 1.3 })
    return items
  },

  // Šatna a sprchy sportu 4 × 4: bezbariérová kabina (vyhl. 398/2009),
  // běžná kabina, sprcha, dvě umyvadla, skříňky. Vstup z fitness (z jihu).
  'wc-pub': (S, b) => {
    const { items, put, row } = maker(S, b)
    put('wcBF', 1.3, 2.75, { note: 'jediná bezbariérová kabina v domě' })
    put('wc', 3.25, 3.25, { rot: 90 })
    put('shower', 3.5, 1.9)
    row('basin', 2.9, 0.45, 2, 0.75)
    row('locker', 0.28, 0.5, 3, 0.35, { along: 'v', rot: 90 })
    return items
  },

  // Sanita patra 3,2 × 5,8 vedle podesty — obsluhuje kanceláře, zasedačku
  // i rezervu. Dveře z podesty na východní stěně (z ≈ 5).
  'wc-1f': (S, b) => {
    const { items, put, row } = maker(S, b)
    row('wc', 0.75, 4.95, 2, 1.0)
    put('urinal', 2.95, 5.4, { rot: 90 })
    row('basin', 0.3, 2.4, 2, 0.7, { along: 'v', rot: 90 })
    put('cleaning', 0.7, 0.75, { note: 'úklidová komora patra' })
    return items
  },

  // -------------------------------------------------- jednotka 5 (iterace 2)
  // 98 m² bez fasády — denní světlo dávají střešní okna (nad jednotkou už je
  // jen střecha). Vybavená lehce a neutrálně: musí obstát jako kancelář
  // i jako byt 3+kk, takže stoly, sezení a úložení, žádná pevná vestavba.
  'u5-main': (S, b) => {
    const { items, put, row, around, seat } = maker(S, b)
    put('table', 3.0, 3.5)
    around(3.0, 3.5, [[-1.05, 0], [1.05, 0]])
    put('table', 7.2, 1.0)
    seat(7.2, 1.7, 7.2, 1.0)
    put('table', 9.0, 1.0)
    seat(9.0, 1.7, 9.0, 1.0)
    put('sofa', 9.6, 5.6, { rot: 180 })
    put('rtable', 9.6, 4.4)
    row('cabinet', 5.6, 6.6, 3, 1.0)
    put('wardrobe', 0.9, 6.6)
    // střešní okna — dvě řady po třech, jediné denní světlo jednotky
    for (const uu of [1.9, 5.6, 9.3]) {
      put('skylight', uu, 1.8, { dy: 2.62 })
      put('skylight', uu, 5.2, { dy: 2.62 })
    }
    return items
  },
  'u5-w': (S, b) => {
    const { items, put, seat } = maker(S, b)
    // linka u severní stěny, jídelní stolek uprostřed; vstupní dveře
    // z chodby jsou u jižního konce západní stěny (z = 10) — před nimi volno
    put('kitchen', 1.3, 4.45)
    put('fridge', 0.35, 3.6)
    put('washer', 2.35, 3.55, { note: 'pračka v jednotce' })
    put('skylight', 1.35, 1.2, { dy: 2.62 })
    return items
  },
  'u5-bath': (S, b) => {
    const { items, put } = maker(S, b)
    put('shower', 0.5, 0.55)
    put('wcbowl', 0.35, 1.5, { rot: 90 })
    put('basin', 1.35, 0.35)
    return items
  },

  // ------------------------------------------------- nudle (varianta C)
  // Byt 3+kk přes celý rozpon 18 m. Chodbový pruh 1,8 m, pokojový ~2,87 m.
  // Základní orientace = chodba NA VÝCHODĚ (byt B); byty A a C jsou
  // zrcadlené přes b.mirror — maker překlopí u i rotace.

  'nudle-hall': (S, b) => {
    const { items, put } = maker(S, b)
    put('door', 0.9, 0.14, { note: 'vlastní vstup z pavlače' })
    put('smoke', 0.45, 0.5, { dy: blockHeight(S, b) - 0.3, note: 'autonomní hlásič — povinný v bytě' })
    return items
  },

  // Chodbová část obýváku zůstává prázdná — je průchozí (předsíň → chodba).
  'nudle-livw': () => [],

  // Pokojový pruh obýváku: kuchyň na severním konci ZÁDY k WC a koupelně
  // (jedna stoupačka), jídelní stůl uprostřed, sezení u jižního okna.
  'nudle-liv': (S, b) => {
    const { items, put, seat } = maker(S, b)
    put('kitchen', 1.35, 5.85)
    put('fridge', 0.35, 4.85)
    put('table', 0.7, 3.4, { rot: 90 })
    seat(1.5, 3.0, 0.7, 3.0)
    seat(1.5, 3.8, 0.7, 3.8)
    put('sofa', 1.15, 0.75, { note: 'sezení u jižního okna' })
    put('screen', 0.1, 2.2, { rot: 90, dy: 1.1, note: 'TV na západní stěně' })
    return items
  },

  // Chodba 1,8 × 8 m: skříně podél vnější stěny (0,6 m), průchod 1,2 m.
  // Dveře do pokojů jsou v protější stěně, skříně jim nepřekážejí.
  'nudle-corr': (S, b) => {
    const { items, put, row } = maker(S, b)
    row('wardrobe', 1.5, 1.6, 3, 1.9, { along: 'v', rot: 90 })
    put('smoke', 0.6, 7.0, { dy: blockHeight(S, b) - 0.3, note: 'hlásič na únikové cestě' })
    return items
  },

  'nudle-wc': (S, b) => {
    const { items, put } = maker(S, b)
    put('wcbowl', 0.4, 0.65, { rot: 270 })
    put('basin', 1.4, 0.3)
    return items
  },

  'nudle-bath': (S, b) => {
    const { items, put } = maker(S, b)
    put('shower', 0.55, 1.45)
    put('washer', 1.6, 1.6, { note: 'pračka v bytě' })
    put('basin', 0.5, 0.35)
    return items
  },

  'nudle-shatna': (S, b) => {
    const { items, put } = maker(S, b)
    put('wardrobe', 0.85, 1.15, { note: 'u severní stěny — východní třetina patří dveřím' })
    put('sideboard', 0.25, 0.4, { rot: 90 })
    return items
  },

  'nudle-bed': (S, b) => {
    const { items, put } = maker(S, b)
    put('bed', 1.15, 1.7, { note: 'hlava k severní stěně' })
    put('sideboard', 2.45, 0.4, { rot: 90 })
    put('skylight', 1.4, 0.75, { rot: 90, dy: 2.62, note: 'jediné denní světlo ložnice' })
    return items
  },

  // Dětský pokoj přes celou šířku u slepé severní stěny — dvě střešní okna
  // v severní rovině střechy (difuzní světlo, FVE je jen na jižní rovině).
  'nudle-kid': (S, b) => {
    const { items, put, seat } = maker(S, b)
    put('bedS', 1.2, 3.35, { rot: 90, note: 'postel podél severní stěny' })
    put('desk', 0.95, 0.45)
    seat(0.95, 1.1, 0.95, 0.45)
    put('wardrobe', 3.6, 3.4)
    put('skylight', 1.2, 1.5, { dy: 2.62 })
    put('skylight', 3.4, 1.5, { dy: 2.62 })
    return items
  },

  // ---------------------------------------------------------------- byt
  // Jedna dispozice na místnost, čtyři byty. Byty 2 a 4 jsou zrcadlené
  // (b.mirror) — maker() překlopí u i rotaci, takže se nic nepíše dvakrát.

  'flat-bed': (S, b) => {
    const { items, put } = maker(S, b)
    put('bed', 1.5, 2.9, { note: 'postel čelem k oknu, ne pod ním' })
    put('wardrobe', 0.35, 2.6, { rot: 90 })
    return items
  },

  'flat-bath': (S, b) => {
    const { items, put } = maker(S, b)
    put('shower', 0.55, 0.6)
    put('wcbowl', 0.35, 2.0)
    put('basin', 1.6, 2.1, { rot: 180 })
    put('washer', 2.35, 2.05, { note: 'pračka v bytě, ne ve společné prádelně' })
    return items
  },

  // Předsíň nese vstupní dveře z pláště: v přízemí přímo z terénu,
  // v patře z pavlače. Uvnitř jen šatní skříň na severním konci, jinak
  // musí zůstat průchozí ke třem dveřím.
  'flat-hall': (S, b) => {
    const { items, put } = maker(S, b)
    put('door', 0.7, 0.14, { note: 'vlastní vstup do bytu' })
    put('cabinet', 0.27, 6.4, { rot: 90, note: 'šatní skříň' })
    put('smoke', 0.7, 2.0, { dy: blockHeight(S, b) - 0.3, note: 'autonomní hlásič — povinný v bytě' })
    return items
  },

  'flat-liv': (S, b) => {
    const { items, put, around } = maker(S, b)
    // Obývák 2,9 × 4,6 m nemá dveře do kuchyně — jsou to dva bloky bez příčky.
    // Průchod k lince proto MUSÍ zůstat volný po celé délce u stěny s předsíní;
    // nábytek napříč místností kuchyň odřízl a byl to nález walk testu.
    put('table', 1.9, 1.2, { note: 'jídelní stůl u okna' })
    around(1.9, 1.2, [[0, -0.8], [0, 0.8]])
    put('sofa', 2.45, 3.4, { rot: 90 })
    put('screen', 0.1, 3.4, { rot: 90, dy: 1.1, note: 'TV na stěně k předsíni' })
    return items
  },

  'flat-kit': (S, b) => {
    const { items, put } = maker(S, b)
    // linka po severní stěně, lednice v rohu — jižní polovina zůstává volná
    // jako průchod z obýváku
    put('kitchen', 1.3, 2.05)
    put('fridge', 2.55, 1.4, { rot: 90 })
    return items
  },

  // ------------------------------------------- varianta D: vesnička (buňky)
  // Buňka duo 2× 40' = vnitřek 12,19 × 4,88 m; sólo 20' = 6,06 × 2,44 m.
  // Vstupní dveře nese obálka buňky (village.js), tady je jen nábytek.

  // Kanceláře A: bench 6 stolů na západě, malý jednací stůl na východě,
  // vstup z jihu u 5,6–6,6 zůstává volný.
  'ves-office': (S, b, P) => {
    const { items, put, row, desks, seat } = maker(S, b)
    desks(1.3, 2.44, Math.ceil((P.office?.desks ?? 6) / 2))
    put('mtable', 9.0, 2.44)
    for (const du of [-0.75, 0.75]) {
      seat(9.0 + du, 1.55, 9.0 + du, 2.44)
      seat(9.0 + du, 3.33, 9.0 + du, 2.44)
    }
    row('cabinet', 0.7, 4.6, 3, 0.9)
    put('sideboard', 10.6, 4.6)
    put('printer3d', 10.6, 4.55, { dy: 0.78, note: 'tiskárna na skříňce' })
    put('rack19', 11.75, 4.4, { rot: 90, note: 'switch + NAS' })
    return items
  },

  // Bar / komunita: pult a zázemí u jižní stěny, posezení u severního
  // prosklení na náves. Dveře na severu u 5,6–6,6.
  'ves-bar': (S, b) => {
    const { items, put, row, seat, around } = maker(S, b)
    row('backbar', 1.1, 0.35, 2, 1.1)
    put('fridge', 3.15, 0.4)
    put('kitchen', 4.9, 0.38)
    put('bar', 2.0, 1.45)
    put('bar', 3.25, 1.45)
    seat(2.0, 2.25, 2.0, 1.45)
    seat(3.25, 2.25, 3.25, 1.45)
    put('table', 8.3, 1.7)
    around(8.3, 1.7, [[-1.05, 0], [1.05, 0]])
    seat(8.3, 2.75, 8.3, 1.7)
    put('table', 10.6, 3.1)
    around(10.6, 3.1, [[-1.05, 0], [1.05, 0]])
    put('sofa', 8.0, 4.32, { rot: 180 })
    put('rtable', 8.0, 3.35)
    return items
  },

  // Byt 2+kk v duo buňce: obývák s KK, průchozí do ložnice (jako verze C).
  'ves-obyvak': (S, b) => {
    const { items, put, around } = maker(S, b)
    put('kitchen', 2.3, 4.55)
    put('fridge', 3.95, 4.5)
    put('table', 1.6, 3.3)
    around(1.6, 3.3, [[-1.05, 0], [1.05, 0]])
    put('sofa', 4.35, 2.9, { rot: 0, note: 'pohovka čelem k jižnímu prosklení' })
    put('rtable', 4.35, 1.9)
    put('screen', 6.0, 2.2, { rot: 90, dy: 1.1, note: 'TV na stěně k ložnici' })
    return items
  },
  'ves-loznice': (S, b) => {
    const { items, put } = maker(S, b)
    put('bed', 2.7, 2.0, { rot: 90 })
    put('wardrobe', 1.05, 4.55)
    return items
  },
  'ves-koupelna': (S, b) => {
    const { items, put } = maker(S, b)
    put('shower', 0.55, 1.95)
    put('wcbowl', 1.75, 2.0)
    put('basin', 1.85, 1.3, { rot: 90 })
    put('washer', 0.35, 0.35)
    return items
  },
  'ves-predsin': (S, b) => {
    const { items, put } = maker(S, b)
    put('shoerack', 1.1, 0.35)
    // hlásič u jižního konce — střed drží vyústka VZT a svítidlo jí uhýbá
    // v ose z, takže lávka 5,2–5,8 musí zůstat volná
    put('smoke', 0.5, 0.6, { dy: blockHeight(S, b) - 0.3, note: 'autonomní hlásič — povinný v bytě' })
    return items
  },

  // Technika: TČ, akumulace, rozvaděč, baterie a rack u severní stěny,
  // dveře na jihu u 2,5–3,5 volné.
  'ves-tech': (S, b) => {
    const { items, put } = maker(S, b)
    put('hpmodule', 0.85, 1.9)
    put('tank', 2.0, 2.0)
    put('board', 3.1, 2.25)
    put('battery', 4.2, 2.2)
    put('rack19', 5.5, 2.0)
    return items
  },

  // Sanita v sólo 20': dvě WC kabiny na severním konci, sprcha na jižním,
  // umyvadla u západní stěny. Dveře na východě u 2,5–3,5.
  'ves-sanita': (S, b) => {
    const { items, put, row } = maker(S, b)
    put('wc', 0.65, 5.25)
    put('wc', 1.75, 5.25)
    put('shower', 0.65, 0.85, { rot: 180 })
    row('basin', 2.15, 1.7, 2, 0.8, { along: 'v', rot: 90 })
    return items
  },
}

/** Vybavení jednoho bloku ve světových souřadnicích. */
export function fitoutFor(S, b) {
  if (b.fitout === 'shell') return []
  // b.layout přepíše dispozici podle id — dvě verze budovy mají blok stejného
  // jména v jiném rozměru a čtyři byty sdílejí jeden layout na místnost
  const gen = LAYOUTS[b.layout ?? b.id]
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
const ZONE_BOARDS = { 'office-gf': 'komunitní zóna', lobby: 'veřejná část', gym: 'sport', workshop: 'dílna' }

// osvětlenost podle ČSN EN 12464-1 [lx] a plocha na jedno svítidlo [m²]
const LUX = {
  office: 500, meeting: 500, sim: 300, gym: 300, lobby: 200, wet: 200, arena: 300,
  play: 300, workshop: 500, storage: 150, plant: 200, circ: 150, reserve: 0,
  flat: 200,                                   // obytné místnosti, ČSN EN 12464-1
}
const M2_PER_LUM = (lux) => (lux >= 500 ? 8 : lux >= 300 ? 11 : 16)

// kde se sbírá voda na podlaze
const DRAINED = { wet: 2, workshop: 2, plant: 1 }

function derivedFor(S, b) {
  if (b.fitout === 'shell') return []
  const out = []
  // část půdorysu haly překrytá blokem patra (galerie, mezipatro) nemá strop
  // u střechy — stropní prvky se tam nesmí generovat
  const mezz = b.level === 'full'
    ? S.blocks.filter((o) => o.level === 1
        && o.x0 < b.x1 && o.x1 > b.x0 && o.z0 < b.z1 && o.z1 > b.z0)
    : []
  const underMezz = (x, z) => mezz.some((o) => x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1)
  const base = levelBase(S, b.level === 'full' ? 0 : b.level)
  const w = b.x1 - b.x0
  const d = b.z1 - b.z0
  const a = w * d
  const ceil = b.level === 'full'
    ? blockHeight(S, b) - 0.4
    : base + (b.level === 1 ? S.eaves - base : S.clearGF) - 0.25

  // vyústky: jedna na 400 m³/h, rozmístěné do pravidelné mřížky
  const flow = (TYPES_VZT[b.type] ?? 0) * a
  const n = Math.min(12, Math.max(1, Math.ceil(flow / 400)))
  const cols = Math.max(1, Math.round(Math.sqrt((n * w) / d)))
  const rows = Math.ceil(n / cols)
  for (let i = 0; i < n; i++) {
    const cx = ((i % cols) + 0.5) / cols
    const cz = (Math.floor(i / cols) + 0.5) / rows
    if (!underMezz(b.x0 + cx * w, b.z0 + cz * d)) {
      out.push({ kind: 'diffuser', block: b.id, x: b.x0 + cx * w, z: b.z0 + cz * d,
        y: ceil, rot: 0, flow: flow / n })
    }
  }

  // podružný rozvaděč na zónu — kvůli podružnému měření po provozech
  if (ZONE_BOARDS[b.id]) {
    out.push({ kind: 'subboard', block: b.id, x: b.x1 - 0.45, z: b.z0 + 0.6, y: base, rot: 90,
      note: `podružné měření: ${ZONE_BOARDS[b.id]}` })
  }

  // hasicí přístroje: 1 na 150 m². Roh si vybírají podle toho, kde je volno
  // a kde nestojí ve vnějším vstupu — pevný roh kolidoval se skříňkami
  // i s únikovými dveřmi. Vnitřním dveřím uhýbají o 1 m (hasičák v lobby
  // stál přesně v dveřích do komunitního prostoru).
  if (a > 15) {
    const doorsNear = doorsFor(S).filter((d) =>
      d.x > b.x0 - 0.5 && d.x < b.x1 + 0.5 && d.z > b.z0 - 0.5 && d.z < b.z1 + 0.5)
    const nearDoor = (x, z) => doorsNear.some((d) => Math.hypot(d.x - x, d.z - z) < 1.0)
    const roomItems = [...fitoutFor(S, b), ...out]
    const free = (x, z) => !nearDoor(x, z) && !roomItems.some((it) => {
      const f = FURN[it.kind]
      if (!f || it.y > base + 0.5) return false
      const turned = it.rot === 90 || it.rot === 270
      return Math.abs(it.x - x) < (turned ? f.d : f.w) / 2 + 0.35
          && Math.abs(it.z - z) < (turned ? f.w : f.d) / 2 + 0.35
    })
    const cand = [
      [b.x1 - 0.45, b.z0 + 0.45], [b.x0 + 0.45, b.z1 - 0.45],
      [b.x0 + 0.45, b.z0 + 0.45], [b.x1 - 0.45, b.z1 - 0.45],
      [b.x0 + w / 2, b.z1 - 0.4],
    ]
    const ne = Math.max(1, Math.ceil(a / 150))
    let placed = 0
    for (const [cx, cz] of cand) {
      if (placed >= ne) break
      if (!free(cx, cz)) continue
      out.push({ kind: 'extinguisher', block: b.id, y: base, rot: 0, x: cx, z: cz })
      placed++
    }
  }

  // Stropní prvky sdílejí jednu rovinu — nový kus si uhne v z, když je jeho
  // buňka mřížky už obsazená (vyústka, svítidlo a čidlo jinak sedí na sobě).
  // Střešní okna z layoutu (jednotka 5) se počítají jako obsazené taky.
  const skyTaken = fitoutFor(S, b).filter((it) => ['skylight', 'smoke'].includes(it.kind))
  const ceilTaken = (x, z) => [...out, ...skyTaken].some((o) =>
    ['diffuser', 'light', 'smoke', 'skylight'].includes(o.kind)
    && Math.abs(o.x - x) < 0.95
    && Math.abs(o.z - z) < (o.kind === 'skylight' ? 0.85 : 0.48))
  const dodgeZ = (x, z) => {
    for (let k = 0; k < 4 && ceilTaken(x, z); k++) {
      z = z + 0.6 > b.z1 - 0.4 ? z - 0.6 : z + 0.6
    }
    return z
  }

  // svítidla podle požadované osvětlenosti
  const lux = LUX[b.type] ?? 200
  if (lux > 0) {
    const nl = Math.min(28, Math.max(1, Math.round(a / M2_PER_LUM(lux))))
    const lc = Math.max(1, Math.round(Math.sqrt((nl * w) / d)))
    const lr = Math.ceil(nl / lc)
    for (let i = 0; i < nl; i++) {
      const lx = b.x0 + (((i % lc) + 0.5) / lc) * w
      const lz = b.z0 + ((Math.floor(i / lc) + 0.5) / lr) * d
      const lz2 = dodgeZ(lx, lz)
      if (!underMezz(lx, lz2)) out.push({ kind: 'light', block: b.id, rot: 0, y: ceil + 0.08, x: lx, z: lz2 })
    }
  }

  // nouzové osvětlení a detekce kouře — bez nich se budova nezkolauduje
  if (a > 15) {
    out.push({ kind: 'emlight', block: b.id, x: b.x0 + w / 2, z: b.z0 + 0.35, y: base + 2.4, rot: 0 })
    const ns = Math.max(1, Math.ceil(a / 60))
    for (let i = 0; i < ns; i++) {
      const sx = b.x0 + ((i + 0.5) / ns) * w
      const sz = b.z0 + Math.min(d - 0.5, d / 2 + 0.85)
      const sz2 = dodgeZ(sx, sz)
      if (!underMezz(sx, sz2)) out.push({ kind: 'smoke', block: b.id, rot: 0, y: ceil, x: sx, z: sz2 })
    }
  }

  // podlahové vpusti tam, kde se pracuje s vodou
  for (let i = 0; i < (DRAINED[b.type] ?? 0); i++) {
    out.push({ kind: 'floordrain', block: b.id, rot: 0, y: base,
      x: b.x0 + ((i + 0.5) / (DRAINED[b.type] ?? 1)) * w, z: b.z0 + d * 0.55 })
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
    const gen = LAYOUTS[b.layout ?? b.id]
    if (b.fitout === 'shell' || !gen) continue
    const n = gen(S, b, S.program).length - fitoutFor(S, b).length
    if (n > 0) droppedBy[b.id] = n
  }
  const dropped = Object.values(droppedBy).reduce((a, n) => a + n, 0)
  return { items, counts, dropped, droppedBy }
}
