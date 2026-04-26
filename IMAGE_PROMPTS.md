# Pizzabot — Image & Icon Generation Prompts

Customized prompts for generating all images and icons for the Pizzabot project.
All outputs are **PNG** and locked to the project's design system:

- **Primary**: `#FF6B35` (vivid orange)
- **Secondary**: `#1A1A2E` (deep navy)
- **Accent**: `#FFD700` (warm gold)
- **Success**: `#00C853` (green)
- **Backgrounds**: `#0F0F23` (page), `#16213E` (surface), `#1A1A3E` (card)
- **Fonts**: Inter (UI), Space Grotesk (display)
- **Language context**: Brazilian Portuguese (pt-BR)
- **Style anchor**: modern, photorealistic / claymorphic flat-3D, dark-mode friendly, glass-card UI

---

## Recommended folder layout

Create these directories under [frontend/public/](frontend/public/):

```
frontend/public/
├── images/
│   ├── brand/          ← logo, favicon, app icon, OG image
│   ├── backgrounds/    ← login bg, dashboard hero, error pages
│   ├── menu/           ← category and product hero photos
│   ├── empty-states/   ← illustrations for empty lists
│   └── icons/          ← custom status, payment, channel icons
└── models/             ← (already exists, for 3D .glb files)
```

---

## 1. Brand (logo / favicon / app icon)

### `frontend/public/images/brand/logo.png` — 512×512, transparent

> Modern minimalist logo mark for "Pizzabot", a Brazilian pizzeria's WhatsApp ordering bot. A stylized geometric pizza slice fused with a chat speech bubble tail, rendered in 3D with subtle PBR materials. Primary color gradient from `#FF6B35` (vivid orange) at the top to `#FFD700` (warm gold) at the bottom, with a soft inner shadow on a deep navy `#1A1A2E` rim. Clean vector-perfect edges, glossy specular highlight on the cheese surface, single melted-cheese drip as a playful detail. Centered composition, generous padding, fully transparent background. PNG, 512×512, no text, square.

### `frontend/public/images/brand/logo-wordmark.png` — 1024×256, transparent

> Horizontal wordmark for "Pizzabot" admin panel. The icon mark (a 3D pizza slice merged with a chat bubble in `#FF6B35`→`#FFD700` gradient) on the left, then the wordmark "Pizzabot" set in Space Grotesk Bold, white `#FFFFFF` with a faint orange glow `rgba(255,107,53,0.35)`. Tight optical kerning, slight letter weight reduction on the lowercase "izzabot". Transparent background, anti-aliased, 1024×256 PNG. Modern SaaS aesthetic, no taglines.

### `frontend/public/favicon.png` — 64×64, transparent

> Compact favicon version of the Pizzabot mark: a single pizza slice silhouette in a `#FF6B35` to `#FFD700` linear gradient with two small pepperoni dots in deep red, optimized for legibility at 16×16. Crisp edges, transparent background, square 64×64 PNG. No chat-bubble detail (drop it at this size — keep only the slice).

### `frontend/public/images/brand/app-icon-192.png` and `app-icon-512.png` — solid

> PWA-ready Pizzabot app icon: the 3D pizza-slice-meets-chat-bubble logo centered on a soft radial background that fades from `#1A1A3E` in the center to `#0F0F23` at the edges, with very subtle orange glow ring at 35% opacity. Logo glows gently `0 0 24px rgba(255,107,53,0.5)`. Rounded-square safe area (iOS mask-friendly). Solid background, square PNG, ultra-sharp.

### `frontend/public/images/brand/og-image.png` — 1200×630, solid

> Social/OG card for the Pizzabot admin panel. Left half: hero shot of a freshly baked Brazilian pizza with melted mozzarella, fresh basil, and a generous drizzle of tomato sauce, photorealistic, top-down 3/4 angle, studio lighting, shallow depth of field. Right half: deep navy `#0F0F23` panel showing the wordmark "Pizzabot" in Space Grotesk Bold white, subtitle "Painel administrativo · WhatsApp · Datacaixa PDV" in muted white `rgba(255,255,255,0.6)` Inter Medium, and a soft orange-to-gold glow accent. Subtle glass-card panel mockup floating in the right side showing a fake "Pedidos hoje: 47" stat. 1200×630 PNG, solid background, modern SaaS social card aesthetic.

---

## 2. Backgrounds

