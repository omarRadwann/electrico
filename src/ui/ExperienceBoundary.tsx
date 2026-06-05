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
    if (process.env.NODE_ENV !== "production") {
      console.warn("[ELECTRICO] 3D experience disabled (rendering content only):", error);
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
