# Panelová simulace poptávky — okolí Pelhřimova (MatrAIx persony)

*10. 8. 2026 · 48 person z datasetu MatrAIx_Persona_1M (MIT), kvótní výběr:
venkov/maloměsto/předměstí, nižší–střední příjem, věková struktura okresu.
Persona-agent: Claude (stejný princip jako framework — LLM podmíněný
záznamem persony; bez externího API).*

## Výsledky panelu (deklarace)

    Jump aréna     94 % vyzkouší aspoň 1×/rok · průměr 3,1 návštěvy/os/rok
                   medián mezi návštěvníky 3×/rok · tahouni: rodiny s dětmi
                   5–15 a teenageři (5–8×/rok)
    Cena 210 Kč    přijatelná 42 % · hraniční 40 % · moc 19 %
                   → cena je NA HORNÍ HRANICI akceptace; <25k příjmy říkají
                   „moc" v třetině případů
    Fitness 550    19 % dospělých deklaruje členství
    Sim 250 Kč     31 % vyzkouší, ale jen ~0,65 jízdy/os/rok — doplněk,
                   žije z gamerů (2 persony = polovina všech jízd)
    Dílna 1200     4 % členství (profily: řemeslník-živnostník, dřevo/auto
                   koníček) + 15 % zájem o jednorázový vstup
    Kavárna        79 Kč průměrná útrata při návštěvě arény

## Extrapolace (spád 30 tis., deflátor deklarací 30–40 %)

    Aréna     25–33 tis. návštěv/rok   (plán počítá 15 tis. → KONZERVATIVNÍ)
    Fitness   po ořezu o konkurenci a setrvačnost reálně 150–400 členů
              (plán 50 → velmi bezpečný)
    Dílna     ~1 % dospělých v blízkém dojezdu ≈ 100–200 kandidátů,
              konverze na 1200 Kč/měs nízká (plán 15 členů → realistický)
    Sim       deklarace NEPODPORUJE 300 tis. Kč/rok z walk-in — nutné
              firemní akce a turnaje

## Doporučení z panelu

1. RODINNÉ VSTUPNÉ — 40 % „hraniční" u 210 Kč jsou hlavně rodiče s 2+ dětmi;
   rodinná cena (např. 2+2 za 640) je konverzní páka č. 1.
2. Permanentky/kredity pro teenagery (nejčastější segment, platí z kapesného).
3. Školy a školky dopoledne — panel je neměří, ale všední dopoledne je
   jinak mrtvé (viz ekonomická rozvaha).
4. Sim racing prodávat přes firemní akce, ne走 walk-in ceník.

## Limity metody (číst před citováním čísel)

- „8B model" NEEXISTUJE ke stažení — jde o 8,3 mld. person; framework
  oživuje persony přes API LLM. Zde byl agentem Claude — jiný model než
  v paperu, bez jejich verifikační pipeline.
