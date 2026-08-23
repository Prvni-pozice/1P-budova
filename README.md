# 1P — 3D koncept firemní budovy

Nástroj na hledání dispozice, ne architektonický projekt. Model se **generuje
ze specu** — geometrie, plochy i dimenze rozvodů. Když se změní číslo ve spec,
přepočítá se všechno ostatní.

Budova má dvě verze dispozice ve stejné obálce. Přepínají se v panelu vlevo
nahoře (a drží se v adrese za `#`):

| | verze | spec | co je uvnitř |
|---|---|---|---|
| **A** | firemní budova | `src/spec.js` | jump aréna, bar, fitness a sim racing v patře |
| **B** | se 4 byty | `src/spec-byty.js` | 4 byty 2+kk místo arény, sport sjel do přízemí |

```bash
npm install
npm run dev          # http://116.203.103.27:5186/       (verze A)
                     # http://116.203.103.27:5186/#byty  (verze B)
node test_spec.mjs   # kontrola varianty A (151 kontrol)
node test_byty.mjs   # kontrola varianty B (byty, pavlač, požární úseky)
node audit.mjs       # projektantský audit obou verzí: kolize předmětů,
                     # přesahy přes stěny, věci ve vstupech, rozvody
                     # v prostupech (0 nálezů)
node plans.mjs       # 2D výkresy obou verzí → plans/ a plans/byty/
```

Rozcestník verzí je v `src/variants.js`. Generátory (`building.js`, `mep.js`,
`fitout.js`, `walk.js`) jsou společné a berou spec parametrem — přidat třetí
verzi znamená napsat nový spec a přidat řádek do `variants.js`.

## Zadání (společné pro obě verze)

Celkový půdorys 18 × 56 m = 1 008 m², stavěno ve dvou etapách po 18 × 28 m.
Okap ~6 m, typizovaná montovaná hala, rastr 7 m (28 = 4×7, 56 = 8×7).
Cíl: z 504 m² půdorysu etapy 1 dostat vestavěnými patry 750–850 m² podlahové
plochy.

| | verze A | verze B |
|---|---|---|
| Podlahová plocha | 812 m² | 807 m² |
| Koeficient | 1,61× | 1,60× |
| Vybaveno | 771 m² | 766 m² |
| Hrubá rezerva | 41 m² | 41 m² |

## Verze A — program (počty, ze kterých se vybavení odvozuje)

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

## Verze A — řídicí princip dispozice

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

### Patro — 308 m²

```
Chodba                   x 5,8–7  z 0–18    22 m²   propojuje schodiště se všemi
Klidové místnosti        x 0–5,8  z 0–5     29 m²
Rezerva k pronájmu       x 0–5,8  z 5–12    41 m²   hrubá stavba
Zasedačka / školicí      x 0–5,8  z 12–18   35 m²   sever = bez oslnění projekce
Fitness                  x 7–14   z 0–12    84 m²   jih = světlo
Sim racing               x 7–14   z 12–18   42 m²   sever = tma, bez oslnění
Dětské atrakce (galerie) x 14–21  z 15–18   21 m²   vykonzolovaná ze severní stěny
Sklad nad dílnou         x 21–28  z 6–13    49 m²   nad vjezdovou dráhou nesmí být
```

## Verze B — se čtyřmi byty

Zadání 23. 8. 2026: aréna se ruší, na jejím místě a na části lobby vznikají
**4 byty 2+kk, dva v přízemí a dva v patře, každý s vlastním vstupem zvenku**.
Kanceláře vepředu a dílna vzadu zůstávají. Záměr byl konzultován na stavebním
úřadě — model to bere jako zadání, ne jako ověřený fakt.

### Co dispozici určilo

**Světlo je jen z jihu.** Severní stěna je na hranici pozemku a zůstává slepá,
západní štít jednou zmizí v etapě 2, východní průčelí patří kancelářím. Obytná
místnost musí mít okno, takže se ložnice i obývák každého bytu musí vejít na
jižní fasádu — na to je potřeba nejmíň 6 m průčelí na byt. Čtyři byty ve dvou
podlažích tedy zaberou 14 m jižní fasády, a přesně 14 m je mezi kancelářemi
(x 0–7) a dílnou (x 21–28). **Na vstup do firmy tam nezbude ani metr.**

