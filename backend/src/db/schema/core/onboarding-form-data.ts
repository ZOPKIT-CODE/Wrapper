/**
 * Onboarding Form Data Schema
 * Stores form data during onboarding process before user/tenant records are created
 */

import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

export const onboardingFormData = pgTable('onboarding_form_data', {
  id: uuid('id').defaultRandom().primaryKey(),
  kindeUserId: varchar('kinde_user_id', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  currentStep: varchar('current_step', { length: 50 }),
  flowType: varchar('flow_type', { length: 50 }), // 'newBusiness' or 'existingBusiness'
  formData: jsonb('form_data').default({}).notNull(), // Complete form data as JSON
  stepData: jsonb('step_data').default({}), // Step-specific data
  lastSaved: timestamp('last_saved', { mode: 'date' }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  kindeUserIdIdx: index('idx_onboarding_form_data_kinde_user_id').on(table.kindeUserId),
  emailIdx: index('idx_onboarding_form_data_email').on(table.email),
  kindeUserIdEmailIdx: index('idx_onboarding_form_data_kinde_user_email').on(table.kindeUserId, table.email),
}));

