/**
 * Shared rendering helpers for customer identity in the panel.
 *
 * Modern WhatsApp routes 1:1 chats with `<id>@lid` JIDs (privacy protocol).
 * The real phone is never delivered, and Evolution v2.2.x has no
 * LID-to-phone mapping, so the LID is the only stable identifier we
 * have. These helpers turn that into something an operator can read at
 * a glance: pushName when known, otherwise `Anônimo · #<last-6>`.
 *
 * Use them ANYWHERE the panel surfaces a customer phone or name —
 * conversation list, chat header, customers grid, live order feed,
 * orders table, global search. Keeping the formatting in one place
 * means a future Evolution upgrade that resolves LIDs only needs to
 * touch this file.
 */

const isLid = (s) => typeof s === 'string' && s.endsWith('@lid')

/**
 * Friendly version of a stored phone JID.
 *  - Real phone (`5517991050473`)        → unchanged
 *  - LID (`190374526083207@lid`)         → `Anônimo · #526083`
 *  - Empty / null                         → ''
 */
export function friendlyPhone(phone) {
  if (!phone) return ''
  if (!isLid(phone)) return phone
  const id = phone.slice(0, -4) // strip "@lid"
  const tail = id.length > 6 ? id.slice(-6) : id
  return `Anônimo · #${tail}`
}

/**
 * Best-effort customer label: prefer the captured name (pushName /
 * operator-set), fall back to the friendly phone. Useful for primary
 * fields ("who is this customer") in lists and headers.
 */
export function displayName(name, phone) {
  if (name && name.trim()) return name.trim()
  return friendlyPhone(phone)
}

/** True if the JID is an anonymised LID — useful for showing a tag. */
export function isAnonymousPhone(phone) {
  return isLid(phone)
}
