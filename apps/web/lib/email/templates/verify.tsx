import * as React from "react";
import { Text } from "@react-email/components";
import { EmailLayout, ButtonLink, emailStyles } from "./layout";

export interface VerifyEmailProps {
  verifyUrl: string;
}

export function VerifyEmail({ verifyUrl }: VerifyEmailProps) {
  return (
    <EmailLayout preview="Verify your Axona email">
      <Text
        style={{
          fontSize: "17px",
          fontWeight: 600,
          color: emailStyles.ink,
          margin: "0 0 8px",
        }}
      >
        Verify your email
      </Text>
      <Text
        style={{
          fontSize: "14px",
          lineHeight: "1.5",
          color: emailStyles.muted,
          margin: "0 0 20px",
        }}
      >
        Confirm this address to secure your Axona account.
      </Text>
      <ButtonLink href={verifyUrl} label="Verify email" />
    </EmailLayout>
  );
}
