"use client";

import { Component, type ReactNode } from "react";

/**
 * Robustness net around the 3D dive. If WebGL is unavailable or the renderer/shaders
 * throw, we drop the experience instead of crashing the page — the real, crawlable
 * company content (the <main> sibling in page.tsx) keeps rendering on the night
 * background, so the site degrades gracefully on weak/old/headless environments.
 */
export class ExperienceBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // The fixed canvas overlay is gone — flip the document into its "poster
    // edition": html.no-3d (globals.css) restores the beat copy and collapses
    // the 100svh beat sections to natural height, so the visitor reads designed
    // content instead of six blank screens. Mirrored for no-JS by the
    // <noscript> style in layout.tsx. componentDidCatch only runs client-side,
    // so the document write is safe.
    document.documentElement.classList.add("no-3d");
    if (process.env.NODE_ENV !== "production") {
      console.warn("[ELECTRICO] 3D experience disabled (rendering content only):", error);
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
