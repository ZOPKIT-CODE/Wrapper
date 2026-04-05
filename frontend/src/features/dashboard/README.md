# Dashboard Feature

Main dashboard views including activity logs and the business suite launcher.

## Directory Structure

```
dashboard/
├── components/
│   └── ActivityDashboard.tsx          # Tabbed activity & audit log viewer
├── pages/
│   ├── ActivityDashboardPage.tsx      # Split-pane activity log page
│   └── SuiteDashboard.tsx            # Business Suite app launcher dashboard
```

## Pages & Components

### SuiteDashboard

Business Suite dashboard for authenticated users:
- Loads assigned applications and recent activity via suite APIs
- App grid with launch buttons (SSO redirect via `/suite/sso/redirect`)
- Sidebar with quick stats and recent activity feed

### ActivityDashboardPage

Split-pane activity log viewer:
- Stats cards (Total Activities, Active Users, Security Events, Data Changes)
- Left panel: filterable event list (search, action type, period)
- Right panel: event detail (connection info, app context, metadata JSON)
- Export to JSON/CSV

### ActivityDashboard (Component)

Tabbed activity & audit viewer with three tabs:
- **My Activities** — User's own activity log
- **Audit Logs** — System-wide audit entries (filter by action, resource type, user)
- **Statistics** — Active users, activity/audit breakdown by period

## Key APIs

| Component | Endpoints |
|-----------|-----------|
| ActivityDashboard / Page | `GET /activity/user`, `GET /activity/audit`, `GET /activity/stats`, `POST /activity/export` |
| SuiteDashboard | `GET /suite/applications`, `GET /suite/activity`, `POST /suite/sso/redirect` |

## Dependencies

- `@tanstack/react-query` — Data fetching
- `@kinde-oss/kinde-auth-react` — Auth (SuiteDashboard)
- `date-fns` — Date formatting
- `lucide-react` — Icons
