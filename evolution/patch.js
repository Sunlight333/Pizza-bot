#!/usr/bin/env node
// LID-bypass patch for Evolution v2.2.3.
//
// What's broken upstream
// ----------------------
// Modern WhatsApp routes 1:1 chats with `<id>@lid` JIDs (anonymised LIDs)
// instead of `@s.whatsapp.net` phone JIDs. Evolution v2.2.3's send pipeline
// validates the recipient via Baileys' onWhatsApp([jid]); that helper only
// looks up phone numbers, so for LIDs it returns {exists: false}, and
// Evolution then throws 400 before Baileys' relay (which DOES support LIDs)
// is reached.
//
// Two patches
// -----------
// 1. The result-builder in whatsappNumber(): force `exists: true` for any
//    JID ending in `@lid`. Makes the result object look "OK".
// 2. The per-send guard `if (!n.exists && !isJidGroup && !@broadcast) throw`
//    appearing at every call site (sendText, sendMedia, sendButtons, ...):
//    add `&& !n.jid.endsWith("@lid")` so we never throw on LID recipients
//    even if the cache layer reset .exists in between.
//
// The script fails (exit 1) if fewer patches apply than expected, which is
// the signal that an Evolution bump rewrote the minified bundle and we need
// to re-derive these regexes.

const fs = require('fs');

// Evolution's `package.json` points `main` at `dist/main.js`, which bundles
// in the validator code. The same minified code is duplicated into
// channel.service.js + server.module.js via the build pipeline. Patching
// only the source files leaves dist/main.js untouched and the runtime
// behaviour unchanged.
const targets = [
  '/evolution/dist/main.js',
  '/evolution/dist/api/services/channel.service.js',
  '/evolution/dist/api/server.module.js',
];

let total = 0;
for (const path of targets) {
  if (!fs.existsSync(path)) {
    console.error(`MISSING: ${path}`);
    process.exit(1);
  }
  console.log(`-- patching ${path} --`);
  let s = fs.readFileSync(path, 'utf8');
  total += patchFile(s, path);
}

// Each file should yield ≥1 result-builder + ≥1 send-guard (=2 patches min).
// Threshold = 6 across the three target files.
if (total < 6) {
  console.error(`FATAL: only ${total} patch(es) applied (expected >= 6). Vendor bundle changed?`);
  process.exit(1);
}
console.log(`LID-bypass patch complete — ${total} site(s) modified across ${targets.length} files.`);

function patchFile(s, path) {
  let count = 0;

  // Patch 1 — result-builder
  {
    const pat = /exists:!!g\?\.exists,jid:h,/g;
    const replaced = s.replace(
      pat,
      'exists:(typeof h==="string"&&h.endsWith("@lid")?true:!!g?.exists),jid:h,',
    );
    const n = (s.match(pat) || []).length;
    if (n) { s = replaced; count += n; }
    console.log(`  patch1 (whatsappNumber result-builder): ${n} site(s)`);
  }

  // Patch 2 — per-send throw guard. Variable names in the minified bundle
  // are inconsistent (n / s / etc.); patch each form we observe.
  for (const v of ['n', 's', 'r', 'l', 'd']) {
    const pat = new RegExp(
      `!${v}\\.jid\\.includes\\("@broadcast"\\)\\)throw new f\\(${v}\\)`,
      'g',
    );
    const replaced = s.replace(
      pat,
      `!${v}.jid.includes("@broadcast")&&!${v}.jid.endsWith("@lid"))throw new f(${v})`,
    );
    const n = (s.match(pat) || []).length;
    if (n) { s = replaced; count += n; }
    if (n) console.log(`  patch2 (send-guard, var=${v}): ${n} site(s)`);
  }

  if (count < 2) {
    console.error(`  FATAL: only ${count} patch(es) applied to ${path}.`);
    process.exit(1);
  }

  fs.writeFileSync(path, s);
  console.log(`  -> wrote ${count} patches to ${path}`);
  return count;
}
