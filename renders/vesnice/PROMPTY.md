# Prezentační záběry vesničky — vstupy pro videogenerátor

Snímky v této složce jsou 4K rendery varianty D bez UI (generuje
`review-tools/shot-cine-vesnice.mjs`, po změně modelu přegenerovat).

## Postup (image-to-video)

1. Veo 3.1 / Kling 2.5 / Runway Gen-4 — režim **image-to-video**, nahrát PNG
   jako první snímek. Dvojice `-a`/`-b` (náves, terasa) jsou **first frame +
   last frame** — Kling i Veo mezi nimi interpolují průlet kamery.
2. Délka 8–10 s na záběr, poměr 16:9. Prompt anglicky (níže).
3. Geometrii drží vstupní snímek — prompt popisuje atmosféru a život,
   NE budovy. Do negative promptu: „no additional buildings, no extra
   floors, do not change the layout".
4. Sestřih: CapCut / DaVinci — 01 → 02 → 03 → 04 → 06 → 05, hudba, hotovo.

## Prompty k jednotlivým snímkům

**01-dron-establishing** (letecký nájezd)
> Cinematic drone shot slowly descending toward a small modern village of
> black container buildings with lime-green door frames, golden hour light,
> long soft shadows, a few people walking between the buildings, birds in
> the sky, photorealistic architectural visualization, warm summer evening.

**02-prijezd-od-kruhace** (příjezd autem)
> Slow forward dolly at eye level entering a modern container-building
> compound through an open gate, gravel and asphalt driveway, warm sunset
> glow, a car parked on the left, two people chatting near the entrance,
> photorealistic, shallow depth of field.

**03-naves-k-baru-a + b** (first/last frame — průchod návsí)
> Steadicam walk across a paved village square toward a black container
> café with large glass windows glowing warm from inside, people sitting
> at outdoor tables with coffee, leaves moving in a light breeze, golden
> hour, photorealistic architectural visualization.

**04-prosklenim-do-baru** (detail prosklení)
> Slow push-in toward the glass facade of a small café at sunset, warm
> interior light, silhouettes of people inside, reflections of the pink
> sky in the glass, steam rising from a coffee cup on an outdoor table,
> cinematic, photorealistic.

**05-terasa-bydleni-a + b** (first/last frame — bydlení)
> Gentle camera glide along a wooden terrace of a modern black container
> home, sliding glass doors open, warm light from inside, a person
> watering plants, laundry moving softly in the breeze, sunset,
> photorealistic lifestyle shot.

**06-vstup-kancelari** (vstup do kanceláří)
> Close tracking shot of a person opening a lime-green framed door of a
> black container office building, warm evening light, colleague visible
> at a desk through the window, photorealistic, cinematic contrast.

**07-top-down-plan** (kolmý pohled)
> Top-down aerial view of a container village slowly rotating, long
> evening shadows sweeping across a paved square, tiny people walking,
> cars parked near the entrance, photorealistic map-like establishing
> shot.
