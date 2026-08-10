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