Proto se recepce stěhuje do východního pole (x 0–7, z 0–3,2) i s portálem —
vchod tedy zůstává z jihu, jak velí zbytek konceptu. Komunitní prostor
kanceláří si drží šířku i polohu, jen se zkrátí ze 102 na 80 m². To je jediný
zásah do kanceláří.

### Byt 7 × 7 m = 49 m²

```
 v=7  ┌──────────┬──────┬──────────┐
      │ koupelna │ před-│ kuchyňský│   sever (bez oken)
 v=4,6├──────────┤ síň  ├──────────┤
      │ ložnice  │      │ obývák   │
 v=0  └──────────┴──────┴──────────┘   jih — okna a vstupní dveře
      u=0      2,7    4,1          7
```

Obývák s kuchyňským koutem 20 m², ložnice 12 m², koupelna s WC a pračkou
6,5 m², předsíň 10 m². Ložnice i obývák mají okno na jih, předsíň mezi nimi
nese vstupní dveře. **Koupelny všech čtyř bytů leží nad sebou** → dvě
stoupačky na celý dům. Byty 2 a 4 jsou zrcadlené, aby obývací pokoje sousedily
s venkovním schodištěm a pavlač běžela před obývákem, ne před ložnicí.

### Přístup: venkovní schodiště a pavlač

Byty v přízemí mají dveře přímo z terénu. Byty v patře obsluhuje **dvouramenné
ocelové schodiště před jižní fasádou** (vyčnívá 5,6 m) a pavlač x 9,7–18,3.
Žádná společná vnitřní chodba se nestaví: bytová část se nikde nepotká
s provozem firmy, každý byt je vlastní požární úsek a schodiště je zároveň
úniková cesta. Ověřuje to walk test — z bytu se dovnitř firmy neprojde a
naopak.

### Sport sjel do přízemí

Fitness (42 m²) a sim racing (28 m²) jsou nově v bezokenním středu přízemí.
Není to jen výplň zbytku:

- posilovna **nad byty** by byla akustický průšvih (kročejový hluk činek),
- na terénu odpadá dimenzování mezipatra na 5 kN/m²,
- **nad středem přízemí se strop vůbec nestaví** (`level: 'full'`) — ušetří se
  121 m² stropní desky, fitness dostane světlou výšku ~7 m a sklad regál
  do výšky.

### Bilance verze B

```
Přízemí            504 m²      Byty            4 × 49 = 196 m²
Patro              303 m²      Fitness                  42 m²
Celkem             807 m²      Sim racing               28 m²
Koeficient          1,60×      Kanceláře + zázemí      194 m²
Hrubá rezerva       41 m²      Dílna + sklady          216 m²
```

Ekonomika v `spec-byty.js` je **odhad k ověření**, ne nabídka: nájem
11 000 Kč/měs za byt (spodní hranice trhu v Pelhřimově, průmyslová zóna) =
528 tis. Kč/rok, provozní náklady bez arény a baru 1,18 mil. Kč/rok.

### Otevřené otázky verze B

- **Územní plán.** V průmyslové zóně bývá bydlení přípustné jen jako byt
  správce. Čtyři nájemní byty jsou jiná kategorie — tohle je jediné, co může
  celý záměr zabít, a model si to nijak neověřuje.
- **Hluk a vibrace.** U verze A platilo „hluk venkovních jednotek TČ se neřeší
  — průmyslová zóna". S byty přestává platit: hygienické limity pro chráněný
  venkovní prostor, TČ, VZT dílny i zvedák jsou najednou téma.
- **Pavlač před okny.** Mezi vstupními dveřmi a schodištěm běží ~2 m pavlače
  před oknem obývacího pokoje. Řeší se zvýšeným parapetem nebo odsazením
  pavlače od fasády — v modelu to zatím není.
- **Předpolí a stání.** Řada stání je odsunutá na z = −12, aby se před fasádu
  vešlo schodiště. Skutečný počet stání pro 4 byty + firmu a tvar příjezdu je
  věc situace, ne tohoto modelu.
- **Bez sklepů a kolárny.** Úložné prostory bytů jsou zatím jen komora v bytě.
  Kolárnu/kočárkárnu by šlo dodělat jako přístavek u schodiště.