### `frontend/public/images/backgrounds/login-bg.png` — 2560×1440, solid

> Cinematic dark-mode background for a login page of a Brazilian pizzeria admin app. A close-up macro photograph of a wood-fired pizza oven interior with glowing ember coals at the bottom edge casting warm `#FF6B35` light, the rest of the frame deep navy `#0F0F23` with slow soft bokeh particles in `#FFD700` floating upward like sparks. Heavy motion-blur depth-of-field, ambient haze, no text, no people. The center of the frame is intentionally darker and emptier so a glass-card login form sits on top legibly. Photorealistic, 2560×1440 PNG, hyperdetailed, ARRI Alexa cinematic look.

### `frontend/public/images/backgrounds/dashboard-hero.png` — 2400×800, solid

> Wide hero banner for a pizzeria admin dashboard. Top-down flat-lay of a pizzaiolo's prep station: stainless steel surface, scattered semolina flour, basil leaves, fresh mozzarella ball, a wooden peel partially in frame on the left, a small ramekin of olive oil. Lighting is moody dark-mode-friendly with warm orange `#FF6B35` rim light from the left edge and cool navy `#0F0F23` shadows. Heavy vignette so the center reads as background to overlaid widgets. No pizza visible — only ingredients. Photorealistic, 2400×800 PNG, food-photography quality, shallow grain.

### `frontend/public/images/backgrounds/auth-pattern.png` — 1024×1024, transparent, tileable

> Seamless tileable subtle pattern for dark UI surfaces: very faint hexagonal mesh suggesting a pizza honeycomb cheese-bubble structure, lines at 4% opacity in `#FFD700`, on a fully transparent background. Tiles perfectly edge-to-edge with zero visible seam. 1024×1024 PNG, monoline, ultra-thin strokes, almost invisible by design — meant to multiply over the navy app background.

---

## 3. Menu category heroes

### `frontend/public/images/menu/cat-pizza-salgada.png` — 800×600, transparent

> Photorealistic top-down 45° hero shot of a classic Brazilian Calabresa pizza on a rustic black slate, melted mozzarella, sliced calabresa sausage, red onion rings, oregano, slightly charred crust edge. The pizza is cleanly cut out with soft contact shadow only — fully transparent background outside the slate. Studio softbox lighting, vivid saturation, ultra-sharp, 800×600 PNG, food magazine quality.

### `frontend/public/images/menu/cat-pizza-doce.png` — 800×600, transparent

> Photorealistic top-down 45° hero shot of a Brazilian dessert pizza "Chocolate com Morango": dark chocolate ganache base, fresh sliced strawberries arranged in a spiral, condensed-milk drizzle, dusting of powdered sugar, on a light wooden board. Cleanly cut out with soft contact shadow on a fully transparent background. Studio lighting, glossy chocolate highlights, vivid red strawberries, 800×600 PNG, premium food photography.

### `frontend/public/images/menu/cat-bebidas.png` — 800×600, transparent

> Photorealistic group shot of Brazilian pizza-night drinks: a chilled 2L Coca-Cola bottle with condensation, a 1L Guaraná Antarctica, two ice-cold glass bottles of Heineken with frost, slight diagonal arrangement, dark reflective surface beneath. Subtle warm rim light from the right (`#FF6B35` tint) for brand consistency. Cleanly cut out with soft floor shadow on a fully transparent background. 800×600 PNG, commercial product photography, ultra-detailed labels and condensation.

### `frontend/public/images/menu/cat-acompanhamentos.png` — 800×600, transparent

> Photorealistic overhead shot of Brazilian pizzeria sides: a basket of golden garlic bread sticks (pão de alho), a bowl of barbecue dipping sauce, a wedge of grilled provolone, scattered parsley. Warm golden-hour lighting, rustic wooden surface visible only directly under the food. Cleanly cut out with soft contact shadow on a fully transparent background. 800×600 PNG, hyperdetailed crust texture, glistening melted cheese.

### `frontend/public/images/menu/placeholder-product.png` — 600×600, transparent

> Generic photorealistic mini-pizza fallback image for when a product has no photo. A small personal-size margherita pizza, top-down view, bright studio lighting, perfectly centered, soft contact shadow only. Transparent background, 600×600 PNG, neutral and recognizable, suitable for any product card.

---

## 4. Empty-state illustrations

