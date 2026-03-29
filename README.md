# LeadFlow CRM

## One-Click Deploy (Vercel)

Use this after pushing the repo to GitHub:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/diasjason/LeadFlow)

Before clicking, replace `https://github.com/diasjason/LeadFlow` in this README link with your real repo path.

### Required environment variables

Set these in Vercel Project Settings → Environment Variables:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `OPENAI_API_KEY`
- `CRON_SECRET`

## Deployment behavior

`vercel.json` is configured to run:

- `npm run build:vercel`

That script runs, in order:

1. `prisma generate --config prisma.config.ts`
2. `prisma db push --config prisma.config.ts`
3. `next build`

So your schema is applied automatically during deploy.

## Local run

```bash
npm install
npm run dev
```
