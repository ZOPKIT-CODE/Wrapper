import React from 'react'
import { UserPlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { UseFormReturn } from 'react-hook-form'
import { useWatch } from 'react-hook-form'
import {
  newBusinessData,
  existingBusinessData,
  TeamMember,
} from '../../schemas'
import { UserClassification } from '../FlowSelector'

interface TeamStepProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>
  onAddMember: () => void
  onUpdateMember: (id: number, field: keyof TeamMember, value: string) => void
  onRemoveMember: (id: number) => void
  userClassification?: UserClassification
}

export const TeamStep = ({
  form,
  onAddMember,
  onUpdateMember,
  onRemoveMember,
  userClassification,
}: TeamStepProps) => {
  // Use useWatch to prevent re-renders
  const teamMembers = useWatch({ control: form.control, name: 'teamMembers' })
  const team = Array.isArray(teamMembers) ? teamMembers : []

  React.useEffect(() => {
    if (teamMembers === undefined) {
      form.setValue('teamMembers', [], {
        shouldValidate: false,
        shouldDirty: false,
        shouldTouch: false,
      })
    }
  }, [teamMembers, form])

  const getPersonalizedContent = () => {
    switch (userClassification) {
      case 'aspiringFounder':
        return {
          title: 'Build your startup team',
          description: 'Add co-founders and key team members to your startup.',
          placeholder: 'Co-founder, CTO, Head of Marketing, etc.',
          maxMembers: 5,
          showSuggestions: true,
        }
      case 'corporateEmployee':
        return {
          title: 'Add team members',
          description: 'Include colleagues and department members.',
          placeholder: 'Manager, Team Lead, Department Head, etc.',
          maxMembers: 10,
          showSuggestions: true,
        }
      case 'enterprise':
        return {
          title: 'Enterprise team configuration',
          description: 'Set up your enterprise team structure.',
          placeholder: 'Executive, VP, etc.',
          maxMembers: 20,
          showSuggestions: true,
        }
      default:
        return {
          title: 'Team members',
          description: 'Add team members who will be part of your company.',
          placeholder: 'Role',
          maxMembers: 5,
          showSuggestions: false,
        }
    }
  }

  const personalizedContent = getPersonalizedContent()
  const getRoleSuggestions = () => {
    switch (userClassification) {
      case 'aspiringFounder':
        return ['Co-founder', 'CTO', 'Lead Dev', 'Product']
      case 'corporateEmployee':
        return ['Dept Head', 'Lead', 'Senior', 'PM']
      case 'enterprise':
        return ['Executive', 'VP', 'Director']
      default:
        return ['Manager', 'Senior', 'Associate']
    }
  }
  const roleSuggestions = getRoleSuggestions()

  const inputClasses =
    'h-11 rounded-xl border-border bg-muted/50 focus:bg-background focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm'

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        {userClassification && userClassification !== 'aspiringFounder' && (
          <Badge
            variant="secondary"
            className="mb-2 rounded-full border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold tracking-wide text-blue-700 uppercase"
          >
            {userClassification.replace(/([A-Z])/g, ' $1').trim()}
          </Badge>
        )}
        <h1 className="text-primary text-3xl font-bold tracking-tight">
          {personalizedContent.title}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed">
          {personalizedContent.description}
        </p>
      </div>

      <div className="max-w-4xl">
        <div className="grid gap-6">
          {team.map((member, index) => (
            <div
              key={member.id}
              className="group glass-card shadow-soft hover:shadow-glow relative rounded-2xl p-6"
            >
              <div className="mb-6 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600 shadow-sm ring-2 ring-blue-50">
                    {index + 1}
                  </div>
                  <h3 className="text-primary font-semibold">Team Member</h3>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveMember(member.id)}
                  className="text-muted-foreground h-8 w-8 rounded-full p-0 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground ml-1 text-xs font-bold tracking-wider uppercase">
                    Full Name
                  </label>
                  <Input
                    type="text"
                    value={member.name}
                    onChange={(e) =>
                      onUpdateMember(member.id, 'name', e.target.value)
                    }
                    placeholder="Jane Doe"
                    className={inputClasses}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-muted-foreground ml-1 text-xs font-bold tracking-wider uppercase">
                    Role
                  </label>
                  <Input
                    type="text"
                    value={member.role}
                    onChange={(e) =>
                      onUpdateMember(member.id, 'role', e.target.value)
                    }
                    placeholder={personalizedContent.placeholder}
                    className={inputClasses}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-muted-foreground ml-1 text-xs font-bold tracking-wider uppercase">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={member.email}
                    onChange={(e) =>
                      onUpdateMember(member.id, 'email', e.target.value)
                    }
                    placeholder="jane@company.com"
                    className={inputClasses}
                  />
                </div>
              </div>

              {personalizedContent.showSuggestions && !member.role && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs font-medium">
                    Suggestions:
                  </span>
                  {roleSuggestions.slice(0, 4).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => onUpdateMember(member.id, 'role', role)}
                      className="bg-muted text-muted-foreground rounded-md px-2.5 py-1 text-xs font-medium hover:bg-blue-100 hover:text-blue-700"
                    >
                      {role}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {team.length < personalizedContent.maxMembers && (
            <button
              type="button"
              onClick={onAddMember}
              disabled={team.length >= personalizedContent.maxMembers}
              className="border-border text-muted-foreground hover:bg-primary/5/50 group bg-card/50 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 hover:border-blue-400 hover:text-blue-600"
            >
              <div className="bg-card border-border mb-3 flex h-12 w-12 items-center justify-center rounded-full border shadow-md">
                <UserPlus className="h-6 w-6 text-blue-500" />
              </div>
              <span className="text-lg font-semibold">Add Team Member</span>
              <span className="mt-1 text-sm opacity-70">
                {personalizedContent.maxMembers - team.length} slots remaining
              </span>
            </button>
          )}

          {team.length >= personalizedContent.maxMembers && (
            <div className="flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
              Maximum team capacity reached for this plan.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
