# Customer Portal — Design System & UX Spec

> Companion to `CUSTOMER_PORTAL_DEV_PLAN.md`. The dev plan covers *what*
> ships and *when*; this doc covers *how it looks, feels, and connects
> to admin data*. Every implementation decision below is binding for
> M1–M9; deviations need a one-line note in the PR.

---

## 1. Vision in one sentence

A pizza site that feels like a social app — photo-first, thumb-friendly,
fast to scan, satisfying to use — without losing the warmth of a
neighborhood pizzeria.

Reference posture: Instagram's content-first restraint, not a
restaurant-website template. Imagery is the headline; chrome retreats.

---

## 2. Design principles

These five principles override individual taste calls. When two
solutions are both reasonable, pick the one that better satisfies the
higher-numbered principle.

1. **Mobile-first, always.** Every layout starts at 375×812 (iPhone SE/13
   mini). Anything that doesn't work one-handed on that viewport is
   broken regardless of how good the desktop view is.
2. **Photography is the headline.** A pizza is sold by what it looks
   like. Type and chrome support the image, never compete with it.
3. **Two taps to reorder, three to first order.** Returning customer:
   `/orders` → "Pedir de novo" → confirm. New customer: `/menu` → product
   → "Adicionar" → checkout.
4. **Brand consistency with the existing landing.** The pizzeria already
   uses cream / charcoal / oven-red on its landing page. We extend that
   palette, we do not invent a new one.
5. **No clutter.** If a screen has more than one primary CTA, one of
   them is wrong. If a card has more than five distinct visual elements,
   one of them is wrong.

---

## 3. Visual language

### 3.1 Color palette

Built on the existing landing palette (`tailwind.config.js`: `cream`,
`offwhite`, `charcoal`, `ovenred`). The customer portal extends with two
fresh accents for product states.

| Token | Hex | Use |
|---|---|---|
| `cream` | `#F8F1E4` | Page background |
| `offwhite` | `#FFFCF7` | Card surfaces, sticky bars |
| `charcoal` | `#1F1815` | Body text, headlines |
| `ovenred` | `#8B1A1A` | **Primary CTA** (Adicionar, Confirmar pedido) |
| `ember` (new) | `#E94B1F` | Hot accents — live status, badges, sale tags |
| `basil` (new) | `#5A7A2C` | Success — "disponível", order delivered |
| `crust` (new) | `#D9B382` | Soft warm accent — selected pills, dividers |
| `slate-muted` | `#64748B` | Secondary text, captions |
| `slate-line` | `#E5E9F0` | Hairline dividers |
| `danger` | `#B33A3A` | Errors only |

Add to `customer/tailwind.config.js`:

```js
colors: {
  cream: '#F8F1E4', offwhite: '#FFFCF7',
  charcoal: '#1F1815', ovenred: '#8B1A1A',
  ember: '#E94B1F', basil: '#5A7A2C', crust: '#D9B382',
}
```

**Contrast.** `charcoal` on `cream` = 13.6:1. `offwhite` on `ovenred` =
8.1:1. Both clear WCAG AAA. `slate-muted` on `cream` = 4.7:1, AA only —
do not use for body text, only for captions ≥14px.

### 3.2 Typography

A two-font system. Display reuses `Playfair Display` already loaded by
the landing; body uses `Inter` for legibility on mobile.

| Role | Font | Weight | Notes |
|---|---|---|---|
| Display (h1, hero, product name on detail) | Playfair Display | 600 | `letter-spacing: -0.01em` on sizes ≥ 32px |
| Headline (h2, section titles) | Playfair Display | 500 | |
| UI / body | Inter | 400 / 500 / 600 | System UI fallback |
| Numeric (prices) | Inter | 600 | Tabular figures: `font-variant-numeric: tabular-nums` |

**Mobile type ramp** (use these sizes literally, no scaling):

