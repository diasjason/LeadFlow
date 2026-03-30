-- Migration: add clerkId to users, PHONE to MessageChannel enum

-- Add clerkId column to users (guarded for shadow DB compatibility)
DO $$
BEGIN
	IF to_regclass('public.users') IS NOT NULL THEN
		ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerkId" TEXT;

		IF NOT EXISTS (
			SELECT 1
			FROM pg_constraint
			WHERE conname = 'users_clerkId_key'
		) THEN
			ALTER TABLE "users" ADD CONSTRAINT "users_clerkId_key" UNIQUE ("clerkId");
		END IF;
	END IF;
END $$;

-- Add PHONE value to MessageChannel enum
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_type
		WHERE typname = 'MessageChannel'
	) THEN
		ALTER TYPE "MessageChannel" ADD VALUE IF NOT EXISTS 'PHONE';
	END IF;
END $$;
