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
    this.apiKey =
      apiKey ?? process.env.VAPI_PRIVATE_KEY ?? process.env.VAPI_API_KEY ?? ''
    if (!this.apiKey) {
      throw new Error('Vapi private API key is not configured (set VAPI_PRIVATE_KEY or VAPI_API_KEY)')
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
    serverBaseUrl?: string
  }): Promise<CallResult> {
    try {
      const { toPhone, assistantConfig, metadata, serverBaseUrl } = params

      const normalizedPhone = this.normalizePhone(toPhone)
      const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID
      const assistantId = process.env.VAPI_ASSISTANT_ID
      const resolvedServerBaseUrl =
        serverBaseUrl ?? process.env.NEXT_PUBLIC_BASE_URL ?? ''

      if (!phoneNumberId) {
        return {
          success: false,
          error: 'VAPI_PHONE_NUMBER_ID is not configured',
        }
      }

      if (!resolvedServerBaseUrl) {
        return {
          success: false,
          error: 'Missing server base URL for Vapi webhook callback',
        }
      }

      const payload = {
        type: 'outboundPhoneCall',
        phoneNumberId,
        customer: {
          number: normalizedPhone,
        },
        ...(assistantId
          ? {
              assistantId,
            }
          : {
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
                server: {
                  // Send end-of-call report and tool calls to our webhook
                  url: `${resolvedServerBaseUrl}/api/vapi/webhook`,
                  secret: process.env.VAPI_WEBHOOK_SECRET,
                },
              },
            }),
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

      const rawBody = await response.text()
      let data: unknown = null
      try {
        data = rawBody ? JSON.parse(rawBody) : null
      } catch {
        data = rawBody
      }

      if (!response.ok) {
        console.error('[vapi] makeCall failed:', data)
        const responseObject =
          data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined
        const rawMessage =
          (typeof responseObject?.message === 'string' ? responseObject.message : undefined) ??
          (typeof responseObject?.error === 'string' ? responseObject.error : undefined)
        const normalizedMessage = rawMessage?.toLowerCase() ?? ''
        const isKeyTypeMismatch =
          normalizedMessage.includes('invalid key') ||
          normalizedMessage.includes('private key') ||
          normalizedMessage.includes('public key')
        const detail = (() => {
          if (typeof data === 'string' && data.trim().length > 0) {
            return data
          }
          if (responseObject && typeof responseObject === 'object') {
            const issues = responseObject.issues
            if (Array.isArray(issues) && issues.length > 0) {
              return issues
                .map((issue) => {
                  if (issue && typeof issue === 'object') {
                    const issueObj = issue as Record<string, unknown>
                    const path = Array.isArray(issueObj.path)
                      ? issueObj.path.join('.')
                      : undefined
                    const message =
                      typeof issueObj.message === 'string'
                        ? issueObj.message
                        : JSON.stringify(issueObj)
                    return path ? `${path}: ${message}` : message
                  }
                  return String(issue)
                })
                .join('; ')
            }
            return JSON.stringify(responseObject)
          }
          return undefined
        })()

        return {
          success: false,
          error: isKeyTypeMismatch
            ? 'Invalid Vapi key for server call. Set VAPI_PRIVATE_KEY (or VAPI_API_KEY) to your Vapi private key. Do not use the public key here.'
            : rawMessage ??
              detail ??
              `Vapi API error: ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`,
        }
      }

      const callId =
        data && typeof data === 'object' && typeof (data as Record<string, unknown>).id === 'string'
          ? (data as Record<string, unknown>).id
          : undefined

      console.log(`[vapi] Call initiated: ${callId ?? 'unknown-id'} → ${normalizedPhone}`)
      return {
        success: true,
        callId: callId as string | undefined,
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
    let cleaned = phone.trim().replace(/\D/g, '')

    // Convert 00-prefixed international format (e.g., 001234...) to E.164 digits
    if (cleaned.startsWith('00')) {
      cleaned = cleaned.slice(2)
    }

    // If local 10-digit number is provided, assume a default country code.
    // Defaults to US/CA (+1) unless overridden via env.
    if (cleaned.length === 10) {
      const defaultCountryCode =
        (process.env.VAPI_DEFAULT_COUNTRY_CODE ?? '1').replace(/\D/g, '') || '1'
      cleaned = `${defaultCountryCode}${cleaned}`
    }

    return `+${cleaned}`
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