| Token | Size | Line-height | Where |
|---|---|---|---|
| `display-xl` | 36px | 40px | Landing hero only |
| `display-lg` | 28px | 32px | Section headers, product detail name |
| `display-md` | 22px | 28px | Product card name |
| `body-lg` | 17px | 26px | Description on detail |
| `body` | 15px | 22px | Default body |
| `body-sm` | 13px | 18px | Captions, metadata |
| `label` | 12px | 16px | Eyebrow, uppercase, `letter-spacing: 0.08em` |

**Desktop ramp.** Multiply display sizes by 1.25; body sizes unchanged.

**No paragraph wider than 70ch.** On mobile this is automatic; on
desktop, constrain.

### 3.3 Spacing

Standard 4-based scale (Tailwind default): `1 (4) · 2 (8) · 3 (12) · 4
(16) · 5 (20) · 6 (24) · 8 (32) · 12 (48) · 16 (64)`.

Layout heuristics:

- Page side padding: `16` mobile, `24` tablet, `32` desktop.
- Card internal padding: `16` mobile, `20` desktop.
- Vertical rhythm between cards: `16`.
- Section vertical padding: `48` mobile, `64` desktop.
- Bottom nav height: `64` (mobile only). Add `64` bottom padding to
  scrollable content so the nav never overlaps the last item.

### 3.4 Border radius

| Token | Radius | Use |
|---|---|---|
| `rounded-md` | 8px | Form inputs, small buttons |
| `rounded-lg` | 12px | Pills, chips |
| `rounded-xl` | 16px | Cards, product images |
| `rounded-2xl` | 24px | Modals, bottom sheets |
| `rounded-full` | 999px | Avatars, FAB, status pills |

### 3.5 Shadows

Reuse the existing `card` and `card-hover` from admin tokens; add one
new layer for elevated surfaces (bottom sheet, FAB).

```js
boxShadow: {
  'soft':   '0 1px 2px rgba(31,24,21,0.04), 0 8px 24px -12px rgba(31,24,21,0.10)',
  'lifted': '0 4px 8px rgba(31,24,21,0.06), 0 24px 48px -16px rgba(31,24,21,0.18)',
  'cta':    '0 8px 20px -8px rgba(139,26,26,0.45)',
}
```

`shadow-cta` goes on the primary button when not hovered, scaled up on
hover. Prevents the "floating button looks pasted" effect.

### 3.6 Motion

Three timings, one easing. No bespoke animations.

| Token | Duration | Easing | Use |
|---|---|---|---|
| `motion-tap` | 120ms | `ease-out` | Button press, pill select |
| `motion-default` | 200ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Hover, color, opacity |
| `motion-layout` | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Sheet open/close, page transition |

One spring exception: cart-add uses Framer Motion `spring(stiffness:
300, damping: 24)` for the fly-to-cart animation. That's the only spring
in the app.

**Respect `prefers-reduced-motion`** — drop layout transitions to
opacity-only.

---

## 4. Mobile-first responsive strategy

### 4.1 Breakpoints

Tailwind defaults, named for clarity:

| Name | px | Layout |
|---|---|---|
| (default) | 0–639 | Phone — single column, bottom nav |
| `sm` | 640–767 | Large phone / small tablet portrait — same as phone |
| `md` | 768–1023 | Tablet — 2-col grid, side cart drawer on demand |
| `lg` | 1024–1279 | Desktop — 3-col grid, persistent side cart |
| `xl` | 1280+ | Wide — 4-col grid, max-width container 1280 |

### 4.2 Layout patterns by breakpoint

**Mobile (< md)**

```
┌─────────────────────────┐
│ Top bar (44px)          │  ← logo + cart icon w/ badge
├─────────────────────────┤
│                         │
│   Content (scrolls)     │
│                         │
├─────────────────────────┤
│ Bottom nav (64px)       │  ← Cardápio · Pedidos · Conta
└─────────────────────────┘
```

**Tablet (md)**

