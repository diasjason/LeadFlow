export type Stage = 
  | 'new'
  | 'contacted'
  | 'follow-up'
  | 'interested'
  | 'visit-scheduled'
  | 'visit-done'
  | 'docs-collected'
  | 'closed-won'
  | 'lost'

export type Source = 'facebook' | 'instagram' | 'referral' | 'excel'

export type Category = 'hot' | 'warm' | 'cold'

export interface Lead {
  id: string
  name: string
  phone: string
  additionalPhones?: string[]  // stored in metadata.additionalPhones
  email?: string
  source: Source
  category: Category
  stage: Stage
  attempts: number
  lastContact?: Date
  nextFollowUp?: Date
  notes?: string
  whatsAppSent: boolean
  createdAt: Date
  documents: DocumentChecklist
}

export interface DocumentChecklist {
  aadhaar: boolean
  pan: boolean
  salarySlip: boolean
  bankStatement: boolean
  itReturns: boolean
  agreement: boolean
  photo: boolean
  addressProof: boolean
}

export const STAGES: { id: Stage; label: string }[] = [
  { id: 'new', label: 'New Lead' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'follow-up', label: 'Follow-Up' },
  { id: 'interested', label: 'Interested' },
  { id: 'visit-scheduled', label: 'Visit Scheduled' },
  { id: 'visit-done', label: 'Visit Done' },
  { id: 'docs-collected', label: 'Docs Collected' },
]

export const SOURCES: { id: Source; label: string }[] = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'referral', label: 'Referral' },
  { id: 'excel', label: 'Excel Import' },
]

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'hot', label: 'Hot' },
  { id: 'warm', label: 'Warm' },
  { id: 'cold', label: 'Cold' },
]

export const DOCUMENT_LABELS: Record<keyof DocumentChecklist, string> = {
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  salarySlip: 'Salary Slip',
  bankStatement: 'Bank Statement',
  itReturns: 'IT Returns',
  agreement: 'Agreement',
  photo: 'Photo',
  addressProof: 'Address Proof',
}
