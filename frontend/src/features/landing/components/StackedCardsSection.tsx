import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, Activity, TrendingUp, Calendar, DollarSign, Users, Award, Layers, BarChart3, PieChart, List, FileText, MapPin, UserPlus, Share2, Code, Layout, Globe, Zap, Box } from 'lucide-react';
import { BusinessApp, Product } from '../../types';

interface CardProps {
  app: BusinessApp;
  index: number;
  isActive: boolean;
  onClick: () => void;
}

// --- COLOR THEME MAPPING ---

// Pre-defined maps to ensure Tailwind classes are always generated correctly
const THEMES: Record<string, any> = {
  blue: {
    bgLight: 'bg-blue-50',
    bgMedium: 'bg-blue-100',
    bgDark: 'bg-[#1B2E5A]',
    textLight: 'text-blue-500',
    textDark: 'text-blue-700',
    border: 'border-blue-200',
    gradient: 'from-blue-500 to-cyan-500',
    shadow: 'shadow-blue-500/20'
  },
  green: {
    bgLight: 'bg-emerald-50',
    bgMedium: 'bg-emerald-100',
    bgDark: 'bg-emerald-600',
    textLight: 'text-emerald-500',
    textDark: 'text-emerald-700',
    border: 'border-emerald-200',
    gradient: 'from-emerald-500 to-green-500',
    shadow: 'shadow-emerald-500/20'
  },
  purple: {
    bgLight: 'bg-purple-50',
    bgMedium: 'bg-purple-100',
    bgDark: 'bg-purple-600',
    textLight: 'text-purple-500',
    textDark: 'text-purple-700',
    border: 'border-purple-200',
    gradient: 'from-purple-500 to-pink-500',
    shadow: 'shadow-purple-500/20'
  },
  orange: {
    bgLight: 'bg-orange-50',
    bgMedium: 'bg-orange-100',
    bgDark: 'bg-orange-600',
    textLight: 'text-orange-500',
    textDark: 'text-orange-700',
    border: 'border-orange-200',
    gradient: 'from-orange-500 to-red-500',
    shadow: 'shadow-orange-500/20'
  },
  indigo: {
    bgLight: 'bg-indigo-50',
    bgMedium: 'bg-indigo-100',
    bgDark: 'bg-[#1B2E5A]',
    textLight: 'text-indigo-500',
    textDark: 'text-indigo-700',
    border: 'border-indigo-200',
    gradient: 'from-indigo-500 to-violet-500',
    shadow: 'shadow-indigo-500/20'
  },
  teal: {
    bgLight: 'bg-teal-50',
    bgMedium: 'bg-teal-100',
    bgDark: 'bg-teal-600',
    textLight: 'text-teal-500',
    textDark: 'text-teal-700',
    border: 'border-teal-200',
    gradient: 'from-teal-500 to-emerald-500',
    shadow: 'shadow-teal-500/20'
  }
};

// --- VISUAL COMPONENTS ---

// --- VISUAL TEMPLATES ---

const ChartVisual = ({ type = 'bar', color = 'blue' }: { type?: 'bar' | 'line' | 'pie', color?: string }) => {
  const theme = THEMES[color] || THEMES['blue'];
  return (
    <div className="w-full h-full p-6 flex flex-col preserve-3d">
      <div className="flex justify-between items-center mb-6" style={{ transform: 'translateZ(20px)' }}>
        <div className="bg-white/80 backdrop-blur px-4 py-2 rounded-xl shadow-sm border border-slate-100">
          <span className={`text-xs font-bold ${theme.textDark} uppercase tracking-wide`}>Analytics</span>
        </div>
        <BarChart3 className={`w-5 h-5 ${theme.textLight}`} />
      </div>
      <div className="flex-1 bg-white/50 backdrop-blur-sm rounded-xl border border-white/60 p-4 flex items-end justify-between gap-2 relative shadow-inner" style={{ transform: 'translateZ(10px)' }}>
        {[40, 70, 50, 90, 60, 80, 45].map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ duration: 0.8, delay: i * 0.1 }}
            className={`flex-1 rounded-t-lg ${theme.bgDark} opacity-90`}
          />
        ))}
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-20">
          <div className="w-full h-px bg-slate-400"></div>
          <div className="w-full h-px bg-slate-400"></div>
          <div className="w-full h-px bg-slate-400"></div>
        </div>
      </div>
    </div>
  );
};

