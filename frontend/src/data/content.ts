import { ProductData, Testimonial } from '../types';

export const products: ProductData[] = [
    {
        id: "b2b-crm",
        name: "B2B CRM",
        tagline: "Modern CRM Built for Sales Teams",
        description: "Complete sales cycle from lead to invoice. Modern UI. Affordable pricing. Perfect for B2B companies.",
        iconName: "Briefcase",
        gradient: "from-blue-500 to-indigo-600",
        color: "blue",
        stats: [
            { label: "Sales Reps", value: "50k+" },
            { label: "Faster Cycles", value: "30%" }
        ],
        features: [
            { title: "Lead Management", description: "Capture, qualify (BANT), and route leads automatically.", icon: "Target" },
            { title: "Contact Management", description: "Centralized database for all your business contacts and accounts.", icon: "Users" },
            { title: "Opportunity Management", description: "Track deals through the sales pipeline with visual stages.", icon: "TrendingUp" },
            { title: "Visual Pipeline", description: "Drag-and-drop deal management with forecasting.", icon: "BarChart3" },
            { title: "Quote-to-Order", description: "Convert approved quotes to orders with one click.", icon: "FileText" },
            { title: "Invoice Management", description: "Generate and send professional invoices directly from the CRM.", icon: "FileCheck" },
            { title: "Task Management", description: "Track activities, calls, and meetings linked to deals.", icon: "CheckSquare" },
            { title: "Sales Analytics", description: "Deep insights into team performance and revenue forecasts.", icon: "PieChart" },
            { title: "Mobile CRM", description: "Access your sales data from anywhere with the mobile app.", icon: "Smartphone" },
            { title: "Integrations", description: "Connect with email, calendar, and other business tools.", icon: "Link" }
        ],
        useCases: [
            { title: "B2B SaaS", description: "Manage subscription sales and renewals." },
            { title: "Wholesale", description: "Handle complex volume orders and delivery schedules." }
        ],
        pricing: [
            { name: "Starter", price: "$29/user", features: ["5 Users", "Basic Pipeline", "Mobile App"] },
            { name: "Professional", price: "$49/user", features: ["50 Users", "Advanced Analytics", "API Access"] }
        ]
    },
    {
        id: "operations",
        name: "Operations Management",
        tagline: "End-to-End Supply Chain Platform",
        description: "Inventory, warehouse, procurement, logistics, and quality management—all in one unified platform.",
        iconName: "Box",
        gradient: "from-orange-500 to-amber-600",
        color: "orange",
        stats: [
            { label: "Warehouses", value: "1,000+" },
            { label: "Cost Reduction", value: "30%" }
        ],
        features: [
            { title: "Inventory Management", description: "Real-time tracking of stock levels across multiple locations.", icon: "Package" },
            { title: "Warehouse Management", description: "Optimize storage, picking, and packing processes.", icon: "Home" },
            { title: "Procurement", description: "RFQ to PO automation with vendor management.", icon: "ShoppingCart" },
            { title: "Logistics", description: "Route optimization and freight management.", icon: "Truck" },
            { title: "Order Management", description: "Streamline order processing from entry to fulfillment.", icon: "ClipboardList" },
            { title: "Multi-Vendor", description: "Manage multiple vendors and suppliers in one place.", icon: "Users" },
            { title: "Quality Control", description: "Ensure product quality with inspections and audits.", icon: "CheckCircle" },
            { title: "Service Management", description: "Manage returns, repairs, and after-sales service.", icon: "Wrench" },
            { title: "Mobile Warehouse", description: "Barcode scanning and inventory management on mobile.", icon: "Smartphone" },
            { title: "Analytics", description: "Data-driven insights for supply chain optimization.", icon: "BarChart" }
        ],
        useCases: [
            { title: "Manufacturing", description: "Track raw materials to finished goods." },
            { title: "Distribution", description: "High-volume order fulfillment optimization." }
        ],
        pricing: [
            { name: "Starter", price: "$199/mo", features: ["1 Warehouse", "Basic Inventory", "Order Management"] },
            { name: "Professional", price: "$499/mo", features: ["5 Warehouses", "Advanced Analytics", "API Access"] }
        ]
    },
    {
        id: "project-management",
        name: "Project Management",
        tagline: "Enterprise Project Management",
        description: "Agile, Scrum, Gantt charts, Kanban—everything you need. Integrated with HR and Accounting.",
        iconName: "ClipboardList",
        gradient: "from-cyan-500 to-sky-600",
        color: "teal",
        stats: [
            { label: "Projects", value: "50k+" },
            { label: "Faster Delivery", value: "40%" }
        ],
        features: [
            { title: "Project Planning", description: "Define project scope, timelines, and milestones.", icon: "Map" },
            { title: "Agile & Scrum", description: "Sprint planning, backlog management, and burndown charts.", icon: "RefreshCw" },
            { title: "Task Management", description: "Assign and track tasks with dependencies and priorities.", icon: "CheckSquare" },
            { title: "Time Tracking", description: "Monitor time spent on tasks for accurate billing.", icon: "Clock" },
            { title: "Resource Planning", description: "Integrated with HRMS for accurate availability.", icon: "Users" },
            { title: "Collaboration", description: "Team chat, file sharing, and real-time updates.", icon: "MessageCircle" },
            { title: "Project Analytics", description: "Track project health, budget, and progress.", icon: "BarChart" },
            { title: "HR Integration", description: "Sync with HRMS for resource allocation.", icon: "UserCheck" },
            { title: "Accounting Link", description: "Real-time budget tracking linked to Finance.", icon: "DollarSign" },
            { title: "Mobile App", description: "Manage projects and tasks on the go.", icon: "Smartphone" }
        ],
        useCases: [
            { title: "Agencies", description: "Bill clients accurately with integrated time tracking." },
            { title: "Software Teams", description: "Manage sprints and releases efficiently." }
        ],
        pricing: [
            { name: "Starter", price: "$49/mo", features: ["10 Projects", "Basic Features"] },
            { name: "Professional", price: "$149/mo", features: ["Unlimited Projects", "Priority Support"] }
        ]
    },
    {
        id: "finance",
        name: "Financial Accounting",
        tagline: "Complete Financial Management",
        description: "General ledger, AP/AR, tax compliance, multi-entity support. AI cash flow forecasting.",
        iconName: "Landmark",
        gradient: "from-emerald-500 to-green-600",
        color: "green",
        stats: [
            { label: "Transactions", value: "100M+" },
            { label: "Compliance", value: "100%" }
        ],
        features: [
            { title: "General Ledger", description: "Multi-currency, multi-entity financial reporting.", icon: "BookOpen" },
            { title: "Accounts Payable", description: "Automated bill processing and vendor payments.", icon: "ArrowDownLeft" },
            { title: "Accounts Receivable", description: "Invoicing and automated payment reminders.", icon: "ArrowUpRight" },
            { title: "Banking", description: "Bank reconciliation and cash management.", icon: "Landmark" },
            { title: "Tax Management", description: "Built-in tax management and e-invoicing.", icon: "FileCheck" },
            { title: "Multi-Entity", description: "Consolidated reporting for holding companies.", icon: "Globe" },
            { title: "Cost Accounting", description: "Track costs by project, department, or location.", icon: "PieChart" },
            { title: "Financial Reporting", description: "Customizable financial statements and reports.", icon: "FileText" },
            { title: "AI Forecasting", description: "Predict cash flow and financial trends.", icon: "TrendingUp" },
            { title: "Integration", description: "Connect with banks and other financial tools.", icon: "Link" }
        ],
        useCases: [
            { title: "Multi-Entity", description: "Consolidated reporting for holding companies." },
            { title: "Global Biz", description: "Handle multi-currency transactions seamlessly." }
        ],
        pricing: [
            { name: "Pro", price: "$299/mo", features: ["Core Finance", "Tax Compliance"] },
            { name: "Enterprise", price: "Custom", features: ["Multi-entity", "Dedicated Support"] }
        ]
    },
    {
        id: "hrms",
        name: "HRMS",
        tagline: "Complete HR Management",
        description: "Recruitment to retirement. Payroll & compliance. Performance management. Employee self-service.",
        iconName: "Users2",
        gradient: "from-red-500 to-orange-600",
        color: "orange",
        stats: [
            { label: "Employees", value: "100k+" },
            { label: "Onboarding", value: "60% Faster" }
        ],
        features: [
            { title: "Employee Management", description: "Centralized employee database and records.", icon: "Users" },
            { title: "Recruitment", description: "ATS with automated interview scheduling.", icon: "UserPlus" },
            { title: "Onboarding", description: "Digital onboarding workflows and checklists.", icon: "UserCheck" },
            { title: "Time & Attendance", description: "Track attendance, shifts, and overtime.", icon: "Clock" },
            { title: "Leave Management", description: "Automated leave requests and approvals.", icon: "Calendar" },
            { title: "Payroll", description: "Automated salary calculation and statutory compliance.", icon: "Banknote" },
            { title: "Performance", description: "Goals, reviews, and 360-degree feedback.", icon: "Award" },
            { title: "Benefits", description: "Manage employee benefits and insurance.", icon: "Heart" },
            { title: "Self-Service", description: "Employee portal for leaves, payslips, and docs.", icon: "Smartphone" },
            { title: "HR Analytics", description: "Insights into workforce trends and metrics.", icon: "BarChart" }
        ],
        useCases: [
            { title: "Growing Teams", description: "Automate onboarding and asset provisioning." },
            { title: "Remote Work", description: "Manage distributed teams and attendance." }
        ],
        pricing: [
            { name: "Starter", price: "$99/mo", features: ["50 Employees", "Basic HR"] },
            { name: "Professional", price: "$299/mo", features: ["500 Employees", "Full Suite"] }
        ]
    },
    {
        id: "esop",
        name: "ESOP System",
        tagline: "Equity Compensation Management",
        description: "Grant & vesting management. Cap table tracking. Compliance & reporting.",
        iconName: "PieChart",
        gradient: "from-teal-500 to-emerald-600",
        color: "teal",
        stats: [
            { label: "Grants", value: "100k+" },
            { label: "Time Saved", value: "50%" }
        ],
        features: [
            { title: "Scheme Management", description: "Create and manage multiple ESOP schemes.", icon: "Folder" },
            { title: "Grant Management", description: "Issue grants with custom vesting schedules.", icon: "Gift" },
            { title: "Vesting", description: "Automated vesting calculations and notifications.", icon: "Clock" },
            { title: "Exercise Management", description: "Streamlined exercise process for employees.", icon: "MousePointer" },
            { title: "Cap Table", description: "Real-time ownership structure and dilution analysis.", icon: "PieChart" },
            { title: "Valuation", description: "Track company valuation and share price history.", icon: "TrendingUp" },
            { title: "Compliance", description: "Generate reports for tax and regulatory compliance.", icon: "FileCheck" },
            { title: "Employee Portal", description: "Transparency for employees to view their equity.", icon: "Layout" },
            { title: "Tax Management", description: "Calculate and withhold taxes on exercise.", icon: "DollarSign" },
            { title: "Analytics", description: "Reports on grants, vesting, and cap table.", icon: "BarChart" }
        ],
        useCases: [
            { title: "Startups", description: "Manage complex vesting schedules easily." },
            { title: "Pre-IPO", description: "Maintain audit-ready cap tables." }
        ],
        pricing: [
            { name: "Starter", price: "$199/mo", features: ["100 Employees", "Basic Features"] },
            { name: "Professional", price: "$499/mo", features: ["500 Employees", "Priority Support"] }
        ]
    },
    {
        id: "academy",
        name: "Zopkit Academy",
        tagline: "Learning Management System",
        description: "Course & assessment engine. Digital certificates. Gamification. AI tutor. Integrated with HRMS.",
        iconName: "GraduationCap",
        gradient: "from-yellow-500 to-amber-600",
        color: "orange",
        stats: [
            { label: "Courses", value: "5k+" },
            { label: "Completion", value: "90%" }
        ],
        features: [
            { title: "Course Management", description: "Create and organize courses and modules.", icon: "Book" },
            { title: "Assessment Engine", description: "Quizzes, exams, and assignments.", icon: "FileText" },
            { title: "Certificates", description: "Auto-generate verifiable digital certificates.", icon: "Award" },
            { title: "Gamification", description: "Badges, leaderboards, and points to drive engagement.", icon: "Trophy" },
            { title: "Learning Paths", description: "Guided learning journeys for specific roles.", icon: "Map" },
            { title: "AI Tutor", description: "Personalized learning assistance.", icon: "Bot" },
            { title: "Student Portal", description: "Access courses and track progress.", icon: "Layout" },
            { title: "Instructor Tools", description: "Manage students and grade assignments.", icon: "Users" },
            { title: "Analytics", description: "Track learner progress and course effectiveness.", icon: "BarChart" },
            { title: "Integration", description: "Sync with HRMS for training records.", icon: "Link" }
        ],
        useCases: [
            { title: "Onboarding", description: "Automated training paths for new hires." },
            { title: "Compliance", description: "Track mandatory compliance training." }
        ],
        pricing: [
            { name: "Starter", price: "$99/mo", features: ["100 Students", "Basic LMS"] },
            { name: "Professional", price: "$299/mo", features: ["1k Students", "All Features"] }
        ]
    },
    {
        id: "itsm",
        name: "Zopkit ITSM",
        tagline: "IT Service Management",
        description: "ITIL-compliant ticketing. Asset management. Change management. Service catalog.",
        iconName: "Terminal",
        gradient: "from-slate-600 to-zinc-700",
        color: "indigo",
        stats: [
            { label: "Tickets", value: "5M+" },
            { label: "Resolution", value: "80% Faster" }
        ],
        features: [
            { title: "Incident Management", description: "Track and resolve IT incidents efficiently.", icon: "AlertCircle" },
            { title: "Problem Management", description: "Identify and fix root causes of recurring issues.", icon: "Search" },
            { title: "Change Management", description: "Manage changes to IT infrastructure.", icon: "GitBranch" },
            { title: "Asset Management", description: "Track hardware and software lifecycles.", icon: "Monitor" },
            { title: "Service Catalog", description: "Self-service portal for IT requests.", icon: "Menu" },
            { title: "Knowledge Base", description: "Centralized repository for IT documentation.", icon: "BookOpen" },
            { title: "Config Management", description: "Track configuration items and relationships.", icon: "Settings" },
            { title: "IT Operations", description: "Monitor IT infrastructure health.", icon: "Activity" },
            { title: "Reporting", description: "Metrics and KPIs for IT performance.", icon: "BarChart" },
            { title: "Integration", description: "Connect with other IT tools.", icon: "Link" }
        ],
        useCases: [
            { title: "IT Teams", description: "Streamline support and change management." },
            { title: "MSPs", description: "Manage multiple clients from one console." }
        ],
        pricing: [
            { name: "Starter", price: "$199/mo", features: ["50 Users", "Basic ITSM"] },
            { name: "Professional", price: "$499/mo", features: ["200 Users", "Full Suite"] }
        ]
    },
    {
        id: "flowtilla",
        name: "Flowtilla",
        tagline: "Visual Workflow Automation",
        description: "The brain that connects everything. No-code workflow builder. AI-powered automation.",
        iconName: "Zap",
        gradient: "from-purple-500 to-violet-600",
        color: "purple",
        stats: [
            { label: "Workflows", value: "10k+" },
            { label: "Time Saved", value: "80%" }
        ],
        features: [
            { title: "Visual Builder", description: "Drag-and-drop node editor for complex logic.", icon: "GitMerge" },
            { title: "Triggers", description: "Start workflows based on events or schedules.", icon: "Play" },
            { title: "Actions", description: "Perform tasks in connected apps.", icon: "Zap" },
            { title: "Logic & Control", description: "Add conditions, loops, and branches.", icon: "Shuffle" },
            { title: "AI Components", description: "Use LLMs to extract data, generate text, or make decisions.", icon: "Sparkles" },
            { title: "User Tasks", description: "Include human approval steps in workflows.", icon: "UserCheck" },
            { title: "Templates", description: "Ready-to-use templates for common tasks.", icon: "LayoutTemplate" },
            { title: "AI Co-pilot", description: "Get help building and optimizing workflows.", icon: "Bot" },
            { title: "Monitoring", description: "Track workflow execution and logs.", icon: "Activity" },
            { title: "Integration", description: "Connect with hundreds of apps.", icon: "Link" }
        ],
        useCases: [
            { title: "Lead to Cash", description: "Automate entire sales to finance lifecycle." },
            { title: "Onboarding", description: "Trigger IT, HR, and Training tasks on new hire." }
        ],
        pricing: [
            { name: "Starter", price: "$99/mo", features: ["10 Workflows", "Email Support"] },
            { name: "Professional", price: "$299/mo", features: ["Unlimited Workflows", "Priority Support"] }
        ]
    },
    {
        id: "b2c-crm",
        name: "B2C CRM",
        tagline: "Customer engagement for B2C teams",
        description: "Customer lifecycle management, AI-powered campaigns, smart segmentation, and engagement widgets.",
        iconName: "Users",
        gradient: "from-violet-500 to-purple-600",
        color: "purple",
        stats: [
            { label: "Customers", value: "1M+" },
            { label: "Engagement", value: "65% Increase" }
        ],
        features: [
            { title: "AI Campaign Creator", description: "Create campaigns with AI assistance in minutes.", icon: "Bot" },
            { title: "Lifecycle Management", description: "Track customers through journey stages automatically.", icon: "RefreshCw" },
            { title: "Smart Segments", description: "Intelligent customer segmentation with AI.", icon: "Target" },
            { title: "Engagement Widgets", description: "Interactive widgets for customer engagement.", icon: "Layout" },
            { title: "AI Journeys", description: "Automated multi-step customer journeys.", icon: "Workflow" },
            { title: "Analytics", description: "Real-time performance tracking and insights.", icon: "BarChart" }
        ],
        useCases: [
            { title: "E-Commerce", description: "Engage customers throughout their journey." },
            { title: "SaaS", description: "Manage onboarding and retention." }
        ],
        pricing: [
            { name: "Starter", price: "$199/mo", features: ["10k Customers", "Basic Features"] },
            { name: "Professional", price: "$499/mo", features: ["100k Customers", "AI Features"] }
        ]
    },
    {
        id: "affiliate-connect",
        name: "Affiliate Connect",
        tagline: "Unified Affiliate & Influencer Marketing",
        description: "Manage both affiliates and influencers in one platform. AI-powered pricing advisor. Advanced fraud detection. Mobile app included.",
        iconName: "Share2",
        gradient: "from-pink-500 to-rose-500",
        color: "pink",
        stats: [
            { label: "Affiliates Managed", value: "10k+" },
            { label: "Fraud Reduction", value: "80%" }
        ],
        features: [
            { title: "Affiliate Management", description: "Invite, approve, and track affiliates with multi-tier commission structures.", icon: "Users" },
            { title: "Influencer Hub", description: "End-to-end campaign management with media kits and content approval.", icon: "Star" },
            { title: "Campaign Management", description: "Create and manage marketing campaigns across multiple channels.", icon: "Megaphone" },
            { title: "Commission Engine", description: "Flexible commission structures including CPA, CPL, and revenue share.", icon: "DollarSign" },
            { title: "Payment System", description: "Automated payouts to affiliates and influencers globally.", icon: "CreditCard" },
            { title: "Fraud Detection", description: "Advanced AI to detect and prevent fraudulent activities.", icon: "ShieldAlert" },
            { title: "AI Pricing Advisor", description: "'Rate My Rate' technology helps negotiate fair influencer prices.", icon: "Bot" },
            { title: "Analytics & Reporting", description: "Real-time insights into campaign performance and ROI.", icon: "BarChart" },
            { title: "Mobile App", description: "Manage campaigns and track performance on the go.", icon: "Smartphone" },
            { title: "Integrations", description: "Connect to the tools your team already uses.", icon: "Link" }
        ],
        useCases: [
            { title: "E-Commerce Brands", description: "Unified partner marketing to track ROI across all channels." },
            { title: "D2C Companies", description: "Scale brand awareness with fraud-protected influencer campaigns." }
        ],
        pricing: [
            { name: "Starter", price: "$99/mo", features: ["100 Partners", "Basic Fraud Detection", "Mobile App"] },
            { name: "Professional", price: "$299/mo", features: ["500 Partners", "AI Pricing", "Priority Support"] }
        ]
    }
];

export const testimonials: Testimonial[] = [
    {
        quote: "We replaced several point tools with Zopkit. Our ops team spends less time reconciling data between systems.",
        author: "Priya Mehta",
        role: "COO",
        company: "Northline Logistics"
    },
    {
        quote: "Billing, CRM, and HR finally share the same customer and employee records. Onboarding new hires is noticeably faster.",
        author: "Arjun Desai",
        role: "Head of Operations",
        company: "Meridian Components"
    }
];
