import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CRM_ROLE_TEMPLATES,
  countTemplatePermissions,
  type CrmRoleTemplate,
} from '@/data/crm-role-templates'

function TemplateCard({ template }: { template: CrmRoleTemplate }) {
  const navigate = useNavigate()
  const { total, modules } = countTemplatePermissions(template)

  return (
    <div className="border-border bg-card hover:border-primary/30 flex flex-col gap-3 rounded-lg border p-4 transition-colors">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `${template.color}18`,
            border: `1.5px solid ${template.color}35`,
          }}
        >
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: template.color }}
          />
        </div>
        <div className="min-w-0">
          <p
            className="text-foreground truncate text-sm font-semibold"
            style={{
              fontFamily: 'var(--zk-display)',
              letterSpacing: '-0.02em',
            }}
          >
            {template.roleName}
          </p>
          <p
            className="text-muted-foreground truncate text-xs"
            style={{ fontFamily: 'var(--zk-font)' }}
          >
            {template.description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="bg-muted text-muted-foreground px-2 py-0.5 text-[10px]"
          style={{ fontFamily: 'var(--zk-mono)', letterSpacing: '0.04em' }}
        >
          {modules} modules
        </Badge>
        <Badge
          variant="secondary"
          className="bg-muted text-muted-foreground px-2 py-0.5 text-[10px]"
          style={{ fontFamily: 'var(--zk-mono)', letterSpacing: '0.04em' }}
        >
          {total} permissions
        </Badge>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="mt-auto w-full gap-1.5 text-xs"
        style={{ borderColor: `${template.color}40`, color: template.color }}
        onClick={() =>
          navigate({ to: `/dashboard/roles/new?template=${template.key}` })
        }
      >
        Use Template
        <ArrowRight className="h-3 w-3" />
      </Button>
    </div>
  )
}

export function CrmRoleTemplatesSection() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="text-muted-foreground h-4 w-4" />
        <span
          className="text-foreground text-sm font-semibold"
          style={{ fontFamily: 'var(--zk-display)', letterSpacing: '-0.02em' }}
        >
          CRM Role Templates
        </span>
        <span
          className="text-muted-foreground text-xs"
          style={{ fontFamily: 'var(--zk-font)' }}
        >
          — start from a preset, customise before saving
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CRM_ROLE_TEMPLATES.map((template) => (
          <TemplateCard key={template.key} template={template} />
        ))}
      </div>
    </div>
  )
}
