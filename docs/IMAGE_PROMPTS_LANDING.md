# Pizzaria Landing Page — Image Prompts

Complete photorealistic image set for every section of the landing page
proposed in [PROPOSTA_LANDING_PAGE.md](PROPOSTA_LANDING_PAGE.md). Every
prompt is individualized — different angle, lens, lighting, mood,
composition, props — so the rendered set looks like one coherent
professional photo shoot rather than dozens of variations of the same
shot.

All outputs: **PNG**, sRGB. Default to photoreal DSLR-quality unless
the prompt explicitly calls for an illustrated element (icons,
ornaments, badges).

---

## Brand & photographic anchor (applies to every prompt)

**Palette**
| Role | Hex |
|---|---|
| Primary (warm orange) | `#FF6B35` |
| Accent (gold) | `#FFD700` |
| Deep oven red | `#8B1A1A` |
| Charcoal | `#1F1815` |
| Warm cream | `#F8F1E4` |
| Off-white | `#FFFCF7` |
| WhatsApp green | `#25D366` |

**Photographic defaults**
- Camera body: full-frame DSLR look (Canon 5D / Sony A7 quality)
- Default lens: 50 mm f/1.8 environmental, 85 mm f/2.0 portrait,
  100 mm macro f/4 food close-up
- Light: natural warm daylight (3200–4500K) or wood-fire warmth.
  Never cool fluorescent.
- Color grade: warm shadows, neutral mids, slightly cool highlights.
  Tomato reds slightly desaturated, never neon.
- Grain: subtle film grain at 4–8% opacity
- Skin tones: naturally Brazilian range (`#F2C9A2` → `#7A4A2E`),
  never the AI-default European pale-pink
- People: faces only when below-the-eyes, profile, or back-of-head.
  Never frontal AI-generated faces — they have uncanny-valley tells
  that destroy trust.
- Text in image: avoid. If unavoidable (storefront sign), keep short
  and verify legibility before committing.

