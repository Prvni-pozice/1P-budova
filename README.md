# 1P — 3D koncept firemní budovy

Nástroj na hledání dispozice, ne architektonický projekt. Model se **generuje
ze specu** — geometrie, plochy i dimenze rozvodů. Když se změní číslo ve spec,
přepočítá se všechno ostatní.

Budova má dvě verze dispozice ve stejné obálce. Přepínají se v panelu vlevo
nahoře (a drží se v adrese za `#`):

| | verze | spec | co je uvnitř |
|---|---|---|---|
| **A** | firemní budova | `src/spec.js` | jump aréna, bar, fitness a sim racing v patře |
| **B** | s 5 jednotkami | `src/spec-byty.js` | 4 byty 2+kk + jednotka 5 (byt/kancelář), sport v přízemí |
| **C** | nudle 3+kk | `src/spec-nudle.js` | přízemí jako B, patro = 3 nudle 84 m² přes celý rozpon |

```bash
npm install
npm run dev          # http://116.203.103.27:5186/       (verze A)
                     # http://116.203.103.27:5186/#byty  (verze B)
                     # http://116.203.103.27:5186/#nudle (verze C)
node test_spec.mjs   # kontrola varianty A (151 kontrol)
node test_byty.mjs   # kontrola varianty B (byty, pavlač, požární úseky)
node test_nudle.mjs  # kontrola varianty C (nudle, chodba, střešní okna)
node audit.mjs       # projektantský audit obou verzí: kolize předmětů,
                     # přesahy přes stěny, věci ve vstupech, rozvody
                     # v prostupech (0 nálezů)
node plans.mjs       # 2D výkresy všech verzí → plans/, plans/byty/, plans/nudle/
```

Rozcestník verzí je v `src/variants.js`. Generátory (`building.js`, `mep.js`,
`fitout.js`, `walk.js`) jsou společné a berou spec parametrem — přidat třetí
verzi znamená napsat nový spec a přidat řádek do `variants.js`.

## Zadání (společné pro všechny verze)

Celkový půdorys 18 × 56 m = 1 008 m², stavěno ve dvou etapách po 18 × 28 m.
Okap ~6 m, typizovaná montovaná hala, rastr 7 m (28 = 4×7, 56 = 8×7).
Cíl: z 504 m² půdorysu etapy 1 dostat vestavěnými patry 750–850 m² podlahové
plochy.

| | verze A | verze B | verze C |
|---|---|---|---|
| Podlahová plocha | 812 m² | 861 m² | 917 m² |
| Koeficient | 1,61× | 1,71× | 1,82× |
| Hrubá rezerva | 41 m² | 78 m² | 78 m² |
| Jednotky k pronájmu | — | 294 m² | 448 m² |

Verze B a C překračují horní mez záměrně: zastropení středu přidává
pronajímatelnou plochu.

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

## Verze B — s pěti jednotkami

Zadání 23. 8. 2026: aréna se ruší, na jejím místě a na části lobby vznikají
**4 byty 2+kk, dva v přízemí a dva v patře, každý s vlastním vstupem zvenku**.
Kanceláře vepředu a dílna vzadu zůstávají. Bydlení je v této zóně podle
územního plánu **přípustné** — ověřeno na stavebním úřadě.
Revize 24. 8. 2026 přidala pátou jednotku a proběhla v pěti iteracích
(viz níž).

### Co dispozici určilo

**Světlo je jen z jihu.** Severní stěna je na hranici pozemku a zůstává slepá,
západní štít jednou zmizí v etapě 2, východní průčelí patří kancelářím. Obytná
místnost musí mít okno, takže se ložnice i obývák každého bytu musí vejít na
jižní fasádu — na to je potřeba nejmíň 6 m průčelí na byt. Čtyři byty ve dvou
podlažích tedy zaberou 14 m jižní fasády, a přesně 14 m je mezi kancelářemi
(x 0–7) a dílnou (x 21–28). **Na vstup do firmy tam nezbude ani metr.**

Proto se recepce stěhuje do východního pole (x 0–7, z 0–3,2) i s portálem —
vchod tedy zůstává z jihu, jak velí zbytek konceptu.

### Pět iterací revize 24. 8.

1. **Vnitřní jádro za recepcí.** Schodiště bývalo hluboko ve středu dispozice
   a chodilo se k němu přes komunitní prostor. Teď stojí s výtahem přímo za
   pultem (x 3,2–7, z 3,2–9), otevřené do vstupní haly: vejdeš a vidíš schody.
   Kanceláře se kolem jádra složily do L (pruh u okna + pracovní zóna za
   jádrem), sanita patra sedí hned vedle podesty.
