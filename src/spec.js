// spec.js — JEDINÝ zdroj pravdy celého modelu.
//
// Geometrie, plochy i trasy rozvodů se generují odtud. Když se tady změní
// číslo, přegeneruje se všechno včetně dimenzí VZT, topení a elektra.
//
// Souřadnice — POZOR na znaménka, kompas musí být pravotočivý:
//   x = 0 na VÝCHODNÍM průčelí, roste na ZÁPAD (etapa 1 = 0..28, etapa 2 = 28..56)
//   z = 0 na JIŽNÍ stěně (vstupy), roste na SEVER (rozpon 18 m)
//   y = výška nad podlahou přízemí
// Kontrola: východ = −x, sever = +z → východ × sever = +y (nahoru). Sedí.
// Kdyby platilo z+ = jih, byl by celý model zrcadlově převrácený.

export const SPEC = {
  grid: 7,          // rastr rámů montované haly (28 = 4×7, 56 = 8×7)
  length: 56,       // celková délka V–Z (obě etapy)
  stage1: 28,       // hranice etapy 1
  depth: 18,        // rozpon S–J
  eaves: 6.0,       // výška k okapu
  pitch: 10,        // sklon střechy [°]
  wall: 0.25,       // tloušťka obvodového pláště
  slab: 0.3,        // tloušťka vestavěného stropu
  clearGF: 3.0,     // světlá výška přízemí
  spineZ: 17.1,     // osa SEVERNÍ servisní páteře (u slepé stěny)

  // Severní stěna je na hranici pozemku (soused, průmyslová zóna) — slepá.
  // Proto tam sedí provozy, které okna nechtějí, a všechny rozvody.
  blindWalls: ['north'],

  // Vrata dílny — v JIŽNÍ stěně, kde jsou všechny vstupy a vjezdy
  gate: { width: 4.0, height: 4.0 },

  // Fotovoltaika. Jižní střešní rovina + jižní fasáda mezi otvory.
  // roofNorth zůstává vypnutá schválně: provoz je odpolední a večerní, vlastní
  // spotřeba je slabá a přebytek by odtékal do sítě za výkupní cenu. Baterie
  // ve strojovně vydělá víc než druhá střešní rovina.
  pv: { roofSouth: true, roofNorth: false, facadeSouth: true, wp: 210, coverage: 0.85 },

  // Program — počty osob a kusů. Od nich se odvozuje vybavení i sanita.
  program: {
    office:   { staff: 8, staffTarget: 10, desks: 10 },
    arena:    { peak: 40, beds: 6 },   // 2 odrazové + 4 volné, k tomu molitanová jáma
    bar:      { level: 'light', seats: 24 },   // nápoje + jednoduchá příprava; víc se do lobby nevejde
    gym:      { cages: 2, users: 8 },
    sim:      { rigs: 2 },
    workshop: { carLift: true, benches: 3, printers: 2 },
  },

  // Požární úseky (PBŘ): mezi různými úseky jsou dělicí konstrukce s požární
  // odolností (v modelu tlustší, tónované). Technická zóna je vlastní úsek,
  // aréna s lobby je shromažďovací prostor, kanceláře třetí úsek.
  compartments: {
    office: ['office-gf', 'kitchen', 'office-1f', 'meeting', 'reserve', 'corridor'],
    public: ['arena', 'lobby', 'wetcore', 'play', 'gym', 'sim'],
    tech:   ['workshop', 'plant', 'storage'],
  },

  // Otvory v příčkách mimo dveře (výtahová šachta prochází stěnou office–lobby)
  wallGaps: [
    { a: 'office-gf', b: 'lobby', from: 8.1, to: 9.9, note: 'výtah — kabina ústí do lobby' },
  ],

  // Vnitřní dveře. Co tu není, není propojené — DÍLNA JE ZÁMĚRNĚ ODDĚLENÁ:
  // technická zóna (dílna + strojovna + sklad) se vstupuje jen vlastními
  // dveřmi a vraty z jihu, do veřejné části z ní nevede nic.
  //   at = poloha po délce společné hrany (jinak střed)
  links: [
    { a: 'office-gf', b: 'kitchen',  type: 'door',    at: 1.5,  note: 'do kuchyňky a WC' },
    { a: 'office-gf', b: 'lobby',    type: 'door',    at: 11.4, note: 'kanceláře do lobby' },
    { a: 'lobby',     b: 'wetcore',  type: 'double',  at: 8.5,  note: 'veřejnost na WC' },
    { a: 'lobby',     b: 'arena',    type: 'glazed',  at: 1.5,  note: 'vstup do arény, do vstupní uličky' },
    { a: 'workshop',  b: 'plant',    type: 'service', at: 27.0, note: 'jediné propojení dílny' },
    { a: 'corridor',  b: 'office-1f', type: 'door',   at: 4.0 },
    { a: 'corridor',  b: 'reserve',  type: 'door',    at: 6.0,  note: 'samostatný vstup do pronájmu' },
    { a: 'corridor',  b: 'meeting',  type: 'double',  at: 16.6 },
    { a: 'corridor',  b: 'gym',      type: 'escape',  at: 5.2,  note: 'požární, druhá úniková cesta z fitness' },
    { a: 'gym',       b: 'sim',      type: 'door',    at: 12.0 },
  ],

  // Ekonomika provozu — z rozvahy 8/2026 (základní scénář, Pelhřimov):
  // tržby po provozech [Kč/rok], náklady celkem. Sloupce ve vizualizaci
  // mají výšku podle VÝNOSNOSTI (Kč/m²/rok) plochy pod sebou.
  economy: {
    costsTotal: 2970000,
    revenue: {
      arena: 2400000, lobby: 750000,        // aréna + bar = 3,15 mil.
      gym: 330000, sim: 300000,
      workshop: 200000, storage: 50000,     // dílna vč. skladu = 0,25 mil.
      'office-gf': 120000, 'office-1f': 60000, meeting: 60000, kitchen: 32000,
      reserve: 74000,
    },
  },

  blocks: [
    // ---- přízemí (504 m²) ----
    // sever (z 12–18) = servisní pruh bez oken, jih (z 0–12) = vstupy a světlo
    { id: 'kitchen',   name: 'Kuchyňka + WC',       type: 'wet',      level: 0, x0: 0,  x1: 7,  z0: 12, z1: 18 },
    { id: 'office-gf', name: 'Kanceláře 1P',        type: 'office',   level: 0, x0: 0,  x1: 7,  z0: 0,  z1: 12 },
    { id: 'wetcore',   name: 'Šatny + sprchy + WC', type: 'wet',      level: 0, x0: 7,  x1: 14, z0: 12, z1: 18 },
    { id: 'lobby',     name: 'Lobby / recepce / bar', type: 'lobby',  level: 0, x0: 7,  x1: 14, z0: 0,  z1: 12 },
    { id: 'arena',     name: 'Jump aréna',          type: 'arena',    level: 'full', x0: 14, x1: 21, z0: 0, z1: 18 },
    { id: 'plant',     name: 'Strojovna',           type: 'plant',    level: 0, x0: 21, x1: 28, z0: 13, z1: 18 },
    { id: 'workshop',  name: 'Sdílená dílna',       type: 'workshop', level: 'full', x0: 21, x1: 28, z0: 0, z1: 13 },

    // ---- patro (322 m²) ----
    // Sklad začíná až na z 6 — nad vjezdovou dráhou a zvedákem musí zůstat
    // plná výška 4,2 m, jinak se pod mezipatro auto nevejde.
    // Chodba podél západní stěny propojuje všechny tři místnosti se schodištěm.
    // Bez ní by se do zasedačky chodilo přes pronajatou rezervu.
    { id: 'corridor',  name: 'Chodba',              type: 'circ',     level: 1, x0: 5.8, x1: 7, z0: 0, z1: 18 },
    { id: 'office-1f', name: 'Klidové místnosti',   type: 'office',   level: 1, x0: 0,  x1: 5.8, z0: 0,  z1: 5 },
    // 40 m² v hrubé stavbě: buď růst 1P, nebo pronájem. Má vlastní světlo
    // z východního štítu a vlastní dveře z chodby, takže jde oddělit.
    { id: 'reserve',   name: 'Rezerva k pronájmu',  type: 'reserve',  level: 1, x0: 0,  x1: 5.8, z0: 5,  z1: 12, fitout: 'shell' },
    { id: 'meeting',   name: 'Zasedačka / školicí', type: 'meeting',  level: 1, x0: 0,  x1: 5.8, z0: 12, z1: 18 },
    { id: 'gym',       name: 'Fitness',             type: 'gym',      level: 1, x0: 7,  x1: 14, z0: 0,  z1: 12 },
    { id: 'sim',       name: 'Sim racing',          type: 'sim',      level: 1, x0: 7,  x1: 14, z0: 12, z1: 18 },
    { id: 'play',      name: 'Dětské atrakce',      type: 'play',     level: 1, x0: 14, x1: 21, z0: 15, z1: 18 },
    { id: 'storage',   name: 'Sklad nad dílnou',    type: 'storage',  level: 1, x0: 21, x1: 28, z0: 6,  z1: 13 },
  ],
}

