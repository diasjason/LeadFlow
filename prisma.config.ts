import { config as loadEnv } from "dotenv"
import { defineConfig } from "prisma/config"

loadEnv()
loadEnv({ path: ".env.local", override: true })

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
})
