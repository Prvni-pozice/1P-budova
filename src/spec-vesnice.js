// spec-vesnice.js — varianta D: kontejnerová vesnička místo haly.
//
// Úplně jiný přístup než A–C: žádná velká budova, ale samostatné modulární
// buňky z lodních kontejnerů rozeseté po pozemku 2360/110 (~2 850 m²,
// ul. Kouřimského, Pelhřimov). Buňka = 2× 40' kontejner podélně vedle sebe,
// uvnitř propojený bez příčky (12,19 × 4,88 m ≈ 59 m²), doplněné sólo
// kontejnery 40' a 20'. Kontejnery na severní hranici stojí PŘÍMO NA HRANĚ
// pozemku a fungují zároveň jako plot (sklad okna nepotřebuje).
//
// ETAPA 1 je vymodelovaná naplno (kanceláře A, bar, bydlení, technika,
// sanita), etapy 2 a 3 jsou jen naznačené obrysy (spec.future).
//
// Souřadnice — stejný kompas jako u haly (pravotočivý):
//   x = 0 na VÝCHODNÍ hranici (ulice), roste na ZÁPAD (0..72)
//   z = 0 na JIŽNÍ hranici (soused 2360/109), roste na SEVER (0..40)
// Vjezd je v SV rohu od kruhového objezdu. Sever (z = 40) = soused 2360/111.
//
// TVAR: skutečná parcela je protáhlý lichoběžník (přeměřeno z katastru
// 29. 8., kalibrace přes výměru): jih ~81 m, sever ~65 m vč. oblouku
// u kruháče, hloubka ~40–45 m, dlouhá osa pootočená ~21° od V–Z.
// Model drží osový obdélník 72 × 40 m (2 880 m²) — poměr ~1,8 sedí,
// pootočení a zkosení rohů se doladí až nad geodetickým zaměřením.

// vnější rozměry kontejnerů [m]; duo40 = dva 40' bez vnitřní příčky
export const CONT = {
  duo40:  { w: 12.19, d: 4.88, c40: 2, c20: 0 },
  solo40: { w: 12.19, d: 2.44, c40: 1, c20: 0 },
  solo20: { w: 6.06,  d: 2.44, c40: 0, c20: 1 },
}