**Style anchor for all five**: same illustrator, modern flat-3D claymorphic style, subtle ambient occlusion, palette restricted to `#FF6B35`, `#FFD700`, `#1A1A2E`, `#16213E`, off-white `#E8E8F0`. Friendly, never childish.

### `frontend/public/images/empty-states/no-orders.png` — 600×600, transparent

> Modern flat-3D claymorphic illustration: a single empty pizza box (closed) with a tiny "Pedidos" tag dangling from a string, slight tilt, soft contact shadow. Box is `#FF6B35` with `#FFD700` interior peek, tag in `#1A1A2E`. Friendly minimalist style, no text inside the image, soft ambient occlusion. Transparent background, 600×600 PNG. For an empty "no orders yet" state in a Brazilian pizzeria admin panel.

### `frontend/public/images/empty-states/no-customers.png` — 600×600, transparent

> Modern flat-3D claymorphic illustration: a stylized smartphone in `#1A1A2E` with a green WhatsApp-style chat bubble emerging from the screen, but the bubble is empty (no contact silhouette inside). Soft glow `#FFD700` behind the phone. Friendly, minimalist. Transparent background, 600×600 PNG. Conveys "no customers in the database yet".

### `frontend/public/images/empty-states/no-conversations.png` — 600×600, transparent

> Modern flat-3D claymorphic illustration: two stacked chat bubbles, top one in `#FF6B35`, bottom one in `#16213E`, both with three dots inside but faded out at 40% opacity, gentle floating angle. Subtle gold `#FFD700` particles drifting upward like the chat is "asleep". Transparent background, 600×600 PNG. For an empty "no conversations" state.

### `frontend/public/images/empty-states/no-delivery-zones.png` — 600×600, transparent

> Modern flat-3D claymorphic illustration: a stylized map pin in `#FF6B35` standing on a small flat hex tile of city map (`#1A1A2E` base, `#16213E` road lines), with a faint dashed circle radius around it in `#FFD700` at 40% opacity. Pin casts soft shadow. No text. Transparent background, 600×600 PNG. For "no delivery zones configured" empty state.

### `frontend/public/images/empty-states/no-menu-items.png` — 600×600, transparent

> Modern flat-3D claymorphic illustration: an empty menu/clipboard standing upright with a cartoon pizza cutter and a small tomato resting at its base. Clipboard surface `#E8E8F0`, accents `#FF6B35` and `#FFD700`. Soft ambient occlusion shadow. No text on the clipboard. Transparent background, 600×600 PNG. For "menu is empty, add your first pizza" state.

### `frontend/public/images/empty-states/error-500.png` — 800×600, transparent

> Modern flat-3D claymorphic illustration of a sad burnt pizza: a small personal pizza tilted on its side with a wisp of cartoon smoke rising from a charred spot, exaggerated melted-cheese drip frozen mid-fall. Crust edges visibly blackened. Palette `#FF6B35`, `#1A1A2E`, with smoke in soft `#E8E8F0`. Friendly humor, not grim. Transparent background, 800×600 PNG. For server-error / "something went wrong" pages.

### `frontend/public/images/empty-states/offline-bridge.png` — 800×600, transparent

> Modern flat-3D claymorphic illustration: a stylized pizza box with a broken Wi-Fi/signal symbol floating above it crossed out with a soft `#FF6B35` slash. The box is closed and tilted. No text. Subtle red-glow accent only on the slash. Transparent background, 800×600 PNG. Used to indicate the Datacaixa Windows bridge is offline / disconnected.

---

## 5. Custom status & channel icons (UI)

All in `frontend/public/images/icons/`. Each is a **128×128 transparent PNG**, isometric-mini-3D claymorphic, with a soft 1px outer glow in its accent color. No background.

### `icons/status-pending.png`

> Mini-3D isometric icon: an analog clock face tilted at a 25° isometric angle, hands at 10 and 2, body in `#FFD700`, bezel and hands `#1A1A2E`. Soft outer glow `rgba(255,215,0,0.35)`. Transparent background, 128×128 PNG. For "Pedido pendente" (pending order) status.

### `icons/status-preparing.png`

> Mini-3D isometric icon: a chef's toque (white hat) tilted slightly with a small `#FF6B35` flame underneath. Soft warm glow `rgba(255,107,53,0.35)`. Transparent background, 128×128 PNG. For "Em preparo" (being prepared) status.

