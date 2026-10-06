---
name: Vitality Peak Dark
colors:
  surface: '#0e1511'
  surface-dim: '#0e1511'
  surface-bright: '#343b36'
  surface-container-lowest: '#09100c'
  surface-container-low: '#161d19'
  surface-container: '#1a211d'
  surface-container-high: '#242c27'
  surface-container-highest: '#2f3632'
  on-surface: '#dde4dd'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dde4dd'
  inverse-on-surface: '#2b322d'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#7bd0ff'
  on-secondary: '#00354a'
  secondary-container: '#00a6e0'
  on-secondary-container: '#00374d'
  tertiary: '#ffb3af'
  on-tertiary: '#650911'
  tertiary-container: '#fc7c78'
  on-tertiary-container: '#711419'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#c4e7ff'
  secondary-fixed-dim: '#7bd0ff'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#004c69'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3af'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#842225'
  background: '#0e1511'
  on-background: '#dde4dd'
  surface-variant: '#2f3632'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  title-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
---

## Brand & Style
This design system is a high-performance, dark-mode evolution of a health and fitness ecosystem. It targets fitness enthusiasts and data-driven athletes who require a focused, low-strain interface for tracking metrics in various lighting conditions.

The aesthetic follows a **Modern Corporate** style with **Tonal Layering**. It prioritizes legibility and data visualization, using a deep monochromatic base to let the signature emerald brand color and nutritional accents vibrate with energy. The emotional response is one of precision, vitality, and sophisticated strength.

## Colors
The palette is rooted in a deep charcoal-navy (`#0f172a`) to reduce eye fatigue and provide a canvas for high-contrast elements. 

- **Primary:** The signature Emerald (`#10b981`) is used for primary actions and success states.
- **Surface Tiers:** Backgrounds use the base navy, while cards and containers use a lighter charcoal (`#1e293b`) to create depth.
- **Nutritional Accents:** Protein (Red), Carbs (Amber), and Fats (Indigo) have been tuned for dark mode by increasing their luminance and slightly desaturating them to ensure they remain accessible against dark backgrounds without causing "vibration."

## Typography
This design system utilizes **Hanken Grotesk** for all roles to maintain a sharp, contemporary, and engineered feel. 

- **Headlines:** Use Bold (700) or ExtraBold (800) weights with tighter letter spacing for a punchy, editorial look.
- **Body:** Set in Regular (400) weight using the soft gray text color to ensure long-form reading comfort.
- **Labels:** Set in SemiBold (600) with slight tracking for utility-based UI components like chips and navigation.

## Layout & Spacing
The layout uses a **Fluid Grid** system based on an 8px square rhythm. 

- **Desktop:** 12-column grid with 24px gutters and a 1280px max-width container.
- **Mobile:** Single column with 16px side margins. 
- **Rhythm:** Vertical rhythm is strictly enforced in 8px increments to maintain a disciplined, "engineered" aesthetic. Spacing between card groups should be `md` (24px), while internal padding for cards should be `sm` (12px) or `md` depending on content density.

## Elevation & Depth
In this dark mode environment, depth is conveyed through **Tonal Layering** and **Subtle Inner Borders** rather than heavy shadows.

- **Level 0:** Background (`#0f172a`).
- **Level 1:** Main cards and containers (`#1e293b`). These should have a subtle 1px border using `#334155` to define edges.
- **Level 2:** Floating elements, menus, and modals. These use a slightly lighter tone and a soft, diffused navy-tinted shadow (`rgba(0, 0, 0, 0.4)`) to separate from the background.
- **Interactive:** Hover states on cards should subtly lighten the background or increase the border brightness.

## Shapes
The shape language is defined as **Rounded**, utilizing a base 8px (0.5rem) radius. This balances the professional, technical nature of the data with a friendly, approachable user experience. 

- **Standard Elements:** Buttons, Inputs, and Small Cards use `rounded` (8px).
- **Large Containers:** Dashboard widgets and main feed cards use `rounded-lg` (16px).
- **Interactive Accents:** Progress bars and selection pills use `rounded-xl` (24px) or full pill shapes to indicate fluidity.

## Components
- **Buttons:** Primary buttons use a solid Emerald (`#10b981`) background with a dark navy text for maximum contrast. Secondary buttons use an outlined style with `#334155`.
- **Inputs:** Fields use a darker fill than the surface (`#0f172a`) with a 1px border. On focus, the border transitions to Emerald.
- **Nutritional Chips:** Small, pill-shaped tags used for macronutrient display. Use a low-opacity version of the accent color as a background with high-luminance text (e.g., Protein chip: background `rgba(248, 113, 113, 0.1)`, text `#f87171`).
- **Cards:** Dashboard cards utilize the `#1e293b` surface. They should be used to group related health metrics, with headers in `title-md`.
- **Progress Rings:** Used for activity goals. The "track" should be a dark `#334155`, while the "indicator" uses the Primary or Accent colors.