// src/lib/messaging/types.ts
// ─────────────────────────────────────────────
// THE MESSAGING ABSTRACTION LAYER
// This is the architectural insight that makes LeadFlow
// work in India (WhatsApp) AND the US (SMS/Email)
// without changing any business logic.
//
// Your workflow engine calls sendMessage() — it doesn't
// know or care whether that goes via WhatsApp, SMS, or email.
// The provider is selected based on org config / market.
// ─────────────────────────────────────────────

import { MessageChannel, MessageStatus } from "@prisma/client";

// ─── Core Interfaces ──────────────────────────

export interface SendMessageParams {
  to: string;                    // Phone number or email
  body: string;                  // Message text
  templateId?: string;           // WhatsApp template ID (if using templates)
  templateParams?: Record<string, string>; // Template variable substitutions
  mediaUrl?: string;             // Optional attachment
}

export interface SendMessageResult {
  success: boolean;
  externalId?: string;           // Meta message ID, Twilio SID, SES message ID
  status: MessageStatus;
  error?: string;
}

export interface BroadcastParams {
  recipients: Array<{
    to: string;
    name: string;
    leadId: string;
  }>;
  body: string;
  templateId?: string;
  templateParams?: Record<string, string>;
}

export interface BroadcastResult {
  total: number;
  sent: number;
  failed: number;
  results: Array<{
    leadId: string;
    success: boolean;
    externalId?: string;
    error?: string;
  }>;
}

export interface WebhookPayload {
  channel: MessageChannel;
  externalId: string;
  from: string;                  // Phone/email of sender
  body: string;
  timestamp: Date;
  status?: MessageStatus;        // For delivery receipts
  mediaUrl?: string;
}

// ─── Provider Interface ───────────────────────
// Every channel (WhatsApp, SMS, Email) implements this.
// Swap providers without touching business logic.

export interface MessageProvider {
  channel: MessageChannel;

  /**
   * Send a single message to a lead
   */
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;

  /**
   * Send bulk messages (re-marketing broadcast)
   * Implementations should handle rate limiting internally
   */
  sendBroadcast(params: BroadcastParams): Promise<BroadcastResult>;

  /**
   * Parse an incoming webhook from the channel's API
   * Returns normalized payload regardless of source
   */
  parseWebhook(rawBody: unknown): WebhookPayload | null;

  /**
   * Verify webhook signature (security)
   */
  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean;
}

// ─── Provider Config ──────────────────────────

export interface WhatsAppConfig {
  phoneNumberId: string;         // Meta phone number ID
  accessToken: string;           // Meta access token
  webhookVerifyToken: string;    // For webhook verification
  businessAccountId: string;     // WABA ID
}

export interface TwilioSmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;            // Your Twilio phone number
}

export interface SesEmailConfig {
  fromEmail: string;             // Verified SES sender
  region: string;                // AWS region
  // Uses AWS SDK default credentials (env vars or IAM role)
}
