// src/lib/workflow/engine.ts
// ─────────────────────────────────────────────
// WORKFLOW ENGINE — The 11-step pipeline brain
// 
// This is where your business logic lives.
// It's pure functions that take a lead + action
// and return the next state. No UI, no API, no DB.
// Easy to test, easy to reason about.
// ─────────────────────────────────────────────

import { LeadStage, LeadCategory } from "@prisma/client";

// ─── Stage Transition Rules ─────────────────

/** Valid next stages from any given stage */
const STAGE_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  NEW:             ["CONTACTED", "CLOSED_LOST"],
  CONTACTED:       ["FOLLOW_UP", "INTERESTED", "CLOSED_LOST"],
  FOLLOW_UP:       ["INTERESTED", "CLOSED_LOST"],
  INTERESTED:      ["VISIT_SCHEDULED", "FOLLOW_UP", "CLOSED_LOST"],
  VISIT_SCHEDULED: ["VISIT_DONE", "FOLLOW_UP", "CLOSED_LOST"],
  VISIT_DONE:      ["DOCS_COLLECTED", "INTERESTED", "CLOSED_LOST"],
  DOCS_COLLECTED:  ["CLOSED_WON", "CLOSED_LOST"],
  CLOSED_WON:      [],  // Terminal state
  CLOSED_LOST:     ["NEW"],  // Can re-activate
};

export function canTransition(from: LeadStage, to: LeadStage): boolean {
  return STAGE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextStages(current: LeadStage): LeadStage[] {
  return STAGE_TRANSITIONS[current] ?? [];
}

// ─── Follow-Up Scheduling ───────────────────

/** 
 * Follow-up interval increases with each attempt.
 * Attempt 1-2: next day
 * Attempt 3-4: every 2 days
 * Attempt 5-6: every 3 days
 * After 6: auto-mark as COLD/LOST
 */
export function getNextFollowUpDate(
  currentAttempts: number,
  fromDate: Date = new Date()
): Date | null {
  if (currentAttempts >= 6) return null; // No more follow-ups

  let daysToAdd: number;
  if (currentAttempts < 2) daysToAdd = 1;
  else if (currentAttempts < 4) daysToAdd = 2;
  else daysToAdd = 3;

  const next = new Date(fromDate);
  next.setDate(next.getDate() + daysToAdd);
  return next;
}

/**
 * Process a follow-up attempt on a lead.
 * Returns the updated fields that should be saved.
 */
export function processFollowUp(lead: {
  attempts: number;
  maxAttempts: number;
  stage: LeadStage;
}): {
  attempts: number;
  stage: LeadStage;
  category: LeadCategory | null; // null = don't change
  nextFollowUpAt: Date | null;
  lastContactAt: Date;
  autoClosedReason: string | null;
} {
  const newAttempts = lead.attempts + 1;
  const now = new Date();

  // 6-attempt rule: auto-mark as COLD/LOST
  if (newAttempts >= lead.maxAttempts && !isAdvancedStage(lead.stage)) {
    return {
      attempts: newAttempts,
      stage: "CLOSED_LOST" as LeadStage,
      category: "COLD" as LeadCategory,
      nextFollowUpAt: null,
      lastContactAt: now,
      autoClosedReason: `No response after ${lead.maxAttempts} attempts`,
    };
  }

  // Normal follow-up: increment attempts, schedule next
  const nextStage = lead.stage === "NEW" ? "CONTACTED" as LeadStage
    : lead.stage === "CONTACTED" ? "FOLLOW_UP" as LeadStage
    : lead.stage;

  return {
    attempts: newAttempts,
    stage: nextStage,
    category: null, // Don't auto-change category on normal follow-up
    nextFollowUpAt: getNextFollowUpDate(newAttempts, now),
    lastContactAt: now,
    autoClosedReason: null,
  };
}

/** Stages that are "advanced" enough to not be auto-closed */
function isAdvancedStage(stage: LeadStage): boolean {
  return [
    "INTERESTED",
    "VISIT_SCHEDULED",
    "VISIT_DONE",
    "DOCS_COLLECTED",
    "CLOSED_WON",
  ].includes(stage);
}

// ─── Re-activation ──────────────────────────

/**
 * Re-activate a lost lead (from re-marketing broadcast)
 * Resets to NEW with fresh follow-up cycle
 */
export function reactivateLead(): {
  stage: LeadStage;
  category: LeadCategory;
  attempts: number;
  nextFollowUpAt: Date;
} {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    stage: "NEW" as LeadStage,
    category: "WARM" as LeadCategory,
    attempts: 0,
    nextFollowUpAt: tomorrow,
  };
}

// ─── Auto Welcome Message Template ──────────

export function getWelcomeMessage(leadName: string, orgName?: string): string {
  const name = leadName.split(" ")[0]; // First name only
  const org = orgName || "us";
  return `Hi ${name}! Thank you for your interest. We received your inquiry and a team member from ${org} will be in touch shortly. In the meantime, feel free to reply to this message with any questions!`;
}

export function getFollowUpMessage(
  leadName: string,
  attemptNumber: number
): string {
  const name = leadName.split(" ")[0];

  switch (attemptNumber) {
    case 1:
      return `Hi ${name}, just following up on your inquiry. Would you like to schedule a site visit or have any questions? We're happy to help!`;
    case 2:
      return `Hi ${name}, I wanted to check in again. We have some excellent options that might interest you. When would be a good time to talk?`;
    case 3:
      return `Hi ${name}, I hope you're doing well. I don't want you to miss out on our current offerings. Can we set up a quick call this week?`;
    case 4:
      return `Hi ${name}, just a friendly reminder that we're here to help with your property search. Let me know if your requirements have changed!`;
    case 5:
      return `Hi ${name}, this is my final follow-up. If you're still interested, please reply and we'll pick up where we left off. We'd love to help you find the right property!`;
    default:
      return `Hi ${name}, following up on your inquiry. Please let us know if you're still interested!`;
  }
}

// ─── Cron Job Logic ─────────────────────────

/**
 * Find leads that need follow-up action.
 * Called by Vercel Cron every 15 minutes.
 *
 * Returns filters for a Prisma query — the cron API route
 * uses these to fetch and process leads.
 */
export function getDueFollowUpsFilter(now: Date = new Date()) {
  return {
    nextFollowUpAt: { lte: now },
    stage: {
      notIn: ["CLOSED_WON", "CLOSED_LOST"] as LeadStage[],
    },
    attempts: { lt: 6 }, // Only leads that haven't hit the limit
  };
}