**Anti-AI checklist (run before saving any image)**
- [ ] Hands have exactly 5 fingers, no extra knuckles
- [ ] Cheese strands obey gravity (sag, not levitate)
- [ ] Crust char is irregular (not perfect repeating spots)
- [ ] No double pupils, merged earlobes, phantom lens flares
- [ ] Text on signs/screens is readable, not gibberish
- [ ] Drop shadows match a single light source
- [ ] No "jewelry" embedded in food (random gold dots that aren't oil)

If any fail → regenerate.

---

## Output folder convention

```
frontend/public/images/landing/
├── hero/
├── trust/
├── menu/
├── story/
├── how-it-works/
├── delivery/
├── reviews/
├── offers/
├── cta/
├── social/
└── favicon-landing.png
```

Total set: **47 unique PNGs** across 10 sections.

---

# SECTION 1 — Hero

The hero is the first 2 seconds. Two variants below, each fully
individualized; pick **one** based on the pizzeria's positioning, then
generate only that variant's images.

| Variant | Pick when |
|---|---|
| **A. Cinematic Close-Up** | Premium artisanal positioning, food is the hero |
| **B. Wood-Fired Action** | Wood-oven craftsmanship is the differentiator |

## 1A — Cinematic Close-Up: `hero/closeup-desktop.png`
**Dimensions:** 2880×1620 (16:9)

> Hyper-detailed macro photograph of a single Pizza Margherita filling
> the entire frame edge-to-edge, shot directly overhead from a perfectly
> orthogonal angle, lens centered on the pizza's exact middle. The pie
> sits on weathered black volcanic-stone slab, just out of the wood-fired
> oven. Visible wisps of vapor rising from three or four bubbling
> mozzarella dollops. Crust shows pronounced Neapolitan leoparding —
> irregular dark brown char spots over a golden base. Six fresh basil
> leaves placed in intentional asymmetric rhythm, one of them almost
> falling off the right edge of the pie. A glossy thread of dark-green
> basil-infused olive oil traces an off-center spiral, catching a single
> warm specular highlight from the upper-left lighting source.
> Background slate is matte, almost black `#15110D`, vignetted darker
> toward the four corners. Color grading: warm shadows, neutral
> midtones, slightly cool highlights to separate the cheese from the
> crust. Lens: 100 mm macro at f/4 for tack-sharp focus across the
> entire pie. Micro-grain film texture at 4% opacity. No text, no
> logos, no hands, no people. PNG 2880×1620.

## 1A — Cinematic Close-Up: `hero/closeup-mobile.png`
**Dimensions:** 1170×2532 (9:19.5)

> Vertical macro re-composition of the same Margherita scene, but with
> a tighter crop showing only the upper-right quadrant of the pie
> filling the bottom 60% of the frame. The top 40% is matte-black
> volcanic stone with a single soft warm `#FFD700` light glow bleeding
> in from the upper-right corner (suggesting an off-frame oven flame).
> One basil leaf falls naturally into the dark negative space at the
> top, frozen mid-fall. Crust char is the dominant texture; one
> mozzarella bubble has just popped, leaving a small golden crater. Same
> color grading and grain as the desktop. The empty top region must
> accept a 3-line headline overlay without visual interference. Lens:
> 85 mm at f/2.8, slight depth-of-field falloff toward the top edge of
> the pizza. PNG 1170×2532.

## 1B — Wood-Fired Action: `hero/woodfired-desktop.png`
**Dimensions:** 2880×1620 (16:9)

> Cinematic 1/250s action shot of a pizzaiolo's forearms and hands
> (mid-40s, warm Brazilian skin tone, no face in frame, only forearms
> entering from the bottom-left) gripping a long wooden peel and sliding
> a raw Margherita pizza into the mouth of a glowing wood-fired brick
> oven. The oven dome occupies the left half of the frame: dark sooty
> bricks framing an intense roaring orange-yellow inferno inside, three
> burning logs visible at the back. Tiny orange embers float in the
> air around the peel. Strong directional light from the fire bathes
> the forearms, the peel, and the pizza in saturated warm `#FF6B35` and
> `#FFD700` rim light, while the right half of the frame falls away into
> deep charcoal `#1F1815` shadow showing only suggestive hints of the
> dark pizzeria interior (a copper pot hanging, defocused). The pizza
> on the peel is unfinished, raw — pale dough, fresh red tomato sauce,
> white mozzarella, two basil leaves. Lens: 35 mm full-frame at f/2.0,
> very slight motion blur on the peel's tip and the embers only — the
> hands stay sharp. Color grade: pushed warm in the highlights,
> teal-shifted in the deepest shadows for cinematic separation. No
> text, no apron logos, no face visible, no other people. PNG 2880×1620.

## 1B — Wood-Fired Action: `hero/woodfired-mobile.png`
**Dimensions:** 1170×2532 (9:19.5)

> Vertical reframe of the wood-fired oven scene: the oven mouth dominates
> the lower 65% of the frame as a glowing portal of orange flame, the
> pizzaiolo's wrists and the wooden peel entering from the right edge at
> a 30° angle (deliberately a different entry vector than the desktop's
> bottom-left). Above the flame, the upper 35% of the frame is deep
> matte black with sparse floating embers drifting upward and gradually
> fading out — this is the headline overlay region. Stronger contrast
> than the desktop version, almost chiaroscuro. The raw pizza on the
> peel is visible but partially silhouetted against the flame, only its
> edge catching warm rim light. Lens: 50 mm at f/2.8, frozen action
> 1/500s, no motion blur. Sense of intimate scale appropriate for a
> phone screen. PNG 1170×2532.

---

# SECTION 2 — Trust Bar

Sits immediately under the hero. Quietly answers "is this real?" —
five small ceramic-style badges arranged in a horizontal strip.
All five share **the same lighting direction** (upper-left, soft) so
they read as a coherent set, not clip-art assembled from different
sources.

## `trust/google-rating-badge.png`
**Dimensions:** 800×320 (transparent)

> Photorealistic 3D render of a small floating badge with a soft drop
> shadow on a transparent background. Badge surface: matte warm cream
> `#F8F1E4` ceramic with rounded corners (24 px radius). On the badge:
> the lowercase "google" wordmark in its official four-color palette at
> the top-left, then five filled gold `#FFA000` stars in a horizontal
> row, then the bold numeric "4.9" in dark charcoal `#1F1815`, followed
> by smaller text "248 avaliações" in lighter grey `#5A4F47`. Subtle
> inner shadow giving depth, faint warm light from upper-left producing
> a soft natural drop shadow below. Render at 2× for retina sharpness.
> PNG 800×320 transparent. (If text comes out garbled, regenerate the
> badge as blank ceramic and overlay text in CSS.)

## `trust/ifood-style-badge.png`
**Dimensions:** 600×320 (transparent)

> Photorealistic floating ceramic badge identical in **material, lighting
> direction, and shadow softness** to the Google rating badge above —
> matte warm cream `#F8F1E4`, rounded 24 px corners. Content: a generic
> delivery-platform logomark on the left (a stylized red square with
> white motorcycle silhouette inside — visually evokes a delivery-app
> icon without being any specific brand), and to the right two stacked
> lines: "Entrega rápida" in charcoal `#1F1815` Inter Bold, beneath it
> "30–45 min" in `#5A4F47`. Same upper-left soft light as the Google
> badge — these badges must visibly belong together. PNG 600×320,
> transparent.

## `trust/payment-methods.png`
**Dimensions:** 1200×200 (transparent)

> Horizontal strip showing five photorealistic generic payment icons
> evenly spaced left-to-right on transparent background. Each icon
> rendered as a small floating ceramic tile (matching the badge
> material — same warm cream, same upper-left light, same shadow):
> credit card silhouette in `#1F1815`, stylized PIX diamond in
> `#32BCAD`, generic debit-card icon, cash banknote with embossed "R$"
> symbol, meal-voucher card. Consistent stroke weight across all five.
> Generous and even spacing. No bank brand names. PNG 1200×200,
> transparent.

## `trust/years-medal.png`
**Dimensions:** 400×400 (transparent)

> Photorealistic close-up of a small circular bronze-and-gold medallion,
> floating with a subtle drop shadow on transparent background. Medal
> face: matte bronze `#A87246` outer ring with a polished gold `#FFD700`
> inner circle. Embossed inside: the numeral "12" in elegant serif
> (Playfair Display style), and curving along the upper inner ring the
> words "ANOS DE FORNO". Slight wear and patina — believable as a
> small artisan-craft medallion, not a corporate trophy. Light from
> upper-left producing realistic specular highlight on the gold's
> upper edge. PNG 400×400, transparent. (To swap "12" later, regenerate
> the base as blank gold and overlay the number in CSS.)

## `trust/whatsapp-verified.png`
**Dimensions:** 480×240 (transparent)

> Photorealistic floating ceramic badge in matching style to the others
> — matte warm cream `#F8F1E4`, rounded 24 px corners, same upper-left
> light. On the badge: a large green `#25D366` WhatsApp logomark (chat
> bubble with phone) on the left, two stacked lines on the right —
> "WhatsApp" in charcoal Inter Bold, "Conta verificada" in smaller
> `#5A4F47`. Photoreal ceramic, not flat vector. PNG 480×240,
> transparent.

---

# SECTION 3 — Menu Showcase

Twelve pizzas. Each photographed with a **deliberately different**
angle, lens, plate, lighting setup, and surface so the menu grid feels
like a curated catalog instead of twelve identical overhead shots. The
rotation table below is the design contract — every adjacent cell in
the grid must differ on at least three axes.

| # | Pizza | Angle | Lens | Light | Surface |
|---|---|---|---|---|---|
| 1 | Margherita | Top-down 90° | 100 mm macro f/4 | Window left soft | White marble |
| 2 | Calabresa | 45° three-quarter | 60 mm macro f/2.8 | Tungsten upper-right raking | Dark slate |
| 3 | Frango Catupiry | Top-down 75° tilted | 85 mm f/3.5 | Window above-left diffuse | Cream marble |
| 4 | Portuguesa | Eye-level slice macro | 100 mm macro f/3.5 | Window left long shadow | Walnut wood |
| 5 | Quatro Queijos | Top-down 90° symmetric | 50 mm f/8 | Dual softbox top | Black ceramic |
| 6 | Pepperoni | 30° low backlit | 35 mm f/2.0 | Golden-hour back | Charred peel |
| 7 | Brócolis Bacon | 60° three-quarter | 70 mm f/2.8 | Side window rim | Slate |
| 8 | Atum | Top-down 90° | 50 mm f/5.6 | Overcast soft | Blue-grey ceramic |
| 9 | Vegetariana | 45° three-quarter | 85 mm f/2.8 | Garden window dappled | Linen tablecloth |
| 10 | Bauru de Carne | Eye-level whole pie | 50 mm f/2.8 | Tungsten warm low | Charred peel |
| 11 | Doce Chocolate | Low-angle 20° | 35 mm f/2.0 | String-light bokeh | Pink linen |
| 12 | Romeu e Julieta | Top-down 90° | 100 mm macro f/4 | Window left | Cream marble |

## `menu/01-margherita.png` — 1600×1600

> Perfectly orthogonal top-down photograph of a single Pizza Margherita
> centered on a circular slab of veined Carrara marble. Eight irregular
> dollops of fresh buffalo mozzarella di bufala, visibly handmade — each
> a slightly different size. Six fresh basil leaves placed in
> deliberate asymmetric rhythm; one leaf overlaps the crust edge.
> Crust shows mild Neapolitan leoparding (irregular dark char spots).
> A thin spiral drizzle of bright green basil-infused olive oil tracing
> off-center across the cheese. Soft window light from the left at 9
> o'clock position, producing a long gentle shadow falling toward 3
> o'clock. Color rendering neutral and accurate — no warm-orange
> grading. Lens: 100 mm macro at f/4, tack sharp across the entire
> pie. Background: bare marble, slight natural veining at the edges.
> Subtle 4% film grain. No props beyond the pizza. PNG 1600×1600.

## `menu/02-calabresa.png` — 1600×1600

> Forty-five-degree three-quarter angled photograph of a Pizza Calabresa
> on a circular dark slate plate. Generous slices of cured Brazilian
> linguiça calabresa caramelized at the edges with crisped brown rims,
> thin rings of raw red onion, scattered green oregano flakes, dark
> mozzarella spots where the cheese has browned. Tiny golden droplets
> of sausage oil pooled in the cheese valleys. Strong warm tungsten
> light from the upper-right at low angle, raking across the surface to
> emphasize texture and casting visible shadows behind each sausage
> slice. Background fades from charcoal `#1F1815` to deep brown out of
> focus. Lens: 60 mm macro at f/2.8 with the back edge of the pie
> falling slightly out of focus. Hearty, abundant. PNG 1600×1600.

## `menu/03-frango-catupiry.png` — 1600×1600

> Top-down with a deliberate 15° camera tilt — capturing one full Pizza
> de Frango com Catupiry on a cream-veined marble slab. Shredded
> seasoned chicken distributed evenly, with creamy white Catupiry-style
> cheese piped in soft peaks (each ~1 cm tall, slightly toasted golden
> at the very tips, not burnt). Sprinkle of fine green parsley and a
> dusting of black pepper across the top. Cool diffused natural daylight
> from a large window above-left at 11 o'clock, almost shadowless,
> editorial feel. Tighter crop than the Margherita — pie nearly fills
> the frame, leaving 8% margin per side. Soft, comforting,
> family-recipe mood. Lens: 85 mm at f/3.5. PNG 1600×1600.

## `menu/04-portuguesa.png` — 1600×1600

> Eye-level macro shot framing a single triangular slice of Pizza
> Portuguesa in the foreground (sharp focus) with the rest of the pie
> visible behind it (soft defocus). The slice is being lifted slightly
> off the pie at a natural angle. Loaded toppings clearly identifiable:
> sliced ham, halves of hard-boiled egg with yellow yolk and white
> edge, bright green peas, sliced black olives, raw onion crescents,
> red and green bell pepper strips. The slice has a tiny rivulet of
> melted cheese stretching down from its tip toward the pie below.
> Slate-grey ceramic plate visible at the bottom edge, warm walnut wood
> table behind. Light from a window at 9 o'clock creating a long soft
> shadow across the lower-right. Lens: 100 mm macro at f/3.5. Mood:
> abundant, traditional Sunday lunch. PNG 1600×1600.

## `menu/05-quatro-queijos.png` — 1600×1600

> Symmetric perfectly orthogonal top-down shot showing four cheeses as
> visibly distinct quadrants on the pie: top-left mozzarella (white,
> melted smooth, slight bubbling); top-right gorgonzola (visible
> blue-green veining, partially melted); bottom-right parmesan (golden
> grated, slightly browned crust where it caramelized against the heat);
> bottom-left provolone (deep amber, fully melted with caramelized edge).
> A thin black line of basil oil drawn from the center outward as a
> cross dividing the four quadrants. Plate: matte black ceramic.
> Background: dark walnut wood `#3A2418`. Lighting: dual top-mounted
> softboxes for even exposure across all four sections, no directional
> shadow. Lens: 50 mm at f/8 for full depth of field across the entire
> pie. Editorial, almost diagrammatic, but still appetizing.
> PNG 1600×1600.

## `menu/06-pepperoni.png` — 1600×1600

> Low-angle 30° shot of a Pizza de Pepperoni resting on a charred
> wooden pizza peel, photographed against a backlit warm golden-hour
> sky visible behind the pie's silhouette. Dozens of pepperoni slices
> arranged across the cheese, each curled upward at the edges into
> small "cup" shapes filled with rendered orange-red oil — the classic
> "cup-and-char" pepperoni look. Strong rim light from behind catches
> the steam rising from the surface. Cheese underneath bubbling and
> spotted with golden char marks. Foreground: the wooden peel's grain
> in sharp focus; background: warm orange `#FF6B35` sky bokeh.
> Lens: 35 mm at f/2.0. Mood: rustic, just-out-of-the-oven.
> PNG 1600×1600.

## `menu/07-brocolis-bacon.png` — 1600×1600

> Sixty-degree three-quarter shot of a Pizza de Brócolis com Bacon on
> a circular dark slate plate. Bright green steamed broccoli florets
> scattered across the pie (color preserved — not olive-drab from
> overcooking), interspersed with thick crispy bacon strips broken
> into 3 cm pieces showing visible fat-and-meat striation, base of
> melted mozzarella with golden-brown spots, finished with a few thin
> shavings of garlic and a final crack of black pepper. Side window
> light at 3 o'clock providing strong rim-lighting along the right
> edges of the bacon and broccoli, casting the left side of each
> ingredient into soft shadow. Lens: 70 mm at f/2.8. Background: out
> of focus dark linen. The color separation between green broccoli,
> white cheese, and brown bacon is the entire visual story.
> PNG 1600×1600.

## `menu/08-atum.png` — 1600×1600

> Perfectly orthogonal top-down shot of a Pizza de Atum on a circular
> blue-grey ceramic plate. Generous mounds of flaked tuna distributed
> evenly across the pie, scattered with thin slices of raw red onion
> and a small handful of capers, finished with chopped fresh parsley.
> Visible drizzles of olive oil pooling in the cheese. Overcast soft
> shadowless natural daylight from directly above (cloudy-day light),
> giving even rendering across the whole frame, no specular highlights.
> Calm, slightly cool color palette — the only menu pizza shot in a
> cooler register, signaling "lighter / lunchtime". Lens: 50 mm at
> f/5.6. PNG 1600×1600.

## `menu/09-vegetariana.png` — 1600×1600

> Forty-five-degree three-quarter angled photograph of a Pizza
> Vegetariana on a natural-fiber linen tablecloth, no plate. Loaded
> with colorful vegetables: thin-sliced zucchini rounds, roasted red
> bell pepper strips, sliced champignon mushrooms, grilled eggplant
> cubes, fresh cherry tomato halves still glistening, scattered arugula
> leaves on top added post-bake. Vivid color palette intentional — this
> pizza sells with its visible vegetable variety. Light through a garden
> window at 11 o'clock with soft dappled shadows from leaves outside,
> giving organic dappled patterns across the linen. Lens: 85 mm at
> f/2.8. PNG 1600×1600.

## `menu/10-bauru-carne.png` — 1600×1600

> Eye-level shot of a whole Pizza Bauru de Carne resting on a heavily
> charred wooden pizza peel, the back edge of the pie raised slightly
> so the surface tilts toward the camera. Topping: shredded slow-cooked
> beef in dark sauce, melted mozzarella mostly hidden under the meat,
> sliced tomato around the edge, finished with fresh oregano. The
> meat's dark brown contrasts dramatically with the visible white
> cheese peeking through. Warm low-angle tungsten light from the right
> at 4 o'clock, mimicking the glow of a wood-oven mouth just out of
> frame. Background: deep matte black `#1F1815` with warm orange
> ambient bounce. Lens: 50 mm at f/2.8. Steam rising visibly from two
> points on the meat surface. Mood: hearty, indulgent, weekend-dinner.
> PNG 1600×1600.

## `menu/11-doce-chocolate.png` — 1600×1600

> Low-angle 20° shot at table height of a sweet pizza "doce de
> chocolate": white pizza dough base completely covered in glossy
> molten dark chocolate ganache that's still warm and reflective, a
> generous lattice arrangement of sliced fresh strawberries, scattered
> white chocolate shavings, fresh dusting of powdered sugar (visibly
> still settling, with motion-blurred sugar particles in mid-air), one
> mint leaf placed off-center. Background: a soft rosy `#FAD8C7`
> gradient with subtle warm bokeh from string lights — celebration /
> dessert mood, distinctly different from the savory pizzas. Lens:
> 35 mm at f/2.0, 1/200s shutter to catch the falling sugar.
> PNG 1600×1600.

## `menu/12-romeu-julieta.png` — 1600×1600

> Perfectly orthogonal top-down shot of a sweet Pizza Romeu e Julieta
> on a cream-veined marble slab. Base: melted white mozzarella over
> the pizza dough; topped with even cubes of bright red guava paste
> (goiabada — distinctive ruby color, slightly melted at the edges)
> and small chunks of softened white minas cheese. Drizzle of honey
> across the surface catching the light. Pieces deliberately abundant
> and rustic in arrangement — not perfectly geometric. Lens: 100 mm
> macro at f/4. Soft window light from 9 o'clock. The ruby-red guava
> paste against the white cheese is the visual signature.
> PNG 1600×1600.

---

# SECTION 4 — Story & Kitchen

Six images that turn *visitor → repeat customer* by showing process.
Faces never appear frontally in any of these — only hands, forearms,
profiles, backs of heads. Avoids AI uncanny-valley **and** keeps
photography reusable when staff turns over.

## `story/dough-stretching.png` — 2400×1600

> Documentary close-up at table height of a pizzaiolo's flour-dusted
> hands stretching a round of pizza dough on a marble counter. Both
> hands visible, pressing outward from the center with thumbs at the
> dough's edge — classic hand-stretching technique, no rolling pin.
> The dough is mid-transformation: already a 25 cm round, with a
> slightly thicker rim forming at the perimeter. Loose flour scattered
> on the counter, visible flour on the back of the hands. Face and
> torso completely out of frame — only forearms enter from the lower
> edge. Skin tone naturally warm Brazilian. Wedding band visible on
> the left hand for a small humanizing detail. Light from a window at
> 11 o'clock providing soft directional light, gentle shadow toward 5
> o'clock. Lens: 35 mm at f/2.8, slight motion blur on the right hand
> (mid-stretch). Background: defocused stainless steel kitchen edge.
> PNG 2400×1600.

## `story/oven-flames-detail.png` — 2400×1600

> Tight detail shot of the interior of a Brazilian wood-fired pizza
> oven at peak operating temperature. Three split logs of eucalyptus
> burning at the back of the dome, intense orange-yellow flames licking
> up the curved sooty brick walls, glowing red-hot coal bed at the
> floor. A single Pizza Margherita visible in the foreground at the
> right edge of the floor, just placed inside, the bottom of the crust
> beginning to char from contact with the hot stones. Tiny embers
> float in the air. Oven mouth's framing visible at the edges of the
> photo like a porthole into the inferno. No human in frame. Lens:
> 50 mm at f/2.8 with the pizza in sharp focus and the flames at the
> back slightly soft. Color: dominated by deep orange `#FF6B35` and
> hot yellow `#FFD700`, with deep crimson coals at the bottom.
> Heat-haze shimmer above the pizza. PNG 2400×1600.

## `story/ingredients-knolling.png` — 2400×1600

> Editorial overhead "knolling" composition of pizza ingredients
> arranged on a warm walnut wood surface, photographed perfectly
> orthogonally from directly above. Items placed in a deliberate grid,
> evenly spaced, angled at consistent 90° rotations: a small bowl of
> crushed San Marzano tomatoes, a ball of fresh buffalo mozzarella di
> bufala on a small wooden board, a sprig of fresh basil, a glass cruet
> of green-gold extra-virgin olive oil, a coarse sea salt grinder, a
> wedge of aged parmigiano with a small grater, a few cured pepperoni
> slices fanned out, a single round of pizza dough resting in a wooden
> proofing bowl, a small bunch of fresh oregano, one fresh ripe red
> tomato sliced in half. All photographed with shallow but uniform
> shadows from soft overhead diffused light, suggesting late-morning
> natural daylight through a north-facing kitchen window. Composition
> has obvious negative space between items — restraint, not crowding.
> Lens: 50 mm at f/8 for full sharpness across all items.
> PNG 2400×1600.

## `story/pizzaiolo-back-at-oven.png` — 2400×1600

> Documentary three-quarter shot from behind-and-side of a pizzaiolo
> (wearing a flour-dusted plain dark apron over a white t-shirt — face
> entirely out of frame, only shoulders, arms, and back of head
> visible) in mid-action sliding a pizza into a glowing wood-fired
> brick oven using a long wooden peel. Strong warm `#FF6B35` rim light
> from the oven's flames bathes the figure's right side, while the
> left side falls into pizzeria-interior shadow. Tiny embers airborne
> around the peel. Skin tone naturally warm Brazilian (visible
> forearms). Apron shows the wear of someone who actually works in a
> kitchen — slight stains, real flour dust, not a styled photo-shoot
> apron. No text or logo on the apron. Background: dark and out of
> focus, the suggestion of stainless steel prep counters at the edge.
> Lens: 35 mm at f/2.0, 1/250s frozen action. Mood: craft, heat,
> authenticity. PNG 2400×1600.

## `story/storefront-blue-hour.png` — 2400×1350

> Wide exterior shot at blue hour (just after sunset) of a small
> independent Brazilian pizzeria storefront on a quiet neighborhood
> street. Single-story building, warm-lit interior visible through a
> large front window — silhouettes of three or four customers seated
> at small wooden tables, the orange glow of a wood oven at the back.
> Above the door: a generic illuminated sign reading just "PIZZARIA"
> in clean serif lettering (don't render any specific brand name; keep
> it simple and replaceable in post). Outside: two simple metal café
> tables on a tiled sidewalk, a small chalk A-frame menu board (text
> intentionally illegible), a string of warm `#FFD700` Edison bulbs
> draped above the entrance. Sky: deep navy `#1A1A2E` fading to soft
> burnt-orange near the horizon. Street empty except for a single
> parked moto across the way. Lens: 24 mm at f/4. Cozy, neighborhood,
> end-of-workday. PNG 2400×1350.

## `story/cooling-rack-trio.png` — 2400×1600

> Top-down shot of three freshly baked pizzas resting on a stainless
> steel cooling rack, each at a different rotation (visual variety) —
> from left to right: a Margherita, a Calabresa, a Quatro Queijos.
> Steam rising from all three. The rack is set on a warm walnut
> counter; faint flour residue and a wooden peel partially in frame at
> the bottom-left. Light from a high window at 12 o'clock providing
> diffuse cool daylight, soft shadows beneath the rack. Lens: 50 mm at
> f/5.6 for full sharpness across the three pies. Composition signals
> "just baked, multiple at once" — high-throughput craft. PNG 2400×1600.

---

# SECTION 5 — How It Works

Four "icon-photographs" — actual photos framed and treated like
icons — explaining the process: *escolher → confirmar → assar →
entregar*. Each must read instantly at small sizes.

## `how-it-works/01-choose-on-phone.png` — 1200×1200

> Photoreal close-up of a pair of hands (warm Brazilian skin tone, no
> jewelry, fingernails trimmed and clean) holding a modern bezel-less
> smartphone in vertical orientation, screen visible toward the viewer
> at a slight 5° tilt. The screen displays a generic WhatsApp-style
> chat with one outgoing green bubble that reads "Quero uma calabresa
> grande" — text legible. Right thumb hovering just above the screen
> as if mid-tap. Background: warm defocused interior with a hint of
> `#FF6B35` ambient bounce light (suggesting a kitchen or living-room
> evening setting). Soft natural light from upper-left at 11 o'clock.
> Lens: 60 mm at f/2.8 with sharp focus on the screen and slight
> defocus on the fingertips. Square so it sits equally well in the
> desktop horizontal row and the mobile stacked column. PNG 1200×1200.

## `how-it-works/02-kitchen-ticket.png` — 1200×1200

> Photoreal flat-lay (perfectly orthogonal top-down) of a small printed
> kitchen ticket — the kind that comes out of a thermal receipt printer
> — resting on a stainless steel counter. Ticket shows a clear short
> order in monospace text: "PEDIDO #142", "1× Calabresa Grande",
> "1× Refrigerante 2L", "Total: R$ 78,00", and a small horizontal
> QR-code-style block at the bottom (decorative — black squares in a
> believable grid, not real QR data). The ticket has slight curl at
> one edge from the printer. Beside it: a small black ballpoint pen at
> a 30° angle, and the bottom-right corner shows the edge of a wooden
> pizza peel just entering the frame. Soft cool overhead kitchen
> light, even shadowless. Lens: 50 mm at f/5.6. Color rendering
> accurate, paper white slightly warm. The composition signals "the
> order made it through to the kitchen" without showing the kitchen.
> PNG 1200×1200.

## `how-it-works/03-pizza-into-oven.png` — 1200×1200

> Photoreal three-quarter shot of a single pizza on a wooden peel
> being guided into the mouth of a glowing wood-fired oven, framed
> tighter than the larger story-section "pizzaiolo" image. Just the
> peel, the raw pizza on it (Margherita, pre-bake), and the orange
> glow of the oven mouth. No human figure visible at all in this
> version (cropped out for icon-style framing) — just the peel
> emerging from the right edge of the frame as if held by someone
> off-camera. Strong warm `#FF6B35` light from the oven on the left,
> raking across the peel and pizza. Tiny embers airborne. Background:
> deep matte black `#1F1815` with the suggestion of a brick oven
> mouth at the lower-left. Lens: 50 mm at f/2.8, 1/250s. Reads
> clearly at small size as "pizza going into oven". PNG 1200×1200.

## `how-it-works/04-handover-at-door.png` — 1200×1200

> Photoreal close-up at door height of a pair of hands (warm Brazilian
> skin tone) handing over a square pizza delivery box (matte cardboard
> brown, generic, no logo or branding on the visible faces — leave it
> blank so a logo can be composited later) to another pair of hands
> receiving it. Receiver's hands have a wedding band on the right hand
> for a small humanizing detail. Both pairs of hands and only the
> lower forearms visible — no faces, no torsos. Background: the soft
> defocused warm interior of a residential apartment doorway at
> evening — a hint of a coat rack at the right edge, warm yellow
> ambient light from inside the home. Lens: 50 mm at f/2.8. Reads
> instantly as "delivery handover". PNG 1200×1200.

## `how-it-works/connector-arrow.png` — 240×120 (transparent)

> Pure decorative element on transparent background: a thin minimal
> right-pointing arrow drawn in single-weight 3 px strokes, color
> warm orange `#FF6B35`. The arrow has a slight hand-drawn imperfection
> (subtle wobble) so it doesn't look mechanical. Arrowhead is open
> (chevron-style), not filled. Used in CSS between the four icons on
> desktop. Rotates 90° on mobile. PNG 240×120, transparent.

---

# SECTION 6 — Delivery Zone

Three images: aerial map background, moto in motion, ETA tracker
mockup. Together they communicate *fast* and *local*.

## `delivery/aerial-neighborhood.png` — 2400×1600

> Photoreal aerial drone-style photograph of a generic Brazilian
> neighborhood at dusk, taken from approximately 200 m altitude looking
> straight down. Visible: a grid of low residential blocks with red-tile
> rooftops, narrow tree-lined streets, scattered green of small
> backyards, a few parked cars, occasional rooftop water tanks. No
> identifiable landmarks, no large buildings, no recognizable city
> skyline — must look like "any neighborhood, anywhere in Brazil".
> Lighting: late afternoon golden hour with long warm shadows from the
> west, every roof catching the last of the light. The image is
> intentionally slightly desaturated and slightly hazy — designed to
> sit underneath a CSS-rendered colored polygon overlay (the delivery
> zone) without competing with it. Lens look: tilt-shift wide at f/8,
> slight miniature-effect blur at the top and bottom edges only. No
> text, no logos, no people. PNG 2400×1600.

## `delivery/moto-panning-blur.png` — 2000×1250

> Cinematic action photograph of a delivery moto rider seen from a low
> rear-three-quarter angle, riding through a softly motion-blurred
> Brazilian residential street at golden hour. The branded square pizza
> delivery box on the back rack is in **sharp focus**: generic warm
> orange `#FF6B35` color, no logo or text on it (so a logo can be
> composited later). Rider wears a plain dark jacket and a fully
> closed black helmet — no face visible, no exposed skin, no
> expression. Background: blurred low palms and pastel-painted houses,
> warm street lights starting to flicker on, sun low on the horizon
> casting long shadows. Slight panning motion blur in the wheels and
> ground only — rider, jacket, and box stay crisp. Lens: 70 mm at
> f/2.8 with 1/30s pan technique. The image must read as "fast and
> competent" without needing a human face to do it. PNG 2000×1250.

## `delivery/eta-phone-mockup.png` — 1200×1800

> Hyper-photoreal smartphone screen mockup, viewed perfectly straight-on
> with no perspective distortion, showing what looks like an order-
> tracking screen. The phone frame is generic black bezel-less. On the
> screen: a clean modern UI with the top showing a circular progress
> ring at 80% complete in `#FF6B35`, with "32 min" centered inside in
> large bold numerals; below, a horizontal stepper showing four icons
> in a row — "Confirmado ✓", "Assando ✓", "Saiu para entrega"
> (highlighted in `#FF6B35`), "Entregue" (still grey/inactive); below
> the stepper, a stylized map slice with a small pulsing dot showing
> the moto's current position, surrounded by an arc indicating
> remaining distance; at the bottom, a button "Ligar para o entregador"
> in warm orange. The phone has a subtle drop shadow. Background
> behind the phone: warm cream `#F8F1E4` solid with very faint
> paper-grain texture. Soft upper-left light. PNG 1200×1800. Verify
> all UI text is legible — if the model garbles text, regenerate the
> phone with a blank screen and overlay the UI in CSS later.

---

# SECTION 7 — Reviews

Three images framing the live Google-reviews feed. The text comes from
the API; these images are only the visual frame.

## `reviews/three-friends-laughing.png` — 2400×1350

> Wide candid documentary-style photograph of three friends seated
> around a wooden bistro table at a casual pizzeria interior, captured
> mid-laughter. The group is naturally diverse Brazilian (varying skin
> tones from `#F2C9A2` to `#7A4A2E`, late-20s to mid-30s). **None of
> them are looking at the camera** — fly-on-the-wall observation, not
> a posed shot. One person leans back laughing, head tilted up; another
> is mid-gesture telling a story; the third looks at the second with
> a smile. Faces are partially obscured by the laughing motion, by
> hair, by a raised hand — clearly photographed *during* an actual
> moment, not staged. A whole pizza on a wooden board occupies the
> foreground bottom-third, partially eaten with two slices missing.
> Glasses of guaraná and a sweating bottle of Brazilian craft beer on
> the table. Warm pendant light overhead casting golden tones on faces
> and table. Background: soft bokeh of the pizzeria interior — other
> customers as colored shapes, no detail. The image is intentionally
> darker in the lower 30% (so testimonial cards can be CSS-overlaid on
> top without losing legibility). Lens: 50 mm at f/2.0, very subtle
> film grain, photojournalistic feel. No identifying logos. The image
> must read as authentic — if it has the slightest "stock photo"
> energy, regenerate. PNG 2400×1350.

## `reviews/thank-you-wall.png` — 2400×1600

> Photoreal interior of a pizzeria's exposed-brick wall covered in a
> dense gallery-style arrangement of small framed customer thank-you
> notes, polaroid photographs, hand-written postcards, and chalk-drawn
> hearts directly on the brick. Photographed at a slight three-quarter
> angle so the wall recedes diagonally to the right, with the closest
> portion in sharp focus and the far portion gradually defocusing.
> Frames are mismatched on purpose (different sizes, different
> aged-wood and brass styles), polaroids are weathered, some notes
> yellowed with time. Text on every note **deliberately illegible**
> (small handwriting, blurred, or facing away) so visitors read "lots
> of love" without trying to read individual notes. Warm tungsten
> lighting from above-left. Color palette: warm browns, cream paper,
> faded photo tones. Lens: 35 mm at f/2.8. Background texture for
> the testimonials section. PNG 2400×1600.

## `reviews/customer-mid-bite.png` — 1200×1500

> Photoreal portrait-orientation candid shot of a single happy customer
> from the chest down — face deliberately cropped out of frame above
> the chin — holding a large slice of pizza in both hands, mid-bite or
> just-after-bite (cheese stretching, slight smile visible at the
> corners of the mouth, no eye-line because no eyes in frame). The
> person wears a plain warm-toned t-shirt (color in the `#A87246` to
> `#5C3A1F` range) with no graphics. The pizza slice has visible
> generous toppings (Calabresa). Background: defocused warm pizzeria
> interior with soft pendant light glow. Skin tone naturally Brazilian.
> Lens: 85 mm at f/2.0, slight grain. The cropped-face composition
> avoids both AI uncanny-valley issues and the stock-photo "model
> with too-perfect smile" problem. The image conveys "real customer,
> really enjoying it" without any face. PNG 1200×1500.

---

# SECTION 8 — Offers & Promos

Four promo cards plus a transparent decorative tag overlay.
Each composition is fully different from the others — no template-
swapping vibe.

## `offers/combo-familia.png` — 1600×1200

> Cinematic three-quarter shot of a "family combo" centerpiece on a
> long warm walnut wooden table photographed from slightly above and
> to the side. Composition includes: two whole pizzas (one Margherita,
> one Calabresa) on circular wooden boards, a 2-liter glass bottle of
> guaraná with condensation droplets on the outside catching the
> light, two tall glasses already half-poured with the dark soda, a
> small wooden bowl of grated parmesan, a basket of crusty bread on
> the side. All items arranged with deliberate abundance — table
> feels generously full but not cluttered. Background: warm defocused
> interior with a single pendant light overhead casting golden tones.
> Soft natural shadows. Lens: 35 mm at f/2.8 to capture the full
> breadth of the spread. Color rendering warm but accurate.
> Composition's negative space in the upper-right reserved for the
> promo headline overlay. Mood: Sunday family dinner, generous
> portion. PNG 1600×1200.

## `offers/combo-casal.png` — 1600×1200

> Intimate close-up at table height of a "couples combo": one whole
> pizza (a half-and-half: half Frango com Catupiry, half Calabresa)
> on a circular dark slate plate in the center of frame, two stemless
> wine glasses with a deep ruby Brazilian red wine half-filled, a
> single burning candle in a short glass holder casting warm `#FF6B35`
> flicker light across the scene, two folded linen napkins in deep
> charcoal. Table surface: dark walnut wood. Background: very dark and
> intentionally moody — only the candle and the off-frame pendant
> light up the scene, creating a romantic chiaroscuro effect. Two
> pairs of hands partially visible at opposite edges of the frame
> (just fingertips and wrists, no faces, no torsos), suggesting two
> people about to share the meal. Lens: 50 mm at f/1.8. Mood: date
> night, indulgent. PNG 1600×1200.

## `offers/promo-terca-doce.png` — 1600×1200

> Bright, cheerful overhead three-quarter shot of a single whole sweet
> pizza (Doce de Chocolate com Morango) on a soft pink-rose linen
> tablecloth, with playful styling: scattered loose strawberry halves
> around the pizza, a small ramekin of extra chocolate ganache on the
> side, a single dessert fork at a 30° angle, a few mint sprigs
> arranged in the lower-left. Background: a bright cream `#F8F1E4`
> wall just visible at the top of frame, softly out of focus. Light:
> cool diffused natural daylight from a window above-left, almost
> shadowless, modern editorial feel. The mood is light, cheerful,
> Tuesday-afternoon-treat — distinct in tone from the savory promo
> shots. Negative space in the upper-right corner reserved for the
> promo banner. Lens: 50 mm at f/4. PNG 1600×1200.

## `offers/promo-balcao-rapido.png` — 1600×1200

> Photoreal close-up of a single takeaway pizza box (matte cardboard
> brown, generic, no logo on the visible top face) sitting on a bright
> stainless steel pizzeria counter, photographed at a slight 30°
> three-quarter angle. The box is slightly open, lid lifted just
> enough to reveal a glimpse of a fresh Margherita inside with steam
> visibly rising through the gap, catching warm light. Beside the box
> on the counter: a small paper bag stapled at the top (a side or
> extra inside), and a printed receipt slipped under the box's edge.
> Behind the counter, an out-of-focus warm `#FF6B35` glow suggesting
> the wood-oven mouth in the background. Lens: 50 mm at f/2.8. Reads
> as "ready in five minutes, grab and go" — promo angle is "balcão
> rápido" / takeaway speed. PNG 1600×1200.

## `offers/discount-tag-blank.png` — 600×600 (transparent)

> Pure decorative element on transparent background: a photoreal small
> circular paper price tag with a torn-edge appearance, made of
> slightly textured kraft paper in warm cream. Single pin-hole at the
> top with a tiny piece of off-white string passing through it (the
> string falls off the bottom of the frame). The tag has a subtle
> warm shadow indicating it's floating slightly above the canvas. The
> tag itself is **completely blank** — no text, no numbers — so the
> discount percentage can be overlaid in CSS for each promo. Soft
> natural light from upper-left. PNG 600×600 transparent. Used as a
> corner badge on each combo card, rotated -8° in CSS.

---

# SECTION 9 — Final CTA

The closing pitch. One enormous full-bleed background image, one huge
button overlaid in HTML. Two options below — pick **one** based on the
hero variant chosen in Section 1.

| Hero variant | Use this CTA image |
|---|---|
| 1A Cinematic Close-Up | `cta/final-pizza-pull.png` |
| 1B Wood-Fired Action | `cta/final-storefront-warm.png` |

## `cta/final-pizza-pull.png` — 2880×1620

> Hyper-cinematic ultra-close-up of a single pizza slice being lifted
> from a whole pie, captured at the moment cheese strands are stretched
> to their visual limit — taut, glossy, not yet broken. Shot from the
> side at exact slice level (camera horizontal with the table), with
> the slice on the left side of frame being raised by an unseen hand
> (only the very edge of fingertips visible at the lower-left,
> partially cropped out), and the rest of the pie on the right. The
> cheese strands are lit from behind by a strong warm `#FFD700` rim
> light, making them glow translucent against the dark background.
> Steam rises in two visible columns from the lifted slice. Background:
> deep matte charcoal `#1F1815` falling completely out of focus into
> pure darkness at the right edge of frame — generous negative space
> for the CTA button overlay. The pie itself is a Calabresa with
> caramelized sausage edges visible on the slice being lifted. Lens:
> 85 mm at f/1.4, dramatic shallow depth, slight film grain. The image
> must trigger an immediate "I am hungry right now" reaction.
> PNG 2880×1620.

## `cta/final-storefront-warm.png` — 2880×1620

> Photoreal interior shot of a pizzeria at full evening service, taken
> from a corner near the entrance looking in toward the wood oven at
> the back. The wood oven dominates the back-center of frame with its
> warm orange `#FF6B35` glow. In the middle ground, two or three
> customer tables are visible — silhouettes of people seated, animated
> conversation suggested by hand gestures, none looking at the camera.
> Pendant lights overhead casting warm pools of light onto wooden
> tables. A pizzaiolo at the back-left peripherally visible at the
> oven (only profile and hands, no face). The camera angle is low and
> slightly tilted, suggesting "you just walked in". Lens: 24 mm at
> f/2.8 to capture the full depth of the room. Color grade: warm
> shadows, gold midtones, slight teal in the deepest darks for
> separation. The lower-right of the frame has a darker pool (where
> the CTA button will sit). Mood: cozy, populated, inviting — "we're
> open, come in". PNG 2880×1620.

---

# SECTION 10 — Footer, OG, Favicon

Brand-consistency assets and the share-card that controls how the URL
looks in WhatsApp / Instagram / Twitter previews.

## `social/og-image.png` — 1200×630 (OG / Twitter spec)

> Composite social-share card: left half is a cropped photograph of a
> hand-cut pizza slice mid-lift with cheese strands (similar mood to
> the hero mobile but tighter and more graphic), right half is a flat
> solid panel in warm orange-to-gold gradient (`#FF6B35` → `#FFD700`)
> leaving generous negative space for a single line of text the
> developer will add later in CSS or via an image editor (the prompt
> should NOT render text). Subtle 1 px gold inner border. Composition
> rule-of-thirds. Photograph half is grainy/film-like; gradient half
> is clean flat-color. The two halves meet in a soft 40-pixel diagonal
> feather, not a hard line. PNG 1200×630, sRGB, OG-safe (no important
> content within 60 px of any edge).

## `favicon-landing.png` — 256×256 (transparent)

> Compact stylized icon: a single triangular pizza slice in flat
> color, warm orange `#FF6B35` crust outline, golden `#FFD700` cheese
> fill, two small dark-red `#8B1A1A` pepperoni circles. Slight 3D
> bevel suggested by a soft inner shadow on the crust edge only —
> otherwise flat illustration. Centered with 14% padding on all sides
> for safe area. Transparent background. Designed to remain legible
> when downscaled to 16×16 (so: bold shapes, no fine detail, max two
> pepperoni dots, no text). PNG 256×256, transparent.

## `cta/whatsapp-button-glyph.png` — 128×128 (transparent)

> Photoreal 3D render of a small floating green WhatsApp-style chat
> bubble icon with a phone silhouette inside. Color: WhatsApp green
> `#25D366`. Rounded soft material like a high-quality app icon, with
> a subtle warm drop shadow from upper-left lighting. No text, no
> branding wordmark — just the universally recognized chat-bubble-with-
> phone glyph. Used as a small accent inside the primary CTA button.
> PNG 128×128 transparent. (Used inline in the button — not the WhatsApp
> brand asset, which has licensing constraints; render a generic
> equivalent.)

## `social/wordmark-pizzaria.png` — 1024×256 (transparent)

> Photoreal embossed wordmark "PIZZARIA" set in elegant Playfair Display
> Bold, color charcoal `#1F1815`, rendered as if pressed into warm
> cream `#F8F1E4` paper with a very subtle inset shadow giving it
> physical depth. Slight letterpress-style impression around each
> character. Transparent background outside the wordmark itself. The
> wordmark sits inside a 1024×256 canvas with generous safe-area
> margins. PNG 1024×256, transparent. Used in the footer as a
> brand-mark element.

---

## Output checklist

After generating, you should have these PNGs (counting only the chosen
hero variant and CTA image, not both options of each):

```
frontend/public/images/landing/
├── hero/
│   ├── <variant>-desktop.png    (2880×1620)
│   └── <variant>-mobile.png     (1170×2532)
├── trust/
│   ├── google-rating-badge.png  (800×320)
│   ├── ifood-style-badge.png    (600×320)
│   ├── payment-methods.png      (1200×200)
│   ├── years-medal.png          (400×400)
│   └── whatsapp-verified.png    (480×240)
├── menu/
│   ├── 01-margherita.png        (1600×1600)
│   ├── 02-calabresa.png         (1600×1600)
│   ├── 03-frango-catupiry.png   (1600×1600)
│   ├── 04-portuguesa.png        (1600×1600)
│   ├── 05-quatro-queijos.png    (1600×1600)
│   ├── 06-pepperoni.png         (1600×1600)
│   ├── 07-brocolis-bacon.png    (1600×1600)
│   ├── 08-atum.png              (1600×1600)
│   ├── 09-vegetariana.png       (1600×1600)
│   ├── 10-bauru-carne.png       (1600×1600)
│   ├── 11-doce-chocolate.png    (1600×1600)
│   └── 12-romeu-julieta.png     (1600×1600)
├── story/
│   ├── dough-stretching.png         (2400×1600)
│   ├── oven-flames-detail.png       (2400×1600)
│   ├── ingredients-knolling.png     (2400×1600)
│   ├── pizzaiolo-back-at-oven.png   (2400×1600)
│   ├── storefront-blue-hour.png     (2400×1350)
│   └── cooling-rack-trio.png        (2400×1600)
├── how-it-works/
│   ├── 01-choose-on-phone.png       (1200×1200)
│   ├── 02-kitchen-ticket.png        (1200×1200)
│   ├── 03-pizza-into-oven.png       (1200×1200)
│   ├── 04-handover-at-door.png      (1200×1200)
│   └── connector-arrow.png          (240×120, transparent)
├── delivery/
│   ├── aerial-neighborhood.png      (2400×1600)
│   ├── moto-panning-blur.png        (2000×1250)
│   └── eta-phone-mockup.png         (1200×1800)
├── reviews/
│   ├── three-friends-laughing.png   (2400×1350)
│   ├── thank-you-wall.png           (2400×1600)
│   └── customer-mid-bite.png        (1200×1500)
├── offers/
│   ├── combo-familia.png            (1600×1200)
│   ├── combo-casal.png              (1600×1200)
│   ├── promo-terca-doce.png         (1600×1200)
│   ├── promo-balcao-rapido.png      (1600×1200)
│   └── discount-tag-blank.png       (600×600, transparent)
├── cta/
│   ├── <chosen-cta>.png             (2880×1620)
│   └── whatsapp-button-glyph.png    (128×128, transparent)
├── social/
│   ├── og-image.png                 (1200×630)
│   └── wordmark-pizzaria.png        (1024×256, transparent)
└── favicon-landing.png              (256×256, transparent)
```

**Total: 41 PNGs** (with one hero variant + one CTA option chosen).

## Generation tips

- For Midjourney / DALL·E / Imagen: append `--ar W:H --no text,
  watermark, logo` (Midjourney) or the equivalent negative prompt.
- Render each image at the exact target dimension when supported;
  otherwise generate at the closest larger ratio and downscale in
  [Squoosh](https://squoosh.app) to preserve sharpness.
- Save as **PNG-24** (lossless). Convert to AVIF/WebP at build time
  via the bundler — keep PNG masters in the repo as the source of
  truth.
- Run the anti-AI checklist (top of file) before committing **every**
  image. Visitors notice AI tells unconsciously and trust drops even
  when they can't articulate why.
- Sanity-check finished images on a real iPhone (1170×2532) and a
  real laptop (1440×900) before launch.
