# Custom Evolution API image — v2.2.3 + LID-aware send validator.
#
# Why this exists
# ---------------
# Modern WhatsApp routes 1:1 chats with `<id>@lid` JIDs (anonymised LIDs)
# instead of `@s.whatsapp.net` phone JIDs. Evolution v2.2.3's outbound send
# pipeline calls Baileys' onWhatsApp([jid]) to validate the recipient — that
# helper only looks up phones, so for LIDs it returns {exists: false} and the
# send is rejected with HTTP 400 before Baileys' relay even runs.
#
# Baileys 6.7.x itself can route to LIDs natively (the LID is the protocol's
# primary identifier). Only Evolution's wrapper validation is in the way.
# This image patches that single check: if the JID ends in `@lid`, treat it
# as existing. Everything else is unchanged.
#
# Update procedure
# ----------------
# When bumping the upstream tag, re-run `docker compose build evolution` —
# the RUN block will fail loudly if the regex pattern no longer matches,
# which is the signal that Evolution rewrote the validator and we need to
# re-derive the patch.
FROM atendai/evolution-api:v2.2.3

RUN node -e "\
  const fs = require('fs'); \
  const p = '/evolution/dist/api/services/channel.service.js'; \
  const src = fs.readFileSync(p, 'utf8'); \
  const out = src.replace( \
    /exists:!!g\?\.exists,jid:h,/g, \
    'exists:(typeof h===\"string\"&&h.endsWith(\"@lid\")?true:!!g?.exists),jid:h,' \
  ); \
  if (out === src) { \
    console.error('LID-bypass patch did NOT apply — vendor minifier output changed.'); \
    process.exit(1); \
  } \
  fs.writeFileSync(p, out); \
  console.log('LID-bypass patch applied to channel.service.js'); \
"
