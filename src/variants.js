// variants.js — rozcestník verzí budovy.
//
// Obálka, rastr i všechny generátory jsou společné; liší se jen spec.
// Přidat další verzi znamená napsat nový spec a přidat řádek sem.

import { SPEC } from './spec.js'
import { SPEC_BYTY } from './spec-byty.js'
import { SPEC_NUDLE } from './spec-nudle.js'
import { SPEC_VESNICE } from './spec-vesnice.js'

export const VARIANTS = [
  {
    id: 'firma',
    label: 'A — firemní budova',
    short: 'A',
    sub: 'Jump aréna, bar, fitness a sim racing v patře',
    spec: SPEC,
  },
  {
    id: 'byty',
    label: 'B — s 5 jednotkami',
    short: 'B',
    sub: '4 byty 2+kk + jednotka byt/kancelář, sport v přízemí',
    spec: SPEC_BYTY,
  },
  {
    id: 'nudle',
    label: 'C — nudle 3+kk',
    short: 'C',
    sub: '3 byty 84 m² přes celý rozpon patra, střešní okna na severu',
    spec: SPEC_NUDLE,
  },
  {
    id: 'vesnice',
    label: 'D — vesnička',
    short: 'D',
    sub: 'Kontejnerové buňky kolem návsi; etapa 1 naplno, 2 a 3 naznačené',
    spec: SPEC_VESNICE,
  },
]

export const DEFAULT_VARIANT = 'firma'

/** Verze podle id; neznámé id spadne na výchozí. */
export function variantById(id) {
  return VARIANTS.find((v) => v.id === id) ?? VARIANTS.find((v) => v.id === DEFAULT_VARIANT)
}

/**
 * Verze z argumentů příkazové řádky: `node test.mjs --variant=byty` nebo
 * prostě `node test.mjs byty`. Bez argumentu vrací null (= projeď všechny).
 */
export function variantFromArgv(argv = process.argv.slice(2)) {
  for (const a of argv) {
    const m = /^--variant=(.+)$/.exec(a)
    const id = m ? m[1] : a
    if (VARIANTS.some((v) => v.id === id)) return variantById(id)
  }
  return null
}
