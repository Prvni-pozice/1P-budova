# Investiční náklady — odhady k diskusi

**Stav k 2. 9. 2026. ŽÁDNÉ z těchto čísel není z nabídky ani z rozpočtu.**
Jsou to orientační sazby z obecné znalosti českého trhu (Claude, odhad),
sepsané proto, aby bylo nad čím diskutovat a co nahradit skutečnými čísly.
Model je zatím nepoužívá — `spec.economy` řeší jen provoz (roční tržby
a náklady), investice v modelu není. Než se podle toho rozhodne cokoli
podstatného, musí přijít poptávka u dodavatelů.

Ceny jsou bez DPH, bez pozemku a bez projektových a inženýrských prací.

## Varianta D — kontejnerová vesnička

Položka                          Rozpětí            Poznámka
Použitý 40' HC kontejner         60–90 tis./ks      samotná skořápka
Nový (one-trip) 40' HC           130–180 tis./ks    lepší základ pro obytný modul
Přestavba na sklad / dílnu       10–20 tis. Kč/m²   zateplení, elektro, vrata
Přestavba na kancelář            20–30 tis. Kč/m²   + okna, podlaha, vytápění
Obytný modul (bydlení)           28–40 tis. Kč/m²   koupelna, kuchyň, rekuperace
Základy (patky / zemní vruty)    1–2 tis. Kč/m²
Přípojky na celý pozemek         0,5–1,5 mil.       podle vzdálenosti od ulice
Zpevněné plochy + plot           1,5–2,5 tis. Kč/m² parkoviště a náves dominují

Z toho vychází: **etapa 1 (208 m², z toho 59 m² bydlení) ~5 mil.** včetně
přípojek dimenzovaných na celou vesničku; **finál (520 m²) ~13 mil.**,
rozpětí 12–15 mil.

Nejcitlivější položka je úroveň přestavby — rozdíl mezi „stavební buňkou"
a skutečným obytným modulem je 3×, takže poměr obytných a skladových buněk
hýbe součtem víc než počet kontejnerů.

## Varianty A–C — sendvičová hala

Položka                              Rozpětí
Ocelová konstrukce + opláštění       12–20 tis. Kč/m² půdorysu
Základy a podlahová deska            3–5 tis. Kč/m²
Vestavěné patro (konstrukce)         8–12 tis. Kč/m² patra
Rozvody (ZTI, elektro, VZT, TČ)      4–8 tis. Kč/m² podlahové plochy
Vybavení na kancelářský standard     +15–25 tis. Kč/m² té plochy
Vybavení na bytový standard          +25–35 tis. Kč/m² té plochy
Prosklený východní štít              600 tis. – 1,2 mil. (18 × 6 m)
FVE 38,9 kWp                         0,9–1,3 mil.

Z toho vychází **etapa 1 ~22 mil.** (odhad z 8. 8. 2026), což je zhruba
**24 tis. Kč/m² podlahové plochy** při 917 m² — pro halu s vestavěným patrem
a bytovým fit-outem střed rozpětí, ne nejlevnější varianta.

## Co z porovnání plyne

**Hala je na m² podlahové plochy levnější**, protože jeden plášť nese dvě
podlaží — patro se platí jen konstrukcí, ne novou obálkou a střechou.
Vesnička platí obálku za každou buňku zvlášť.

**Vesnička se dá stavět po ~3 milionech** a první etapa může vydělávat,
zatímco hala je jedna velká investice na začátku. To je hlavní rozdíl,
ne cena za metr.

## Kde jsou čísla nejméně jistá

1. **Cena přestavby kontejneru** — nabídky se liší 2× podle toho, jestli je
   to „stavební buňka", nebo skutečný obytný modul s rekuperací.
2. **Přípojky** — závisí na vzdálenosti od sítí, kterou zatím neznáme.
3. **Fit-out bytů** — rozptyl 25–35 tis. Kč/m² je široký a u pěti jednotek
   dělá přes milion rozdílu.

## Další krok, až budou reálné sazby

Postavit kapex model do specu (sazby na typ provozu jako v `TYPES`), aby se
investice počítala z ploch stejně jako teď rozvody a dala se porovnat mezi
variantami A/B/C/D. Sazby by byly na jednom místě k přepsání. Dokud jsou
čísla jen odhad, model by jen dodával falešnou přesnost — proto zatím
zůstávají tady v textu.
