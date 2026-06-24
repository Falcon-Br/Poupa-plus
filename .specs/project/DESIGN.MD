---
name: Premium FinTrack System
colors:
  surface: '#f8faf8'
  surface-dim: '#d8dad9'
  surface-bright: '#f8faf8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f2'
  surface-container: '#eceeec'
  surface-container-high: '#e6e9e7'
  surface-container-highest: '#e1e3e1'
  on-surface: '#191c1b'
  on-surface-variant: '#404943'
  inverse-surface: '#2e3130'
  inverse-on-surface: '#eff1ef'
  outline: '#717973'
  outline-variant: '#c0c9c1'
  surface-tint: '#356850'
  primary: '#002819'
  on-primary: '#ffffff'
  primary-container: '#06402b'
  on-primary-container: '#77ac90'
  inverse-primary: '#9cd2b5'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#4d0006'
  on-tertiary: '#ffffff'
  tertiary-container: '#76000d'
  on-tertiary-container: '#ff7670'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b8efd0'
  primary-fixed-dim: '#9cd2b5'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#1b503a'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#f8faf8'
  on-background: '#191c1b'
  surface-variant: '#e1e3e1'
typography:
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-numeric:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 16px
  label-caps:
    fontFamily: Manrope
    fontSize: 11px
    fontWeight: '800'
    lineHeight: 16px
    letterSpacing: 0.08em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 1.5rem
  margin-mobile: 1rem
  margin-desktop: 2.5rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 2rem
---

## Brand & Style

The design system is built on a foundation of **Modern Corporate** aesthetics with a focus on high-fidelity financial management. It targets professionals who demand clarity, reliability, and a premium feel from their financial tools. 

The UI evokes an emotional response of security and control through a structured layout and a sophisticated color palette. It utilizes heavy whitespace to reduce cognitive load in data-heavy environments, ensuring that "critical numbers" remain the focal point. The aesthetic avoids unnecessary ornamentation, favoring precise alignment and subtle depth to guide the user's eye across complex financial narratives.

## Colors

This design system utilizes a specialized "Financial Growth" palette:

- **Primary (Forest Green):** Used for sidebar backgrounds, primary navigation, and high-level headers to establish a grounded, trustworthy environment.
- **Secondary (Emerald):** Reserved for "positive" financial indicators, growth metrics, and call-to-action buttons.
- **Tertiary (Financial Red):** Strictly used for debt, expenses exceeding limits, and critical alerts.
- **Neutral (Off-White/Sage):** A warm, clean background layer that reduces eye strain compared to pure white, providing a sophisticated canvas for data.
- **Surface Tiers:** Use subtle variations of the neutral palette to distinguish between the background and elevated cards or containers.

## Typography

Typography is the core of this design system's utility. 

1. **Manrope** is used for all interface copy and headlines to maintain a modern, balanced, and approachable feel.
2. **JetBrains Mono** (or any clean Monospaced font) is strategically applied to currency values and transaction amounts. This ensures that decimal points align perfectly in lists, aiding in rapid visual scanning of balance sheets.
3. **Information Hierarchy:** Use `label-caps` for section headers (e.g., "CATEGORIES", "RECENT TRANSACTIONS") to provide a clear structural anchor without competing with the primary data.

## Layout & Spacing

The system employs a **Fixed Grid** philosophy for desktop to maintain a premium "dashboard" feel, switching to a fluid stack for mobile devices.

- **Grid:** A 12-column grid is used for the main content area. Data cards typically span 3, 4, or 6 columns.
- **Sidebar:** A fixed-width sidebar (240px) persists on desktop, containing the brand logo and primary navigation.
- **Vertical Rhythm:** Use the `stack` variables to maintain consistent spacing between card elements. Progress bars and their associated labels should use `stack-sm` to feel grouped, while separate widgets use `stack-lg`.
- **Responsive Behavior:** On mobile, margins reduce to 16px and all grid columns collapse into a single vertical flow.

## Elevation & Depth

This design system uses **Tonal Layering** combined with **Ambient Shadows** to create a sense of organized depth.

- **Base Layer:** Background uses the `neutral` off-white color.
- **Card Layer:** White surfaces with a very soft, diffused shadow (`0px 4px 20px rgba(0, 64, 43, 0.04)`) to separate content from the background without creating "visual noise."
- **Interactive States:** On hover, cards may lift slightly with a more pronounced shadow. 
- **Separators:** Use 1px borders in a slightly darker neutral tone rather than shadows for internal card divisions (like transaction list items) to keep the UI crisp.

## Shapes

The shape language is **Rounded**, conveying a professional yet modern software feel.

- **Standard Elements:** Buttons, input fields, and small widgets use a 0.5rem (8px) radius.
- **Containers:** Large data cards and the main dashboard content area use `rounded-lg` (16px) or `rounded-xl` (24px) to soften the overall composition.
- **Progress Bars:** Use fully rounded ends (pill-shape) to distinguish them from structural containers.

## Components

### Buttons
- **Primary:** Solid Forest Green with white text. High contrast, 8px corner radius.
- **Secondary:** Transparent with an Emerald border and Emerald text.
- **Ghost:** No border or background; Emerald text for "View All" or "Export" actions.

### Cards & Summaries
Data cards should feature a consistent header style using `label-caps`. Financial summaries (e.g., "Total Balance") should use a vertical colored accent bar (Emerald for positive, Red for negative) on the left edge of the card to provide instant context.

### Transaction Lists
Transactions should be presented in a clean row format. Use small circular icons for categories. The "Value" column must always use the monospaced font weight to ensure numerical alignment.

### Budget Progress Bars
Background should be a light tint of the neutral palette. The fill color is dynamic: Emerald by default, turning Red if the "Limit" value is exceeded. Include "Used" and "Remaining" labels in `body-md` directly above the bar.

### Input Fields
Soft off-white background with a subtle 1px border. Focus state should highlight the border in Emerald and add a soft Emerald outer glow.