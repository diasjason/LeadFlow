// src/lib/messaging/whatsapp.ts
// ─────────────────────────────────────────────
// WHATSAPP PROVIDER (Meta Cloud API)
// Direct Meta integration — ZERO BSP markup.
// Cost: ₹0.86/marketing msg (Jan 2026 rate)
//
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
// ─────────────────────────────────────────────

import {
  MessageProvider,
  SendMessageParams,
  SendMessageResult,
  BroadcastParams,
  BroadcastResult,
  WebhookPayload,
  WhatsAppConfig,
} from "./types";
import { MessageChannel, MessageStatus } from "@prisma/client";

const META_API_BASE = "https://graph.facebook.com/v21.0";

export class WhatsAppProvider implements MessageProvider {
  channel = MessageChannel.WHATSAPP;
  private config: WhatsAppConfig;

  constructor(config: WhatsAppConfig) {
    this.config = config;
  }

  // ─── Send Single Message ──────────────────

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    try {
      const url = `${META_API_BASE}/${this.config.phoneNumberId}/messages`;

      // Build request body based on whether it's a template or text message
      let body: Record<string, unknown>;

      if (params.templateId) {
        // Template message (for business-initiated conversations)
        body = {
          messaging_product: "whatsapp",
          to: this.normalizePhone(params.to),
          type: "template",
          template: {
            name: params.templateId,
            language: { code: "en" },
            components: params.templateParams
              ? [
                  {
                    type: "body",
                    parameters: Object.values(params.templateParams).map(
                      (value) => ({ type: "text", text: value })
                    ),
                  },
                ]
              : undefined,
          },
        };
      } else {
        // Text message (only within 24hr service window)
        body = {
          messaging_product: "whatsapp",
          to: this.normalizePhone(params.to),
          type: "text",
          text: { body: params.body },
        };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          status: MessageStatus.FAILED,
          error: data.error?.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        externalId: data.messages?.[0]?.id,
        status: MessageStatus.SENT,
      };
    } catch (error) {
      return {
        success: false,
        status: MessageStatus.FAILED,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ─── Broadcast (Bulk Send) ────────────────

  async sendBroadcast(params: BroadcastParams): Promise<BroadcastResult> {
    const results: BroadcastResult["results"] = [];
    let sent = 0;
    let failed = 0;

    // Meta rate limit: ~80 messages/second for business accounts
    // We add a small delay between batches to be safe
    const BATCH_SIZE = 50;
    const BATCH_DELAY_MS = 1000;

    for (let i = 0; i < params.recipients.length; i += BATCH_SIZE) {
      const batch = params.recipients.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (recipient) => {
          const result = await this.sendMessage({
            to: recipient.to,
            body: params.body.replace("{{name}}", recipient.name),
            templateId: params.templateId,
            templateParams: {
              ...params.templateParams,
              name: recipient.name,
            },
          });

          return { leadId: recipient.leadId, ...result };
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
          if (result.value.success) sent++;
          else failed++;
        } else {
          failed++;
          results.push({
            leadId: "",
            success: false,
            error: result.reason?.message || "Promise rejected",
          });
        }
      }

      // Rate limiting: pause between batches
      if (i + BATCH_SIZE < params.recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    return {
      total: params.recipients.length,
      sent,
      failed,
      results,
    };
  }

  // ─── Webhook Parsing ──────────────────────

  parseWebhook(rawBody: unknown): WebhookPayload | null {
    try {
      const body = rawBody as MetaWebhookBody;
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      // Handle incoming message
      if (value?.messages?.[0]) {
        const msg = value.messages[0];
        return {
          channel: MessageChannel.WHATSAPP,
          externalId: msg.id,
          from: msg.from,
          body: msg.text?.body || "",
          timestamp: new Date(parseInt(msg.timestamp) * 1000),
          mediaUrl: msg.image?.id || msg.document?.id || undefined,
        };
      }

      // Handle status update (delivered, read)
      if (value?.statuses?.[0]) {
        const status = value.statuses[0];
        return {
          channel: MessageChannel.WHATSAPP,
          externalId: status.id,
          from: status.recipient_id,
          body: "",
          timestamp: new Date(parseInt(status.timestamp) * 1000),
          status: this.mapStatus(status.status),
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  // ─── Webhook Verification ─────────────────

  verifyWebhook(
    headers: Record<string, string>,
    _rawBody: string
  ): boolean {
    // For the initial webhook setup, Meta sends a GET with a verify token
    // For subsequent POST webhooks, you'd verify the X-Hub-Signature-256
    // Simplified for MVP — add full HMAC verification for production
    const hubVerifyToken = headers["hub.verify_token"];
    if (hubVerifyToken) {
      return hubVerifyToken === this.config.webhookVerifyToken;
    }
    // TODO: Implement X-Hub-Signature-256 HMAC verification
    return true;
  }

  // ─── Helpers ──────────────────────────────

  private normalizePhone(phone: string): string {
    // Strip all non-digits, ensure country code
    let cleaned = phone.replace(/\D/g, "");
    // If it's an Indian number without country code, add 91
    if (cleaned.length === 10) {
      cleaned = "91" + cleaned;
    }
    return cleaned;
  }

  private mapStatus(metaStatus: string): MessageStatus {
    switch (metaStatus) {
      case "sent":
        return MessageStatus.SENT;
      case "delivered":
        return MessageStatus.DELIVERED;
      case "read":
        return MessageStatus.READ;
      case "failed":
        return MessageStatus.FAILED;
      default:
        return MessageStatus.SENT;
    }
  }
}

// ─── Meta Webhook Types ─────────────────────

interface MetaWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string };
          document?: { id: string };
        }>;
        statuses?: Array<{
          id: string;
          recipient_id: string;
          status: string;
          timestamp: string;
        }>;
      };
    }>;
  }>;
}