### `icons/status-out-for-delivery.png`

> Mini-3D isometric icon: a small motorcycle delivery scooter from 3/4 view with a square pizza-delivery box on the rear rack, body `#FF6B35`, helmet/box accents `#1A1A2E`, faint motion-line streak `#FFD700` behind the rear wheel. Soft contact shadow. Transparent background, 128×128 PNG. For "Saiu para entrega" status.

### `icons/status-delivered.png`

> Mini-3D isometric icon: a closed pizza box with a green `#00C853` checkmark badge on the lid (badge raised on a tiny pillar so it floats above the surface). Soft green glow. Transparent background, 128×128 PNG. For "Entregue" (delivered) status.

### `icons/status-cancelled.png`

> Mini-3D isometric icon: a pizza box tilted with a soft red X badge on the lid, X stroke `#E63946`, lid `#1A1A2E`. Subtle red glow `rgba(230,57,70,0.3)`. Transparent background, 128×128 PNG. For "Cancelado" status.

### `icons/payment-pix.png`

> Mini-3D isometric icon: the official PIX diamond logo shape (four-quadrant rotated square) extruded into a chunky 3D badge, body in `#32BCAD` (PIX teal), with a faint white inner highlight. Sitting on an invisible plane with a soft contact shadow. Transparent background, 128×128 PNG. For PIX payment method.

### `icons/payment-cash.png`

> Mini-3D isometric icon: a small stack of Brazilian Real banknotes (R$) with a single coin tilted at the front, banknote in `#00C853` and `#1A1A2E` accents. Soft contact shadow. Transparent background, 128×128 PNG. For "Dinheiro" payment method.

### `icons/payment-card.png`

> Mini-3D isometric icon: a credit card with rounded corners floating at a 25° isometric angle, surface gradient from `#FF6B35` to `#FFD700`, an embossed chip in `#1A1A2E`, four masked digits (••••) in white. Soft outer glow `rgba(255,107,53,0.3)`. Transparent background, 128×128 PNG. For "Cartão" payment method.

### `icons/channel-whatsapp.png`

> Mini-3D isometric icon: the WhatsApp speech-bubble glyph extruded into a chunky 3D badge, body `#25D366` with darker `#128C7E` underside, a tiny `#FFD700` notification dot on the upper-right corner. Soft green glow. Transparent background, 128×128 PNG. For orders that came in via WhatsApp.

### `icons/channel-manual.png`

> Mini-3D isometric icon: a pen/stylus laid diagonally over a small tilted notepad sheet, pen body `#FF6B35`, notepad `#E8E8F0` with two faint horizontal `#1A1A2E` lines. Soft contact shadow. Transparent background, 128×128 PNG. For orders that were entered manually by staff.

### `icons/health-ok.png` — 128×128, transparent

> Mini-3D isometric heartbeat status badge for a healthy backend service. A chunky extruded ECG pulse waveform in vivid `#00C853` (success green) with a single clean upward spike, sitting on a faint dark `#1A1A2E` pill-shaped base at 30% opacity. Slight 25° isometric tilt, soft outer glow `rgba(0,200,83,0.35)`, soft contact shadow. Glossy specular highlight along the top edge of the waveform. Transparent background, 128×128 PNG. For the HealthWidget "all systems operational" state — must align rotationally with `health-degraded.png` and `health-down.png` so they swap cleanly.

### `icons/health-degraded.png` — 128×128, transparent

> Mini-3D isometric heartbeat status badge for a degraded backend service. Same chunky extruded ECG pulse waveform as `health-ok.png` (identical 25° isometric angle and pill base), but rendered in warm `#FFD700` (warm gold) with a single dimmer/uneven spike, plus a tiny floating `#FFD700` exclamation-mark dot hovering just above the spike's peak. Soft amber outer glow `rgba(255,215,0,0.35)`, soft contact shadow on a faint dark `#1A1A2E` pill base at 30% opacity. Transparent background, 128×128 PNG. For the HealthWidget "partial outage / slow" state.

### `icons/health-down.png` — 128×128, transparent

