import { Experience } from "@/src/experience/Experience";
import { ExperienceBoundary } from "@/src/ui/ExperienceBoundary";

/**
 * Landing route. The 3D dive (<Experience/>) is a fixed client island behind
 * this real, crawlable content (spec §3.5 — all company info must live as HTML,
 * never baked only into textures). The visual treatment of these overlays is
 * refined in M5/M6; for now they also supply the scroll height the dive scrubs
 * against. Narrative lines are verbatim from the brief (§7); the tagline and
 * contact destination are flagged placeholders.
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
          <ul className="services">
            <li className="service">
              <h3>
                <span className="num">01</span>Power &amp; Lighting
              </h3>
              <p>
                From street-scale grids to the glow in a single window, we deliver
                and maintain the power that keeps spaces alive.
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
            </li>
            <li className="service">
              <h3>
                <span className="num">03</span>Smart Home Systems
              </h3>
              <p>
                Lighting, climate, blinds and security that respond to the people
                inside. We make the home think.
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
            </li>
          </ul>
        </section>

        <section className="content-section" id="contact">
          <p className="eyebrow">Get in touch</p>
          <h2>Start a project</h2>
          <p className="tagline">
            Tell us what you are building. We handle the power, the structure and
            the intelligence inside it.
          </p>
          {/* TODO(<<CONTACT_DESTINATION>>): wire real submission (form/CRM) in M6 */}
          <a className="cta" href="mailto:hello@electrico.eg">
            Contact ELECTRICO
          </a>
        </section>
      </main>
    </>
  );
}
