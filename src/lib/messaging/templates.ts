export const WHATSAPP_TEMPLATES = {
  WELCOME: {
    name: 'lead_welcome_v1',
    category: 'MARKETING',
    language: 'en',
    body: "Hi {{1}}! Thank you for your interest in {{2}}. We received your inquiry and a team member will be in touch shortly.",
  },
  FOLLOWUP_1: {
    name: 'followup_day1_v1',
    category: 'MARKETING',
    language: 'en',
    body: "Hi {{1}}, just following up on your inquiry about {{2}}. Would you like to schedule a site visit?",
  },
  FOLLOWUP_2: {
    name: 'followup_day3_v1',
    category: 'MARKETING',
    language: 'en',
    body: "Hi {{1}}, checking in again about {{2}}. We have options that might interest you.",
  },
  FOLLOWUP_3: {
    name: 'followup_day5_v1',
    category: 'MARKETING',
    language: 'en',
    body: "Hi {{1}}, I hope you're doing well. I don't want you to miss out on our current offerings at {{2}}.",
  },
  FOLLOWUP_4: {
    name: 'followup_day7_v1',
    category: 'MARKETING',
    language: 'en',
    body: "Hi {{1}}, just a friendly reminder that we're here to help with your property search at {{2}}.",
  },
  FOLLOWUP_5: {
    name: 'followup_final_v1',
    category: 'MARKETING',
    language: 'en',
    body: "Hi {{1}}, this is our final follow-up regarding {{2}}. If you're still interested, please reply.",
  },
  REMARKETING: {
    name: 'remarketing_offer_v1',
    category: 'MARKETING',
    language: 'en',
    body: 'Hi {{1}}! We have an exciting update — {{2}}. Reply YES to know more.',
  },
} as const

export function getFollowUpTemplate(attemptNumber: number) {
  switch (attemptNumber) {
    case 1:
      return WHATSAPP_TEMPLATES.FOLLOWUP_1
    case 2:
      return WHATSAPP_TEMPLATES.FOLLOWUP_2
    case 3:
      return WHATSAPP_TEMPLATES.FOLLOWUP_3
    case 4:
      return WHATSAPP_TEMPLATES.FOLLOWUP_4
    case 5:
    default:
      return WHATSAPP_TEMPLATES.FOLLOWUP_5
  }
}
