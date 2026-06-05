// Minimal ambient types for `n8ao` (no declarations ship with the package). We
// only need the post-pass ref to toggle `enabled` for tier gating in Effects.tsx.
// The package itself is a transitive dependency of @react-three/postprocessing.
declare module "n8ao" {
  import type { Pass } from "postprocessing";
  export class N8AOPostPass extends Pass {
    enabled: boolean;
    configuration: Record<string, unknown>;
    setQualityMode(mode: string): void;
  }
}