2. **Jednotka 5 — 98 m² byt/kancelář.** Za byty v patře zela díra dolů do
   fitness. Střed se zastropil (x 7–21, z 7–14) a vznikla pátá jednotka:
   velký byt 3+kk, nebo kancelář — podle nájemce. Fasádu nemá žádnou, denní
   světlo dává **sedm střešních oken** (nad jednotkou už je jen střecha,
   světlíky jsou levné a pro obytnou místnost normově stačí). Vstup z chodby
   u vnitřního schodiště — pro kancelář přirozené, pro byt je to totéž co
   vstup bytového domu. Koupelna sedí na stoupačce koupelny bytu 3.
3. **Venkovní schodiště podél fasády.** Kolmé dvouramenné vyčnívalo 5,6 m do
   předpolí. Teď jde jedno přímé ocelové rameno rovnoběžně s jižní stěnou
   v pásu 1,2 m hned za pavlačí (běh 5,3 m, sklon ~32°), nahoře podesta
   a vstup mezerou v zábradlí pavlače. Otevřené stupně a odstup 1,5 m od
   fasády nechávají oknům přízemí světlo. Nejlevnější možná konstrukce —
   žádná mezipodesta, žádné zalomení.
4. **Střed přízemí bez vysokého skladu.** Sklad zůstává jen u dílny
   (store-gf). Fitness 49 m² hned u jádra, sim racing 28 m² za ním, šatna se
   sprchami a bezbariérovým WC u severní stěny. Zbylých **61 m² je hrubá
   rezerva** — nestaví se do ní nic, dokud není nájemce nebo potřeba růstu
   (nejblíž má k rozšíření fitness nebo sim centra).
5. **Ekonomika a požární úseky.** Jednotka 5 je vlastní požární úsek; nájem
   4 × 12 000 Kč (byty) + 13 000 Kč (jednotka 5, odhad).

### Byt 7 × 7 m = 49 m²

```
 v=7  ┌──────────┬──────┬──────────┐
      │ koupelna │ před-│ kuchyňský│   sever (vnitřní stěna)
 v=4,6├──────────┤ síň  ├──────────┤
      │ ložnice  │      │ obývák   │
 v=0  └──────────┴──────┴──────────┘   jih — okna a vstupní dveře
      u=0      2,7    4,1          7
```

Obývák s kuchyňským koutem 20 m², ložnice 12 m², koupelna s WC a pračkou
6,5 m², předsíň 10 m². Ložnice i obývák mají okno na jih, předsíň mezi nimi
nese vstupní dveře. **Koupelny bytů leží nad sebou** → dvě stoupačky (a třetí
sdílená s jednotkou 5). Byty 2 a 4 jsou zrcadlené, aby obývací pokoje
sousedily s venkovním schodištěm a pavlač běžela před obývákem, ne před
ložnicí.

### Přístup k jednotkám

Byty v přízemí mají dveře přímo z terénu. Byty v patře obsluhuje pavlač
x 9,7–18,3 s venkovním schodištěm podél fasády (iterace 3). Byty 1–4 se
s provozem firmy nikde nepotkají — ověřuje to walk test v obou směrech.
Jednotka 5 je vědomá výjimka: sdílí vnitřní schodiště s firmou, což jí
zároveň umožňuje fungovat jako kancelář.

### Sport na terénu, nad ním jednotka 5

Fitness a sim racing jsou v bezokenním středu přízemí: posilovna nad byty by
byla akustický průšvih a na terénu odpadá dimenzování stropu na 5 kN/m².
Nad fitness a simem teď bydlí jednotka 5 → fitness má těžkou plovoucí
podlahu (kročejový hluk) a jednotka je primárně nabízená jako kancelář;
jako byt s tím nájemce musí počítat (večerní provoz posilovny pod podlahou).

### Bilance verze B

```
Přízemí            504 m²      Byty 1–4        4 × 49 = 196 m²
Patro              357 m²      Jednotka 5               98 m²
Celkem             861 m²      Fitness                  49 m²
Koeficient          1,71×      Sim racing               28 m²
Hrubá rezerva       78 m²      Dílna + sklad           126 m²
```

Ekonomika v `spec-byty.js`: nájem **12 000 Kč/měs bez energií za byt**
(Zdeněk, 23. 8. 2026) = 576 tis. Kč/rok, jednotka 5 za 13 000 Kč/měs
(odhad) = 156 tis. Kč/rok. Provozní náklady bez arény a baru 1,18 mil.
Kč/rok jsou pořád jen odhad k ověření — provozní výsledek vychází na
~730 tis. Kč/rok, ale spolehlivá je zatím jen výnosová půlka.

### Rozhodnuto

- **Územní plán bydlení dovoluje** — nájemní byty v této zóně projdou
  (23. 8. 2026).
