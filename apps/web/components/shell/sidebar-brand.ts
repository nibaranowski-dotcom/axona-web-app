// SIDEBAR.1 — the sidebar-header co-branding decision, as a PURE function so the two
// INDEPENDENT flags are unit-testable and can never be collapsed into one boolean.
//
// Flag 1 — co-branding (driven by logoUrl presence): a customer logo tile + customer
//   name own the switcher slot; else the Axona square + "Axona".
// Flag 2 — the ON AXONA microlabel (its own boolean): only meaningful when co-branded;
//   turning it OFF must NOT remove the logo (showLogo stays driven by co-branding).

export interface OrgBrand {
  name: string;
  /** Resolved from Org.logoKey → FILE.1 blob (nullable). Presence = State A/B switch. */
  logoUrl: string | null;
  /** Flag 2 — render the ON AXONA microlabel. Independent of the logo; defaults on. */
  showMicrolabel?: boolean;
}

export interface ResolvedBrand {
  /** Flag 1 — a customer logo tile renders (co-branding is on). */
  coBranded: boolean;
  /** No customer logo: the Axona square carries the switcher row itself (State A). */
  axonaOnly: boolean;
  /** Render the customer logo <img> in the switcher slot. Driven ONLY by co-branding. */
  showLogo: boolean;
  /** Flag 2 — render the ON AXONA microlabel (co-branded AND showMicrolabel). */
  showMicrolabel: boolean;
  /** The switcher-row display name ("Axona" in State A; the customer name in State B). */
  displayName: string;
  logoUrl: string | null;
  /** The customer name — used as the logo <img> alt. */
  alt: string;
}

export function resolveSidebarBrand(org?: OrgBrand | null): ResolvedBrand {
  const coBranded = !!org?.logoUrl;
  return {
    coBranded,
    axonaOnly: !coBranded,
    // showLogo is driven ONLY by co-branding — never by the microlabel flag.
    showLogo: coBranded,
    // the microlabel is its own flag; it exists only when co-branded, defaults on.
    showMicrolabel: coBranded && (org?.showMicrolabel ?? true),
    displayName: coBranded ? (org?.name ?? "Axona") : "Axona",
    logoUrl: org?.logoUrl ?? null,
    alt: org?.name ?? "Axona",
  };
}
