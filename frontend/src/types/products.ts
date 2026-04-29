import { LucideIcon } from 'lucide-react';

export interface HeroSection {
    headline: string;
    subheadline: string;
    valueProposition: string;
    primaryCTA: string;
    secondaryCTA: string;
    stats: Array<{ label: string; value: string }>;
}

export interface PainPoint {
    icon: LucideIcon;
    text: string;
}

export interface ProblemSection {
    headline: string;
    painPoints: PainPoint[];
}

export interface Differentiator {
    icon: LucideIcon;
    text: string;
}

export interface SolutionSection {
    headline: string;
    description: string;
    differentiators: Differentiator[];
}

export interface Feature {
    icon: LucideIcon;
    title: string;
    description: string;
    benefits?: string[];
    subFeatures?: string[];
}

export interface UseCase {
    title: string;
    description: string;
    benefits: string[];
}

export interface PricingTier {
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    cta: string;
    popular?: boolean;
}

export interface PricingSection {
    headline: string;
    tiers: PricingTier[];
}

export interface Testimonial {
    quote: string;
    author: string;
    title: string;
    company: string;
}

export interface SocialProofSection {
    testimonial: Testimonial;
    stats: Array<{ label: string; value: string }>;
}

export interface FinalCTASection {
    headline: string;
    description: string;
    primaryCTA: string;
    secondaryCTAs: string[];
}

export interface ProductData {
    hero: HeroSection;
    problem: ProblemSection;
    solution: SolutionSection;
    features: Feature[];
    useCases: UseCase[];
    pricing: PricingSection;
    socialProof: SocialProofSection;
    finalCTA: FinalCTASection;
}

export interface ProductsMap {
    [key: string]: ProductData;
}

export interface ProductInfo {
    id: string;
    name: string;
    slug: string;
    tagline: string;
    iconName: string;
    gradient: string;
    color: string;
}
