# -*- coding: utf-8 -*-
# H1: pro-sim 2000 Kč/h (2 profi rigy, trénink skutečných jezdců, dojezd po D1)
#   jizd = deklarované placené hodiny/rok, darek = koupí poukaz jinému,
#   cena_ok = 2000 bere / hranicni / moc (vlastní představa)
# H2: „Race Fit" — kruhový trénink jezdce vedle simu (krk, předloktí, reakce)
#   zkusi = jednorázová lekce ~350 Kč, balicek = 8 lekcí 2400 Kč opakovaně
# Odpovědi persona-agenta dle karet panel_sim_cards.txt.
R = {
 'S00': dict(jizd=0, darek=1, cena='moc-500',  zkusi=0, balicek=0),
 'S01': dict(jizd=2, darek=1, cena='ok',       zkusi=1, balicek=0),
 'S02': dict(jizd=1, darek=0, cena='hranicni', zkusi=1, balicek=1),
 'S03': dict(jizd=1, darek=0, cena='hranicni', zkusi=1, balicek=0),
 'S04': dict(jizd=3, darek=1, cena='ok',       zkusi=1, balicek=1),
 'S05': dict(jizd=1, darek=0, cena='moc-900',  zkusi=1, balicek=0),
 'S06': dict(jizd=1, darek=1, cena='hranicni', zkusi=0, balicek=0),
 'S07': dict(jizd=1, darek=0, cena='moc-800',  zkusi=0, balicek=0),
 'S08': dict(jizd=1, darek=0, cena='moc-600',  zkusi=1, balicek=0),
 'S09': dict(jizd=1, darek=0, cena='hranicni', zkusi=0, balicek=0),
 'S10': dict(jizd=3, darek=1, cena='ok',       zkusi=1, balicek=1),
 'S11': dict(jizd=0, darek=0, cena='moc',      zkusi=0, balicek=0),
 'S12': dict(jizd=1, darek=0, cena='moc-800',  zkusi=1, balicek=0),
 'S13': dict(jizd=1, darek=0, cena='hranicni', zkusi=0, balicek=0),
 'S14': dict(jizd=2, darek=0, cena='hranicni', zkusi=1, balicek=1),
 'S15': dict(jizd=0, darek=0, cena='moc',      zkusi=0, balicek=0),
 'S16': dict(jizd=2, darek=1, cena='ok-firma', zkusi=1, balicek=1),
 'S17': dict(jizd=2, darek=0, cena='hranicni', zkusi=1, balicek=1),
 'S18': dict(jizd=0, darek=1, cena='hranicni', zkusi=0, balicek=0),
 'S19': dict(jizd=1, darek=1, cena='ok',       zkusi=1, balicek=0),
 'S20': dict(jizd=2, darek=1, cena='ok',       zkusi=0, balicek=0),
 'S21': dict(jizd=0, darek=0, cena='moc',      zkusi=0, balicek=0),
 'S22': dict(jizd=1, darek=0, cena='hranicni', zkusi=1, balicek=1),
 'S23': dict(jizd=2, darek=1, cena='ok',       zkusi=1, balicek=0),
 'S24': dict(jizd=1, darek=0, cena='moc-1000', zkusi=1, balicek=0),
 'S25': dict(jizd=1, darek=0, cena='hranicni', zkusi=1, balicek=1),
 'S26': dict(jizd=3, darek=0, cena='ok',       zkusi=1, balicek=1),
 'S27': dict(jizd=1, darek=0, cena='moc-900',  zkusi=1, balicek=0),
 'S28': dict(jizd=2, darek=1, cena='hranicni', zkusi=0, balicek=0),
 'S29': dict(jizd=1, darek=1, cena='moc-700',  zkusi=1, balicek=0),
}