- Plnoprofilové persony (1 290 atributů) jsou jen syntetické a Evropu
  neobsahují — panel je demograficky mapovaný na Pelhřimovsko, ale
  kulturně nečeský. Některé syntetické kombinace jsou nekonzistentní
  (18letá „empty nester" apod.) — braly se s korekcí.
- Deklarovaný zájem ≠ chování; deflátor 30–40 % je oborová konvence,
  ne měření. Čísla ber jako HYPOTÉZY pro ověření (pilotní ceník, předprodej),
  ne jako průzkum trhu. I autoři píší: „not a replacement for evidence
  from real people".

---

# Dotest 11. 8.: pro-sim 2 000 Kč/h a „Race Fit"

*Cílený panel 30 person (motorsport: Passionate/industry/moto + vyšší příjmy
+ adrenalinové profily) — pro prémiovou niku je obecný panel k ničemu.
Karty: panel_sim_cards.txt, odpovědi: simulate_sim.py.*

## H1 — 2 profi simulátory (>1 mil. Kč), 2 000 Kč/h

    Koupí aspoň 1 h/rok     83 % cílovky (většina 1× — zážitek/odměna)
    Dárkový poukaz          40 % koupí PRO NĚKOHO — nejsilnější signál panelu
    Cena 2 000 Kč           ok 27 % · hraniční 37 % · moc 37 % (chtěli by 600–1000)
    Extrapolace (dojezd 60 min po D1, ~280 tis. dospělých):
      deflátor 5–15 % → 1 100–3 300 placených hodin/rok → 2,2–6,7 mil. Kč
      break-even 2 rigů vč. prostoru ≈ 600–800 h/rok → I PESIMISTICKY NAD

    Závěr: životaschopné, ALE ne jako walk-in. Nosné pilíře:
    1) dárkové poukazy (40 %!), 2) firemní akce a teambuilding,
    3) tréninkové bloky skutečných jezdců (věrohodnost + obsah),
    4) dvouvrstvý ceník — profi rig 2 000, standardní rig 250–400
       (vstupní schod pro „moc drahé" třetinu, která chce 600–1000).

## H2 — „Race Fit": kruhový trénink jezdce vedle simu

    Vyzkouší               63 % cílovky
    Balíček/pravidelně     30 % deklarace → po deflaci realisticky
                           30–80 pravidelných v dojezdu 20 min
    Závěr: NENÍ samostatný byznys, ALE naplní 4–6 skupinových lekcí
    týdně jako prémiový program fitka. Unikátnost potvrzena — nikdo
    z panelu nic podobného nezná.

    Promo háčky, které v panelu rezonovaly (soutěživé profily):
    - „Trénuj jako jezdec" — identita, ne cvičení; krk, předloktí,
      reakce, periferní vidění
    - MĚŘITELNOST: reakční čas + čas na kolo na simu vedle = leaderboard;
      pokrok vidíš v číslech i v jízdě
    - obsah: video skutečného jezdce/driftera v tréninku (drift dny
      Vysočina, autokluby, sim-racing ligy CZ — kanály zdarma)
    - balíček SIM + FIT (po tréninku měřená kola) — nikdo jiný nenabízí

## Limity dotestu
Stejné jako u hlavního panelu + jeden navíc: u ceny 2 000 Kč/h je rozptyl
deflátoru obrovský (5–15 % = trojnásobný rozdíl tržeb). Levné ověření:
předprodej 20 poukazů „Pro Rig Experience" před nákupem rigů — pokud se
neprodají za měsíc, hypotéza padá.

---

# Pesimistický scénář „Vysočina" (12. 8.)

*Post-stratifikace obou studií na šetřivé rozložení: Frugal saver 50 % ·
Balanced 35 % · Spender 12 % · Splurger 3 % (původní panely měly šetřílků
jen 17–27 %). Přepočet vahami, ne nová simulace.*

## Budova

    aréna            3,12 → 2,90 návštěv/os/rok (−7 %)
                     extrapolace 23–31 tis. návštěv (plán 15 tis. DRŽÍ
                     i pesimisticky, rezerva ~1,5×)
    cena 210 „moc"   19 % → 24 % → rodinné vstupné je ještě důležitější
    fitness          19 % → 13 % členství (pořád ≫ plán 50 členů)
    kavárna          79 → 71 Kč/návštěvu (−10 % tržeb baru)

## Pro-sim 2 000 Kč/h

    placené hodiny   beze změny (+1 %) — jádro kupuje z vášně, ne z rozmaru;
                     šetřivost ho nefiltruje
    DÁRKOVÉ POUKAZY  40 % → 27 % (−⅓!) — šetřivost dopadá NEJVÍC na
                     dárkový kanál, který je hlavním pilířem tržeb
    → pesimisticky se posouvá težiště z poukazů na firemní akce; předprodej
    poukazů jako test hypotézy je tím DŮLEŽITĚJŠÍ

## Poznámka k metodě
Převážení 48/30 person má velký rozptyl (váhy až 1,9×) — čísla jsou směrová.
Pro nové studie je čistší rovnou stavět panely s českými kvótami frugality
(viz README nástroje persony).
