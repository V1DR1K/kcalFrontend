---
name: Vitality Peak
colors:
  surface: '#f8f9ff'
  surface-dim: '#d0dbed'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dee9fc'
  surface-container-highest: '#d9e3f6'
  on-surface: '#121c2a'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#27313f'
  inverse-on-surface: '#eaf1ff'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#9d4300'
  on-secondary: '#ffffff'
  secondary-container: '#fd761a'
  on-secondary-container: '#5c2400'
  tertiary: '#006591'
  on-tertiary: '#ffffff'
  tertiary-container: '#23acf1'
  on-tertiary-container: '#003d59'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#ffdbca'
  secondary-fixed-dim: '#ffb690'
  on-secondary-fixed: '#341100'
  on-secondary-fixed-variant: '#783200'
  tertiary-fixed: '#c9e6ff'
  tertiary-fixed-dim: '#89ceff'
  on-tertiary-fixed: '#001e2f'
  on-tertiary-fixed-variant: '#004c6e'
  background: '#f8f9ff'
  on-background: '#121c2a'
  surface-variant: '#d9e3f6'
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
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
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
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  container-margin-mobile: 16px
  container-margin-desktop: 40px
  gutter: 20px
---

## Brand & Style

The design system is engineered for a premium fitness and nutrition experience that balances clinical precision with motivational energy. The brand personality is authoritative yet encouraging, targeting health-conscious individuals who value clarity and data-driven insights. 

The aesthetic follows a **Modern Corporate** style with a focus on **Minimalism** and **Tactile** depth. It prioritizes high legibility and an airy, spacious feel to reduce the cognitive load of tracking complex nutritional data. The UI should evoke a sense of freshness, vitality, and organized progress through the use of soft light-mode surfaces and vibrant, purposeful accents.

## Colors

The palette is centered around **Emerald Green**, symbolizing health, growth, and vitality. This color is reserved for primary actions, success states, and key progress indicators.

- **Primary (Emerald):** Used for main CTA buttons, "Active" states, and positive health metrics.
- **Secondary (Soft Orange):** Employed for energy-related metrics (calories), nutrition warnings, or secondary highlights.
- **Tertiary (Blue):** Dedicated to hydration tracking and recovery data.
- **Neutrals:** A range of grays from **Deep Charcoal (#1F2937)** for primary text to **Slate Gray (#6B7280)** for secondary labels.
- **Background:** A very light **Off-White (#F9FAFB)** provides a clean canvas that differentiates from the pure white surfaces of interactive cards.

## Typography

This design system utilizes a dual-font strategy to balance character with utility. 

**Hanken Grotesk** is used for headlines and display text. Its sharp, contemporary geometry provides a "high-end fitness" feel that is both professional and modern. 

**Inter** is utilized for all body copy, inputs, and labels. Its neutral, systematic nature ensures maximum readability during activity or quick data entry. 

**Key Rules:**
- Use **Display LG** for hero achievement numbers (e.g., total calories).
- Use **Label SM** in All-Caps for category headers or small metadata.
- Maintain a minimum line height of 1.5x for body text to ensure a spacious, "breathable" layout.

## Layout & Spacing

The system follows an **8px linear scale**, ensuring consistent rhythm across all components.

- **Mobile:** Uses a fluid single-column layout with 16px side margins. Elements are stacked vertically, utilizing the full width for cards.
- **Desktop:** Transitions to a fixed-width content area (max 1200px) with a persistent **Left Sidebar** for navigation. Layout utilizes a 12-column grid.
- **Rhythm:** Use `lg` (24px) for spacing between unrelated sections and `md` (16px) for padding inside cards. 
- **Safe Areas:** On mobile, ensure all primary actions are within the bottom-half "thumb zone" to enhance ergonomics during workouts.

## Elevation & Depth

To achieve a "premium" feel, this design system avoids heavy borders in favor of **Tonal Layers** and **Ambient Shadows**.

1.  **Level 0 (Background):** #F9FAFB. The lowest layer.
2.  **Level 1 (Cards/Surfaces):** Pure #FFFFFF. These elements use a very soft, diffused shadow to appear slightly lifted. 
    - *Shadow Specs:* 0px 4px 20px rgba(0, 0, 0, 0.04).
3.  **Level 2 (Modals/Overlays):** Elevated surfaces for focus.
    - *Shadow Specs:* 0px 10px 30px rgba(0, 0, 0, 0.08).

Avoid inner shadows or harsh outlines. Depth is strictly used to separate content "chunks" from the background, creating a tactile, stackable card interface.

## Shapes

The shape language is friendly and modern, leaning into **Rounded** geometry. 

- **Cards & Primary Containers:** Use `rounded-lg` (16px) or `rounded-xl` (24px) to create a soft, approachable aesthetic.
- **Buttons:** Use a high corner radius (min 12px) or full pills for a "squishy," touch-friendly feel.
- **Charts:** All circular charts (rings/donuts) must have rounded end-caps to maintain the soft visual language.
- **Input Fields:** 12px corner radius to match button styling.

## Components

### Buttons
- **Primary:** Solid Emerald Green background, white text, 16px+ height padding.
- **Secondary:** Soft gray background or Emerald Green outline.
- **States:** Subtle scale-down (0.98) on press for tactile feedback.

### Progress Bars & Charts
- **Ring Charts:** Used for daily goals (Calories, Protein, Carbs, Fat). Line weight should be thick (8px-12px) with rounded caps.
- **Progress Bars:** Backgrounds should be a 10% opacity version of the progress color (e.g., light green track for a green bar).

### Cards
- White background, 16px corner radius, 16px internal padding. 
- Headers inside cards use **Title LG** typography.

### Input Fields
- Clear labels above the field.
- Active state indicated by a 2px Emerald Green bottom border or subtle glow.

### Chips/Badges
- Used for diet tags (e.g., "Keto," "High Protein"). 
- Small font size, uppercase, with a background color matching the nutrient type.

### Navigation
- **Mobile:** Bottom Tab Bar with centered "Plus" button for quick logging.
- **Desktop:** Left-aligned vertical sidebar with icons and labels.