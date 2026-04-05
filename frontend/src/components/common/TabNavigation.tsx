import React from "react"
import { LucideIcon } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// CVA variants for tab list styling
const tabListVariants = cva(
  "grid w-full", // base classes
  {
    variants: {
      variant: {
        default: "bg-muted p-1 rounded-md",
        pills: "bg-transparent p-0 gap-1",
        underline: "bg-transparent p-0 border-b border-border rounded-none",
      },
      orientation: {
        horizontal: "",
        vertical: "grid-cols-1 h-auto",
      },
      size: {
        sm: "h-8",
        md: "h-10",
        lg: "h-12",
      },
    },
    defaultVariants: {
      variant: "default",
      orientation: "horizontal",
      size: "md",
    },
  }
)

// CVA variants for tab trigger styling
const tabTriggerVariants = cva(
  "flex items-center gap-2 transition-all duration-200", // base classes
  {
    variants: {
      variant: {
        default: [
          "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
          "data-[state=inactive]:text-muted-foreground",
          "rounded-sm",
        ],
        pills: [
          "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
          "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground",
          "rounded-full px-4 py-2",
        ],
        underline: [
          "data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary",
          "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground",
          "rounded-none border-b-2 border-transparent pb-2",
        ],
      },
      size: {
        sm: "text-sm",
        md: "text-base",
        lg: "text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

// TypeScript interfaces for configuration
export interface TabItem {
  id: string
  label: string
  icon?: LucideIcon
  disabled?: boolean
  content: React.ReactNode
}

export interface TabNavigationProps {
  tabs: TabItem[]
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  tabsListClassName?: string
  tabsTriggerClassName?: string
  tabsContentClassName?: string
  orientation?: "horizontal" | "vertical"
  variant?: "default" | "pills" | "underline"
  size?: "sm" | "md" | "lg"
}

// CVA variant props for type safety
export type TabListVariantProps = VariantProps<typeof tabListVariants>
export type TabTriggerVariantProps = VariantProps<typeof tabTriggerVariants>

export function TabNavigation({
  tabs,
  defaultValue,
  value,
  onValueChange,
  className,
  tabsListClassName,
  tabsTriggerClassName,
  tabsContentClassName,
  orientation = "horizontal",
  variant = "default",
  size = "md",
}: TabNavigationProps) {
  const [activeTab, setActiveTab] = React.useState(defaultValue || tabs[0]?.id)

  const handleValueChange = (newValue: string) => {
    setActiveTab(newValue)
    onValueChange?.(newValue)
  }

  const currentValue = value ?? activeTab
  const tabLength = tabs.length

  return (
    <Tabs
      value={currentValue}
      onValueChange={handleValueChange}
      orientation={orientation}
      className={cn("w-full", className)}
    >
      <TabsList
        className={cn(
          tabListVariants({ variant, orientation, size }),
          tabsListClassName
        )}
        style={{ gridTemplateColumns: `repeat(${tabLength}, 1fr)` }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              className={cn(
                tabTriggerVariants({ variant, size }),
                tabsTriggerClassName
              )}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {tab.label}
            </TabsTrigger>
          )
        })}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent
          key={tab.id}
          value={tab.id}
          className={cn("mt-4", tabsContentClassName)}
        >
          {/* Only render content when tab is active to prevent unnecessary API calls */}
          {currentValue === tab.id ? tab.content : null}
        </TabsContent>
      ))}
    </Tabs>
  )
}

// Convenience component for just the tab list (without content)
export function TabNavigationList({
  tabs,
  value,
  onValueChange,
  className,
  tabsTriggerClassName,
  orientation = "horizontal",
  variant = "default",
  size = "md",
}: Omit<TabNavigationProps, "defaultValue" | "tabsListClassName" | "tabsContentClassName">) {
  return (
      <Tabs value={value} onValueChange={onValueChange} orientation={orientation}>
      <TabsList
        className={cn(
          tabListVariants({ variant, orientation, size }),
          orientation === "horizontal" ? `grid-cols-${tabs.length}` : "",
          className
        )}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              className={cn(
                tabTriggerVariants({ variant, size }),
                tabsTriggerClassName
              )}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {tab.label}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