> Mini-3D isometric heartbeat status badge for a down/offline backend service. Same chunky extruded ECG waveform shape as `health-ok.png` (identical 25° isometric angle and pill base), but completely flatlined — no spike, just a straight horizontal line — in muted red `#E63946`. Soft red outer glow `rgba(230,57,70,0.35)`, soft contact shadow on a faint dark `#1A1A2E` pill base at 30% opacity. Subtle desaturation on the waveform compared to the OK variant to convey "lifeless". Transparent background, 128×128 PNG. For the HealthWidget "service unreachable" state.

---

## 6. Notification / toast art

### `frontend/public/images/icons/toast-success.png` — 96×96, transparent

> Mini-3D claymorphic toast notification badge for a success state. A perfectly circular rounded badge in vivid `#00C853` (success green) with a thick chunky white checkmark embossed on the front face, slight bevel on the badge edges with subtle ambient occlusion underneath, glossy specular highlight on the upper-left curve. Slight 15° isometric tilt, soft contact shadow on an invisible plane, soft outer glow `rgba(0,200,83,0.4)`. Transparent background, 96×96 PNG. Designed to feel native to a dark glass-card UI — must share the same tilt, badge silhouette, and rendering style as `toast-error.png` and `toast-info.png` so they read as a matched set.

### `frontend/public/images/icons/toast-error.png` — 96×96, transparent

> Mini-3D claymorphic toast notification badge for an error state. A perfectly circular rounded badge in muted alarm red `#E63946` with a thick chunky white X mark embossed on the front face, slight bevel on the badge edges with subtle ambient occlusion underneath, glossy specular highlight on the upper-left curve. Slight 15° isometric tilt (matching the success and info badges), soft contact shadow on an invisible plane, soft outer glow `rgba(230,57,70,0.4)`. Transparent background, 96×96 PNG. Designed to feel native to a dark glass-card UI — identical badge silhouette and tilt to `toast-success.png` and `toast-info.png`.

### `frontend/public/images/icons/toast-info.png` — 96×96, transparent

> Mini-3D claymorphic toast notification badge for an info state. A perfectly circular rounded badge in vivid `#FF6B35` (brand primary orange) with a thick chunky white lowercase "i" (info dot + stem) embossed on the front face, slight bevel on the badge edges with subtle ambient occlusion underneath, glossy specular highlight on the upper-left curve. Slight 15° isometric tilt (matching the success and error badges), soft contact shadow on an invisible plane, soft outer glow `rgba(255,107,53,0.4)`. Transparent background, 96×96 PNG. Designed to feel native to a dark glass-card UI — identical badge silhouette and tilt to `toast-success.png` and `toast-error.png`.

---

## 7. 3D-scene poster fallbacks (R3F login + dashboard globe)

Static PNG posters used when the WebGL canvas is loading or unsupported.

### `frontend/public/images/backgrounds/login-pizza-poster.png` — 1920×1080, solid

> Photorealistic still frame from a 3D pizza render meant as a fallback poster for the WebGL login scene. Hero pizza floating slowly in a deep navy `#0F0F23` void, lit from above-left by a warm `#FF6B35` rim light and from below by a soft `#FFD700` underglow. Cheese strands suspended mid-stretch, basil leaf frozen mid-fall. Subtle volumetric haze. Photorealistic Cycles-render quality, 1920×1080 PNG, solid dark background, cinematic depth of field.

### `frontend/public/images/backgrounds/order-globe-poster.png` — 1024×1024, transparent

> Static poster fallback for a 3D OrderGlobe component: a stylized 3D globe of South America (Brazil highlighted in `#FF6B35`) with small glowing `#FFD700` pin markers concentrated in southeastern Brazil, soft atmospheric haze, slight tilt. Globe oceans deep navy `#1A1A2E`, landmasses `#16213E`. Transparent background, 1024×1024 PNG, photorealistic semi-stylized render. Used when WebGL is unavailable.

---

## 8. Avatar & placeholder

### `frontend/public/images/icons/avatar-placeholder.png` — 256×256, transparent

> Mini-3D claymorphic generic customer avatar: a friendly geometric silhouette head-and-shoulders, body in `#16213E`, subtle `#FF6B35` rim light from the left, no facial features (abstract). Soft contact shadow. Transparent background, 256×256 PNG. Used as a fallback for customer profile photos in the Clientes page.

---

## How to wire these in once generated

After you generate the PNGs, the natural touch-points in the existing code are:

