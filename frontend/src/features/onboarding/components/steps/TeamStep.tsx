import React from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UseFormReturn } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { newBusinessData, existingBusinessData, TeamMember } from '../../schemas';
import { UserClassification } from '../FlowSelector';

interface TeamStepProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>;
  onAddMember: () => void;
  onUpdateMember: (id: number, field: keyof TeamMember, value: string) => void;
  onRemoveMember: (id: number) => void;
  userClassification?: UserClassification;
}

export const TeamStep = ({ form, onAddMember, onUpdateMember, onRemoveMember, userClassification }: TeamStepProps) => {
  // Use useWatch to prevent re-renders
  const teamMembers = useWatch({ control: form.control, name: 'teamMembers' });
  const team = Array.isArray(teamMembers) ? teamMembers : [];

  React.useEffect(() => {
    if (teamMembers === undefined) {
      form.setValue('teamMembers', [], { shouldValidate: false, shouldDirty: false, shouldTouch: false });
    }
  }, [teamMembers]);

  const getPersonalizedContent = () => {
    switch (userClassification) {
      case 'aspiringFounder':
        return {
          title: 'Build your startup team',
          description: 'Add co-founders and key team members to your startup.',
          placeholder: 'Co-founder, CTO, Head of Marketing, etc.',
          maxMembers: 5,
          showSuggestions: true
        };
      case 'corporateEmployee':
        return {
          title: 'Add team members',
          description: 'Include colleagues and department members.',
          placeholder: 'Manager, Team Lead, Department Head, etc.',
          maxMembers: 10,
          showSuggestions: true
        };
      case 'enterprise':
        return {
          title: 'Enterprise team configuration',
          description: 'Set up your enterprise team structure.',
          placeholder: 'Executive, VP, etc.',
          maxMembers: 20,
          showSuggestions: true
        };
      default:
        return {
          title: 'Team members',
          description: 'Add team members who will be part of your company.',
          placeholder: 'Role',
          maxMembers: 5,
          showSuggestions: false
        };
    }
  };

  const personalizedContent = getPersonalizedContent();
  const getRoleSuggestions = () => {
    switch (userClassification) {
      case 'aspiringFounder': return ['Co-founder', 'CTO', 'Lead Dev', 'Product'];
      case 'corporateEmployee': return ['Dept Head', 'Lead', 'Senior', 'PM'];
      case 'enterprise': return ['Executive', 'VP', 'Director'];
      default: return ['Manager', 'Senior', 'Associate'];
    }
  };
  const roleSuggestions = getRoleSuggestions();

  const inputClasses = "h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        {userClassification && userClassification !== 'aspiringFounder' && (
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide mb-2">
              {userClassification.replace(/([A-Z])/g, ' $1').trim()}
            </Badge>
          )}
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          {personalizedContent.title}
        </h1>
        <p className="text-lg text-slate-500 leading-relaxed max-w-2xl">
          {personalizedContent.description}
        </p>
      </div>

      <div className="max-w-4xl">
        <div className="grid gap-6">
          {team.map((member, index) => (
            <div key={member.id} className="group relative glass-card rounded-2xl p-6 shadow-soft hover:shadow-glow">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-blue-50">
                    {index + 1}
                  </div>
                  <h3 className="font-semibold text-primary">Team Member</h3>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveMember(member.id)}
                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full h-8 w-8 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Full Name</label>
                  <Input
                    type="text"
                    value={member.name}
                    onChange={(e) => onUpdateMember(member.id, 'name', e.target.value)}
                    placeholder="Jane Doe"
                    className={inputClasses}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Role</label>
                  <Input
                    type="text"
                    value={member.role}
                    onChange={(e) => onUpdateMember(member.id, 'role', e.target.value)}
                    placeholder={personalizedContent.placeholder}
                    className={inputClasses}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email</label>
                  <Input
                    type="email"
                    value={member.email}
                    onChange={(e) => onUpdateMember(member.id, 'email', e.target.value)}
                    placeholder="jane@company.com"
                    className={inputClasses}
                  />
                </div>
              </div>

              {personalizedContent.showSuggestions && !member.role && (
                <div className="mt-4 flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-slate-500 font-medium">Suggestions:</span>
                  {roleSuggestions.slice(0, 4).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => onUpdateMember(member.id, 'role', role)}
                      className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 font-medium"
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
              className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 group bg-white/50 w-full"
            >
              <div className="w-12 h-12 bg-white rounded-full shadow-md border border-slate-100 flex items-center justify-center mb-3">
                <UserPlus className="w-6 h-6 text-blue-500" />
              </div>
              <span className="font-semibold text-lg">Add Team Member</span>
              <span className="text-sm opacity-70 mt-1">
                {personalizedContent.maxMembers - team.length} slots remaining
              </span>
            </button>
          )}

          {team.length >= personalizedContent.maxMembers && (
             <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-center text-amber-800 text-sm font-medium">
               Maximum team capacity reached for this plan.
             </div>
          )}
        </div>
      </div>
    </div>
  );
};