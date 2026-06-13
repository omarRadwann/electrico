/**
 * ═════════════════════════════════════════════════════════════════════════════
 * ELECTRICO CONTACT CONFIG — the single source of truth for every inbound
 * channel on the site. Conversion surfaces (ContactTerminal, page footer,
 * layout JSON-LD) read ONLY this object — never hardcode a destination.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * HOW TO GO LIVE (owner action — Owner-Input Manifest items #1/#2):
 *
 *   whatsapp : the company WhatsApp number in full international form, e.g.
 *              "+20 100 123 4567" (formatting is fine — non-digits are
 *              stripped before building the wa.me link).
 *              WHILE NULL, NO WHATSAPP BUTTON RENDERS ANYWHERE — channels hide
 *              until configured; a dead link must never ship.
 *
 *   phone    : a dialable number for `tel:` links, e.g. "+201001234567".
 *              WHILE NULL, NO CALL BUTTON RENDERS ANYWHERE.
 *
 *   email    : ⚠ FLAGGED PLACEHOLDER — this is the <<CONTACT_DESTINATION>>
 *              placeholder from CLAUDE.md; the electrico.eg domain is NOT
 *              owned yet. Replace with a real, monitored inbox the moment the
 *              owner supplies one. It ships (unlike whatsapp/phone) because
 *              mailto is the floor channel and it degrades visibly — the
 *              address is shown as selectable text, never a silent dead end.
 *
 * DO NOT invent numbers, domains, or handles here under any circumstances.
 */
export const contact = {
  /** WhatsApp number (international). null = WhatsApp hidden site-wide. */
  whatsapp: null as string | null,
  /** Phone number for tel: links. null = call button hidden site-wide. */
  phone: null as string | null,
  /** Inbound email — flagged placeholder, see the block comment above. */
  email: "hello@electrico.eg",
  /**
   * Pre-filled WhatsApp message. The terminal passes the visitor's selected
   * service phrase (preselected from the dimension they summoned it from), so
   * the lead arrives pre-qualified by the dive itself.
   */
  whatsappMessage: (service: string): string =>
    `Hello ELECTRICO — I just took the dive on your site. I'd like to talk about ${service} for a project.`,
};
