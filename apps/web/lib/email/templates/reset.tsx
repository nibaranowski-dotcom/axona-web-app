import * as React from "react";
import { Text } from "@react-email/components";
import { EmailLayout, ButtonLink, emailStyles } from "./layout";

export interface ResetEmailProps {
  resetUrl: string;
}

export function ResetEmail({ resetUrl }: ResetEmailProps) {
  return (
    <EmailLayout preview="Reset your Axona password">
      <Text
        style={{
          fontSize: "17px",
          fontWeight: 600,
          color: emailStyles.ink,
          margin: "0 0 8px",
        }}
      >
        Reset your password
      </Text>
      <Text
        style={{
          fontSize: "14px",
          lineHeight: "1.5",
          color: emailStyles.muted,
          margin: "0 0 20px",
        }}
      >
        Click below to choose a new password. If you didn&apos;t request this,
        you can ignore this email.
      </Text>
      <ButtonLink href={resetUrl} label="Reset password" />
    </EmailLayout>
  );
}
