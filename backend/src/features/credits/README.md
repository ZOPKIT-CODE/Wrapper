# Credits Feature

Manages tenant credit balances, purchases (including Stripe checkout), consumption, transfers, operation/module/app configuration, credit expiry processing, and seasonal credits.

## Directory Structure

```
credits/
├── index.ts                              # Feature exports
├── routes/
│   ├── credits.ts                        # Core credit endpoints
│   ├── credit-expiry.ts                  # Credit expiry processing endpoints
│   └── seasonal-credits-public.ts        # Public seasonal credit endpoints
└── services/
    ├── credit-service.ts                 # Facade delegating to sub-services
    ├── credit-core.ts                    # Core helpers, entity resolution, Stripe init
    ├── credit-balance.ts                 # Balance queries, transaction history, stats
    ├── credit-operations.ts              # Purchases, consumption, transfers, allocations
    ├── credit-config-global.ts           # Global credit configuration management
    ├── credit-config-tenant.ts           # Tenant-scoped credit configuration
    ├── credit-expiry-service.ts          # Expiry processing and warnings
    └── seasonal-credit-service.ts        # Seasonal credit allocation (deprecated)
```

## Endpoints

### Credits (`/api/credits`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/test-route` | Health check for credit routes |
| GET | `/current` | Current credit balance for the authenticated user |
| GET | `/transactions` | Paginated credit transaction history |
| GET | `/alerts` | Credit alerts |
| GET | `/usage-summary` | Usage summary for a period |
| GET | `/config/:operationCode` | Effective credit config for an operation |
| GET | `/config/module/:moduleCode` | Effective module credit config |
| GET | `/config/app/:appCode` | Effective application credit config |
| GET | `/configurations` | All global credit configurations |
| GET | `/packages` | Available credit packages for purchase |
| GET | `/monitor-status` | Credit balance monitor status |
| GET | `/stats` | Credit statistics for dashboard |
| GET | `/payment/:identifier` | Payment details by purchaseId, Stripe intent, or session ID |
| POST | `/purchase` | Start credit purchase (Stripe checkout or other) |
| POST | `/consume` | Consume credits for an operation |
| POST | `/transfer` | Transfer credits between entities |
| POST | `/config/operation/:operationCode` | Set operation credit config |
| POST | `/config/module/:moduleCode` | Set module credit config |
| POST | `/config/app/:appCode` | Set app credit config |
| POST | `/allocate/application` | Allocate credits from entity to application |
| POST | `/webhook` | Stripe webhook for credit purchase completion |
| PUT | `/alerts/:alertId/read` | Mark alert as read |

### Credit Expiry (`/api/credits/expiry`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/expiring` | Credits expiring within a window |
| GET | `/expiry-stats` | Expiry statistics for a tenant/entity |
| POST | `/process-expired` | Process expired credits (cron trigger) |
| POST | `/send-warnings` | Send expiry warnings |

### Seasonal Credits (Public)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/recent-allocations` | Recent seasonal credit allocations for current tenant |

## Services

| Service | Description |
|---------|-------------|
| **CreditService** | Facade that re-exports and delegates to all credit sub-services for backward compatibility |
| **credit-core** | Core helpers: ensure credit record exists, find root organization, get module permissions, Stripe client init |
| **credit-balance** | Balance queries: getCurrentBalance, getEntityBalance, getTransactionHistory, getUsageSummary, getCreditStats with free/paid/seasonal categorization |
| **credit-operations** | Mutations: initializeTenantCredits, purchaseCredits, addCreditsToEntity, allocateCreditsToApplication, consumeCredits, transferCredits, getAvailablePackages. Integrates Stripe checkout and SNS events |
| **credit-config-global** | Global/admin config: get/set operation, module, and app configs with tenant-to-global-to-default resolution |
| **credit-config-tenant** | Tenant-scoped config: get/set/reset tenant configs, bulk updates, templates. Publishes credit config events to SNS |
| **credit-expiry-service** | Expiry processing: processExpiredCredits, deductExpiredCredits, getExpiringCredits, sendExpiryWarnings, getExpiryStats |
| **seasonal-credit-service** | Deprecated seasonal credit methods (being refactored onto CreditService) |
