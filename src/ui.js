// ui.js — textový souhrn. Vše se přepočítává ze SPEC, nic není opsané ručně.
import { areaTotals } from './spec.js'

const BREAKERS = [25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400]

const n0 = (v) => Math.round(v).toLocaleString('cs-CZ')
const n1 = (v) => v.toFixed(1).replace('.', ',')
const n2 = (v) => v.toFixed(2).replace('.', ',')
const pad = (s, w) => String(s).padEnd(w)
const rpad = (s, w) => String(s).padStart(w)

// Měrné výnosy pro ČR [kWh/kWp/rok] — střecha ve sklonu 10°, fasáda svisle
const YIELD = { roof: 1020, facade: 700 }

export function summaryText(spec, mep, pv) {
  const a = areaTotals(spec)
  const t = mep.totals
  const breaker = BREAKERS.find((b) => b >= t.breaker * 1.15) ?? '>400'

  const L = []
  L.push('PLOCHY')
  L.push(`  ${pad('Přízemí', 16)}${rpad(n0(a.gf), 7)} m²`)
  L.push(`  ${pad('Patro', 16)}${rpad(n0(a.up), 7)} m²`)
  L.push(`  ${pad('Celkem', 16)}${rpad(n0(a.total), 7)} m²`)
  L.push(`  ${pad('Půdorys etapy 1', 16)}${rpad(n0(a.footprint), 7)} m²`)
  L.push(`  ${pad('Koeficient', 16)}${rpad(n2(a.ratio) + '×', 7)}`)
  L.push('')
  L.push('VZDUCHOTECHNIKA')
  L.push(`  ${pad('Celkem', 16)}${rpad(n0(t.vzt), 7)} m³/h`)
  L.push(`  ${pad('Páteřní ø', 16)}${rpad(n2(t.vztDuct), 7)} m`)
  for (const [zone, v] of Object.entries(t.vztByZone).sort((x, y) => y[1] - x[1])) {
    if (v < 1) continue
    L.push(`    ${pad(zone, 14)}${rpad(n0(v), 7)} m³/h`)
  }
  L.push('')
  L.push('TEPLO A CHLAD')
  L.push(`  ${pad('Tepelná ztráta', 16)}${rpad(n1(t.heat), 7)} kW`)
  L.push(`  ${pad('Chlazení', 16)}${rpad(n1(t.cool), 7)} kW`)
  L.push(`  ${pad('Příkon TČ', 16)}${rpad(n1(t.hpElec), 7)} kW`)
  L.push('')
  L.push('ELEKTRO')
  L.push(`  ${pad('Instalovaný', 16)}${rpad(n1(t.elecInstalled), 7)} kW`)
  L.push(`  ${pad('Výpočtový', 16)}${rpad(n1(t.elecCalc), 7)} kW`)
  L.push(`  ${pad('Hlavní jistič', 16)}${rpad('3×' + breaker, 7)} A`)
  L.push(`  ${pad('+ rezerva et. 2', 16)}${rpad('3×' + (BREAKERS.find((b) => b >= t.breaker * 2.2) ?? '>400'), 7)} A`)
  L.push('')
  L.push('VODA')
  L.push(`  ${pad('Mokré provozy', 16)}${rpad(n0(t.wetArea), 7)} m²`)
  L.push(`  ${pad('Špička TUV', 16)}${rpad(n0(t.tuv), 7)} l/h`)

  if (pv && (pv.roofKwp > 0 || pv.facadeKwp > 0)) {
    const kwh = pv.roofKwp * YIELD.roof + pv.facadeKwp * YIELD.facade
    L.push('')
    L.push('FOTOVOLTAIKA')
    L.push(`  ${pad('Střecha', 16)}${rpad(n1(pv.roofKwp), 7)} kWp  (${n0(pv.roofArea)} m²)`)
    L.push(`  ${pad('Jižní fasáda', 16)}${rpad(n1(pv.facadeKwp), 7)} kWp  (${n0(pv.facadeArea)} m²)`)
    L.push(`  ${pad('Celkem', 16)}${rpad(n1(pv.roofKwp + pv.facadeKwp), 7)} kWp`)
    L.push(`  ${pad('Odhad výroby', 16)}${rpad(n0(kwh / 1000), 7)} MWh/rok`)
  }
  return L.join('\n')
}
