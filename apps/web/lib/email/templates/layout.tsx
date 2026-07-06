import * as React from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// EMAIL.1 — the shared branded email layout (Axona: paper/ink, lime accent, no
// emoji). Plain + accessible; a wordmark header + a footer. Email-safe inline styles.
const paper = "#ffffff";
const ink = "#0a0a0a";
const muted = "#6b6b6b";
const line = "#e7e6e1";

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#f4f3ef",
          margin: 0,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <Container
          style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 0" }}
        >
          <Section
            style={{
              backgroundColor: paper,
              border: `1px solid ${line}`,
              borderRadius: "14px",
              padding: "32px 32px 26px",
            }}
          >
            <Text
              style={{
                fontSize: "22px",
                fontWeight: 700,
                letterSpacing: "-0.04em",
                color: ink,
                margin: "0 0 20px",
              }}
            >
              axona
            </Text>
            {children}
          </Section>
          <Hr style={{ borderColor: line, margin: "18px 0 10px" }} />
          <Text
            style={{
              fontSize: "11px",
              color: muted,
              textAlign: "center",
              margin: 0,
            }}
          >
            Axona — the operating system for robotics companies.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = { paper, ink, muted, line };

// A branded ink button (email-safe anchor).
export function ButtonLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: ink,
        color: "#ffffff",
        fontSize: "14px",
        fontWeight: 600,
        textDecoration: "none",
        padding: "12px 22px",
        borderRadius: "9px",
      }}
    >
      {label}
    </a>
  );
}
