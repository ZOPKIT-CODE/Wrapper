# Notifications Feature

Tenant-scoped in-app notifications with listing, read/dismiss tracking, analytics, async queue processing via SQS, templates with variable substitution, caching, and AI-powered content generation/personalization.

## Directory Structure

```
notifications/
├── index.ts                                      # Feature exports
├── routes/
│   └── notifications.ts                          # Notification endpoints
└── services/
    ├── notification-service.ts                   # Core CRUD and specialized notifications
    ├── notification-analytics-service.ts         # Analytics and dashboard data
    ├── notification-queue-service.ts             # Async processing via SQS
    ├── notification-template-service.ts          # Template CRUD and rendering
    ├── notification-cache-service.ts             # In-memory cache for templates/metadata
    └── ai/
        ├── ai-service-factory.ts                 # AI provider abstraction (OpenAI, Anthropic)
        ├── content-generation-service.ts         # AI content generation with variants
        ├── personalization-service.ts            # AI personalization per tenant
        ├── sentiment-service.ts                  # AI sentiment/tone analysis
        └── smart-targeting-service.ts            # AI tenant targeting suggestions
```

## Endpoints (`/api/notifications`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List notifications for the current tenant (with filters) |
| GET | `/unread-count` | Unread notification count |
| GET | `/debug-notifications` | Debug: raw notification rows for tenant |
| PUT | `/:notificationId/read` | Mark one notification as read |
| PUT | `/:notificationId/dismiss` | Mark one notification as dismissed |
| PUT | `/mark-all-read` | Mark all tenant notifications as read |
| POST | `/test-seasonal` | Create a test seasonal-credit notification (debug) |
| POST | `/test` | Create a test notification |
| DELETE | `/cleanup` | Delete expired notifications |

## Services

| Service | Description |
|---------|-------------|
| **NotificationService** | Core CRUD: create, list, unread count, mark read/dismiss/mark-all-read, cleanup expired. Builds specialized notifications (seasonal credits, purchase, expiry warning, system update, billing reminder). Bulk create and send-to-tenants |
| **NotificationAnalyticsService** | Analytics: stats (read/dismissed counts, rates), delivery rates, read rates over time, click-through rates, performance by type. Aggregates dashboard data including AI costs and per-application usage |
| **NotificationQueueService** | Async processing via SQS job queue: workers for immediate, bulk, and scheduled jobs. Enqueue, process, cancel, stats. WebSocket broadcast after create |
| **NotificationTemplateService** | Template CRUD and rendering: create/read/update/delete templates, list with filters, render with variable substitution, get categories. Uses cache layer |
| **NotificationCacheService** | In-memory cache for templates, template lists, tenant metadata, filtered tenant lists, and stats. TTL-based with cleanup and invalidation |
| **AIServiceFactory** | AI provider abstraction: supports OpenAI and Anthropic. Generate completions with optional fallback, cost tracking, availability checks |
| **ContentGenerationService** | Generate notification content from prompts with tone/length/language control. Template-based generation and A/B testing variants |
| **PersonalizationService** | Personalize notification content per tenant using AI. Batch personalization and personalized A/B variants |
| **SentimentService** | Analyze notification content: full sentiment/tone/urgency analysis, quick sentiment checks, problematic content detection |
| **SmartTargetingService** | Suggest target tenants from notification content. Analyze targeting criteria, rank tenants, recommend send times using engagement data |

## Ports and Adapters Convention

- Put email provider interfaces in `ports/` (for example `ports/email-provider.ts`).
- Put concrete implementations in `adapters/` (for example `adapters/brevo-adapter.ts`).
- Business services should use `getEmailProvider()` and program against the port.
- New email providers should be added as adapters without changing feature-level business logic.
