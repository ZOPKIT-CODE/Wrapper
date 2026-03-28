import { Typography } from "@/components/common/Typography";
import { PearlButton } from "@/components/ui/pearl-button";
import { RefreshCw } from "lucide-react";
import { Flex } from "@/components/common/Page";
import { useTheme } from "@/components/theme/ThemeProvider";
import { motion } from "framer-motion";
import { getThemeColors } from "./applicationUtils";

interface ApplicationHeaderProps {
    applicationCount: number;
    isLoading: boolean;
    onRefresh: () => void;
}

export function ApplicationHeader({ applicationCount, isLoading, onRefresh }: ApplicationHeaderProps) {
    const { actualTheme } = useTheme();
    const themeColors = getThemeColors(actualTheme);

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
        >
            <Flex align="center" justify="between" >
                <Flex direction="col" className="space-y-1">
                    <Typography variant="h2" className="text-3xl font-black tracking-tighter text-[#1B2E5A]">
                        Applications
                    </Typography>
                    <p className="text-muted-foreground text-sm">
                        Manage and access your organization's applications
                    </p>
                </Flex>
                <PearlButton onClick={onRefresh} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </PearlButton>
            </Flex>
        </motion.div>
    );
}
