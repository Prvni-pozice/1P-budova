# 1P — 3D koncept firemní budovy

Nástroj na hledání dispozice, ne architektonický projekt. Model se **generuje
ze `src/spec.js`** — geometrie, plochy i dimenze rozvodů. Když se změní číslo
ve spec, přepočítá se všechno ostatní.

```bash
npm install
npm run dev          # http://116.203.103.27:5186/
node test_spec.mjs   # kontrola ploch, otvorů a rozvodů
```

## Zadání

Celkový půdorys 18 × 56 m = 1 008 m², stavěno ve dvou etapách po 18 × 28 m.
Okap ~6 m, typizovaná montovaná hala, rastr 7 m (28 = 4×7, 56 = 8×7).
Cíl: z 504 m² půdorysu etapy 1 dostat vestavěnými patry 750–850 m² podlahové
plochy. Model je teď na **826 m²** (koeficient 1,64), z toho 777 m² vybavených
a 49 m² vědomě nechaných v hrubé stavbě jako rezerva.

## Program (počty, ze kterých se vybavení odvozuje)

```
Kanceláře 1P      8 lidí, výhled 10 → 10 pracovních míst
Jump aréna        40 osob ve špičce → 9 trampolín + airbag + dunk lane
Bar               nápoje a jednoduchá příprava, bez fritézy → 32 míst
Fitness           2 klece, lavičky, činky, zbytek volná plocha
Sim racing        2 rigy
Dílna             zvedák na auta + 3 ponky + 2 3D tiskárny
```

## Souřadnice

```
x = 0 na VÝCHODNÍM průčelí, roste na ZÁPAD   (etapa 1 = 0–28, etapa 2 = 28–56)
z = 0 na JIŽNÍ stěně (vstupy), roste na SEVER (rozpon 18 m)
y = výška nad podlahou přízemí
```

Znaménka nejsou libovolná: východ = −x, sever = +z, takže **východ × sever = +y**.
Kdyby platilo z+ = jih, byl by celý model zrcadlově převrácený — hlídá to test
v sekci KOMPAS.

## Řídicí princip dispozice

Sever je hranice pozemku (soused) → **slepá stěna**. Proto tam sedí servisní
pruh hloubky 6 m: provozy, které okna nechtějí (strojovna, sprchy, sklad,
sim racing), a celá páteř rozvodů. Jih má **všechny vstupy a vrata** a světlo
pro kanceláře, lobby a fitness. Východní štít je celoprosklený.

### Přízemí — 504 m²

```
Kanceláře 1P             x 0–7    z 0–12    84 m²   jih + prosklený východní štít
Kuchyňka + WC            x 0–7    z 12–18   42 m²   servisní pruh
Lobby / recepce / bar    x 7–14   z 0–12    84 m²   hlavní vstup z jihu
Šatny + sprchy + WC      x 7–14   z 12–18   42 m²   servisní pruh
Jump aréna (plná výška)  x 14–21  z 0–18   126 m²   přes celou hloubku
Sdílená dílna            x 21–28  z 0–13    91 m²   vrata z jihu
Strojovna                x 21–28  z 13–18   35 m²   u hranice etapy 2
```

### Patro — 336 m²

```
Kanceláře 1P             x 0–7    z 0–12    84 m²
Zasedačka / školicí      x 0–7    z 12–18   42 m²   sever = bez oslnění projekce
Fitness                  x 7–14   z 0–12    84 m²   jih = světlo
Sim racing               x 7–14   z 12–18   42 m²   sever = tma, bez oslnění
Dětské atrakce (galerie) x 14–21  z 15–18   21 m²   vykonzolovaná ze severní stěny
Sklad nad dílnou         x 21–28  z 4–13    63 m²
```

## Co se dopočítává samo

- **Otvory v plášti** z bloků, které se stěny dotýkají — dílna si nese vrata,
  lobby vstup, aréna prosklení. Stěny v `spec.blindWalls` zůstanou slepé.
  Při kolizi otvorů ustoupí okno, ne dveře.
- **Trasy rozvodů** z pozice strojovny a bloků: páteř podél servisní stěny
  v každém podlaží, odbočka ke každému bloku, stoupačka u strojovny.
  Páteř vždycky dojede zaslepená až na hranici etapy 2.
- **Dimenze**: průměr VZT z průtoku (5 m/s), tepelná ztráta, chlazení,
  hlavní jistič ze soudobého příkonu. Sazby na m² jsou v `TYPES` ve `spec.js`.
- **FVE**: jižní střešní rovina celá, fasáda jen do volných polí mezi otvory
  (doplněk otvorů, takže se panely nikdy nepotkají s oknem). Přepínače
  `roofSouth` / `roofNorth` / `facadeSouth` v `spec.pv`.
- **Vybavení** (`src/fitout.js`): počty stolů, skříněk, WC a umyvadel se
  odvozují z `spec.program`. Sanita podle NV 361/2007 a ČSN 73 4108, jedno
  bezbariérové WC podle vyhl. 398/2009. Rozmístění je relativní k rohu bloku,
  takže jde s ním; co se po zmenšení bloku nevejde, se zahodí a nahlásí
  v souhrnu jako „nevešlo se“ — model radši přizná díru, než aby lhal.

## Soubory

```
src/spec.js      zadání — jediný zdroj pravdy, tohle se edituje
src/mep.js       přepočet rozvodů (bez závislosti na Three → jde testovat v Node)
src/building.js  geometrie: plášť, otvory, střecha, bloky, potrubí
src/cutaway.js   otevírání obálky podle kamery
src/env.js       Miami sunset (převzato z flightsim)
src/quality.js   adaptivní kvalita (kopie z flightsim)
src/fitout.js    vybavení místností + normové počty (taky bez Three)
src/ui.js        textový souhrn
src/main.js      scéna, ovládání, editace
```

## Otevřené otázky

- **Program je menší než půdorys.** 2 rigy do 42 m², 2 klece do 84 m²,
  10 lidí do 126 m² kanceláří. Buď se rezerva nechá v hrubé stavbě
  (teď 49 m²), nebo se etapa 1 zkrátí, nebo se část pronajme.
- Přípojku elektro dimenzovat na celých 56 m, ne jen na etapu 1.
- Zapnout i severní střešní rovinu FVE? Při sklonu 10° je skoro vodorovná a
  přidala by dalších ~39 kWp při zhruba 80 % měrného výnosu.
- Retenci dešťové vody počítat na celých 1 008 m² střechy.

Rozhodnuto: okap zůstává 6,0 m (v patře 2,70 m světlé výšky). Hluk venkovních
jednotek TČ se neřeší — průmyslová zóna.
