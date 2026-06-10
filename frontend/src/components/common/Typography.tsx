import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// cva config for comprehensive typography variants
const typographyVariants = cva('', {
  variants: {
    variant: {
      // Headings - Standard hierarchy with proper font weights
      h1: 'scroll-m-20 text-4xl font-bold tracking-tight lg:text-5xl',
      h2: 'scroll-m-20 text-3xl font-bold tracking-tight first:mt-0',
      h3: 'scroll-m-20 text-2xl font-semibold tracking-tight',
      h4: 'scroll-m-20 text-xl font-semibold tracking-tight',
      h5: 'scroll-m-20 text-lg font-semibold tracking-tight',
      h6: 'scroll-m-20 text-base font-semibold tracking-tight',

      // Body text variants
      body: 'text-base font-normal leading-7',
      bodyLarge: 'text-lg font-normal leading-7',
      bodySmall: 'text-sm font-normal leading-6',

      // Paragraph variants
      p: 'leading-7 [&:not(:first-child)]:mt-6 text-base font-normal',
      pLarge: 'text-lg leading-7 [&:not(:first-child)]:mt-6 font-normal',
      pSmall: 'text-sm leading-6 [&:not(:first-child)]:mt-4 font-normal',

      // Special text variants
      lead: 'text-xl font-normal text-muted-foreground leading-7',
      large: 'text-lg font-semibold leading-7',
      small: 'text-sm font-medium leading-none',
      muted: 'text-sm text-muted-foreground font-normal leading-6',

      // Code variants
      code: 'relative rounded bg-muted px-[0.3em] py-[0.2em] font-mono text-sm font-medium',
      inlineCode:
        'rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium',

      // Label and form variants
      label:
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      labelLarge:
        'text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      labelSmall:
        'text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',

      // Caption and overline
      caption: 'text-xs text-muted-foreground font-normal',
      overline:
        'text-xs font-semibold uppercase tracking-wider text-muted-foreground',

      // Blockquote
      blockquote:
        'mt-6 border-l-2 pl-6 italic text-muted-foreground font-normal',

      // List
      list: 'my-6 ml-6 list-disc [&>li]:mt-2 font-normal',

      // Display variants for large text
      display: 'text-6xl font-bold tracking-tight lg:text-7xl',
      displayLarge: 'text-7xl font-bold tracking-tight lg:text-8xl',
      displaySmall: 'text-5xl font-bold tracking-tight lg:text-6xl',

      // Weight-specific variants
      bold: 'font-bold',
      semibold: 'font-semibold',
      medium: 'font-medium',
      normal: 'font-normal',
      light: 'font-light',
      thin: 'font-thin',

      // Color variants
      primary: 'text-primary font-normal',
      secondary: 'text-secondary font-normal',
      destructive: 'text-destructive font-normal',
      success: 'text-green-600 font-normal',
      warning: 'text-yellow-600 font-normal',
      info: 'text-blue-600 font-normal',
    },
  },
  defaultVariants: {
    variant: 'body',
  },
})

export interface TypographyProps
  extends
    React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof typographyVariants> {
  asChild?: boolean
  as?: React.ElementType
  children: React.ReactNode
}

/**
 * Comprehensive Typography component with standard component library patterns.
 *
 * @example
 * // Headings
 * <Typography variant="h1">Main Heading</Typography>
 * <Typography variant="h2">Section Heading</Typography>
 * <Typography variant="h3">Subsection Heading</Typography>
 *
 * @example
 * // Body text
 * <Typography variant="body">Regular body text</Typography>
 * <Typography variant="bodyLarge">Large body text</Typography>
 * <Typography variant="bodySmall">Small body text</Typography>
 *
 * @example
 * // Special variants
 * <Typography variant="lead">Lead paragraph</Typography>
 * <Typography variant="large">Large text</Typography>
 * <Typography variant="muted">Muted text</Typography>
 *
 * @example
 * // Display text
 * <Typography variant="display">Display heading</Typography>
 * <Typography variant="displayLarge">Large display</Typography>
 *
 * @example
 * // Code
 * <Typography variant="code">Code block</Typography>
 * <Typography variant="inlineCode">inline code</Typography>
 *
 * @example
 * // Labels and forms
 * <Typography variant="label">Form label</Typography>
 * <Typography variant="labelLarge">Large label</Typography>
 *
 * @example
 * // Weight variants
 * <Typography variant="bold">Bold text</Typography>
 * <Typography variant="semibold">Semibold text</Typography>
 * <Typography variant="medium">Medium weight</Typography>
 *
 * @example
 * // Color variants
 * <Typography variant="primary">Primary color</Typography>
 * <Typography variant="destructive">Error text</Typography>
 * <Typography variant="success">Success text</Typography>
 *
 * @example
 * // Custom element
 * <Typography variant="h1" as="div">Custom element</Typography>
 */
export const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  (
    {
      className,
      variant = 'p',
      as,
      asChild: _asChild = false,
      children,
      ...props
    },
    ref
  ) => {
    // Map variant to default HTML tag if not provided
    const tagMap: Record<string, React.ElementType> = {
      // Headings
      h1: 'h1',
      h2: 'h2',
      h3: 'h3',
      h4: 'h4',
      h5: 'h5',
      h6: 'h6',

      // Body text
      body: 'p',
      bodyLarge: 'p',
      bodySmall: 'p',

      // Paragraphs
      p: 'p',
      pLarge: 'p',
      pSmall: 'p',

      // Special text
      lead: 'p',
      large: 'div',
      small: 'small',
      muted: 'p',

      // Code
      code: 'pre',
      inlineCode: 'code',

      // Labels
      label: 'label',
      labelLarge: 'label',
      labelSmall: 'label',

      // Other
      caption: 'p',
      overline: 'p',
      blockquote: 'blockquote',
      list: 'ul',

      // Display
      display: 'h1',
      displayLarge: 'h1',
      displaySmall: 'h1',

      // Weight variants (default to span)
      bold: 'span',
      semibold: 'span',
      medium: 'span',
      normal: 'span',
      light: 'span',
      thin: 'span',

      // Color variants (default to span)
      primary: 'span',
      secondary: 'span',
      destructive: 'span',
      success: 'span',
      warning: 'span',
      info: 'span',
    }
    const Component: React.ElementType =
      as || (variant && tagMap[variant]) || 'p'

    return (
      <Component
        ref={ref}
        className={cn(typographyVariants({ variant }), className)}
        {...props}
      >
        {children}
      </Component>
    )
  }
)
Typography.displayName = 'Typography'
