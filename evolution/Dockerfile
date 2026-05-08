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
  let s = fs.readFileSync(p, 'utf8'); \
  let count = 0; \
  /* Patch 1: whatsappNumber() return value — make existence check pass for @lid. */ \
  let p1 = s.replace( \
    /exists:!!g\?\.exists,jid:h,/g, \
    'exists:(typeof h===\"string\"&&h.endsWith(\"@lid\")?true:!!g?.exists),jid:h,' \
  ); \
  if (p1 !== s) { count++; s = p1; } \
  /* Patch 2: every send-side guard \`if (!n.exists && !isJidGroup && !@broadcast) throw\`. \
     Add an @lid escape so Baileys' relay layer is reached for LID recipients. \
     Multiple call sites (sendText, sendMedia, sendButtons, etc.) share this idiom. */ \
  let p2 = s.replace( \
    /\.jid\.includes\(\"@broadcast\"\)\)\s*throw new f\(/g, \
    '.jid.includes(\"@broadcast\")&&!n.jid.includes(\"@lid\")&&!s.jid.includes(\"@lid\"))throw new f(' \
  ); \
  /* The above won't match every site because variable names vary (n vs s). Use a more \
     surgical regex on the specific minified shape: `!n.jid.includes(\"@broadcast\"))throw` \
     and `!s.jid.includes(\"@broadcast\"))throw`. */ \
  s = p1; \
  let p3a = s.replace( \
    /!n\.jid\.includes\(\"@broadcast\"\)\)throw new f\(n\)/g, \
    '!n.jid.includes(\"@broadcast\")&&!n.jid.endsWith(\"@lid\"))throw new f(n)' \
  ); \
  if (p3a !== s) { count++; s = p3a; } \
  let p3b = s.replace( \
    /!s\.jid\.includes\(\"@broadcast\"\)\)throw new f\(s\)/g, \
    '!s.jid.includes(\"@broadcast\")&&!s.jid.endsWith(\"@lid\"))throw new f(s)' \
  ); \
  if (p3b !== s) { count++; s = p3b; } \
  if (count < 2) { \
    console.error('LID-bypass patch incomplete: applied=' + count + ' (expected >=2). Vendor output changed?'); \
    process.exit(1); \
  } \
  fs.writeFileSync(p, s); \
  console.log('LID-bypass patch applied:', count, 'sites'); \
"
