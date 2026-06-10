import React from "react";
import { User } from "@/types/user-management";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { User as UserIcon } from "lucide-react";

export interface UserAvatarProps {
  user: User | null | undefined;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  showStatus?: boolean;
  status?: "online" | "offline" | "away" | "busy";
  className?: string;
  fallbackIcon?: React.ComponentType<{ className?: string }>;
  showTooltip?: boolean;
  tooltipContent?: string;
  onClick?: () => void;
  disabled?: boolean;
}

const sizeClasses = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm", 
  md: "w-10 h-10 text-base",
  lg: "w-12 h-12 text-lg",
  xl: "w-16 h-16 text-xl",
  "2xl": "w-20 h-20 text-2xl",
};

const statusClasses = {
  online: "bg-green-500",
  offline: "bg-gray-400", 
  away: "bg-yellow-500",
  busy: "bg-red-500",
};

const UserAvatar = ({ 
  user, 
  size = "md",
  showStatus = false,
  status = "offline",
  className,
  fallbackIcon: FallbackIcon = UserIcon,
  showTooltip = false,
  tooltipContent,
  onClick,
  disabled = false,
  ...props 
}: UserAvatarProps) => {
  // Handle null/undefined user
  if (!user) {
    return (
      <Avatar 
        className={cn(
          sizeClasses[size],
          disabled && "opacity-50 cursor-not-allowed",
          onClick && !disabled && "cursor-pointer hover:opacity-80",
          className
        )}
        onClick={disabled ? undefined : onClick}
        {...props}
      >
        <AvatarFallback>
          <FallbackIcon className="w-1/2 h-1/2" />
        </AvatarFallback>
      </Avatar>
    );
  }

  // Generate initials from name or email
  const getInitials = (name: string, email: string) => {
    if (name && name.trim()) {
      return name
        .trim()
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase();
    }
    
    if (email && email.trim()) {
      return email[0].toUpperCase();
    }
    
    return "?";
  };

  // Get display name for tooltip
  const getDisplayName = () => {
    if (user.name && user.name.trim()) {
      return user.name;
    }
    if (user.email && user.email.trim()) {
      return user.email;
    }
    return "Unknown User";
  };

  const initials = getInitials(user.name || "", user.email || "");
  const displayName = getDisplayName();

  return (
    <div className="relative inline-block">
      <Avatar 
        className={cn(
          sizeClasses[size],
          disabled && "opacity-50 cursor-not-allowed",
          onClick && !disabled && "cursor-pointer hover:opacity-80 transition-opacity",
          className
        )}
        onClick={disabled ? undefined : onClick}
        {...props}
      >
        <AvatarImage 
          src={user.avatar} 
          alt={displayName}
          className="object-cover"
        />
        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
      
      {/* Status indicator */}
      {showStatus && (
        <div 
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
            statusClasses[status]
          )}
        />
      )}
      
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
          {tooltipContent || displayName}
        </div>
      )}
    </div>
  );
};

// Preset variants for common use cases
export const UserAvatarPresets = {
  // Small avatar for lists
  ListItem: (props: Omit<UserAvatarProps, 'size'>) => (
    <UserAvatar {...props} size="sm" showTooltip />
  ),
  
  // Medium avatar for cards
  Card: (props: Omit<UserAvatarProps, 'size'>) => (
    <UserAvatar {...props} size="md" showStatus />
  ),
  
  // Large avatar for headers
  Header: (props: Omit<UserAvatarProps, 'size'>) => (
    <UserAvatar {...props} size="lg" showStatus showTooltip />
  ),
  
  // Extra large for profile pages
  Profile: (props: Omit<UserAvatarProps, 'size'>) => (
    <UserAvatar {...props} size="xl" showStatus showTooltip />
  ),
  
  // Clickable avatar for dropdowns
  Clickable: (props: Omit<UserAvatarProps, 'onClick'>) => (
    <UserAvatar {...props} onClick={() => {}} showTooltip />
  ),
};

export { UserAvatar };
export default UserAvatar;