- **Favicon**: replace the inline emoji SVG in [frontend/index.html:5](frontend/index.html#L5) with `<link rel="icon" type="image/png" href="/favicon.png" />`.
- **Sidebar logo**: swap the `🍕` emoji in [frontend/src/components/layout/Sidebar.jsx:36](frontend/src/components/layout/Sidebar.jsx#L36) for `<img src="/images/brand/logo.png" />`.
- **Login mark**: swap the `🍕` emoji in [frontend/src/pages/Login.jsx:62](frontend/src/pages/Login.jsx#L62).
- **Login background fallback**: reference `login-pizza-poster.png` as the poster on the `<Canvas>` or as a CSS `background-image` on the `-z-10` wrapper in [frontend/src/pages/Login.jsx:50](frontend/src/pages/Login.jsx#L50).
- **Empty states**: drop the relevant PNGs into the empty branches of the list pages (Orders, Customers, Conversations, Delivery, Menu).
- **OG image**: add `<meta property="og:image" content="/images/brand/og-image.png" />` to [frontend/index.html](frontend/index.html).

---

## Quick reference — file checklist

| # | Path | Size | Background |
|---|------|------|------------|
| 1 | `images/brand/logo.png` | 512×512 | transparent |
| 2 | `images/brand/logo-wordmark.png` | 1024×256 | transparent |
| 3 | `favicon.png` | 64×64 | transparent |
| 4 | `images/brand/app-icon-192.png` | 192×192 | solid |
| 5 | `images/brand/app-icon-512.png` | 512×512 | solid |
| 6 | `images/brand/og-image.png` | 1200×630 | solid |
| 7 | `images/backgrounds/login-bg.png` | 2560×1440 | solid |
| 8 | `images/backgrounds/dashboard-hero.png` | 2400×800 | solid |
| 9 | `images/backgrounds/auth-pattern.png` | 1024×1024 | transparent (tile) |
| 10 | `images/backgrounds/login-pizza-poster.png` | 1920×1080 | solid |
| 11 | `images/backgrounds/order-globe-poster.png` | 1024×1024 | transparent |
| 12 | `images/menu/cat-pizza-salgada.png` | 800×600 | transparent |
| 13 | `images/menu/cat-pizza-doce.png` | 800×600 | transparent |
| 14 | `images/menu/cat-bebidas.png` | 800×600 | transparent |
| 15 | `images/menu/cat-acompanhamentos.png` | 800×600 | transparent |
| 16 | `images/menu/placeholder-product.png` | 600×600 | transparent |
| 17 | `images/empty-states/no-orders.png` | 600×600 | transparent |
| 18 | `images/empty-states/no-customers.png` | 600×600 | transparent |
| 19 | `images/empty-states/no-conversations.png` | 600×600 | transparent |
| 20 | `images/empty-states/no-delivery-zones.png` | 600×600 | transparent |
| 21 | `images/empty-states/no-menu-items.png` | 600×600 | transparent |
| 22 | `images/empty-states/error-500.png` | 800×600 | transparent |
| 23 | `images/empty-states/offline-bridge.png` | 800×600 | transparent |
| 24 | `images/icons/status-pending.png` | 128×128 | transparent |
| 25 | `images/icons/status-preparing.png` | 128×128 | transparent |
| 26 | `images/icons/status-out-for-delivery.png` | 128×128 | transparent |
| 27 | `images/icons/status-delivered.png` | 128×128 | transparent |
| 28 | `images/icons/status-cancelled.png` | 128×128 | transparent |
| 29 | `images/icons/payment-pix.png` | 128×128 | transparent |
| 30 | `images/icons/payment-cash.png` | 128×128 | transparent |
| 31 | `images/icons/payment-card.png` | 128×128 | transparent |
| 32 | `images/icons/channel-whatsapp.png` | 128×128 | transparent |
| 33 | `images/icons/channel-manual.png` | 128×128 | transparent |
| 34 | `images/icons/health-ok.png` | 128×128 | transparent |
| 35 | `images/icons/health-degraded.png` | 128×128 | transparent |
| 36 | `images/icons/health-down.png` | 128×128 | transparent |
| 37 | `images/icons/toast-success.png` | 96×96 | transparent |
| 38 | `images/icons/toast-error.png` | 96×96 | transparent |
| 39 | `images/icons/toast-info.png` | 96×96 | transparent |
| 40 | `images/icons/avatar-placeholder.png` | 256×256 | transparent |

All paths are relative to `frontend/public/`.