const PipelineVisual = ({ color = 'blue' }: { color?: string }) => {
  const theme = THEMES[color] || THEMES['blue'];
  return (
    <div className="w-full h-full p-6 flex flex-col gap-3 preserve-3d">
      <div className="flex justify-between items-center mb-2" style={{ transform: 'translateZ(20px)' }}>
        <span className="text-sm font-bold text-slate-700">Pipeline Stages</span>
        <span className={`text-xs ${theme.bgLight} ${theme.textDark} px-2 py-1 rounded-full font-bold`}>Active</span>
      </div>
      {[
        { label: 'Lead In', val: '100%', count: 45 },
        { label: 'Contacted', val: '75%', count: 32 },
        { label: 'Qualified', val: '50%', count: 18 },
        { label: 'Negotiation', val: '25%', count: 8 }
      ].map((stage, i) => (
        <div key={i} className="relative" style={{ transform: `translateZ(${15 - i * 3}px)` }}>
          <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mb-1">
            <span>{stage.label}</span>
            <span>{stage.count}</span>
          </div>
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: stage.val }}
              transition={{ duration: 1, delay: i * 0.2 }}
              className={`h-full ${theme.bgDark} rounded-full`}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const TableVisual = ({ color = 'blue' }: { color?: string }) => {
  const theme = THEMES[color] || THEMES['blue'];
  return (
    <div className="w-full h-full p-5 flex flex-col gap-3 preserve-3d">
      <div className="flex items-center gap-2 mb-2" style={{ transform: 'translateZ(20px)' }}>
        <List className={`w-4 h-4 ${theme.textDark}`} />
        <span className="text-sm font-bold text-slate-700">Records</span>
      </div>
      <div className="bg-white/60 backdrop-blur-md rounded-xl border border-white/50 shadow-sm overflow-hidden flex-1" style={{ transform: 'translateZ(10px)' }}>
        <div className="grid grid-cols-4 gap-2 p-3 border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase">
          <span className="col-span-2">Name</span>
          <span>Status</span>
          <span className="text-right">Value</span>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="grid grid-cols-4 gap-2 p-3 border-b border-slate-50 items-center hover:bg-white/80 transition-colors"
          >
            <div className="col-span-2 flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full ${theme.bgLight} flex-shrink-0`}></div>
              <div className="h-2 w-16 bg-slate-200 rounded-full"></div>
            </div>
            <div><div className={`h-4 w-12 ${i % 2 === 0 ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'} rounded-full flex items-center justify-center text-[8px] font-bold`}>ACTIVE</div></div>
            <div className="text-right"><div className="h-2 w-8 bg-slate-200 rounded-full ml-auto"></div></div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const KanbanVisual = ({ color = 'blue' }: { color?: string }) => {
  const theme = THEMES[color] || THEMES['blue'];
  return (
    <div className="w-full h-full p-4 flex gap-3 preserve-3d">
      {['To Do', 'In Prog', 'Done'].map((col, i) => (
        <div key={i} className="flex-1 bg-slate-50/80 rounded-xl border border-slate-100 p-2 flex flex-col gap-2" style={{ transform: `translateZ(${10 + i * 5}px)` }}>
          <div className="text-[10px] font-bold text-slate-400 uppercase px-1">{col}</div>
          {[1, 2].map((card) => (
            <div
              key={card}
              className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 hover:scale-105 hover:-translate-y-0.5 transition-transform"
            >
              <div className={`w-8 h-1 rounded-full ${theme.bgDark} mb-2 opacity-50`}></div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full mb-1"></div>
              <div className="h-1.5 w-2/3 bg-slate-100 rounded-full"></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const MapVisual = ({ color = 'blue' }: { color?: string }) => {
  const theme = THEMES[color] || THEMES['blue'];
  return (
    <div className="w-full h-full relative overflow-hidden rounded-2xl preserve-3d bg-slate-50">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      {/* Map Points */}
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ top: `${20 + i * 25}%`, left: `${30 + i * 20}%`, transform: 'translateZ(20px)' }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.2 }}
        >
          <div className={`relative flex items-center justify-center w-8 h-8 rounded-full ${theme.bgLight} shadow-lg border-2 border-white text-white`}>
            <MapPin className={`w-4 h-4 ${theme.textDark}`} />
            <div className={`absolute -bottom-1 w-1 h-1 bg-slate-400 rounded-full`}></div>
          </div>
          <motion.div
            className={`absolute inset-0 rounded-full ${theme.bgDark}`}
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: 0, scale: 2 }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
      ))}
    </div>
  );
};

const DocumentVisual = ({ color = 'blue' }: { color?: string }) => {
  const theme = THEMES[color] || THEMES['blue'];
  return (
    <div className="w-full h-full p-8 flex items-center justify-center preserve-3d">
      <div
        className="w-48 bg-white rounded-xl shadow-xl border border-slate-100 p-6 relative hover:scale-105 hover:-rotate-2 transition-transform"
        style={{ transform: 'translateZ(20px)' }}
      >
        <div className={`w-10 h-10 rounded-lg ${theme.bgLight} flex items-center justify-center mb-4`}>
          <FileText className={`w-5 h-5 ${theme.textDark}`} />
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full bg-slate-200 rounded-full"></div>
          <div className="h-2 w-3/4 bg-slate-200 rounded-full"></div>
          <div className="h-2 w-1/2 bg-slate-200 rounded-full"></div>
        </div>
        <div className="mt-6 flex justify-between items-center">
          <div className="h-6 w-16 bg-slate-100 rounded-md"></div>
          <div className={`h-6 w-6 rounded-full ${theme.bgDark} flex items-center justify-center text-white`}>
            <Check size={12} />
          </div>
        </div>
      </div>
    </div>
  );
};

const NetworkVisual = ({ color = 'blue' }: { color?: string }) => {
  const theme = THEMES[color] || THEMES['blue'];
  return (
    <div className="w-full h-full relative flex items-center justify-center preserve-3d">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-64 h-64 rounded-full border border-slate-100 animate-[spin_10s_linear_infinite] will-change-transform"></div>
        <div className="absolute w-40 h-40 rounded-full border border-slate-100 animate-[spin_15s_linear_infinite_reverse] will-change-transform"></div>
      </div>
      <motion.div className={`relative z-10 w-16 h-16 rounded-full ${theme.bgDark} shadow-xl flex items-center justify-center text-white`} style={{ transform: 'translateZ(30px)' }}>
        <Globe size={24} />
      </motion.div>
      {[0, 72, 144, 216, 288].map((deg, i) => (
        <motion.div
          key={i}
          className={`absolute w-10 h-10 rounded-full bg-white shadow-lg border border-slate-100 flex items-center justify-center ${theme.textDark}`}
          style={{
            transform: `rotate(${deg}deg) translate(100px) rotate(-${deg}deg) translateZ(20px)`
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.1 }}
        >
          <Users size={16} />
        </motion.div>
      ))}
    </div>
  );
};

const CodeVisual = ({ color = 'blue' }: { color?: string }) => {
  const theme = THEMES[color] || THEMES['blue'];
  return (
    <div className="w-full h-full p-6 flex items-center justify-center preserve-3d">
      <div className="w-full max-w-sm bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-700" style={{ transform: 'translateZ(20px)' }}>
        <div className="bg-slate-800 p-2 flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
        </div>
        <div className="p-4 space-y-2 font-mono text-[10px]">
          <div className="flex gap-2">
            <span className="text-purple-400">const</span>
            <span className="text-blue-400">workflow</span>
            <span className="text-white">=</span>
            <span className="text-yellow-300">async</span>
            <span className="text-white">()</span>
            <span className="text-white">{'=>'}</span>
            <span className="text-white">{'{'}</span>
          </div>
          <div className="pl-4 flex gap-2">
            <span className="text-purple-400">await</span>
            <span className="text-green-400">trigger</span>
            <span className="text-white">.</span>
            <span className="text-blue-300">on</span>
            <span className="text-white">('new_lead');</span>
          </div>
          <div className="pl-4 flex gap-2">
            <span className="text-purple-400">if</span>
            <span className="text-white">(</span>
            <span className="text-blue-300">score</span>
            <span className="text-white">{'>'}</span>
            <span className="text-orange-400">80</span>
            <span className="text-white">)</span>
            <span className="text-white">{'{'}</span>
          </div>
          <div className="pl-8 flex gap-2">
            <span className="text-green-400">notify</span>
            <span className="text-white">.</span>
            <span className="text-blue-300">salesTeam</span>
            <span className="text-white">();</span>
          </div>
          <div className="pl-4 text-white">{'}'}</div>
          <div className="text-white">{'}'}</div>
        </div>
      </div>
    </div>
  );
};

// --- MAPPING LOGIC ---

// Comprehensive explicit mapping: product name -> module name -> visual type
const MODULE_VISUAL_MAP: Record<string, Record<string, 'chart' | 'table' | 'pipeline' | 'kanban' | 'map' | 'document' | 'code' | 'network'>> = {
  'b2b crm': {
    'lead management': 'table',
    'contact management': 'table',
    'opportunity management': 'pipeline',
    'visual pipeline': 'pipeline',
    'quote-to-order': 'document',
    'invoice management': 'document',
    'task management': 'kanban',
    'sales analytics': 'chart',
    'mobile crm': 'table',
    'integrations': 'code',
  },
  'operations management': {
    'inventory management': 'table',
    'warehouse management': 'table',
    'procurement': 'table',
    'logistics': 'map',
    'order management': 'table',
    'multi-vendor': 'table',
    'quality control': 'table',
    'service management': 'table',
    'mobile warehouse': 'table',
    'analytics': 'chart',
  },
  'project management': {
    'project planning': 'kanban',
    'agile & scrum': 'kanban',
    'task management': 'kanban',
    'time tracking': 'table',
    'resource planning': 'table',
    'collaboration': 'table',
    'project analytics': 'chart',
    'hr integration': 'table',
    'accounting link': 'table',
    'mobile app': 'table',
  },
  'financial accounting': {
    'general ledger': 'table',
    'accounts payable': 'table',
    'accounts receivable': 'table',
    'banking': 'table',
    'tax management': 'table',
    'multi-entity': 'table',
    'cost accounting': 'chart',
    'financial reporting': 'document',
    'ai forecasting': 'chart',
    'integration': 'code',
  },
  'hrms': {
    'employee management': 'table',
    'recruitment': 'table',
    'onboarding': 'table',
    'time & attendance': 'table',
    'leave management': 'table',
    'payroll': 'table',
    'performance': 'table',
    'benefits': 'table',
    'self-service': 'table',
    'hr analytics': 'chart',
  },
  'esop system': {
    'scheme management': 'table',
    'grant management': 'table',
    'vesting': 'table',
    'exercise management': 'table',
    'cap table': 'chart',
    'valuation': 'chart',
    'compliance': 'document',
    'employee portal': 'table',
    'tax management': 'table',
    'analytics': 'chart',
  },
  'zopkit academy': {
    'course management': 'table',
    'assessment engine': 'table',
    'certificates': 'document',
    'gamification': 'chart',
    'learning paths': 'table',
    'ai tutor': 'table',
    'student portal': 'table',
    'instructor tools': 'table',
    'analytics': 'chart',
    'integration': 'code',
  },
  'zopkit itsm': {
    'incident management': 'table',
    'problem management': 'table',
    'change management': 'table',
    'asset management': 'table',
    'service catalog': 'table',
    'knowledge base': 'document',
    'config management': 'table',
    'it operations': 'chart',
    'reporting': 'chart',
    'integration': 'code',
  },
  'flowtilla': {
    'visual builder': 'code',
    'triggers': 'code',
    'actions': 'code',
    'logic & control': 'code',
    'ai components': 'code',
    'user tasks': 'table',
    'templates': 'table',
    'ai co-pilot': 'code',
    'monitoring': 'chart',
    'integration': 'code',
  },
  'b2c crm': {
    'ai campaign creator': 'table',
    'lifecycle management': 'pipeline',
    'smart segments': 'table',
    'engagement widgets': 'table',
    'ai journeys': 'pipeline',
    'analytics': 'chart',
  },
  'affiliate connect': {
    'affiliate management': 'table',
    'influencer hub': 'table',
    'campaign management': 'table',
    'commission engine': 'table',
    'payment system': 'table',
    'fraud detection': 'network',
    'ai pricing advisor': 'table',
    'analytics & reporting': 'chart',
    'mobile app': 'table',
    'integrations': 'code',
  },
};

// Helper function to normalize strings for matching
const normalizeString = (str: string): string => {
  return str.toLowerCase().trim();
};

// Helper function to find matching key in a record (fuzzy matching)
const findMatchingKey = (searchKey: string, record: Record<string, any>): string | null => {
  const normalized = normalizeString(searchKey);
  
  // Exact match first
  if (record[normalized]) {
    return normalized;
  }
  
  // Partial match - check if any key contains the search term or vice versa
  for (const key in record) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return key;
    }
  }
  
  return null;
};

const getModuleVisual = (productName: string, moduleName: string, color: string) => {
  const lowerMod = normalizeString(moduleName);
  const lowerProd = normalizeString(productName);

  // 1. Check explicit product+module mapping (most specific)
  const productKey = findMatchingKey(lowerProd, MODULE_VISUAL_MAP);
  if (productKey) {
    const moduleKey = findMatchingKey(lowerMod, MODULE_VISUAL_MAP[productKey]);
    if (moduleKey) {
      const visualType = MODULE_VISUAL_MAP[productKey][moduleKey];
      switch (visualType) {
        case 'chart':
          return <ChartVisual type="bar" color={color} />;
        case 'table':
          return <TableVisual color={color} />;
        case 'pipeline':
          return <PipelineVisual color={color} />;
        case 'kanban':
          return <KanbanVisual color={color} />;
        case 'map':
          return <MapVisual color={color} />;
        case 'document':
          return <DocumentVisual color={color} />;
        case 'code':
          return <CodeVisual color={color} />;
        case 'network':
          return <NetworkVisual color={color} />;
      }
    }
  }

  // 2. Product-specific overrides (Flowtilla always code, etc.)
  if (lowerProd.includes('flowtilla')) {
    return <CodeVisual color={color} />;
  }
  if (lowerProd.includes('affiliate') && (lowerMod.includes('fraud') || lowerMod.includes('network'))) {
    return <NetworkVisual color={color} />;
  }
  if (lowerProd.includes('operations') && (lowerMod.includes('logistics') || lowerMod.includes('transport'))) {
    return <MapVisual color={color} />;
  }

  // 3. Improved module-specific heuristics (with better priority)
  // Analytics/Reports should show charts
  if (lowerMod.includes('analytics') || lowerMod.includes('reporting') || lowerMod.includes('report') || 
      lowerMod.includes('dashboard') || lowerMod.includes('forecasting') || lowerMod.includes('valuation') ||
      lowerMod.includes('gamification') || lowerMod.includes('operations') && lowerMod.includes('it')) {
    return <ChartVisual type="bar" color={color} />;
  }
  
  // Pipelines and funnels
  if (lowerMod.includes('pipeline') || lowerMod.includes('funnel') || 
      (lowerMod.includes('opportunity') && lowerMod.includes('management')) ||
      lowerMod.includes('lifecycle') || lowerMod.includes('journey')) {
    return <PipelineVisual color={color} />;
  }
  
  // Documents, invoices, certificates
  if (lowerMod.includes('invoice') || lowerMod.includes('quote') || lowerMod.includes('document') || 
      lowerMod.includes('contract') || lowerMod.includes('certificate') || lowerMod.includes('compliance') ||
      lowerMod.includes('knowledge base') || lowerMod.includes('reporting') && !lowerMod.includes('analytics')) {
    return <DocumentVisual color={color} />;
  }
  
  // Kanban/Project boards
  if (lowerMod.includes('kanban') || lowerMod.includes('scrum') || lowerMod.includes('agile') ||
      (lowerMod.includes('project') && (lowerMod.includes('planning') || lowerMod.includes('board'))) ||
      (lowerMod.includes('task') && !lowerMod.includes('management'))) {
    return <KanbanVisual color={color} />;
  }
  
  // Maps and tracking
  if (lowerMod.includes('map') || lowerMod.includes('track') || lowerMod.includes('location') ||
      lowerMod.includes('route') || lowerMod.includes('logistics')) {
    return <MapVisual color={color} />;
  }
  
  // Code/Integrations/Workflows
  if (lowerMod.includes('integration') || lowerMod.includes('api') || lowerMod.includes('workflow') ||
      lowerMod.includes('builder') || lowerMod.includes('trigger') || lowerMod.includes('action') ||
      lowerMod.includes('code') || lowerMod.includes('co-pilot')) {
    return <CodeVisual color={color} />;
  }
  
  // Network/Connections
  if (lowerMod.includes('network') || lowerMod.includes('fraud') || lowerMod.includes('connection')) {
    return <NetworkVisual color={color} />;
  }
  
  // Management modules, lists, records (most common - should be default)
  if (lowerMod.includes('management') || lowerMod.includes('list') || lowerMod.includes('directory') || 
      lowerMod.includes('inventory') || lowerMod.includes('employee') || lowerMod.includes('recruitment') ||
      lowerMod.includes('onboarding') || lowerMod.includes('payroll') || lowerMod.includes('benefits') ||
      lowerMod.includes('leave') || lowerMod.includes('attendance') || lowerMod.includes('performance') ||
      lowerMod.includes('scheme') || lowerMod.includes('grant') || lowerMod.includes('exercise') ||
      lowerMod.includes('incident') || lowerMod.includes('problem') || lowerMod.includes('change') ||
      lowerMod.includes('asset') || lowerMod.includes('service') || lowerMod.includes('procurement') ||
      lowerMod.includes('vendor') || lowerMod.includes('quality') || lowerMod.includes('order') ||
      lowerMod.includes('warehouse') || lowerMod.includes('course') || lowerMod.includes('assessment') ||
      lowerMod.includes('student') || lowerMod.includes('instructor') || lowerMod.includes('affiliate') ||
      lowerMod.includes('influencer') || lowerMod.includes('campaign') || lowerMod.includes('commission') ||
      lowerMod.includes('payment') || lowerMod.includes('pricing') || lowerMod.includes('ledger') ||
      lowerMod.includes('payable') || lowerMod.includes('receivable') || lowerMod.includes('banking') ||
      lowerMod.includes('tax') || lowerMod.includes('entity') || lowerMod.includes('resource') ||
      lowerMod.includes('collaboration') || lowerMod.includes('tracking') || lowerMod.includes('portal') ||
      lowerMod.includes('catalog') || lowerMod.includes('config') || lowerMod.includes('mobile') ||
      lowerMod.includes('widget') || lowerMod.includes('segment') || lowerMod.includes('template') ||
      lowerMod.includes('task') && lowerMod.includes('management')) {
    return <TableVisual color={color} />;
  }

  // 4. Fallback to TableVisual (not ChartVisual) since most modules are data/records
  return <TableVisual color={color} />;
};

// --- MAIN CARD COMPONENT ---

const StackedCard: React.FC<CardProps> = React.memo(({
  app,
  index,
  isActive,
  onClick
}) => {
  const [activeModule, setActiveModule] = React.useState<string | null>(null);

  const Icon = app.icon;
  const theme = THEMES[app.color] || THEMES['blue'];

  const renderVisual = () => {
    if (activeModule) {
      return getModuleVisual(app.name, activeModule, app.color);
    }
    const firstFeature = app.features[0];
    const firstFeatureName = typeof firstFeature === 'string' ? firstFeature : firstFeature.title;
    return getModuleVisual(app.name, firstFeatureName, app.color);
  };

  return (
    <div
      className="h-screen sticky top-0 flex items-center justify-center px-4"
      style={{ zIndex: index + 1, contain: 'layout style paint' }}
    >
      <div className="w-full max-w-[95vw] lg:max-w-[1400px]">
        <div
          className={`relative bg-white rounded-[2rem] shadow-[0_-8px_30px_rgba(0,0,0,0.08)] overflow-hidden border border-slate-200 flex flex-col lg:flex-row cursor-pointer transition-shadow duration-300 ${isActive ? 'ring-2 ring-blue-500 shadow-blue-500/20' : 'hover:shadow-xl hover:shadow-slate-500/10'}`}
          onClick={onClick}
        >
          {/* --- LEFT SIDE: Content --- */}
          <div className="w-full lg:w-[40%] p-6 md:p-8 lg:p-10 flex flex-col relative bg-white border-r border-slate-100">
            <div className="flex items-center space-x-3 mb-4">
              <div className={`w-10 h-10 rounded-xl ${theme.bgMedium} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${theme.textDark}`} />
              </div>
              <span className={`text-xs font-bold tracking-wider ${theme.textDark} uppercase bg-slate-50 px-3 py-1 rounded-full border border-slate-100`}>
                Enterprise Suite
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#1B2E5A] tracking-tight mb-2 leading-tight">
              {app.name}
            </h2>

            <p className="text-sm text-slate-500 mb-6 font-medium leading-relaxed">
              {app.tagline}
            </p>

            <div className="max-h-[280px] overflow-y-auto pr-2 space-y-2 no-scrollbar">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Available Modules</p>
              {app.features.map((feature: string | { title: string }, i: number) => {
                const featureName = typeof feature === 'string' ? feature : feature.title;
                return (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveModule(featureName);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-between group
                    ${activeModule === featureName
                        ? `${theme.bgMedium} ${theme.textDark} shadow-sm ring-1 ring-${app.color}-200`
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }
                  `}
                  >
                    <span>{featureName}</span>
                    {activeModule === featureName && (
                      <motion.div layoutId={`active-check-${app.id}`} initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <Check className="w-4 h-4" />
                      </motion.div>
                    )}
                    {activeModule !== featureName && (
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-50 -translate-x-2 group-hover:translate-x-0 transition-all" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `/products/${app.id}`;
                }}
                className={`flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#1B2E5A] text-white hover:bg-[#162447] transition-colors font-semibold text-sm group`}
              >
                Know More <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* --- RIGHT SIDE: Dynamic Visuals --- */}
          <div className="w-full lg:w-[60%] relative overflow-hidden bg-white flex items-center justify-center p-6 md:p-12">
            <div className="relative w-full max-w-2xl aspect-[16/10]">
              <div className="w-full h-full bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeModule || 'default'}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.03 }}
                    transition={{ duration: 0.25 }}
                    className="w-full h-full"
                  >
                    {renderVisual()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

interface StackedCardsSectionProps {
  businessApps: BusinessApp[];
  activeProduct?: Product;
  onProductChange?: (product: Product) => void;
}

export const StackedCardsSection: React.FC<StackedCardsSectionProps> = ({
  businessApps,
  activeProduct,
  onProductChange
}) => {
  const totalCards = businessApps.length;

  return (
    <div className="bg-slate-50 relative z-10">
      {/* Each card is 100vh sticky. Container height = cards * 100vh gives scroll distance. */}
      <div
        className="relative"
        style={{ height: `${totalCards * 100}vh` }}
      >
        {businessApps.map((app, index) => {
          const product: Product = {
            id: app.id,
            name: app.name,
            tagline: app.tagline,
            iconName: app.name.toLowerCase().replace(/\s+/g, ''),
            gradient: app.gradient,
            color: app.color,
            features: app.features,
            stats: app.stats
          };

          return (
            <StackedCard
              key={app.id}
              app={app}
              index={index}
              isActive={activeProduct ? activeProduct.id === app.id : false}
              onClick={() => onProductChange?.(product)}
            />
          );
        })}
      </div>
    </div>
  );
};
