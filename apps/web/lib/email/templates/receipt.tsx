import * as React from "react";
import { Text } from "@react-email/components";
import { EmailLayout, ButtonLink, emailStyles } from "./layout";

export interface ReceiptEmailProps {
  orgName: string;
  amount: string;
  invoiceUrl: string;
}

export function ReceiptEmail({
  orgName,
  amount,
  invoiceUrl,
}: ReceiptEmailProps) {
  return (
    <EmailLayout preview={`Your Axona receipt — ${amount}`}>
      <Text
        style={{
          fontSize: "17px",
          fontWeight: 600,
          color: emailStyles.ink,
          margin: "0 0 8px",
        }}
      >
        Payment received
      </Text>
      <Text
        style={{
          fontSize: "14px",
          lineHeight: "1.5",
          color: emailStyles.muted,
          margin: "0 0 20px",
        }}
      >
        Thanks — we received <strong>{amount}</strong> for {orgName}&apos;s
        Axona subscription.
      </Text>
      <ButtonLink href={invoiceUrl} label="View invoice" />
    </EmailLayout>
  );
}
