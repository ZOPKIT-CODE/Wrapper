# Permissions Feature

Permission visualization and management UI with a matrix view and application-level permission viewer.

## Directory Structure

```
permissions/
├── index.ts
├── pages/
│   └── Permissions.tsx                   # Main permissions page (tabbed)
├── PermissionMatrix.tsx                  # Matrix view of users vs permissions
└── ApplicationPermissionViewer.tsx       # Application/module/operation permission viewer
```

## Pages & Components

### Permissions (Page)

Main permissions page with tabs:
- **Overview** — High-level permission summary
- **Users** — User-level permission assignments
- **Roles** — Role-based permission groupings
- **Permissions** — Granular permission listing

Currently uses mock data from `@/data/mockPermissions` and `@/data/kindeIntegratedData` for display.

### PermissionMatrix

Matrix-style view showing users on one axis and permissions on the other, enabling quick visual identification of access patterns.

### ApplicationPermissionViewer

Hierarchical viewer displaying the application → module → operation permission structure with role-based permission highlighting.

## Key APIs

This feature currently uses **mock data only** and does not make direct backend API calls. Live permission management is handled through the `roles` and `admin` features.

## Dependencies

- `lucide-react` — Icons
- `@/data/mockPermissions`, `@/data/kindeIntegratedData` — Mock data sources
- `@/components/ui/*` — shadcn/ui components
