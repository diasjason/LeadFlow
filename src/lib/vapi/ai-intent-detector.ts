// src/lib/vapi/ai-intent-detector.ts
// ─────────────────────────────────────────────
// INTENT DETECTOR
//
// Keyword-based analysis of inbound WhatsApp messages.
// Determines interest level and extracts property details
// (BHK type, location, budget) from the message text.
//
// Once the Vapi call is triggered, the AI agent handles
// all nuanced qualification — no extra API key needed here.
// ─────────────────────────────────────────────

export interface IntentResult {
  interested: boolean
  shouldTriggerCall: boolean
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  extractedData: {
    propertyType?: string  // "3BHK", "2BHK", "villa", "plot", etc.
    location?: string      // "Whitefield", "Sarjapur", etc.
    budget?: string        // "80L", "1.2Cr", etc.
    timeline?: string      // "immediate", "3 months", etc.
  }
  reason: string
}

// ─── Keyword Lists ───────────────────────────

const NOT_INTERESTED_KEYWORDS = [
  'not interested', 'no thanks', 'nope', 'stop',
  'unsubscribe', 'remove me', "don't contact", 'do not contact',
  'wrong number', 'not looking', 'already bought', 'not now',
]

const HIGH_INTEREST_KEYWORDS = [
  'interested', 'yes', 'sure', 'definitely', 'absolutely',
  'tell me more', 'more info', 'more details', 'send details',
  'site visit', 'visit', 'schedule', 'book', 'when can i',
  'price', 'cost', 'rate', 'how much', 'what is the price',
  'availability', 'available', 'ready to move', 'possession',
]

const MEDIUM_INTEREST_KEYWORDS = [
  'bhk', '2bhk', '3bhk', '4bhk', 'bedroom',
  'flat', 'apartment', 'villa', 'plot', 'house',
  'whitefield', 'sarjapur', 'electronic city', 'hebbal',
  'marathahalli', 'hsr', 'koramangala', 'indiranagar',
  'rera', 'loan', 'emi', 'carpet area', 'super built',
  'floor', 'parking', 'amenities', 'gym', 'swimming',
]

// ─── Property Data Extractors ─────────────────

const BHK_PATTERN = /\b([1-5])\s*bhk\b/i
const BUDGET_PATTERN = /\b(\d+(?:\.\d+)?)\s*(l|lac|lakh|lacs|cr|crore|crores|k)\b/i
const LOCATION_KEYWORDS: Record<string, string> = {
  whitefield: 'Whitefield',
  sarjapur: 'Sarjapur',
  'electronic city': 'Electronic City',
  hebbal: 'Hebbal',
  marathahalli: 'Marathahalli',
  'hsr layout': 'HSR Layout',
  hsr: 'HSR Layout',
  koramangala: 'Koramangala',
  indiranagar: 'Indiranagar',
  'jp nagar': 'JP Nagar',
  jayanagar: 'Jayanagar',
  'brigade road': 'Brigade Road',
  yelahanka: 'Yelahanka',
  devanahalli: 'Devanahalli',
  thanisandra: 'Thanisandra',
  'mg road': 'MG Road',
}

function extractPropertyData(message: string): IntentResult['extractedData'] {
  const lower = message.toLowerCase()
  const data: IntentResult['extractedData'] = {}

  // BHK type
  const bhkMatch = message.match(BHK_PATTERN)
  if (bhkMatch) {
    data.propertyType = `${bhkMatch[1]}BHK`
  } else if (/\bvilla\b/i.test(message)) {
    data.propertyType = 'Villa'
  } else if (/\bplot\b/i.test(message)) {
    data.propertyType = 'Plot'
  }

  // Location
  for (const [keyword, label] of Object.entries(LOCATION_KEYWORDS)) {
    if (lower.includes(keyword)) {
      data.location = label
      break
    }
  }

  // Budget
  const budgetMatch = message.match(BUDGET_PATTERN)
  if (budgetMatch) {
    const amount = budgetMatch[1]
    const unit = budgetMatch[2].toLowerCase()
    if (unit.startsWith('cr')) data.budget = `${amount}Cr`
    else if (unit.startsWith('l') || unit === 'lac' || unit === 'lakh') data.budget = `${amount}L`
    else if (unit === 'k') data.budget = `${amount}K`
  }

  // Timeline hints
  if (/\bimmediate\b|\basap\b|\burgent\b|\bright away\b/i.test(message)) {
    data.timeline = 'immediate'
  } else if (/\b(\d+)\s*(month|months)\b/i.test(message)) {
    const m = message.match(/\b(\d+)\s*(month|months)\b/i)
    if (m) data.timeline = `${m[1]} months`
  }

  return data
}

// ─── Main Export ─────────────────────────────

export async function detectIntent(
  message: string,
  _leadContext?: {
    name?: string
    previousMessages?: string[]
  }
): Promise<IntentResult> {
  const lower = message.toLowerCase()

  // Hard no
  if (NOT_INTERESTED_KEYWORDS.some(kw => lower.includes(kw))) {
    return {
      interested: false,
      shouldTriggerCall: false,
      confidence: 'HIGH',
      extractedData: {},
      reason: 'Keyword match: not interested',
    }
  }

  const extractedData = extractPropertyData(message)

  // High-confidence interest
  if (HIGH_INTEREST_KEYWORDS.some(kw => lower.includes(kw))) {
    return {
      interested: true,
      shouldTriggerCall: true,
      confidence: 'HIGH',
      extractedData,
      reason: 'Keyword match: strong interest signal',
    }
  }

  // Medium interest — property details mentioned but no explicit yes/visit
  const hasMediumSignal = MEDIUM_INTEREST_KEYWORDS.some(kw => lower.includes(kw))
  const hasExtractedData =
    !!extractedData.propertyType || !!extractedData.location || !!extractedData.budget

  if (hasMediumSignal || hasExtractedData) {
    return {
      interested: true,
      shouldTriggerCall: true,  // Still trigger call — Vapi AI will qualify further
      confidence: 'MEDIUM',
      extractedData,
      reason: 'Keyword match: property details mentioned',
    }
  }

  // Unknown / ambiguous — don't trigger call
  return {
    interested: false,
    shouldTriggerCall: false,
    confidence: 'LOW',
    extractedData,
    reason: 'No clear interest signal detected',
  }
}
