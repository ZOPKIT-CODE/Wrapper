import { pgTable, uuid, varchar, decimal, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from '../core/tenants.js';

// Separated from tenants table for security, auditability, and SRP.
// accountNumber should be encrypted at the application layer before storage.
export const tenantBankingDetails = pgTable('tenant_banking_details', {
  bankingId: uuid('banking_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId, { onDelete: 'cascade' }).notNull(),

  // Primary bank account
  bankName: varchar('bank_name', { length: 255 }),
  bankBranch: varchar('bank_branch', { length: 255 }),
  accountHolderName: varchar('account_holder_name', { length: 255 }),
  accountNumber: varchar('account_number', { length: 50 }), // Must be encrypted at app layer
  accountType: varchar('account_type', { length: 50 }), // 'checking', 'savings', 'current'
  bankAccountCurrency: varchar('bank_account_currency', { length: 3 }),

  // International routing codes (only relevant ones per country)
  swiftBicCode: varchar('swift_bic_code', { length: 11 }),
  iban: varchar('iban', { length: 34 }),
  routingNumberUs: varchar('routing_number_us', { length: 9 }),
  sortCodeUk: varchar('sort_code_uk', { length: 6 }),
  ifscCodeIndia: varchar('ifsc_code_india', { length: 11 }),
  bsbNumberAustralia: varchar('bsb_number_australia', { length: 6 }),

  // Payment preferences
  paymentTerms: varchar('payment_terms', { length: 50 }), // 'net-15', 'net-30', etc.
  preferredPaymentMethod: varchar('preferred_payment_method', { length: 50 }),
  creditLimit: decimal('credit_limit', { precision: 15, scale: 2 }),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxTenantBankingTenantId: uniqueIndex('idx_tenant_banking_tenant_id').on(table.tenantId),
}));
