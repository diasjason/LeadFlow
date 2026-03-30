// src/lib/vapi/vapi-provider.ts
// ─────────────────────────────────────────────
// VAPI PROVIDER
//
// Handles all communication with the Vapi.ai API:
//   - makeCall(): trigger an outbound AI voice call
//   - getCall(): fetch call details / transcript
//   - endCall(): force-end a call
//
// Docs: https://docs.vapi.ai
// ─────────────────────────────────────────────

import { VapiAssistantConfig } from './vapi-assistant-templates'

const VAPI_BASE_URL = 'https://api.vapi.ai'

export interface CallResult {
  success: boolean
  callId?: string
  error?: string
}

export interface CallDetails {
  id: string
  status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended'
  transcript?: string
  summary?: string
  recordingUrl?: string
  durationSeconds?: number
  endedReason?: string
  cost?: number
}

// ─── Vapi Provider Class ─────────────────────

export class VapiProvider {
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.VAPI_API_KEY ?? ''
    if (!this.apiKey) {
      throw new Error('VAPI_API_KEY is not configured')
    }
  }

  // ─── Outbound Call ──────────────────────────

  /**
   * Initiate an outbound AI voice call to a lead.
   * The assistant config defines the voice, script, and tools.
   */
  async makeCall(params: {
    toPhone: string
    assistantConfig: VapiAssistantConfig
    metadata?: Record<string, string>
  }): Promise<CallResult> {
    try {
      const { toPhone, assistantConfig, metadata } = params

      const normalizedPhone = this.normalizePhone(toPhone)

      const payload = {
        type: 'outboundPhoneCall',
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        customer: {
          number: normalizedPhone,
        },
        assistant: {
          name: assistantConfig.name,
          model: {
            provider: assistantConfig.model.provider,
            model: assistantConfig.model.model,
            temperature: assistantConfig.model.temperature,
            // Vapi uses messages[] for the system prompt — not a top-level systemPrompt field
            messages: [
              {
                role: 'system',
                content: assistantConfig.model.systemPrompt,
              },
            ],
          },
          voice: assistantConfig.voice,
          firstMessage: assistantConfig.firstMessage,
          endCallMessage: assistantConfig.endCallMessage,
          maxDurationSeconds: assistantConfig.maxDurationSeconds,
          tools: assistantConfig.tools,
          // Send end-of-call report to our webhook
          serverUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/vapi/webhook`,
          serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET,
        },
        metadata,
      }

      const response = await fetch(`${VAPI_BASE_URL}/call`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('[vapi] makeCall failed:', data)
        return {
          success: false,
          error: data.message ?? `Vapi API error: ${response.status}`,
        }
      }

      console.log(`[vapi] Call initiated: ${data.id} → ${normalizedPhone}`)
      return {
        success: true,
        callId: data.id,
      }
    } catch (error) {
      console.error('[vapi] makeCall exception:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ─── Get Call Details ───────────────────────

  async getCall(callId: string): Promise<CallDetails | null> {
    try {
      const response = await fetch(`${VAPI_BASE_URL}/call/${callId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })

      if (!response.ok) return null

      const data = await response.json()
      return {
        id: data.id,
        status: data.status,
        transcript: data.transcript,
        summary: data.summary,
        recordingUrl: data.recordingUrl,
        durationSeconds: data.durationSeconds,
        endedReason: data.endedReason,
        cost: data.cost,
      }
    } catch {
      return null
    }
  }

  // ─── End Call ───────────────────────────────

  async endCall(callId: string): Promise<boolean> {
    try {
      const response = await fetch(`${VAPI_BASE_URL}/call/${callId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })
      return response.ok
    } catch {
      return false
    }
  }

  // ─── Helpers ────────────────────────────────

  private normalizePhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '')
    // Indian numbers: add +91 if not present
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned
    }
    return '+' + cleaned
  }
}

// Singleton instance
let _vapiInstance: VapiProvider | null = null

export function getVapiProvider(): VapiProvider {
  if (!_vapiInstance) {
    _vapiInstance = new VapiProvider()
  }
  return _vapiInstance
}
