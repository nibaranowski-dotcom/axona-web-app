"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Plug,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { SettingsShell } from "@/components/settings/SettingsShell";
import type {
  IntegrationRow,
  ApiKeyRow,
  SsoConfigView,
} from "@/lib/integrations";
import {
  setIntegrationStatus,
  createApiKey,
  revokeApiKey,
  updateSsoConfig,
  type IntegrationsActionResult,
} from "@/app/(shell)/settings/integrations/actions";

// SET.5 — Integrations, SSO & API keys (1:1 with Settings - Integrations.dc.html):
// the connect-card grid (stubbed), the SSO config form (config-only), and the API
// keys table (create shows the key ONCE, list masked, revoke). ADMIN writes;
// non-ADMIN read-only. ERROR renders in ink (no invented reds). v2 tokens.
const STATUS_META = {
  CONNECTED: { label: "Connected", dot: "bg-success", fg: "text-ink" },
  NOT_CONNECTED: {
    label: "Not connected",
    dot: "bg-line-strong",
    fg: "text-ink-muted",
  },
  ERROR: { label: "Error", dot: "bg-ink-strong", fg: "text-ink" },
} as const;

export function IntegrationsView({
  integrations,
  apiKeys,
  sso,
  isAdmin,
}: {
  integrations: IntegrationRow[];
  apiKeys: ApiKeyRow[];
  sso: SsoConfigView;
  isAdmin: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<IntegrationsActionResult>, okMsg: string) =>
    startTransition(async () => {
      const res = await fn();
      setNotice(res.ok ? okMsg : (res.message ?? "Something went wrong."));
    });

  return (
    <SettingsShell eyebrow="Settings" title="Integrations" adminOnly={isAdmin}>
      <div className="mx-auto flex max-w-[860px] flex-col gap-[18px] px-8 py-7">
        {notice && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-card border border-line-strong bg-panel px-3.5 py-2.5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            <span className="text-[12.5px] font-medium text-ink">{notice}</span>
          </div>
        )}

        {/* integrations grid */}
        <section>
          <div className="mb-3">
            <h2 className="text-[15px] font-semibold text-ink">
              Connected systems
            </h2>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              Ingest sources + notify channels. Live connectors land with CONN.1
              — connect is a preview here.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {integrations.map((i) => {
              const s = STATUS_META[i.status];
              const connected = i.status === "CONNECTED";
              return (
                <div
                  key={i.kind}
                  className="flex flex-col rounded-card border border-line bg-paper p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-panel-2 text-ink-muted">
                        {i.status === "ERROR" ? (
                          <TriangleAlert
                            className="h-4 w-4"
                            strokeWidth={1.9}
                            aria-hidden
                          />
                        ) : (
                          <Plug
                            className="h-4 w-4"
                            strokeWidth={1.9}
                            aria-hidden
                          />
                        )}
                      </span>
                      <div>
                        <div className="text-[13.5px] font-semibold text-ink">
                          {i.name}
                        </div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
                          {i.category}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11.5px] ${s.fg}`}
                    >
                      <span
                        aria-hidden
                        className={`h-1.5 w-1.5 rounded-full ${s.dot}`}
                      />
                      {s.label}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[12px] leading-[1.45] text-ink-muted">
                    {i.description}
                  </p>
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            setIntegrationStatus(
                              i.kind,
                              connected ? "NOT_CONNECTED" : "CONNECTED",
                            ),
                          connected
                            ? `${i.name} disconnected.`
                            : `${i.name} connected (preview).`,
                        )
                      }
                      className="mt-3 self-start rounded-btn border border-line-strong bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {connected ? "Disconnect" : "Connect"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <SsoSection sso={sso} isAdmin={isAdmin} pending={pending} run={run} />

        <ApiKeysSection
          apiKeys={apiKeys}
          isAdmin={isAdmin}
          setNotice={setNotice}
        />
      </div>
    </SettingsShell>
  );
}

function SsoSection({
  sso,
  isAdmin,
  pending,
  run,
}: {
  sso: SsoConfigView;
  isAdmin: boolean;
  pending: boolean;
  run: (fn: () => Promise<IntegrationsActionResult>, okMsg: string) => void;
}) {
  const [provider, setProvider] = useState(sso.provider ?? "");
  const [metadata, setMetadata] = useState(sso.idpMetadata ?? "");
  const [enforce, setEnforce] = useState(sso.enforce);

  return (
    <section className="rounded-card border border-line bg-paper p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">SSO / SAML</h2>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Config-only — live SAML sign-in lands with AUTH.2.
          </p>
        </div>
        <span className="rounded-[6px] border border-line-strong px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
          Preview
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-3.5">
        <div>
          <label
            htmlFor="sso-provider"
            className="mb-1.5 block text-[12px] font-semibold text-ink"
          >
            Identity provider
          </label>
          <input
            id="sso-provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            disabled={!isAdmin}
            placeholder="Okta · Azure AD · Google Workspace"
            className="w-full rounded-[9px] border border-line-strong bg-panel px-[13px] py-2.5 text-[13.5px] text-ink outline-none focus-visible:border-ink-strong focus-visible:ring-[3px] focus-visible:ring-accent disabled:opacity-70"
          />
        </div>
        <div>
          <label
            htmlFor="sso-acs"
            className="mb-1.5 block text-[12px] font-semibold text-ink"
          >
            ACS URL (read-only)
          </label>
          <input
            id="sso-acs"
            value={sso.acsUrl}
            disabled
            aria-label="ACS URL (read-only)"
            className="w-full rounded-[9px] border border-line-strong bg-panel px-[13px] py-2.5 font-mono text-[12px] text-ink-muted outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="sso-meta"
            className="mb-1.5 block text-[12px] font-semibold text-ink"
          >
            IdP metadata XML
          </label>
          <textarea
            id="sso-meta"
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
            disabled={!isAdmin}
            rows={3}
            placeholder="<EntityDescriptor …>"
            className="w-full rounded-[9px] border border-line-strong bg-panel px-[13px] py-2.5 font-mono text-[12px] text-ink outline-none focus-visible:border-ink-strong focus-visible:ring-[3px] focus-visible:ring-accent disabled:opacity-70"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={enforce}
            aria-label="Enforce SSO"
            disabled={!isAdmin}
            onClick={() => setEnforce((v) => !v)}
            className={`relative h-[19px] w-[34px] flex-none rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 ${enforce ? "bg-accent" : "bg-line-strong"}`}
          >
            <span
              className={`absolute top-0.5 h-[15px] w-[15px] rounded-full transition-all ${enforce ? "left-[17px] bg-ink-strong" : "left-0.5 bg-paper"}`}
            />
          </button>
          <span className="text-[13px] text-ink">
            Enforce SSO for all members
          </span>
        </div>
      </div>
      {isAdmin && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  updateSsoConfig({
                    provider: provider || null,
                    idpMetadata: metadata || null,
                    enforce,
                  }),
                "SSO config saved.",
              )
            }
            className="rounded-[9px] bg-ink-strong px-5 py-2.5 text-[13px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          >
            Save SSO config
          </button>
        </div>
      )}
    </section>
  );
}

function ApiKeysSection({
  apiKeys,
  isAdmin,
  setNotice,
}: {
  apiKeys: ApiKeyRow[];
  isAdmin: boolean;
  setNotice: (m: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const create = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await createApiKey(name.trim());
      if (res.ok && res.plaintextKey) {
        setNewKey(res.plaintextKey);
        setName("");
        setNotice("API key created — copy it now.");
      } else {
        setNotice(res.message ?? "Couldn’t create key.");
      }
    });
  };

  return (
    <section className="overflow-hidden rounded-card border border-line bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4 pt-5">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">API keys</h2>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Hashed at rest — shown once at creation, never again.
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-6 py-3.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name (e.g. Production ingest)"
            aria-label="New API key name"
            className="min-w-[220px] flex-1 rounded-[9px] border border-line-strong bg-panel px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-muted focus-visible:border-ink-strong focus-visible:ring-[3px] focus-visible:ring-accent"
          />
          <button
            type="button"
            onClick={create}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-[9px] bg-ink-strong px-4 py-2.5 text-[13px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          >
            <KeyRound className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Create key
          </button>
        </div>
      )}

      {newKey && (
        <div className="border-t border-line bg-panel px-6 py-4">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-ink">
            <TriangleAlert
              className="h-3.5 w-3.5"
              strokeWidth={2}
              aria-hidden
            />
            Copy this now — you won’t see it again
          </div>
          <div className="flex items-center gap-2.5 rounded-[9px] border border-line-strong bg-paper px-3 py-2.5">
            <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink">
              {newKey}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(newKey);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex flex-none items-center gap-1.5 rounded-btn border border-line-strong bg-paper px-2.5 py-1.5 text-[11.5px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {copied ? (
                <Check
                  className="h-[13px] w-[13px]"
                  strokeWidth={2.4}
                  aria-hidden
                />
              ) : (
                <Copy
                  className="h-[13px] w-[13px]"
                  strokeWidth={1.8}
                  aria-hidden
                />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[1.4fr_1.4fr_1fr_auto] gap-3 border-t border-line px-6 py-2.5 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
        <span>Name</span>
        <span>Key</span>
        <span>Last used</span>
        <span className="sr-only">Actions</span>
      </div>
      {apiKeys.length === 0 ? (
        <p className="border-t border-line px-6 py-8 text-center text-[13px] text-ink-muted">
          No API keys yet.
        </p>
      ) : (
        apiKeys.map((k) => (
          <div
            key={k.id}
            className={`grid grid-cols-[1.4fr_1.4fr_1fr_auto] items-center gap-3 border-t border-line px-6 py-3 ${k.revokedAt ? "opacity-55" : ""}`}
          >
            <span className="truncate text-[13px] font-semibold text-ink">
              {k.name}
            </span>
            <span className="truncate font-mono text-[12px] text-ink-muted">
              {k.masked}
            </span>
            <span className="font-mono text-[11px] text-ink-muted">
              {k.revokedAt
                ? "revoked"
                : k.lastUsedAt
                  ? relTime(k.lastUsedAt)
                  : "never"}
            </span>
            <div className="flex justify-end">
              {isAdmin && !k.revokedAt && (
                <RevokeButton id={k.id} onDone={setNotice} />
              )}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function RevokeButton({
  id,
  onDone,
}: {
  id: string;
  onDone: (m: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await revokeApiKey(id);
          onDone(
            res.ok ? "API key revoked." : (res.message ?? "Couldn’t revoke."),
          );
        })
      }
      aria-label="Revoke API key"
      className="flex h-7 w-7 items-center justify-center rounded-btn text-ink-muted transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden />
    </button>
  );
}

function relTime(d: Date): string {
  const secs = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
