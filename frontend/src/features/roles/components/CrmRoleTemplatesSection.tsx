import { useNavigate } from '@tanstack/react-router';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/components/theme/ThemeProvider';
import { cn } from '@/lib/utils';
import { CRM_ROLE_TEMPLATES, countTemplatePermissions, type CrmRoleTemplate } from '@/data/crm-role-templates';

function TemplateCard({ template }: { template: CrmRoleTemplate }) {
  const navigate = useNavigate();
  const { actualTheme } = useTheme();
  const { total, modules } = countTemplatePermissions(template);

  const isDark = actualTheme === 'dark';
  const isMono = actualTheme === 'monochrome';

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 transition-shadow hover:shadow-md',
        isDark ? 'bg-slate-900 border-slate-700' : isMono ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200',
      )}
    >
      {/* Color strip + name */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{ backgroundColor: `${template.color}18`, border: `1.5px solid ${template.color}35` }}
        >
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: template.color }} />
        </div>
        <div className="min-w-0">
          <p
            className={cn('text-sm font-semibold truncate', isDark ? 'text-white' : isMono ? 'text-gray-100' : 'text-slate-800')}
            style={{ fontFamily: 'var(--zk-display)', letterSpacing: '-0.02em' }}
          >
            {template.roleName}
          </p>
          <p
            className={cn('text-xs truncate', isDark ? 'text-slate-400' : isMono ? 'text-gray-400' : 'text-slate-500')}
            style={{ fontFamily: 'var(--zk-font)' }}
          >
            {template.description}
          </p>
        </div>
      </div>

      {/* Permission counts */}
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className={cn(
            'text-[10px] px-2 py-0.5',
            isDark ? 'bg-slate-800 text-slate-300 border-slate-600' : isMono ? 'bg-gray-800 text-gray-300' : 'bg-slate-100 text-slate-600',
          )}
          style={{ fontFamily: 'var(--zk-mono)', letterSpacing: '0.04em' }}
        >
          {modules} modules
        </Badge>
        <Badge
          variant="secondary"
          className={cn(
            'text-[10px] px-2 py-0.5',
            isDark ? 'bg-slate-800 text-slate-300 border-slate-600' : isMono ? 'bg-gray-800 text-gray-300' : 'bg-slate-100 text-slate-600',
          )}
          style={{ fontFamily: 'var(--zk-mono)', letterSpacing: '0.04em' }}
        >
          {total} permissions
        </Badge>
      </div>

      {/* Action */}
      <Button
        size="sm"
        variant="outline"
        className={cn(
          'w-full gap-1.5 mt-auto text-xs',
          isDark ? 'border-slate-600 hover:bg-slate-800 text-slate-200' : isMono ? 'border-gray-600 hover:bg-gray-800 text-gray-200' : '',
        )}
        style={{ borderColor: `${template.color}40`, color: template.color }}
        onClick={() => navigate({ to: `/dashboard/roles/new?template=${template.key}` })}
      >
        Use Template
        <ArrowRight className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function CrmRoleTemplatesSection() {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const isMono = actualTheme === 'monochrome';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className={cn('h-4 w-4', isDark ? 'text-purple-400' : isMono ? 'text-gray-400' : 'text-slate-500')} />
        <span
          className={cn('text-sm font-semibold', isDark ? 'text-white' : isMono ? 'text-gray-100' : 'text-slate-700')}
          style={{ fontFamily: 'var(--zk-display)', letterSpacing: '-0.02em' }}
        >
          CRM Role Templates
        </span>
        <span
          className={cn('text-xs', isDark ? 'text-slate-400' : isMono ? 'text-gray-400' : 'text-slate-400')}
          style={{ fontFamily: 'var(--zk-font)' }}
        >
          — start from a preset, customise before saving
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {CRM_ROLE_TEMPLATES.map((template) => (
          <TemplateCard key={template.key} template={template} />
        ))}
      </div>
    </div>
  );
}
