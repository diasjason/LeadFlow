import type { ImportField, ImportProfile } from './types'

const CLIENT_ONE_PROFILE: ImportProfile = {
  id: 'client-test-data-v1',
  label: 'Client 1 - Test Data',
  aliases: {
    name: ['first name', 'last name', 'full name', 'name'],
    phone: ['phone number', 'phone', 'mobile', 'mobile number', 'contact number'],
    email: ['email id', 'email', 'email address'],
    source: ['lead source', 'source'],
    category: ['category'],
    notes: ['requirement', 'budget', 'notes', 'remark', 'remarks', 'comment'],
    skip: ['sr. no.', 'serial number', 'id'],
  },
  sourceValueMap: {
    meta: 'FACEBOOK',
    facebook: 'FACEBOOK',
    instagram: 'INSTAGRAM',
    referral: 'REFERRAL',
    referance: 'REFERRAL',
    reference: 'REFERRAL',
    excel: 'EXCEL_IMPORT',
  },
}

const GENERIC_PROFILE: ImportProfile = {
  id: 'generic-v1',
  label: 'Generic Import',
  aliases: {
    name: ['name', 'full name', 'customer name', 'lead name'],
    phone: ['phone', 'mobile', 'contact', 'phone number', 'mobile number'],
    email: ['email', 'email id', 'mail'],
    source: ['source', 'lead source'],
    category: ['category', 'lead category'],
    notes: ['notes', 'remark', 'remarks', 'comment', 'requirement', 'budget'],
    skip: ['sr no', 'sr. no.', 'id'],
  },
}

const PROFILES: ImportProfile[] = [CLIENT_ONE_PROFILE, GENERIC_PROFILE]

export function getImportProfile(profileId?: string): ImportProfile {
  if (profileId) {
    const matched = PROFILES.find((profile) => profile.id === profileId)
    if (matched) {
      return matched
    }
  }

  return CLIENT_ONE_PROFILE
}

export function scoreColumnMatch(
  column: string,
  field: ImportField,
  profile: ImportProfile
): number {
  const aliases = profile.aliases[field] ?? []
  const normalizedColumn = normalize(column)
  if (!normalizedColumn || normalizedColumn.startsWith('__empty')) {
    return 0
  }

  for (const alias of aliases) {
    const normalizedAlias = normalize(alias)
    if (!normalizedAlias) {
      continue
    }

    if (normalizedColumn === normalizedAlias) {
      return 1
    }

    if (normalizedColumn.includes(normalizedAlias) || normalizedAlias.includes(normalizedColumn)) {
      return 0.85
    }
  }

  if (field === 'phone' && /(phone|mobile|contact|whatsapp)/.test(normalizedColumn)) {
    return 0.7
  }
  if (field === 'name' && /name/.test(normalizedColumn)) {
    return 0.65
  }
  if (field === 'email' && /email|mail/.test(normalizedColumn)) {
    return 0.7
  }
  if (field === 'notes' && /notes|remark|requirement|budget/.test(normalizedColumn)) {
    return 0.6
  }

  return 0
}

export function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
