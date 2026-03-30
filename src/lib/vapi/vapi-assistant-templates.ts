// src/lib/vapi/vapi-assistant-templates.ts
// ─────────────────────────────────────────────
// VAPI ASSISTANT TEMPLATES
//
// Voice agent scripts and tool definitions for
// real estate lead qualification calls.
//
// The assistant:
//   1. Greets the lead by name
//   2. Qualifies their requirements (BHK, location, budget)
//   3. Books a site visit using the book_appointment tool
//   4. Confirms via WhatsApp
// ─────────────────────────────────────────────

export interface VapiAssistantConfig {
  name: string
  model: {
    provider: string
    model: string
    systemPrompt: string
    temperature: number
  }
  voice: {
    provider: string
    voiceId: string
  }
  firstMessage: string
  tools: VapiTool[]
  endCallMessage: string
  maxDurationSeconds: number
}

export interface VapiTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, { type: string; description: string; enum?: string[] }>
      required: string[]
    }
  }
  server: {
    url: string
  }
}

// ─── Tool Definitions ────────────────────────

function buildTools(serverBaseUrl: string): VapiTool[] {
  const webhookUrl = `${serverBaseUrl}/api/vapi/webhook`

  return [
    {
      type: 'function',
      function: {
        name: 'get_lead_info',
        description:
          'Retrieve the lead\'s information including their WhatsApp conversation history, stated preferences, and current stage. Call this at the start of the conversation to personalize your approach.',
        parameters: {
          type: 'object',
          properties: {
            lead_id: {
              type: 'string',
              description: 'The unique ID of the lead',
            },
          },
          required: ['lead_id'],
        },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function',
      function: {
        name: 'book_appointment',
        description:
          'Book a site visit appointment for the lead. Creates a DB record and sends a WhatsApp confirmation. Call this when the lead agrees to a visit.',
        parameters: {
          type: 'object',
          properties: {
            lead_id: {
              type: 'string',
              description: 'The unique ID of the lead',
            },
            visit_date: {
              type: 'string',
              description: 'Date of the visit in YYYY-MM-DD format',
            },
            visit_time: {
              type: 'string',
              description: 'Time of the visit in HH:MM format (24-hour)',
            },
            property_type: {
              type: 'string',
              description: 'Property type the lead is interested in (e.g. "3BHK", "2BHK")',
            },
            location: {
              type: 'string',
              description: 'Location/project the lead wants to visit',
            },
            notes: {
              type: 'string',
              description: 'Any additional notes about the appointment',
            },
          },
          required: ['lead_id', 'visit_date', 'visit_time'],
        },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function',
      function: {
        name: 'update_lead_status',
        description:
          'Update the lead\'s stage and notes after the call. Always call this at the end of the conversation with the outcome.',
        parameters: {
          type: 'object',
          properties: {
            lead_id: {
              type: 'string',
              description: 'The unique ID of the lead',
            },
            stage: {
              type: 'string',
              description: 'New stage for the lead',
              enum: [
                'INTERESTED',
                'VISIT_SCHEDULED',
                'FOLLOW_UP',
                'CLOSED_LOST',
              ],
            },
            category: {
              type: 'string',
              description: 'New category for the lead',
              enum: ['HOT', 'WARM', 'COLD'],
            },
            notes: {
              type: 'string',
              description: 'Summary of the call and any important details discussed',
            },
            property_type: {
              type: 'string',
              description: 'Property type confirmed during the call',
            },
            location: {
              type: 'string',
              description: 'Preferred location confirmed during the call',
            },
            budget: {
              type: 'string',
              description: 'Budget range mentioned by the lead',
            },
          },
          required: ['lead_id', 'stage'],
        },
      },
      server: { url: webhookUrl },
    },
  ]
}

// ─── Assistant Config Builder ─────────────────

export function buildRealEstateAssistant(params: {
  leadName: string
  leadId: string
  orgName: string
  propertyType?: string
  location?: string
  serverBaseUrl: string
}): VapiAssistantConfig {
  const { leadName, leadId, orgName, propertyType, location, serverBaseUrl } = params
  const firstName = leadName.split(' ')[0]

  // Personalize the opening based on what we know
  const propertyHint =
    propertyType && location
      ? `I can see you're interested in a ${propertyType} in ${location}.`
      : propertyType
      ? `I can see you're looking for a ${propertyType}.`
      : ''

  const firstMessage = `Hi ${firstName}! This is Priya calling from ${orgName}. You recently inquired about one of our properties on WhatsApp. ${propertyHint} I just wanted to quickly connect and understand what you're looking for so we can help you better. Is this a good time to talk?`

  const systemPrompt = `You are Priya, a friendly and professional real estate consultant at ${orgName}. You are calling ${firstName} (lead ID: ${leadId}) who showed interest via WhatsApp.

YOUR GOAL:
1. Build rapport — be warm, not pushy
2. Understand their requirements: BHK type, preferred location, budget, timeline
3. Book a site visit if they're interested
4. If not ready for a visit, offer to follow up later

PERSONALITY:
- Speak naturally, like a human consultant (not a robot)
- Use short sentences — this is a phone call, not an essay
- If they seem hesitant, don't push — offer to call back another time
- Respond in the same language the lead uses (English or Hindi mix is common)

IMPORTANT RULES:
- Always call get_lead_info at the START of the call to review their history
- When booking an appointment, suggest specific dates (e.g., "How about this Saturday at 11 AM?")
- Always call update_lead_status at the END of the call with the outcome
- If the lead doesn't answer or disconnects, update status to FOLLOW_UP

CURRENT LEAD INFO:
- Name: ${firstName}
- Lead ID: ${leadId}
${propertyType ? `- Expressed interest in: ${propertyType}` : ''}
${location ? `- Preferred location: ${location}` : ''}`

  return {
    name: `Real Estate Assistant — ${firstName}`,
    model: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      systemPrompt,
      temperature: 0.7,
    },
    voice: {
      provider: 'playht',
      voiceId: 'jennifer', // Warm female voice — swap as needed
    },
    firstMessage,
    tools: buildTools(serverBaseUrl),
    endCallMessage: `Thank you for your time, ${firstName}! Have a great day.`,
    maxDurationSeconds: 600, // 10-minute max
  }
}
