// src/lib/messaging/provider.ts
// ─────────────────────────────────────────────
// PROVIDER FACTORY
// Returns the correct messaging provider based on
// organization config. India orgs get WhatsApp,
// US orgs get SMS + Email. Simple.
// ─────────────────────────────────────────────

import { MessageChannel } from "@prisma/client";
import { MessageProvider } from "./types";
import { WhatsAppProvider } from "./whatsapp";
// import { TwilioSmsProvider } from "./sms";    // Phase 2: US market
// import { SesEmailProvider } from "./email";    // Phase 2: US market

/**
 * Get the primary messaging provider for an organization.
 * For India (MVP): WhatsApp
 * For US (later): SMS via Twilio
 *
 * Usage in workflow engine:
 *   const provider = getMessageProvider(org);
 *   await provider.sendMessage({ to: lead.phone, body: "Hello!" });
 *
 * The workflow engine NEVER knows which channel is being used.
 * That's the whole point.
 */
export function getMessageProvider(org: {
  whatsappPhoneId?: string | null;
  whatsappToken?: string | null;
  // twilioSid?: string | null;     // Future: US market
  // twilioToken?: string | null;
}): MessageProvider {
  // India market: WhatsApp is primary
  // Falls back to env vars if DB fields not set (useful for dev/testing)
  const phoneNumberId = org.whatsappPhoneId || process.env.WHATSAPP_PHONE_NUMBER_ID || ""
  const accessToken = org.whatsappToken || process.env.WHATSAPP_ACCESS_TOKEN || ""

  if (phoneNumberId && accessToken) {
    return new WhatsAppProvider({
      phoneNumberId,
      accessToken,
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "",
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
    });
  }

  // US market (future): Twilio SMS
  // if (org.twilioSid && org.twilioToken) {
  //   return new TwilioSmsProvider({
  //     accountSid: org.twilioSid,
  //     authToken: org.twilioToken,
  //     fromNumber: org.twilioFromNumber!,
  //   });
  // }

  throw new Error("No messaging provider configured for this organization");
}

/**
 * Get a specific channel provider (for when you know which channel to use)
 * Useful for: sending email alongside WhatsApp, or forcing a specific channel
 */
export function getProviderByChannel(
  channel: MessageChannel,
  config: Record<string, string>
): MessageProvider {
  switch (channel) {
    case "WHATSAPP":
      return new WhatsAppProvider({
        phoneNumberId: config.phoneNumberId,
        accessToken: config.accessToken,
        webhookVerifyToken: config.webhookVerifyToken,
        businessAccountId: config.businessAccountId,
      });
    // case "SMS":
    //   return new TwilioSmsProvider({ ... });
    // case "EMAIL":
    //   return new SesEmailProvider({ ... });
    default:
      throw new Error(`Unsupported channel: ${channel}`);
  }
}
