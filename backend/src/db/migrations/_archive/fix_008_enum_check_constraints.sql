-- M008: Add CHECK constraints for all enum-like varchar columns.
-- Allowed lists built from actual data found in pre-flight queries.
-- credit_transactions.transaction_type includes: allocation, transfer_in, transfer_out
-- (discovered in existing data — included in the constraint).
--
-- ROLLBACK:
--   ALTER TABLE entities                DROP CONSTRAINT chk_entity_type;
--   ALTER TABLE organization_memberships DROP CONSTRAINT chk_membership_status;
--   ALTER TABLE organization_memberships DROP CONSTRAINT chk_org_membership_entity_type;
--   ALTER TABLE subscriptions            DROP CONSTRAINT chk_subscription_status;
--   ALTER TABLE credit_transactions      DROP CONSTRAINT chk_credit_transaction_type;
--   ALTER TABLE tenant_invitations       DROP CONSTRAINT chk_invitation_status;
--   ALTER TABLE tenant_invitations       DROP CONSTRAINT chk_invitation_scope;
--   ALTER TABLE payments                 DROP CONSTRAINT chk_payment_status;
--   ALTER TABLE credit_purchases         DROP CONSTRAINT chk_credit_purchase_status;
--   ALTER TABLE applications             DROP CONSTRAINT chk_application_status;

ALTER TABLE entities
  ADD CONSTRAINT chk_entity_type
    CHECK (entity_type IN ('organization','location','department','team'));

ALTER TABLE organization_memberships
  ADD CONSTRAINT chk_membership_status
    CHECK (membership_status IN ('active','inactive','suspended','pending','invited'));

ALTER TABLE organization_memberships
  ADD CONSTRAINT chk_org_membership_entity_type
    CHECK (entity_type IN ('organization','location','department','team'));

ALTER TABLE subscriptions
  ADD CONSTRAINT chk_subscription_status
    CHECK (status IN ('active','inactive','trialing','past_due','canceled','paused','trial'));

ALTER TABLE credit_transactions
  ADD CONSTRAINT chk_credit_transaction_type
    CHECK (transaction_type IN (
      'purchase','consumption','expiry','adjustment',
      'transfer','initialization',
      'allocation','transfer_in','transfer_out'
    ));

ALTER TABLE tenant_invitations
  ADD CONSTRAINT chk_invitation_status
    CHECK (status IN ('pending','accepted','expired','cancelled','revoked'));

ALTER TABLE tenant_invitations
  ADD CONSTRAINT chk_invitation_scope
    CHECK (invitation_scope IN ('tenant','single-entity','multi-entity'));

ALTER TABLE payments
  ADD CONSTRAINT chk_payment_status
    CHECK (status IN ('pending','completed','failed','refunded','processing','cancelled'));

ALTER TABLE credit_purchases
  ADD CONSTRAINT chk_credit_purchase_status
    CHECK (status IN ('pending','completed','failed','cancelled','processing'));

ALTER TABLE applications
  ADD CONSTRAINT chk_application_status
    CHECK (status IN ('active','inactive','maintenance','deprecated'));
