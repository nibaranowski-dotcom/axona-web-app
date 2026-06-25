/**
 * @axona/config — shared workspace configuration.
 *
 * Holds the shared TypeScript base (`tsconfig/base.json`) and ESLint preset
 * (wired in FND.4). Design tokens (`tokens.css`) + the Tailwind preset land in
 * FND.2 and are consumed by `apps/web`.
 */
export const CONFIG_PACKAGE = "@axona/config" as const;