// Vlastnosti typů provozu. Odtud se počítají VŠECHNY dimenze rozvodů —
// změna plochy bloku okamžitě mění m³/h i kW.
//   vzt  [m³/h/m²]  potřeba čerstvého vzduchu
//   heat [W/m²]     tepelná ztráta / potřeba topení
//   cool [W/m²]     potřeba chlazení (0 = neklimatizuje se)
//   elec [W/m²]     instalovaný elektrický příkon
//   wet             potřebuje vodu + kanalizaci
export const TYPES = {
  office:   { label: 'Kanceláře',   color: 0x4a90d9, vzt: 6,  heat: 45, cool: 60,  elec: 40,  wet: false },
  meeting:  { label: 'Zasedačka',   color: 0x74b3ea, vzt: 12, heat: 45, cool: 80,  elec: 45,  wet: false },
  lobby:    { label: 'Lobby / bar', color: 0xf0a63a, vzt: 6,  heat: 50, cool: 50,  elec: 30,  wet: false },
  wet:      { label: 'Mokrý provoz', color: 0x35b0a8, vzt: 12, heat: 60, cool: 0,  elec: 25,  wet: true  },
  arena:    { label: 'Jump aréna',  color: 0xe8574b, vzt: 30, heat: 40, cool: 0,   elec: 30,  wet: false },
  play:     { label: 'Dětské atrakce', color: 0xf2a0c4, vzt: 15, heat: 40, cool: 0, elec: 25, wet: false },
  sim:      { label: 'Sim racing',  color: 0x8b6ae0, vzt: 15, heat: 35, cool: 150, elec: 200, wet: false },
  gym:      { label: 'Fitness',     color: 0x4bc46a, vzt: 20, heat: 40, cool: 80,  elec: 50,  wet: false },
  workshop: { label: 'Dílna',       color: 0x8a8f98, vzt: 6,  heat: 55, cool: 0,   elec: 120, wet: false },
  storage:  { label: 'Sklad',       color: 0xb08a5a, vzt: 2,  heat: 25, cool: 0,   elec: 8,   wet: false },
  plant:    { label: 'Strojovna',   color: 0xd94f8a, vzt: 2,  heat: 15, cool: 0,   elec: 60,  wet: false },
  circ:     { label: 'Komunikace',  color: 0xc9cdd4, vzt: 4,  heat: 35, cool: 0,   elec: 15,  wet: false },
  reserve:  { label: 'Rezerva',     color: 0x8a8f98, vzt: 1,  heat: 20, cool: 0,   elec: 5,   wet: false },
}

