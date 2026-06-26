/**
 * @axona/config — shared workspace configuration + design-token mapping.
 *
 * Holds the shared TypeScript base (`tsconfig/base.json`), the design tokens
 * (`styles/tokens.css` — the single source of truth), and their Tailwind theme
 * mapping (`src/tailwind.ts`). ESLint preset is wired in FND.4.
 */
export const CONFIG_PACKAGE = "@axona/config" as const;

export {
  axonaColors,
  axonaFontFamily,
  axonaBorderRadius,
  axonaTransitionTimingFunction,
} from "./tailwind";
