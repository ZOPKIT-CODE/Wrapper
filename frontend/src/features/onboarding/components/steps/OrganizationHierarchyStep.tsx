import React, { useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Building2, MapPin, Users, ArrowRight, CheckCircle2, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { newBusinessData, existingBusinessData } from '../../schemas';
import { UserClassification } from '../FlowSelector';

interface OrganizationHierarchyStepProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>;
  userClassification?: UserClassification;
}

const hierarchyLevels = [
  {
    level: 1,
    name: 'Primary Organization',
    icon: Building2,
    description: 'Your main company entity',
    color: 'bg-blue-500',
    example: 'Acme Corporation'
  },
  {
    level: 2,
    name: 'Sub-Organizations',
    icon: Building2,
    description: 'Divisions or subsidiaries',
    color: 'bg-indigo-500',
    example: 'Acme Tech Division'
  },
  {
    level: 3,
    name: 'Locations',
    icon: MapPin,
    description: 'Physical offices or branches',
    color: 'bg-purple-500',
    example: 'New York Office'
  },
  {
    level: 4,
    name: 'Departments',
    icon: Users,
    description: 'Teams within locations',
    color: 'bg-pink-500',
    example: 'Engineering Team'
  }
];

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const OrganizationHierarchyStep: React.FC<OrganizationHierarchyStepProps> = ({ form }) => {
  useEffect(() => {
    form.setValue('organizationHierarchyViewed', true, { shouldValidate: false });
  }, [form]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-primary">Organization Structure</h2>
            <p className="text-slate-600 text-sm">Learn how to organize your company hierarchy</p>
          </div>
        </div>
      </motion.div>

      {/* Info Banner */}
      <motion.div variants={fadeInUp}>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900">
                  Understanding Your Organization Hierarchy
                </p>
                <p className="text-sm text-blue-700">
                  Your organization structure helps you manage teams, allocate credits, and control access across different parts of your business. You can set this up after onboarding.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Hierarchy Visualization */}
      <motion.div variants={fadeInUp} className="space-y-4">
        <h3 className="text-lg font-semibold text-primary">Hierarchy Levels</h3>
        <div className="space-y-3">
          {hierarchyLevels.map((level, index) => {
            const Icon = level.icon;
            return (
              <motion.div
                key={level.level}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
              >
                <Card className="hover:shadow-md transition-shadow duration-300 border-l-4 border-l-blue-500">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-lg ${level.color} flex items-center justify-center flex-shrink-0 shadow-md`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-primary">{level.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            Level {level.level}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{level.description}</p>
                        <p className="text-xs text-slate-500 italic">Example: {level.example}</p>
                      </div>
                      {index < hierarchyLevels.length - 1 && (
                        <ArrowRight className="w-5 h-5 text-slate-400 flex-shrink-0 mt-3" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Visual Tree */}
      <motion.div variants={fadeInUp} className="mt-8">
        <Card className="bg-gradient-to-br from-slate-50 to-blue-50/30">
          <CardHeader>
            <CardTitle className="text-lg">Visual Example</CardTitle>
            <CardDescription>How your hierarchy will look</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Tree visualization */}
              <div className="flex flex-col items-center space-y-3">
                {/* Level 1 */}
                <div className="relative">
                  <div className="px-6 py-3 bg-blue-500 text-white rounded-lg shadow-md font-medium">
                    Primary Organization
                  </div>
                  <div className="absolute left-1/2 top-full w-0.5 h-4 bg-slate-300 transform -translate-x-1/2" />
                </div>

                {/* Level 2 */}
                <div className="flex gap-4">
                  <div className="relative">
                    <div className="px-4 py-2 bg-indigo-500 text-white rounded-lg shadow-md text-sm">
                      Sub-Org
                    </div>
                    <div className="absolute left-1/2 top-full w-0.5 h-4 bg-slate-300 transform -translate-x-1/2" />
                  </div>
                  <div className="relative">
                    <div className="px-4 py-2 bg-indigo-500 text-white rounded-lg shadow-md text-sm">
                      Sub-Org
                    </div>
                    <div className="absolute left-1/2 top-full w-0.5 h-4 bg-slate-300 transform -translate-x-1/2" />
                  </div>
                </div>

                {/* Level 3 */}
                <div className="flex gap-3">
                  <div className="px-3 py-1.5 bg-purple-500 text-white rounded-md shadow-sm text-xs">
                    Location
                  </div>
                  <div className="px-3 py-1.5 bg-purple-500 text-white rounded-md shadow-sm text-xs">
                    Location
                  </div>
                </div>

                {/* Level 4 */}
                <div className="flex gap-2">
                  <div className="px-2 py-1 bg-pink-500 text-white rounded text-xs">
                    Dept
                  </div>
                  <div className="px-2 py-1 bg-pink-500 text-white rounded text-xs">
                    Dept
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Benefits */}
      <motion.div variants={fadeInUp} className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Benefits of Organization Structure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {[
                'Allocate credits to specific departments or locations',
                'Control access and permissions at different levels',
                'Track usage and analytics per organization unit',
                'Manage teams and users within their departments',
                'Scale your structure as your business grows'
              ].map((benefit, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="flex items-start gap-2 text-sm text-slate-700"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{benefit}</span>
                </motion.li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};
