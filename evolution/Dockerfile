# Custom Evolution API image — v2.2.3 + LID-aware send validator.
#
# Why this exists
# ---------------
# Modern WhatsApp routes 1:1 chats with `<id>@lid` JIDs (anonymised LIDs)
# instead of `@s.whatsapp.net` phone JIDs. Evolution v2.2.3's outbound send
# pipeline validates the recipient via Baileys' onWhatsApp([jid]); that
# helper only looks up phone numbers, so for an LID it returns
# {exists: false} and the send is rejected with HTTP 400 before Baileys'
# relay (which itself routes LIDs natively) is even reached.
#
# patch.js (next to this Dockerfile) edits two minified-JS sites in
# channel.service.js to teach the validator and the per-send guard to
# treat `@lid` JIDs as existing. The patcher fails the build if its
# regexes no longer match — which is the signal that an Evolution bump
# rewrote the bundle and we need to re-derive the patch.
#
# Update procedure
# ----------------
# When bumping the upstream tag, run `docker compose build evolution`. If
# the patch script aborts, inspect the new bundle (`docker run --rm
# atendai/evolution-api:<tag> cat /evolution/dist/api/services/channel.service.js`)
# and adjust patch.js's regex shapes.
FROM atendai/evolution-api:v2.2.3

COPY patch.js /tmp/patch.js
RUN node /tmp/patch.js && rm /tmp/patch.js
