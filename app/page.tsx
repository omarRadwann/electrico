import { Experience } from "@/src/experience/Experience";
import { ExperienceBoundary } from "@/src/ui/ExperienceBoundary";
import { ContactTerminal, TerminalCta, DiveAgainCta } from "@/src/ui/ContactTerminal";
import { AnalyticsBridge } from "@/src/ui/AnalyticsBridge";
import { contact } from "@/src/lib/contact";

/**
 * Landing route. The 3D dive (<Experience/>) is a fixed client island behind
 * this real, crawlable content (spec §3.5 — all company info must live as HTML,
 * never baked only into textures). This file stays a server component: the only
 * interactive bits (terminal/dive CTAs) are small client islands imported from
 * ContactTerminal.tsx. Narrative lines are verbatim from the brief (§7); the
 * tagline and contact destination are flagged placeholders.
 *
 * Conversion architecture (briefing §6): the terminal overlay is the conversion
 * surface, summoned from the hero CTA, the HUD's CONTACT tick, and the post-veil
 * landing below — the endless loop never has to be escaped by scroll alone.
 * ContactTerminal + AnalyticsBridge mount OUTSIDE the ExperienceBoundary so
 * conversion and telemetry survive a WebGL failure.
 *
 * Copy rule (owner constraint): capability-true only — delivery verbs and
 * standards language, NO invented projects, clients, certifications, or numbers.
 */
export default function Home() {
  return (
    <>
      <ExperienceBoundary>
        <Experience />
      </ExperienceBoundary>

      <main className="content" id="content">
        <section className="content-section">
          <p className="eyebrow">Power · Structure · Smart systems</p>
          <h1 className="brandmark">ELECTRICO</h1>
          {/* TODO(<<TAGLINE>>): provisional line derived from the brief's thesis (§1/§2) */}
          <p className="tagline">
            We light the city, raise its structures, make it think, and keep its
            current alive.
          </p>
          <TerminalCta className="cta">Start a project</TerminalCta>
        </section>

        {/* The six dive beats stay in the DOM as crawlable content + the scroll
            height the dive scrubs against, but their text is visually quiet
            (.content-section--beat) — the on-screen line is the camera-synced
            <Narrative/> overlay, so it can't drift out of sync with the HUD. */}
        <section className="content-section content-section--beat">
          <p className="eyebrow">01 — The City</p>
          <p className="narrative">We keep the city alive.</p>
        </section>
        <section className="content-section content-section--beat">
          <p className="eyebrow">02 — The Building</p>
          <p className="narrative">We raise the structures behind it.</p>
        </section>
        <section className="content-section content-section--beat">
          <p className="eyebrow">03 — The Frame</p>
          <p className="narrative">Bones engineered to last.</p>
        </section>
        <section className="content-section content-section--beat">
          <p className="eyebrow">04 — The Room</p>
          <p className="narrative">We make it think.</p>
        </section>
        <section className="content-section content-section--beat">
          <p className="eyebrow">05 — The Wiring</p>
          <p className="narrative">We install and maintain the nerves.</p>
        </section>
        <section className="content-section content-section--beat">
          <p className="eyebrow">06 — The Current</p>
          <p className="narrative">Energy, endlessly.</p>
        </section>

        <section className="content-section" id="services">
          <p className="eyebrow">What we do</p>
          {/* Real h2 — heading order is h1 (hero) → h2 (sections) → h3 (cards). */}
          <h2>Power, structure, and smart systems</h2>
          <ul className="services">
            {/* Each card: the poetic line, then ONE concrete capability
                sentence — what ELECTRICO delivers, in design/install/maintain
                language. Generic but true; no numbers, no invented facts. */}
            <li className="service">
              <h3>
                <span className="num">01</span>Power &amp; Lighting
              </h3>
              <p>
                From street-scale grids to the glow in a single window, we deliver
                and maintain the power that keeps spaces alive.
              </p>
              <p className="service-fact">
                We design, install and maintain power distribution and lighting
                circuits — standards-driven work, tested and documented before
                handover.
              </p>
            </li>
            <li className="service">
              <h3>
                <span className="num">02</span>Structures &amp; Build
              </h3>
              <p>
                We raise buildings and engineer the steel skeletons beneath them —
                bones built to last.
              </p>
              <p className="service-fact">
                We plan and execute structural and finishing works — steel,
                concrete and the trades around them — under one site supervision.
              </p>
            </li>
            <li className="service">
              <h3>
                <span className="num">03</span>Smart Home Systems
              </h3>
              <p>
                Lighting, climate, blinds and security that respond to the people
                inside. We make the home think.
              </p>
              <p className="service-fact">
                We specify, install and program lighting, climate, blind and
                security control — integrated systems commissioned room by room.
              </p>
            </li>
            <li className="service">
              <h3>
                <span className="num">04</span>Wiring &amp; Maintenance
              </h3>
              <p>
                The nervous system inside the wall: we install, inspect and
                maintain every conductor.
              </p>
              <p className="service-fact">
                We rough-in, terminate, label and test in-wall wiring, and keep
                installed systems serviced after handover.
              </p>
            </li>
          </ul>
        </section>

        {/* Post-veil landing — the readable resolved state for keyboard,
            skip-link and touch users (the endless loop is demoted to an
            explicit control here; the veil never reaches full black).
            tabIndex=-1 makes it a real focus target for the skip-link. */}
        <section className="content-section" id="contact" tabIndex={-1}>
          <p className="eyebrow">07 — Connect</p>
          <h2 className="contact-headline">The current never stops</h2>
          <p className="tagline">
            Tell us what you are building. We handle the power, the structure and
            the intelligence inside it.
          </p>
          <div className="cta-row">
            <TerminalCta className="cta">Start a project</TerminalCta>
            <DiveAgainCta className="cta cta--ghost">Dive again</DiveAgainCta>
          </div>
        </section>

        {/* Quiet trust footer — wordmark, the services line, a reachable email,
            the legal line. Owner-held facts (registration, address, phone) land
            here when supplied; nothing is invented meanwhile. */}
        <footer className="site-footer">
          <span className="site-footer-mark">ELECTRICO</span>
          <span>Power · Structure · Smart systems</span>
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
          <span>© 2026 ELECTRICO</span>
        </footer>
      </main>

      <ContactTerminal />
      <AnalyticsBridge />
    </>
  );
}