export const SPEC_VESNICE = {
  kind: 'village',

  // pozemek — obdélníková aproximace parcely 2360/110 (72 × 40 = 2 880 m²)
  stage1: 72,       // délka dlouhé osy (kvůli sdílenému kódu: střed scény, cutaway)
  length: 72,
  depth: 40,        // hloubka J–S
  grid: 7,          // nepoužito, drží kontrakt spec
  eaves: 2.9,       // vnější výška kontejneru (HC)
  clearGF: 2.6,     // světlá výška uvnitř buňky
  slab: 0.3,
  wall: 0.1,        // sendvičová stěna zatepleného kontejneru
  blindWalls: [],

  // postava startuje na parkovací uličce u vjezdu
  gtaStart: { x: 11.5, z: 34 },

  // Buňky. Etapa 1 se modeluje naplno — každá má obálku s otvory (openings:
  // u = vzdálenost podél stěny od východního rohu [s/n] resp. od jižního [e/w],
  // v = výška nad podlahou). Dveře mají v0 = 0.
  units: [
    {
      id: 'u-kanc-a', name: 'Kanceláře A', stage: 1, kind: 'duo40',
      x0: 30.2, x1: 42.39, z0: 28.0, z1: 32.88,
      blocks: ['kanc-a'],
      openings: [
        { side: 's', kind: 'door',   u0: 5.6, u1: 6.6, v0: 0,   v1: 2.05 },  // vstup z návsi
        { side: 's', kind: 'window', u0: 1.0, u1: 4.9, v0: 0.9, v1: 2.3 },
        { side: 's', kind: 'window', u0: 7.4, u1: 11.3, v0: 0.9, v1: 2.3 },
        { side: 'n', kind: 'window', u0: 3.0, u1: 5.0, v0: 1.5, v1: 2.3 },
        { side: 'n', kind: 'window', u0: 7.2, u1: 9.2, v0: 1.5, v1: 2.3 },
        { side: 'e', kind: 'window', u0: 1.2, u1: 3.7, v0: 0.9, v1: 2.3 },
      ],
    },
    {
      id: 'u-bar', name: 'Bar / komunita', stage: 1, kind: 'duo40',
      x0: 26.0, x1: 38.19, z0: 14.0, z1: 18.88,
      blocks: ['bar'],
      openings: [
        { side: 'n', kind: 'door',  u0: 5.6, u1: 6.6, v0: 0,    v1: 2.05 },  // vstup z návsi
        { side: 'n', kind: 'glass', u0: 0.9, u1: 5.2, v0: 0.45, v1: 2.35 },  // prosklení na náves
        { side: 'n', kind: 'glass', u0: 7.0, u1: 11.3, v0: 0.45, v1: 2.35 },
        { side: 's', kind: 'window', u0: 4.2, u1: 6.2, v0: 1.5, v1: 2.3 },
        { side: 'w', kind: 'window', u0: 1.2, u1: 3.7, v0: 0.9, v1: 2.3 },
      ],
    },
    {
      // Bydlení / dozor 2+kk. Vstup z východního štítu (od chodníku),
      // obývák má jižní prosklení na terasu, ložnice okno na jih i západ.
      id: 'u-byt', name: 'Bydlení / dozor', stage: 1, kind: 'duo40',
      x0: 44.0, x1: 56.19, z0: 4.0, z1: 8.88,
      blocks: ['byt-predsin', 'byt-koupelna', 'byt-obyvak', 'byt-loznice'],
      openings: [
        { side: 'e', kind: 'door',   u0: 0.6, u1: 1.6, v0: 0,    v1: 2.05 },  // vstup do předsíně
        { side: 's', kind: 'glass',  u0: 3.2, u1: 7.4, v0: 0.35, v1: 2.35 },  // obývák → terasa
        { side: 's', kind: 'window', u0: 9.4, u1: 11.3, v0: 0.9, v1: 2.3 },   // ložnice
        { side: 'n', kind: 'window', u0: 0.6, u1: 1.6, v0: 1.7, v1: 2.2 },    // koupelna
        { side: 'n', kind: 'window', u0: 3.4, u1: 5.4, v0: 1.05, v1: 2.2 },   // kuchyňský kout
        { side: 'w', kind: 'window', u0: 1.4, u1: 3.5, v0: 0.9, v1: 2.3 },    // ložnice, západní štít
      ],
    },
    {
      // Technika NA SEVERNÍ HRANĚ pozemku (dělá kus plotu) hned u vjezdu —
      // nejkratší trasa přípojek od ulice. Přípojky se v etapě 1 dimenzují
      // a pokládají na CELOU vesničku, kope se jen jednou.
      id: 'u-tech', name: 'Technika', stage: 1, kind: 'solo20',
      x0: 7.0, x1: 13.06, z0: 37.56, z1: 40.0,
      blocks: ['technika'],
      openings: [
        { side: 's', kind: 'door',   u0: 2.5, u1: 3.5, v0: 0,   v1: 2.05 },
        { side: 's', kind: 'louvre', u0: 0.7, u1: 1.9, v0: 1.6, v1: 2.35 },   // sání
        { side: 's', kind: 'louvre', u0: 4.2, u1: 5.4, v0: 1.6, v1: 2.35 },   // výfuk
      ],
    },
    {
      // Sanita pro kanceláře a bar (bydlení má vlastní koupelnu). Stojí mezi
      // barem a budoucí fitness, které bude sloužit taky.
      id: 'u-sanita', name: 'Sanita', stage: 1, kind: 'solo20',
      x0: 40.5, x1: 42.94, z0: 13.0, z1: 19.06,
      blocks: ['sanita'],
      openings: [
        { side: 'e', kind: 'door',   u0: 2.5, u1: 3.5, v0: 0,   v1: 2.05 },   // od baru
        { side: 's', kind: 'window', u0: 0.6, u1: 1.6, v0: 1.7, v1: 2.2 },
      ],
    },
  ],

  // Etapy 2 a 3 — jen naznačené obrysy na finálních pozicích (nic se pak
  // nestěhuje, vesnička houstne). Sklad na severní hraně = souvislý plot.
  future: [
    { id: 'u-fitness', name: 'Fitness',     stage: 2, kind: 'duo40',  x0: 45.0,  x1: 57.19, z0: 14.0,  z1: 18.88 },
    { id: 'u-sim',     name: 'Sim racing',  stage: 2, kind: 'solo40', x0: 8.0,   x1: 20.19, z0: 4.5,   z1: 6.94 },
    { id: 'u-recepce', name: 'Recepce',     stage: 2, kind: 'solo20', x0: 14.0,  x1: 20.06, z0: 23.5,  z1: 25.94 },
    { id: 'u-kanc-b',  name: 'Kanceláře B', stage: 3, kind: 'duo40',  x0: 16.0,  x1: 28.19, z0: 28.0,  z1: 32.88 },
    { id: 'u-dilna',   name: 'Dílna',       stage: 3, kind: 'duo40',  x0: 24.0,  x1: 36.19, z0: 4.0,   z1: 8.88 },
    { id: 'u-sklad-1', name: 'Sklad 1',     stage: 3, kind: 'solo40', x0: 16.0,  x1: 28.19, z0: 37.56, z1: 40.0 },
    { id: 'u-sklad-2', name: 'Sklad 2',     stage: 3, kind: 'solo40', x0: 28.19, x1: 40.38, z0: 37.56, z1: 40.0 },
    { id: 'u-sklad-3', name: 'Sklad 3',     stage: 3, kind: 'solo40', x0: 40.38, x1: 52.57, z0: 37.56, z1: 40.0 },
  ],

  // Venkovní plochy. Vjezd od kruháče v SV rohu, parkování hned u něj —
  // auta nejezdí dovnitř vesničky. Náves je střed, na který se otvírají
  // vstupy kanceláří i baru; chodníky spojují parking se všemi vstupy.
  site: {
    paving: [
      { id: 'vjezd',    mat: 'asphalt', x0: 0,     x1: 13.5,  z0: 31.5, z1: 37.0 },
      { id: 'ulicka',   mat: 'asphalt', x0: 9.5,   x1: 13.5,  z0: 11.5, z1: 36.5 },
      { id: 'ch-naves', mat: 'paving',  x0: 13.5,  x1: 20.5,  z0: 21.5, z1: 23.5 },
      { id: 'naves',    mat: 'paving',  x0: 20.5,  x1: 40.0,  z0: 19.0, z1: 28.0 },
      { id: 'ch-jih',   mat: 'paving',  x0: 38.3,  x1: 40.5,  z0: 12.5, z1: 19.0 },  // náves → sanita → jih
      { id: 'ch-byt-1', mat: 'paving',  x0: 38.3,  x1: 44.0,  z0: 10.5, z1: 12.5 },
      { id: 'ch-byt-2', mat: 'paving',  x0: 42.0,  x1: 44.0,  z0: 2.0,  z1: 12.5 },  // ke vstupu bytu
      { id: 'ch-tech',  mat: 'paving',  x0: 8.5,   x1: 11.5,  z0: 37.0, z1: 37.56 },
      { id: 'ch-terasa', mat: 'paving', x0: 44.0,  x1: 46.4,  z0: 2.0,  z1: 4.0 },   // od vstupu k terase
      { id: 'terasa',   mat: 'deck',    x0: 46.4,  x1: 52.4,  z0: 1.0,  z1: 4.0 },   // terasa obýváku
    ],
    // stání kolmo na uličku (x 4,5–9,5), bezbariérové nejblíž vjezdu
    parkX0: 4.5, parkX1: 9.5,
    bays: [
      { z0: 31.0, z1: 34.5, bf: true },
      { z0: 28.5, z1: 31.0 }, { z0: 26.0, z1: 28.5 }, { z0: 23.5, z1: 26.0 },
      { z0: 21.0, z1: 23.5 }, { z0: 18.5, z1: 21.0 }, { z0: 16.0, z1: 18.5 },
      { z0: 13.5, z1: 16.0 },
    ],
    // vjezdová brána = mezera v plotu na východní hranici
    gate: { z0: 31.5, z1: 37.0 },
    trees: [[24, 22], [33, 25], [36, 20.5], [58, 6], [2.5, 27]],
  },

  program: {
    office: { staff: 6, staffTarget: 8, desks: 6 },
    bar:    { level: 'light', seats: 14 },
    flats:  { layout: '2+kk' },
  },

  compartments: {
    office: ['kanc-a'],
    public: ['bar'],
    flat:   ['byt-predsin', 'byt-koupelna', 'byt-obyvak', 'byt-loznice'],
    tech:   ['technika'],
    wet:    ['sanita'],
  },

  openPairs: [],
  wallGaps: [],

  // Vnitřní dveře — jen uvnitř bytu (ostatní buňky jsou jeden prostor).
  // Ložnice je průchozí přes obývák (jako nudle ve verzi C).
  links: [
    { a: 'byt-predsin', b: 'byt-obyvak',   type: 'door', at: 5.1 },
    { a: 'byt-predsin', b: 'byt-koupelna', type: 'door', at: 45.35 },
    { a: 'byt-obyvak',  b: 'byt-loznice',  type: 'door', at: 7.5 },
  ],

  // Místnosti. U jednoprostorových buněk je blok = celá buňka; byt se dělí
  // na čtyři místnosti, které buňku přesně vyskládají (hlídá test).
  blocks: [
    { id: 'kanc-a',       name: 'Kanceláře A',    type: 'office', level: 0, x0: 30.2, x1: 42.39, z0: 28.0, z1: 32.88, layout: 'ves-office' },
    { id: 'bar',          name: 'Bar / komunita', type: 'lobby',  level: 0, x0: 26.0, x1: 38.19, z0: 14.0, z1: 18.88, layout: 'ves-bar' },
    { id: 'byt-predsin',  name: 'Předsíň',        type: 'circ',   level: 0, x0: 44.0, x1: 46.2,  z0: 4.0,  z1: 6.4,  layout: 'ves-predsin' },
    { id: 'byt-koupelna', name: 'Koupelna',       type: 'wet',    level: 0, x0: 44.0, x1: 46.2,  z0: 6.4,  z1: 8.88, layout: 'ves-koupelna' },
    { id: 'byt-obyvak',   name: 'Obývák + KK',    type: 'flat',   level: 0, x0: 46.2, x1: 52.4,  z0: 4.0,  z1: 8.88, layout: 'ves-obyvak' },
    { id: 'byt-loznice',  name: 'Ložnice',        type: 'flat',   level: 0, x0: 52.4, x1: 56.19, z0: 4.0,  z1: 8.88, layout: 'ves-loznice' },
    { id: 'technika',     name: 'Technika',       type: 'plant',  level: 0, x0: 7.0,  x1: 13.06, z0: 37.56, z1: 40.0, layout: 'ves-tech' },
    { id: 'sanita',       name: 'Sanita',         type: 'wet',    level: 0, x0: 40.5, x1: 42.94, z0: 13.0, z1: 19.06, layout: 'ves-sanita' },
  ],
}

/** Počty kontejnerů: { c40, c20 } za dané etapy (bez filtru = všechno). */
export function containerCounts(S, stages = null) {
  const all = [...S.units, ...(S.future ?? [])]
  const out = { c40: 0, c20: 0 }
  for (const u of all) {
    if (stages && !stages.includes(u.stage)) continue
    out.c40 += CONT[u.kind].c40
    out.c20 += CONT[u.kind].c20
  }
  return out
}
