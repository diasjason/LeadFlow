import { NextResponse } from 'next/server'
import { LeadCategory, LeadSource } from '@prisma/client'
import { buildImportPreview } from '@/lib/import/service'

export const runtime = 'nodejs'

function toDbSource(source: string | null): LeadSource {
  switch (source) {
    case 'facebook':
      return 'FACEBOOK'
    case 'instagram':
      return 'INSTAGRAM'
    case 'referral':
      return 'REFERRAL'
    default:
      return 'EXCEL_IMPORT'
  }
}

function toDbCategory(category: string | null): LeadCategory {
  switch (category) {
    case 'hot':
      return 'HOT'
    case 'cold':
      return 'COLD'
    default:
      return 'WARM'
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const profileId = formData.get('profileId')
    const defaultSource = formData.get('defaultSource')
    const defaultCategory = formData.get('defaultCategory')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const preview = buildImportPreview({
      buffer: Buffer.from(bytes),
      profileId: typeof profileId === 'string' ? profileId : undefined,
      defaultSource: toDbSource(typeof defaultSource === 'string' ? defaultSource : null),
      defaultCategory: toDbCategory(typeof defaultCategory === 'string' ? defaultCategory : null),
    })

    return NextResponse.json(preview)
  } catch (error) {
    console.error('Preview import error:', error)
    return NextResponse.json({ error: 'Failed to preview import file' }, { status: 500 })
  }
}