Top bar grows to 56px, gains text labels next to icons. Bottom nav
hidden, replaced by top-bar nav links. Product grid → 2 columns.

**Desktop (lg+)**

Persistent side cart drawer (320px) on cart-aware pages. Content area
max-width 1080. Product grid → 3 columns; 4 at `xl`.

### 4.3 Touch targets

44×44px absolute minimum (Apple HIG). Default to 48×48 for primary
actions. Inputs are 56px tall on mobile to match thumb reach.

Spacing between adjacent tap targets ≥ 8px. Pill rows have `gap-2`
minimum.

### 4.4 The bottom navigation

Mobile-only, fixed, three tabs:

```
   ┌──────┬──────┬──────┐
   │ 🍕   │ 📋   │ 👤   │
   │Cardá-│Pedi- │Conta │
   │ pio  │ dos  │      │
   └──────┴──────┴──────┘
```

- 64px tall, `offwhite` bg, top hairline `slate-line`.
- Active tab: `ovenred` icon + label, 2px top accent bar.
- Inactive: `charcoal` at 60% opacity.
- "Conta" routes to `/login` if logged out, `/profile` if logged in
  (don't show two different tabs).
- Cart is **not** in the nav — it has a sticky bar at bottom of menu/
  product pages when items are in it (see 5.6).

---

## 5. Component patterns

Concrete enough that two implementations should look identical.

### 5.1 Button — primary

```
height: 48 mobile / 44 desktop
padding-x: 24
border-radius: 12
bg: ovenred
color: offwhite
font: Inter 16/600
shadow: cta
hover: bg darken 8%, shadow scale 1.05
active: scale 0.98 (motion-tap)
disabled: bg slate-line, color slate-muted, no shadow
loading: spinner left, label remains
```

Full-width on mobile inside forms and cards. Auto-width in headers.

### 5.2 Button — secondary

Same dimensions, `bg: cream`, `color: charcoal`, `border: 1px crust`.
No shadow. Used for "Cancelar", "Voltar", non-primary actions.

### 5.3 Pill / chip

Used for size selection, crust selection, category filter, active
filters.

```
height: 36
padding-x: 14
border-radius: 999
border: 1px slate-line
bg: offwhite
color: charcoal
font: Inter 14/500

selected: bg crust at 25% + border crust + color charcoal (bold)
disabled: bg cream, color slate-muted, line-through
```

### 5.4 Product card (menu page)

```
┌───────────────────────────────┐
│                               │
│     [Image, 4:3, full-width]  │   ← rounded-t-xl, object-cover
│                               │
├───────────────────────────────┤
│  Margherita                   │   ← Playfair 22/500 charcoal
│  Mozzarella, manjericão,      │   ← Inter 13/400 slate-muted
│  tomate fresco                │     line-clamp-2
│                               │
│  A partir de  R$ 49,90    [+] │   ← price Inter 16/600,
│                               │     "+" = 40px ovenred FAB
└───────────────────────────────┘
```

- Card: `bg-offwhite rounded-xl shadow-soft overflow-hidden`
- Tap target = whole card → product detail
- "+" button stops propagation, adds default size to cart with toast
- On press: card scale 0.98, image overlay 5% black

### 5.5 Product detail page

Mobile: full-page, image at top edge-to-edge, content scrolls beneath.

```
┌─────────────────────────┐
│ [<]                  [♡]│  ← floating back + favorite, no top bar
│                         │
│   Hero image (16:10)    │  ← object-cover, parallax-light on scroll
│                         │
├─────────────────────────┤
│ Margherita              │  ← display-lg
│ A clássica, com molho…  │  ← body-lg
│                         │
│ TAMANHO                 │  ← label
│ ( P ) ( M ) (G ✓) (GG) │  ← pills
│                         │
│ BORDA                   │
│ (Sem ✓) (Catupiry +5)…  │
│                         │
│ EXTRAS                  │
│ ☐ Bacon       +R$ 5,00  │
│ ☐ Cheddar     +R$ 5,00  │
│                         │
│ OBSERVAÇÃO              │
│ [textarea]              │
│                         │
├─────────────────────────┤
│ Total       R$ 54,90    │ ← sticky bottom bar
│ [ Adicionar ao pedido ] │
└─────────────────────────┘
```

Desktop: opens as a centered modal (max-width 720), sticky CTA inside
modal footer. Image becomes carousel if `image_urls.length > 1`.

### 5.6 Sticky cart bar

Appears on `/menu` and product pages whenever cart is non-empty.

```
┌─────────────────────────┐
│ 3 itens · R$ 134,70  [→]│ ← bg ovenred, color offwhite
└─────────────────────────┘    full-width, 56px tall, fixed bottom
                              above bottom-nav (mobile)
                              right side of screen (desktop)
```

Tap → navigates to `/cart`. On scroll-down, auto-hides; on scroll-up,
returns. Same gesture as Instagram's nav.

### 5.7 Cart bottom sheet (alternative for quick view)

Used when "+" is tapped from menu — a brief preview slides up:

```
       drag handle
┌─────────────────────────┐
│ Adicionado ao pedido ✓  │  ← basil
│ Margherita G            │
│                         │
│ Subtotal    R$ 49,90    │
│ [ Continuar ] [Finaliza]│  ← both side-by-side
└─────────────────────────┘
```

Auto-dismisses after 3 s if no interaction. Drag-down to dismiss
manually. Does not block the page beneath (no overlay).

### 5.8 Form input

```
height: 56
padding-x: 16
padding-y: 12 (label floats up on focus / has-value)
border: 1px slate-line, becomes 2px charcoal on focus
border-radius: 12
bg: offwhite
font: Inter 16/400 (16 prevents iOS zoom)

floating label: Inter 12/500 slate-muted, charcoal when focused
error: border danger 2px, helper text danger 13px below
```

One field per row on mobile. CEP + number on the same row at `md+`.

### 5.9 OTP input

```
6 boxes × (48×56), gap-2
each: same border treatment as form input
font: Inter 24/600 charcoal centered
inputmode="numeric"
autocomplete="one-time-code"   ← critical for iOS
auto-advance on input
auto-submit on 6th
paste fills all 6 from clipboard
```

### 5.10 Empty state

```
       [ illustration ]      ← max 200px, 50% opacity
       
       Sua sacola está       ← display-md
       vazia
       
       Que tal começar       ← body slate-muted
       pela margherita?
       
       [ Ver cardápio ]      ← primary button
```

Centered vertically in available space, max 320px wide.

### 5.11 Toast

```
position: top-center mobile (12px from top), top-right desktop
max-width: 360
padding: 12 / 16
border-radius: 12
bg: charcoal at 95% (success), danger (error), basil (success-strong)
color: offwhite
font: Inter 14/500
icon left, optional action right ("Desfazer")
auto-dismiss: 3s (4s if has action)
```

Already in the project as `react-hot-toast` — restyle with the above
tokens.

### 5.12 Skeleton loaders

Every list view shows skeletons during `isLoading`, never spinners.

- Product card skeleton: same dimensions, image area = `bg-slate-line`
  with shimmer (already in admin tokens), text rows = 70%/40% width
  bars.
- Order list skeleton: 3 rows of 64px height bars.

---

## 6. Page anatomies

ASCII for the four pages where layout decisions matter most. Other
pages (Login, OTP, Profile, Addresses) follow form-stack conventions.

### 6.1 Landing (`/`)

```
┌─────────────────────────────────┐
│ [logo]              [entrar]    │ ← top bar transparent over hero
│                                 │
│   ╔═════════════════════════╗   │
│   ║  Hero image, full-bleed ║   │ ← /images/hero/hero-pizza-overhead-1600.webp
│   ║  cream gradient overlay ║   │   bottom 30%, dark→transparent
│   ║                         ║   │
│   ║  A pizza que você ama,  ║   │ ← display-xl charcoal
│   ║  agora em 1 minuto.     ║   │
│   ║                         ║   │
│   ║  [ Ver cardápio ]       ║   │ ← primary CTA, full-width mobile
│   ║                         ║   │
│   ╚═════════════════════════╝   │
│                                 │
│  [ 🕐 ]  [ 📍 ]  [ ⚡ ]          │ ← three icon-pills: aberto agora,
│                                 │   bairros atendidos, tempo médio
│                                 │
│  Mais pedidas hoje              │ ← display-lg
│  ┌─────────┬─────────┐          │
│  │ product │ product │          │ ← horizontal-scroll on mobile,
│  │   card  │   card  │ →        │   2-col on tablet, 4-col on desktop
│  └─────────┴─────────┘          │
│                                 │
│  Como funciona                  │
│  1. Escolha. 2. Pague. 3. Coma. │ ← 3 illustrated steps
│                                 │
│  [ Ver todo o cardápio ]        │
│                                 │
│  Footer (bairros, horários,     │
│  WhatsApp link, créditos)       │
└─────────────────────────────────┘
```

Hero image swaps based on time of day (day = overhead, evening = oven
fire) — small touch, costs nothing.

### 6.2 Menu (`/menu`)

```
┌─────────────────────────────────┐
│ [logo]              [🔍] [🛒2]  │ ← search opens overlay
├─────────────────────────────────┤
│                                 │
│ [ Todas ] Pizzas Bebidas Sobr…  │ ← horizontal scroll category pills
│                                 │   sticky on scroll
├─────────────────────────────────┤
│                                 │
│  PIZZAS TRADICIONAIS            │ ← label, slate-muted
│  ┌─────────┬─────────┐          │
│  │ Margher.│ Calabres│          │
│  └─────────┴─────────┘          │
│  ┌─────────┬─────────┐          │
│  │ Quatro  │ Portugue│          │
│  └─────────┴─────────┘          │
│                                 │
│  PIZZAS ESPECIAIS               │
│  ...                            │
│                                 │
│  BEBIDAS                        │
│  ...                            │
│                                 │
│  (sticky cart bar appears when  │
│   cart non-empty, above the     │
│   bottom nav)                   │
└─────────────────────────────────┘
```

Categories pulled from admin `categories` table, displayed in
`display_order`. Tapping a pill scroll-spies to the section. Inactive
products (`is_active=false`) never render.

### 6.3 Cart (`/cart`)

```
┌─────────────────────────────────┐
│ [<]   Sua sacola                │
├─────────────────────────────────┤
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [img] Margherita G          │ │
│ │       Borda Catupiry        │ │
│ │       + Bacon               │ │
│ │       R$ 54,90      [- 1 +] │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ [img] Coca-Cola 2L          │ │
│ │       R$ 14,00      [- 1 +] │ │
│ └─────────────────────────────┘ │
│                                 │
│ ──────────────────────────      │
│                                 │
│ Subtotal           R$ 68,90     │
│ Entrega            R$  6,00     │
│ Total              R$ 74,90     │ ← bold, larger
│                                 │
│ [ Ir para entrega → ]           │ ← sticky bottom on mobile
└─────────────────────────────────┘
```

Item card shows the customer-friendly description rebuilt from
`order_builder` line items (size + crust + extras), not the JSON.
Quantity stepper has 36px touch targets either side.

### 6.4 Tracking (`/track/{token}` or `/orders/{id}`)

```
┌─────────────────────────────────┐
│ Pedido #142                     │
│ Sexta, 10 de mai, 19:42         │
├─────────────────────────────────┤
│                                 │
│  ●━━━━●━━━━●━━━━○━━━━○          │ ← progress: filled = done
│  Receb  Confir Prep  Saiu  Entr │   active = pulsing ember
│                                 │
│  Em preparo                     │ ← display-lg
│  Tempo estimado: 30–40 min      │ ← body-lg slate-muted
│                                 │
│  ╔═══════════════════════════╗  │
│  ║ Atualizado agora há 12s   ║  │ ← live indicator, ember dot
│  ╚═══════════════════════════╝  │
│                                 │
│  Itens                          │
│  · 1× Margherita G              │
│  · 1× Coca-Cola 2L              │
│                                 │
│  Endereço                       │
│  Rua das Pizzas, 123 — apt 4B   │ ← masked on /track/{token}
│                                 │
│  [ Compartilhar este link ]     │
│  [ Pedir de novo ]              │
└─────────────────────────────────┘
```

WebSocket subscription to `/ws/customer/track/{token}` updates the
progress bar without reload. Status changes pulse-fade for 2 s when
they arrive.

---

## 7. Admin-portal compatibility

The most failure-prone area: admin's product schema is rich and the
customer site must render it correctly without re-implementing
business rules.

### 7.1 Product schema → display mapping

From `backend/app/models/product.py`:

| Product field | Customer-side use | Notes |
|---|---|---|
| `name` | Card title, detail header | Truncate at 40ch on cards |
| `description` | Card subtitle (line-clamp-2), full text on detail | Empty = render nothing, no placeholder |
| `category_id` | Section grouping on `/menu` | Use category `display_order` |
| `sizes` (JSONB) | Pill row on detail; "A partir de R$ X" on card | Min price across sizes for card |
| `is_pizza` | Show crust + half/half UI | If false, no crust selector |
| `allows_half` | Show "Meia/Meia" toggle | Half-and-half flow opens a second product picker |
| `available_crusts` (JSONB) | Crust pill row | Always include "Sem Borda" option even if not in array (free) |
| `available_extras` (JSONB) | Extras checklist | Each item has its own price; surface from menu config |
| `image_urls` (JSONB array) | Carousel on detail; `[0]` on card | Empty → fallback by category |
| `image_url == HIDDEN_IMAGE` | Treat as no image | Render fallback |
| `is_active` | Filter out entirely | Never rendered |
| `ncm`, `cfop`, `csosn`, etc. | Not displayed | Backend only |

### 7.2 Pricing display rules

- **Pizza with multiple sizes:** card shows `"A partir de R$ {min}"`,
  detail shows the size pill row with each price below the label.
- **Pizza with one size:** card shows the price plainly, detail still
  shows the pill row but with one option pre-selected and disabled.
- **Non-pizza (drink, dessert):** card shows the price, detail skips
  size/crust UI.
- **Extras:** prices come from a separate menu config (`menu_service`
  exposes them); show as `+ R$ X,XX` next to the checkbox label.
- **Half/half pricing:** standard rule = price of the more expensive
  half. Surface this in a small caption ("Cobramos pelo sabor de maior
  valor").

All pricing is **always** revalidated on the server during `/checkout/quote`
and `/checkout/place`. Client-side display is informational, not
authoritative.

### 7.3 Image handling

```
1. If product.image_urls is non-empty AND first entry is not HIDDEN_IMAGE:
     use product.image_urls[0..n] (carousel on detail)
2. Else if product.category has a category-level fallback in /images/fallbacks/:
     use that
3. Else:
     use /images/fallbacks/pizza-default-800.webp
```

All product images served through the existing media endpoint with
new responsive variants:

```
backend route: GET /media/products/{id}/{size}.webp
sizes: 480 (card), 800 (detail), 1200 (zoom)
backed by Pillow on first request, cached in /backend/media/products/.cache/
```

This is a small backend change in M3 — if not added, fall back to
serving the originals (worse perf but works). The dev plan should
absorb this as part of M3 ("public menu").

### 7.4 Real-time menu updates

When the admin edits a product, the customer site shouldn't show stale
data for hours.

- Backend `PATCH /admin/products/{id}` invalidates `redis.delete("menu:public")`.
- Customer `GET /api/customer/menu` is Redis-cached for 60 s.
- Client revalidates on tab focus (TanStack Query default).
- During checkout, `quote` endpoint always reads fresh — never cached.

A product going `is_active=false` mid-session will:
- Not appear on next menu refresh
- Cause `quote` to return 409 with `{"removed": [item_ids]}` so the
  cart can show "este item não está mais disponível" and offer to
  remove it.

### 7.5 Sold-out (M9) behavior

When sold-out toggle lands:

- Sold-out crust/extra → pill renders disabled with line-through, tap
  shows toast "Indisponível hoje"
- Sold-out whole product → card shows a "Esgotado" diagonal ribbon and
  a muted overlay; tap shows a sheet ("Volta amanhã às 18h" or
  similar)

### 7.6 Connection points to verify in M7

- Customer name shown in admin `/customers` matches what the customer
  set on `/profile`.
- Order placed on web shows "Web" channel badge in admin Pedidos page.
- Conversation history in admin shows web orders inline (or at least a
  marker) so operator sees the full picture.
- Manual address edit in admin propagates to customer's address picker
  on next visit.

---

## 8. Image strategy

### 8.1 Sources

| Image type | Source | Where |
|---|---|---|
| Hero / landing imagery | Curated Unsplash, downloaded at design time | `customer/public/images/hero/` |
| Section backgrounds, textures | Curated Unsplash | `customer/public/images/backgrounds/` |
| Product photos | Admin upload via existing flow | `backend/media/products/` |
| Product fallbacks (no admin photo) | Curated Unsplash, one per category | `customer/public/images/fallbacks/` |
| Empty-state illustrations | SVG, drawn or sourced from Storyset | `customer/public/images/empty-states/` |
| Atmosphere (about, footer) | Curated Unsplash | `customer/public/images/atmosphere/` |

### 8.2 Format & sizes

- **Format:** WebP primary. JPEG fallback only if analytics show > 1%
  Safari < 14 traffic — almost certainly skip.
- **Quality:** 80–82 across the board (sweet spot for WebP).
- **Responsive variants:** 480w / 800w / 1200w / 1600w. Use `<picture>`
  with `srcset`.
- **Hero:** 1600w max, ~150 KB target.
- **Card:** 800w, ~50 KB target.
- **Lazy load:** every image below the fold gets `loading="lazy"
  decoding="async"`. The above-fold hero gets `fetchpriority="high"`.

### 8.3 Placeholder strategy

For card images, use a **dominant-color background** as the
`<img>` placeholder (CSS `background-color`) instead of BlurHash —
simpler, no library, and looks intentional with the warm palette. The
admin upload pipeline already extracts `image_url` thumbnails; extend
it to also store a 4-character dominant hex.

### 8.4 Licensing

- Unsplash license: free for commercial use, modification permitted, no
  attribution required.
- We will still publish a `/credits` page listing photographers as
  goodwill (and so an LGPD/transparency-conscious customer can see we
  source images cleanly).
- Admin product uploads are the customer's own content; they retain
  rights.

### 8.5 Files downloaded for this plan

The following starter set is committed to `customer/public/images/`:

```
hero/
  hero-pizza-overhead-1600.webp        landing main hero (day)
  hero-pizza-overhead-800.webp         srcset variant
  hero-oven-fire-1600.webp             evening hero variant
  hero-oven-fire-800.webp              srcset variant
  hero-margherita-1600.webp            menu page banner
  hero-slice-lifted-1600.webp          secondary hero, "como funciona"
backgrounds/
  wood-texture-1600.webp               subtle background, login & footer
  marble-cream-1600.webp               alt section background
  ingredients-flatlay-1600.webp        about / story section
fallbacks/
  pizza-default-{480,800}.webp         products with no admin photo
  drink-default-800.webp               beverages without photo
  dessert-default-800.webp             desserts without photo
atmosphere/
  dough-stretching-1200.webp           "como funciona" step image
  pizzeria-interior-1200.webp          about page / footer
  cheese-pull-800.webp                 menu page section divider
```

These are the design-time set — operators may swap them per pizzeria
later, but the file paths in code stay the same so the site never
breaks.

---

## 9. Accessibility

Non-negotiable. All five must hold before a milestone ships.

1. **Contrast.** Body text ≥ 4.5:1, large text ≥ 3:1, UI elements ≥ 3:1.
   Our defaults (charcoal on cream/offwhite) clear AAA; just don't
   regress.
2. **Touch targets.** ≥ 44×44; ≥ 48 for primary CTAs.
3. **Keyboard.** Every interactive element focusable in source order.
   Visible 2px focus ring (charcoal outline) — never `outline: none`.
4. **Semantic HTML.** Real `<button>` / `<a>` / `<nav>` / `<main>` /
   `<form>`. No `<div onClick>`.
5. **Screen reader.** Form labels associated, error messages tied via
   `aria-describedby`, cart updates announced via `aria-live="polite"`,
   route changes announced.

Specifically test with VoiceOver on iOS at least once per milestone —
that's where most real users with assistive tech will be.

---

## 10. Performance budget

Hard ceilings; PRs that breach them don't ship without a written
exception.

| Metric | Budget | Measured how |
|---|---|---|
| First Contentful Paint | < 1.8 s | Lighthouse mobile, 4G slow |
| Largest Contentful Paint | < 2.5 s | Lighthouse mobile, 4G slow |
| Time to Interactive | < 4.0 s | Lighthouse mobile |
| Initial JS bundle (gzipped) | ≤ 150 KB | `vite build --report` |
| Total transferred (menu page) | ≤ 1 MB | Chrome DevTools |
| Hero image | ≤ 150 KB | `du -k` after build |
| Product card image (800w) | ≤ 60 KB | spot check |
| Lighthouse mobile performance | ≥ 85 | weekly check post-launch |

Levers if we breach:

- Code-split routes (each non-menu page lazy-loaded).
- Drop unused Tailwind via JIT (already default in v3).
- Inline critical CSS for the menu route only.
- Move Framer Motion to lazy import — only the cart page uses it.

---

## 11. Brand consistency with the admin landing

The existing `Landing.jsx` page in `frontend/src/pages/` already
establishes Cream/Charcoal/Ovenred/Playfair Display as the public-facing
brand. The customer portal will:

- Use the same palette (`cream`, `offwhite`, `charcoal`, `ovenred`).
- Use the same display font (`Playfair Display`).
- Use the same primary CTA treatment.
- Link to and from the existing marketing pages where appropriate.

The admin SaaS palette (`primary` indigo, `violet`, etc.) is **not**
used on the customer portal. Customers should never see SaaS-pattern
UI; only operators do.

---

## 12. Open design questions

To resolve before M3 (menu page) lands. Each has a recommended default
in case we don't get an explicit decision.

1. **Hero copy.** "A pizza que você ama, agora em 1 minuto." vs
   something the pizzeria writes. Default: ship our copy, let pizzeria
   override later via a small admin field.
2. **Logo treatment.** Do we have a vector logo? If yes, use it. If no,
   use Playfair italicized pizzeria name as a wordmark — looks
   intentional, costs nothing.
3. **Favicon + PWA icon set.** Generate from logo at M8.
4. **Half-and-half UX.** Two-product picker modal vs. inline second
   panel? Default: modal — keeps the detail page coherent.
5. **Search on `/menu`.** MVP-worthy or M-something-later? Default:
   skip for M3, add when product count > 30.
6. **Dark mode.** Default: skip. Customer site is photo-heavy and warm;
   dark mode flips the mood. Revisit only if requested.

---

*Design here is final for the launch milestones. Page anatomies and
component specs are binding. Re-open this doc when something is
materially wrong, not when something is merely different from taste.*
