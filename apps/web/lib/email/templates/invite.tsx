import * as React from "react";
import { Text } from "@react-email/components";
import { EmailLayout, ButtonLink, emailStyles } from "./layout";

export interface InviteEmailProps {
  inviterName: string;
  orgName: string;
  role: string;
  acceptUrl: string;
}

export function InviteEmail({
  inviterName,
  orgName,
  role,
  acceptUrl,
}: InviteEmailProps) {
  return (
    <EmailLayout
      preview={`${inviterName} invited you to join ${orgName} on Axona`}
    >
      <Text
        style={{
          fontSize: "17px",
          fontWeight: 600,
          color: emailStyles.ink,
          margin: "0 0 8px",
        }}
      >
        You&apos;ve been invited to {orgName}
      </Text>
      <Text
        style={{
          fontSize: "14px",
          lineHeight: "1.5",
          color: emailStyles.muted,
          margin: "0 0 20px",
        }}
      >
        {inviterName} invited you to join <strong>{orgName}</strong> on Axona as{" "}
        <strong>{role}</strong>. Accept to set your password and get started.
      </Text>
      <ButtonLink href={acceptUrl} label={`Join ${orgName}`} />
      <Text
        style={{
          fontSize: "11px",
          color: emailStyles.muted,
          margin: "20px 0 0",
        }}
      >
        Or paste this link: {acceptUrl}
      </Text>
    </EmailLayout>
  );
}
