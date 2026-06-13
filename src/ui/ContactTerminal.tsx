"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useExperience, scrollToProgress } from "@/src/store/useExperience";
import { contact } from "@/src/lib/contact";
import { track } from "@/src/lib/analytics";

/**
 * THE conversion surface — a diegetic full-screen "control room" console,
 * summoned via store `terminalOpen`, never scrolled to (briefing §6: conversion
 * moves OUT of the scroll spine so the endless loop can stay pure spectacle).
 * It renders ABOVE the loop veil (z-60 vs the veil's 40), so every input
 * modality reaches a working CTA from any progress — including parked on the
 * wrap seam, the exact spot that stranded mobile visitors.
 *
 * Channel discipline (owner constraint, confirmed): WhatsApp / tel buttons
 * render ONLY when configured in src/lib/contact.ts — no dead links ship.
 * mailto (the flagged-placeholder email) is the always-present floor channel,
 * doubled as selectable text + click-to-copy. The service selector defaults
 * from the dimension the visitor summoned the terminal from — the dive itself
 * pre-qualifies the lead.
 */

type ServiceKey = "power" | "structure" | "smart";

interface ServiceDef {
  /** Selector button copy (uppercased by CSS, HUD-style). */
  label: string;
  /** Brand category colour — amber=power, steel=structure, teal=smart. */
  color: string;
  /** Specific-verb action line (briefing §6.4 — never a generic "Contact us"). */
  action: string;
  /** Human phrase injected into the WhatsApp message / mailto subject. */
  phrase: string;
}

const SERVICES: Record<ServiceKey, ServiceDef> = {
  power: {
    label: "Power",
    color: "#e8a23d",
    action: "Get a wiring assessment",
    phrase: "power & wiring",
  },
  structure: {
    label: "Structure",
    color: "#8a94a6",
    action: "Book a site visit",
    phrase: "structural works",
  },
  smart: {
    label: "Smart systems",
    color: "#43d0c4",
    action: "Plan your smart home",
    phrase: "smart home systems",
  },
};

const SERVICE_KEYS = Object.keys(SERVICES) as ServiceKey[];

/** dimension index → preselected service (0,4,5 → power · 1,2 → structure · 3 → smart). */
const DIMENSION_SERVICE: ServiceKey[] = [
  "power", // 0 The City — power & light
  "structure", // 1 The Building
  "structure", // 2 The Frame
  "smart", // 3 The Room
  "power", // 4 The Wiring
  "power", // 5 The Current
];

export function ContactTerminal() {
  const open = useExperience((s) => s.terminalOpen);
  // The dialog mounts fresh on every summon — its open-time state (preselected
  // service, copied flag, focus capture) initializes at mount instead of via
  // effect-driven setState (react-hooks/set-state-in-effect).
  return open ? <TerminalDialog /> : null;
}

function TerminalDialog() {
  const setTerminalOpen = useExperience((s) => s.setTerminalOpen);
  // Preselect the service from the dimension the visitor summoned the terminal
  // in (read once via getState — never subscribe UI to progress-adjacent
  // values): the dive pre-qualifies the lead.
  const [service, setService] = useState<ServiceKey>(
    () => DIMENSION_SERVICE[useExperience.getState().dimension] ?? "power",
  );
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef(0);

  const close = useCallback(() => setTerminalOpen(false), [setTerminalOpen]);

  // Focus moves into the panel on mount and returns to the opener on unmount.
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => opener?.focus();
  }, []);

  // ESC closes from anywhere — document-level, since focus may sit on any
  // control inside the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const def = SERVICES[service];
  // wa.me accepts digits only — strip any formatting from the config value.
  const waDigits = contact.whatsapp ? contact.whatsapp.replace(/\D/g, "") : null;
  const waHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(contact.whatsappMessage(def.phrase))}`
    : null;
  const mailHref = `mailto:${contact.email}?subject=${encodeURIComponent(
    `ELECTRICO — ${def.phrase} inquiry`,
  )}`;

  // mousedown (not click) so a text-selection drag that ends over the backdrop
  // doesn't dismiss the panel mid-copy.
  const onBackdrop = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) close();
  };

  // Minimal focus trap: Tab wraps inside the dialog (aria-modal promises it;
  // the dive's HUD must be unreachable while the console is up).
  const trapTab = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const copyEmail = () => {
    // No clipboard API (http / old engines): the address is selectable text,
    // so the channel still works — the button is an accelerator, not the path.
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard
      .writeText(contact.email)
      .then(() => {
        setCopied(true);
        window.clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <div className="terminal" onMouseDown={onBackdrop}>
      <div
        className="terminal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terminal-title"
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={trapTab}
        data-lenis-prevent
      >
        <button
          type="button"
          className="terminal-close"
          onClick={close}
          aria-label="Close contact terminal"
        >
          ✕
        </button>

        <p className="terminal-eyebrow">07 — Connect</p>
        <h2 className="terminal-title" id="terminal-title">
          Start a project
        </h2>

        <p className="terminal-label" id="terminal-service-label">
          Service
        </p>
        <div
          className="terminal-services"
          role="group"
          aria-labelledby="terminal-service-label"
        >
          {SERVICE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className="terminal-service"
              aria-pressed={key === service}
              style={{ ["--sc"]: SERVICES[key].color } as CSSProperties}
              onClick={() => setService(key)}
            >
              {SERVICES[key].label}
            </button>
          ))}
        </div>

        <p className="terminal-action" style={{ ["--sc"]: def.color } as CSSProperties}>
          {def.action}
        </p>

        <div className="terminal-channels">
          {/* Channels hide until configured (src/lib/contact.ts) — no dead links. */}
          {waHref && (
            <a
              className="terminal-channel terminal-channel--primary"
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("cta-whatsapp", { service })}
            >
              WhatsApp us
            </a>
          )}
          {contact.phone && (
            <a
              className="terminal-channel"
              href={`tel:${contact.phone}`}
              onClick={() => track("cta-tel", { service })}
            >
              Call us
            </a>
          )}
          <a
            className="terminal-channel"
            href={mailHref}
            onClick={() => track("cta-email", { service })}
          >
            Email us
          </a>
        </div>

        <div className="terminal-email-row">
          <span className="terminal-email">{contact.email}</span>
          <button
            type="button"
            className="terminal-copy"
            onClick={copyEmail}
            aria-live="polite"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <button
          type="button"
          className="terminal-dive"
          onClick={() => {
            track("dive-again", { from: "terminal" });
            // Immediate: the snap to p=0 happens behind the closing overlay,
            // so the restart reads as a cut — not a long reverse fly.
            scrollToProgress(0, true);
            close();
          }}
        >
          Dive again
        </button>
      </div>
    </div>
  );
}

/**
 * Landing/hero CTA that summons the terminal. Lives here (not in page.tsx) so
 * the page stays a server component with fully crawlable HTML — these two
 * small controls are the only client islands the content layer needs.
 */
export function TerminalCta({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const setTerminalOpen = useExperience((s) => s.setTerminalOpen);
  return (
    <button type="button" className={className} onClick={() => setTerminalOpen(true)}>
      {children}
    </button>
  );
}

/** Post-veil landing control: restart the dive (smooth — the rewind is visible
 * and intentional here, unlike the terminal's behind-the-overlay cut). */
export function DiveAgainCta({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        track("dive-again", { from: "landing" });
        scrollToProgress(0);
      }}
    >
      {children}
    </button>
  );
}