- 121 m² bezokenního středu přízemí drží sport a sklad. Pokud by fitness
  a sim racing padly, zůstane z toho hluchá plocha — pak dává smysl spíš
  zkrátit etapu 1.

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
- **Vnitřní dveře** ze seznamu `spec.links`. Co tam není, není propojené —
  dílna, strojovna a sklad tvoří samostatnou technickou zónu přístupnou jen
  vlastními dveřmi a vraty z jihu; jediné propojení dovnitř zóny jsou servisní
  dveře dílna–strojovna. Test ověřuje, že se z každé místnosti dá dojít ven,
  že před dveřmi nestojí nábytek a že z dílny nikam neuniknou dveře do
  veřejné části.
- **Prostupy ve stropě** nad každým schodištěm — bez nich schodiště končí
  u stropu, což se v jedné verzi stalo a nikdo si toho nevšiml. Kolem prostupu
  i po všech volných hranách mezipater jde zábradlí; volné hrany se počítají
  jako doplněk sousedních bloků a obvodových stěn (`openEdges`).
- **Osvětlení a bezpečnost**: svítidla podle ČSN EN 12464-1 (500 lx kanceláře
  a dílna, 300 lx sport, 150 lx sklad), nouzová svítidla, detektory kouře
  1 na 60 m², hasicí přístroje, hydrant, podlahové vpusti.
- **Rozvody ke koncovkám**: každý zařizovací předmět má v `SVC` napsáno, co
  potřebuje, a `mep.js` k němu vede větev. O tom, jestli do místnosti jde voda,
  rozhoduje předmět, ne typ provozu — bar a strojovna nejsou „mokré provozy",
  ale dřez i výlevka v nich stojí.
- **Vybavení** (`src/fitout.js`): počty stolů, skříněk, WC a umyvadel se
  odvozují z `spec.program`. Sanita podle NV 361/2007 a ČSN 73 4108, jedno
  bezbariérové WC podle vyhl. 398/2009. Rozmístění je relativní k rohu bloku,
  takže jde s ním; co se po zmenšení bloku nevejde, se zahodí a nahlásí
  v souhrnu jako „nevešlo se“ — model radši přizná díru, než aby lhal.

## Soubory

```
src/spec.js      zadání verze A — jediný zdroj pravdy, tohle se edituje
src/spec-byty.js zadání verze B (4 byty); obálku a sazby bere ze spec.js
src/variants.js  rozcestník verzí pro model, testy, audit i výkresy
src/mep.js       přepočet rozvodů (bez závislosti na Three → jde testovat v Node)
src/building.js  geometrie: plášť, otvory, střecha, bloky, potrubí
src/cutaway.js   otevírání obálky podle kamery
src/env.js       Miami sunset (převzato z flightsim)
src/quality.js   adaptivní kvalita (kopie z flightsim)
src/fitout.js    vybavení místností + normové počty (taky bez Three)
                 židle se umísťují přes seat(), rotaci nikdy nepiš ručně
src/walk.js      mřížkový pathfinder — průchodnost patra pro walk test
src/ui.js        textový souhrn
src/main.js      scéna, ovládání, editace
```

## Požární úseky a příčky

Příčky se generují z sousednosti bloků (`partitionsFor`): kde je v `links`
dveřní propojení, je otvor s nadpražím; `wallGaps` přidává průchod výtahu.
Ve verzi A jsou tři požární úseky (`spec.compartments`): kanceláře, veřejná
část (shromažďovací prostor arény), technická zóna. Ve verzi B k nim přibývají
**čtyři úseky bytů** — každý byt vlastní. Stěny mezi úseky jsou tlustší
a tónované, takže je na modelu vidět, kudy vede požární dělení. Postava v GTA režimu prochází jen dveřmi.

## Otevřené otázky verze A

- **Program je menší než půdorys.** 2 rigy do 42 m², 2 klece do 84 m²,
  10 lidí do 126 m² kanceláří. Buď se rezerva nechá v hrubé stavbě
  (teď 49 m²), nebo se etapa 1 zkrátí, nebo se část pronajme.
- Přípojku elektro dimenzovat na celých 56 m, ne jen na etapu 1.
- Zapnout i severní střešní rovinu FVE? Při sklonu 10° je skoro vodorovná a
  přidala by dalších ~39 kWp při zhruba 80 % měrného výnosu.
- Retenci dešťové vody počítat na celých 1 008 m² střechy.

Rozhodnuto: okap zůstává 6,0 m (v patře 2,70 m světlé výšky). Hluk venkovních
jednotek TČ se neřeší — průmyslová zóna.
