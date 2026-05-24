# Datacaixa Integration — research from the official help center

Crawled 2026-05-21 from https://www.datacaixa.com.br/ajuda/ and subpages.
Captures every technical fact Datacaixa publishes about the
chatbot/PDV connection plus our strategic options.

---

## What I confirmed from the official docs

1. **Datacaixa sells its own Chatbot product.** It is a separate
   purchase from Datacaixa PDV. It is a full WhatsApp ordering bot with
   product registration, complement management, delivery zones, pizza
   pricing, payment methods, etc. — essentially a direct competitor to
   the bot we built. See `https://www.datacaixa.com.br/ajuda/chatbot/`.

2. **The PDV has a dedicated "Chatbot integration" toggle**, documented
   in two articles:
   - `https://www.datacaixa.com.br/ajuda/pdv/pdv-integracao/como-integrar-o-chatbot-no-pdv/`
   - `https://www.datacaixa.com.br/ajuda/pdv/pdv-integracao/como-ativar-a-integracao-de-pedidos-em-uma-estacao-do-pdv/`

   The toggle lives at **Menu Gerencial → Configurações →
   Integração tab → iFood/Chatbot subtab**. To activate, enable:
   - "Habilitar Integração com Chatbot"
   - "Iniciar Serviço com o Windows"
   - "Utilizar esse PDV como Modo Estação"
   - Select a user to receive orders

3. **There is NO publicly documented file format, folder path, REST
   endpoint, webhook, or authentication token** for the chatbot-PDV
   connection. Every help article describes the UI; none describes the
   wire protocol. This information is either proprietary, sold under a
   separate ISV agreement, or only shared with Datacaixa's own chatbot
   product.

4. **No mention of `C:\Datacaixa\Integracao\Pedidos` anywhere on the
   help center.** The folder our bridge writes to was either an older
   spec since deprecated, or never the official channel — likely the
   former, given Gabriel originally confirmed it.

5. **Support channel:** WhatsApp **(11) 98620-5451**, atendimento
   8h-22h todos os dias. There is no email, ticket portal, or chat
   on the website. The Ouvidoria (`/ouvidoria/`) is for escalation
   only when regular support doesn't resolve.

---

## What this means for our bot

The bridge has been writing files in a format that — based on every
public Datacaixa document — has no documented receiver. The PDV's
current integration listens for orders from Datacaixa's own Chatbot
(via a private protocol) and from iFood (via iFood's published API).
There is no documented third-party slot.

**This was not a regression on our side.** Whoever set up the original
bridge with Gabriel either built against a deprecated spec, or had a
private arrangement with Datacaixa that needs to be re-established.

---

## Strategic options, ranked

### Option A — Get the private protocol from Datacaixa (recommended)
Send the message in `datacaixa_support_message.md` to **(11) 98620-5451**.
The binary question forces them to choose between:
1. Telling us how to configure the existing file-folder channel (path
   1) — they confirm the format and we adjust the bridge as needed.
2. Giving us their official API / ISV agreement (path 2) — typically
   a paid partner program, but legitimate.

This is the official path and worth pursuing first. Time cost: 1-3
days of support back-and-forth.

### Option B — Use Datacaixa's own Chatbot as a relay
Pay for Datacaixa Chatbot, register the same menu in it, and have
our AI bot programmatically submit orders to it (via WhatsApp number
forwarding, REST scraping, or whatever entry point it exposes). Their
Chatbot then forwards to PDV via its supported channel.

Pros: works without official ISV approval, keeps our AI front-end.
Cons: brittle, requires duplicate menu management, monthly cost for
the Chatbot product, possibly violates Datacaixa's terms if they
detect automated input.

### Option C — Direct Firebird database insertion
Connect to `localhost:3050/C:\Datacaixa\BD\BANCO.FDB` from the bridge
and INSERT orders directly into the PDV's database tables. Requires
reverse-engineering the schema (PEDIDOS, ITENS, etc.) and risks
breaking on every Datacaixa update.

Pros: bypasses every integration layer.
Cons: completely unsupported, fragile under upgrades, no fiscal
audit trail.

### Option D — Switch entirely to Datacaixa Chatbot
Disable our bot, configure their Chatbot, accept the loss of the AI
features (intent recognition, free-form conversation, dynamic pricing
logic, etc.). Operations team manages everything through Datacaixa's
unified surface.

Pros: zero integration work, fully supported.
Cons: customer experience downgrade, all the development work we
invested becomes obsolete.

### Option E — Operator-mediated bridge (current fallback)
Bot collects the order, sends a print summary to the kitchen plus
an admin alert. Operator re-types the order into Datacaixa via
"Criar Novo" on the Delivery tab. Manual but unblocks today.

Pros: zero risk, zero new dependency.
Cons: ongoing labor cost, error-prone, doesn't scale.

---

## Public URLs that were useful

- Help index: https://www.datacaixa.com.br/ajuda/
- PDV help: https://www.datacaixa.com.br/ajuda/pdv/
- Activate integration: https://www.datacaixa.com.br/ajuda/pdv/pdv-integracao/como-ativar-a-integracao-de-pedidos-em-uma-estacao-do-pdv/
- Integrate Chatbot: https://www.datacaixa.com.br/ajuda/pdv/pdv-integracao/como-integrar-o-chatbot-no-pdv/
- iFood troubleshooting (similar pattern): https://www.datacaixa.com.br/ajuda/pdv/pdv-problemas-solucoes/como-importar-um-pedido-ifood-que-nao-aparece-no-pdv/
- Chatbot product docs: https://www.datacaixa.com.br/ajuda/chatbot/
- Cardápio Digital docs: https://www.datacaixa.com.br/ajuda/cardapio-digital/
- YouTube tutorials: https://www.youtube.com/@Datacaixa/videos
- Ouvidoria (escalation): https://www.datacaixa.com.br/ouvidoria/

---

## Recommended next action

Send the message in `datacaixa_support_message.md` to
**(11) 98620-5451** today between 8h and 22h. Until they respond,
fall back to Option E (operator re-types orders) so customers continue
to be served.

Once Datacaixa responds with path 1 or path 2, that answer determines
the next code change — and the diff stays bounded to
`backend/app/services/datacaixa.py` and `bridge/bridge_service.py`.