- **Nájem 12 000 Kč/měs** bez energií za byt (23. 8. 2026).
- **Hluk se zatím neřeší.** U verze A to plynulo z průmyslové zóny, teď je to
  vědomý odklad: až se projekt pohne dál, hygienické limity pro chráněný
  venkovní prostor, TČ, VZT dílny i zvedák budou téma.
- **Pavlač před oknem obýváku zůstává, jak je.** Kdyby to vadilo, řeší se to
  zvýšeným parapetem nebo odsazením pavlače od fasády.
- **Vysoký sklad zrušen, sklad jen u dílny; rozcestník verzí v modelu**
  (24. 8. 2026).

### Otevřené otázky verze B

- **Provozní náklady jsou odhad.** 1,18 mil. Kč/rok bez arény a baru je jen
  hrubý odhad — výnosová strana je zadaná, nákladová ne. Stejně tak nájem
  jednotky 5 (13 tis.) je odhad.
- **Jednotka 5 jako byt = kolaudace na zkoušku.** Střešní okna normově na
  denní osvětlení stačí, ale byt bez jediného svislého okna je na hraně
  komfortu; jako kancelář je jednotka bez diskuse. Nabízet primárně jako
  kancelář.
- **Předpolí a stání.** Řada stání je na z = −9. Skutečný počet stání pro
  5 jednotek + firmu a tvar příjezdu je věc situace, ne tohoto modelu.
- **Bez sklepů a kolárny.** Úložné prostory bytů jsou zatím jen komora
  v bytě. Kolárnu/kočárkárnu by šlo dodělat jako přístavek u schodiště,
  nebo vyčlenit kus hrubé rezervy středu.
- 61 m² hrubé rezervy středu čeká na obsah — nejblíž má k rozšíření fitness
  nebo sim centra, případně na kóje pro nájemníky.

## Verze C — nudle 3+kk přes rozpon

Zadání 26. 8. 2026: byty v patře jako „nudle" napříč celou hloubkou haly
(18 m). Přízemí zůstává jako ve verzi B (2 byty 2+kk s okny na jih, fitness,
sim, rezerva) — nudle funguje **jen v patře**: v přízemí je nad ložnicí
a dětským pokojem strop, střešní okno tam nedosáhne.

### Jedna nudle: ~4,67 × 18 m = 84 m² (3+kk)

Chodbový pruh 1,8 m (0,6 m skříně + 1,2 m průchod) + pokojový pruh ~2,87 m.
Od jihu: předsíň se vstupem z pavlače | obývák s KK přes oba pruhy
(průchozí), kuchyň zády k WC a koupelně → jedna stoupačka na byt | WC |
koupelna s pračkou | šatna | ložnice ⌂ | dětský pokoj ⌂⌂ přes celou šířku
u severní stěny.

**Sever je slepá stěna (hranice pozemku), okno tam nejde.** Ložnice
a dětský pokoj mají střešní okna v severní rovině střechy: stálé difuzní
světlo bez oslnění a žádná kolize s FVE (ta je jen na jižní rovině).

### Tři nudle v poli x 7–21

Byty A a C jsou zrcadlené, aby se koupelnové pruhy A|B potkaly zády k sobě
→ **dvě stoupačky na tři byty** (C má vlastní u stěny dílny). Všechny tři
vstupy z pavlače (x ~7,9 / 15,4 / 17,2), venkovní schodiště podél fasády
jako ve verzi B. Žádný vnitřní vstup — bydlení a firma se nepotkají nikde,
odpadá i kompromis jednotky 5 z verze B.

### Bilance a srovnání s verzí B (patro)

```
                       verze B         verze C
Jednotky nahoře        2× 2+kk + 98 m² 3× 3+kk 84 m²
Plocha pronájmu patra  196 m²          252 m²
Nájem patra (odhad)    444 tis. Kč/rok 558 tis. Kč/rok  (3× 15 500 Kč/měs)
Vstupy                 pavlač + vnitřní jen pavlač
```

Celkem verze C: 5 jednotek, 917 m² podlahové plochy, výnos jednotek
846 tis. Kč/rok (2× 144 + 3× 186 tis.).

### Slabá místa verze C

- **Ložnice 9,2 m²** — na dvoulůžko úsporný standard (postel 1,8 m
  + průchod po jedné straně).
- **Jediné fasádní okno na byt** (obývák) — zbytek světla jde střechou.
  V patře plnohodnotné, ale jiný charakter bydlení než klasický byt.
- **Fitness pod ložnicemi.** Pod byty A a B leží fitness (x 7–14, z 7–14)
  — těžká plovoucí podlaha zůstává nutností, večerní provoz je slyšet.
- Nájem 15 500 Kč/měs za 3+kk je ODHAD k ověření.

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
src/spec-byty.js zadání verze B (byty + jednotka 5); obálku bere ze spec.js
src/spec-nudle.js zadání verze C (nudle) — přízemí přebírá ze spec-byty.js
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