// --- odvozené veličiny ---

export const area = (b) => (b.x1 - b.x0) * (b.z1 - b.z0)

/** Výška spodní hrany podlaží. */
export function levelBase(s, level) {
  return level === 1 ? s.clearGF + s.slab : 0
}

/** Podhled střechy nad danou z-souřadnicí (sedlová střecha, hřeben v ose). */
export function roofY(s, z) {
  const h = s.depth / 2
  return s.eaves + (h - Math.abs(z - h)) * Math.tan((s.pitch * Math.PI) / 180)
}

/** Výška hřebene. */
export const ridgeY = (s) => roofY(s, s.depth / 2)

/** Světlá výška bloku — u 'full' až pod střechu (bere nižší okraj). */
export function blockHeight(s, b) {
  if (b.level === 'full') return Math.min(roofY(s, b.z0), roofY(s, b.z1))
  return b.level === 1 ? s.eaves - levelBase(s, 1) : s.clearGF
}

/** Součty podlahových ploch. Shell = postavená, ale nevybavená rezerva. */
export function areaTotals(s) {
  const gf = s.blocks.filter((b) => b.level === 0 || b.level === 'full').reduce((a, b) => a + area(b), 0)
  const up = s.blocks.filter((b) => b.level === 1).reduce((a, b) => a + area(b), 0)
  const shell = s.blocks.filter((b) => b.fitout === 'shell').reduce((a, b) => a + area(b), 0)
  const footprint = s.stage1 * s.depth
  return { gf, up, total: gf + up, shell, fitted: gf + up - shell, footprint, ratio: (gf + up) / footprint }
}
