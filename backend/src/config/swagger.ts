import type { FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import type { FastifySwaggerUiOptions } from '@fastify/swagger-ui';

const TAG_DEFINITIONS = [
  { name: 'Auth', description: 'Authentication — OAuth2 login, token management, logout' },
  { name: 'Tenants', description: 'Tenant CRUD and configuration' },
  { name: 'Onboarding', description: 'Tenant onboarding — company setup, verification, subdomain, invites' },
  { name: 'Organizations', description: 'Organization hierarchy, structure, and membership' },
  { name: 'Entities', description: 'Entity management within organizations' },
  { name: 'Locations', description: 'Location management for organizations' },
  { name: 'Roles', description: 'Role definitions, assignment, and custom roles' },
  { name: 'Permissions', description: 'Permission management, matrix, and sync' },
  { name: 'Subscriptions', description: 'Billing plans, checkout, and subscription lifecycle' },
  { name: 'Payments', description: 'Payment history, upgrades, and profile completion' },
  { name: 'Trial', description: 'Free trial management and restrictions' },
  { name: 'Credits', description: 'Credit balances, purchases, consumption, expiry' },
  { name: 'Notifications', description: 'In-app notification management and delivery' },
  { name: 'Activity', description: 'Activity logs, audit trails, and tracking' },
  { name: 'Admin', description: 'Platform administration — dashboard, tenants, entities, credits' },
  { name: 'Invitations', description: 'Organization invitations and team onboarding' },
  { name: 'Webhooks', description: 'Stripe and external webhook handlers' },
  { name: 'DNS', description: 'Subdomain and DNS management via Route 53' },
  { name: 'Suite', description: 'Application suite and navigation' },
  { name: 'Applications', description: 'Application assignment and user-application mapping' },
  { name: 'App Sync', description: 'Data synchronization with downstream apps — prefix: /api/sync' },
  { name: 'Internal', description: 'Internal tooling and diagnostics' },
  { name: 'Contact', description: 'Contact form and inquiries' },
  { name: 'Demo', description: 'Demo and sandbox endpoints' },
  { name: 'Health', description: 'Health checks and system status' },
] as const;

const PREFIX_TO_TAG: Record<string, string> = {
  '/api/auth': 'Auth',
  '/api/tenants': 'Tenants',
  '/api/onboarding': 'Onboarding',
  '/api/entities': 'Entities',
  '/api/locations': 'Locations',
  '/api/roles': 'Roles',
  '/api/custom-roles': 'Roles',
  '/api/permissions': 'Permissions',
  '/api/permission-matrix': 'Permissions',
  '/api/permission-sync': 'Permissions',
  '/api/subscriptions': 'Subscriptions',
  '/api/payments': 'Payments',
  '/api/payment-upgrade': 'Payments',
  '/api/trial': 'Trial',
  '/api/credits': 'Credits',
  '/api/notifications': 'Notifications',
  '/api/activity': 'Activity',
  '/api/admin/platform-staff': 'Admin',
  '/api/admin': 'Admin',
  '/api/admin-promotion': 'Admin',
  '/api/invitations': 'Invitations',
  '/api/webhooks': 'Webhooks',
  '/api/dns': 'DNS',
  '/api/suite': 'Suite',
  '/api/applications': 'Applications',
  '/api/sync': 'App Sync',
  '/api/internal': 'Internal',
  '/api/contact': 'Contact',
  '/api/demo': 'Demo',
  '/health': 'Health',
};

function resolveTag(url: string): string {
  for (const prefix of Object.keys(PREFIX_TO_TAG).sort((a, b) => b.length - a.length)) {
    if (url.startsWith(prefix)) {
      return PREFIX_TO_TAG[prefix];
    }
  }
  return 'Other';
}

export const swaggerOptions: FastifyDynamicSwaggerOptions = {
  openapi: {
    openapi: '3.0.3',
    info: {
      title: 'Wrapper API',
      description:
        'Multi-tenant SaaS platform API — centralized authentication, billing, credit management, ' +
        'RBAC, and application orchestration for business applications.',
      version: '1.0.0',
      contact: {
        name: 'Wrapper Team',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Local development',
      },
    ],
    tags: TAG_DEFINITIONS.map(t => ({ name: t.name, description: t.description })),
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token from Kinde OAuth2 flow. Pass as: Authorization: Bearer <token>',
        },
        CookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
          description: 'Session cookie set after OAuth2 callback',
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  transform({ schema, url, route }) {
    const transformed = { ...schema };

    if (!transformed.tags || transformed.tags.length === 0) {
      transformed.tags = [resolveTag(url)];
    }

    if (!transformed.description && !transformed.summary) {
      const method = (route as any)?.method || '';
      const cleanUrl = url.replace(/\/api/, '').replace(/:(\w+)/g, '{$1}');
      transformed.summary = `${method} ${cleanUrl}`;
    }

    return { schema: transformed, url };
  },
};

export const swaggerUiOptions: FastifySwaggerUiOptions = {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    filter: true,
    tagsSorter: 'alpha',
    operationsSorter: 'method',
    persistAuthorization: true,
  },
  uiHooks: {
    onRequest(_request, _reply, next) { next(); },
    preHandler(_request, _reply, next) { next(); },
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject) => {
    return swaggerObject;
  },
  transformSpecificationClone: true,
};
