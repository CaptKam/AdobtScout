# Design Guidelines: AI-Powered Dog Adoption Matching App

## Design Approach

**Reference-Based Strategy** drawing from industry leaders in discovery and matching:
- **Tinder/Hinge**: Card-based discovery, swipe mechanics, profile depth
- **Airbnb**: Trust-building through photos, detailed listings, map integration
- **Zillow**: Geolocation search, pin-based browsing, filter systems
- **Linear**: Clean typography, purposeful spacing, refined interactions

**Core Principle**: Create an emotionally engaging, visually-rich experience that builds trust and connection between adopters and dogs while maintaining the compassionate, ethical tone of rescue adoption.

---

## Typography System

**Font Families**:
- Primary: 'Inter' (Google Fonts) - for UI, body text, labels
- Display: 'Playfair Display' (Google Fonts) - for dog names, emotional headlines

**Hierarchy**:
- H1 (Dog Names on Cards): Playfair Display, 32px (text-3xl), semibold (font-semibold)
- H2 (Section Headers): Inter, 24px (text-2xl), bold (font-bold)
- H3 (Subsections): Inter, 18px (text-lg), semibold (font-semibold)
- Body: Inter, 16px (text-base), normal (font-normal)
- Small/Meta: Inter, 14px (text-sm), normal (font-normal)
- Tiny/Labels: Inter, 12px (text-xs), medium (font-medium), uppercase tracking

---

## Layout & Spacing System

**Tailwind Units**: Consistently use **2, 4, 6, 8, 12, 16, 20** for spacing
- Tight spacing: `p-2`, `gap-2`, `m-2`
- Standard spacing: `p-4`, `gap-4`, `m-4`
- Section padding: `p-8`, `py-12`, `py-16`
- Large gaps: `gap-8`, `mb-12`, `mt-20`

**Container Strategy**:
- Mobile-first: `px-4` on all viewports
- Desktop: `max-w-7xl mx-auto px-6`
- Card containers: `max-w-md mx-auto` (swipe cards)
- Profile content: `max-w-2xl`

---

## Core Components Library

### 1. Onboarding Flow
**Multi-step questionnaire** (5-6 screens):
- Welcome screen with hero image of happy adopted dog
- Living situation questions (house/apartment, yard, other pets)
- Activity level assessment (active/moderate/relaxed lifestyle)
- Experience level (first-time/experienced owner)
- Preference inputs (size, age, energy level)
- Location/radius selection with map preview

**Layout**: Single-column centered forms, one question per screen, large touch targets (min-h-12), progress bar at top (h-1 with transition animation)

### 2. Swipe Discovery Interface (Primary Screen)

**Card Stack Design**:
- Centered card: `w-full max-w-md h-[600px]` on mobile, `h-[700px]` on desktop
- Large hero image at top (60% of card height)
- Overlay gradient at bottom of image for text readability
- Content section below image with clean hierarchy:
  - Dog name (H1, Playfair Display)
  - Age, breed, location (small caps, tracking-wide)
  - Energy level indicator (pill badges)
  - AI compatibility score (prominent percentage with small explanation)
  - 2-3 sentence personality description

**Swipe Controls**:
- Bottom action bar with 3 large circular buttons (h-16 w-16):
  - Left: Pass (X icon, Heroicons)
  - Center: Info/Details (i icon)
  - Right: Like/Match (Heart icon)
- Buttons have subtle shadow (shadow-lg), slight hover lift

**Behind-Card Preview**: Show next 2 cards slightly scaled and offset for depth

### 3. Map View

**Layout**: Full-screen map with overlay controls
- Top bar: Search input, filter button, list/map toggle
- Map pins clustered by location with count badges
- Bottom drawer (slides up): 
  - Collapsed: Shows "X dogs near you" with photo strip
  - Expanded: Horizontal scrolling cards (h-48) showing dogs at selected location
  
**Pin Design**: Custom dog paw icon with compatibility score badge

### 4. Dog Profile Page

**Hero Section**:
- Full-width photo gallery (swipeable carousel, h-96 on desktop)
- Photo counter dots below
- Back button (top-left, blurred background circle)
- Share/Favorite buttons (top-right, blurred background)

**Content Sections** (all `px-6 py-8`):

1. **Header Block**:
   - Dog name (H1)
   - Age, breed, weight, location
   - Large compatibility score card with breakdown

2. **AI Match Explanation**:
   - "Why Scout thinks you'll love [Name]" heading
   - 3-4 bullet points explaining compatibility
   - Conversational AI-generated text

3. **About Section**:
   - Personality traits (pill badges in grid-cols-2)
   - Good with: kids/dogs/cats (icon grid)
   - Full bio paragraph

4. **Health & Details**:
   - Vaccination status, spay/neuter, special needs
   - Two-column grid on desktop

5. **Shelter Information**:
   - Shelter name, address, phone
   - Hours, response time
   - "Schedule Visit" primary CTA button (w-full on mobile, max-w-xs on desktop)

### 5. Scout AI Chat Interface

**Layout**: Standard messaging interface
- Top bar with "Chat with Scout" and profile icon
- Scrollable message area (grow)
- Input bar at bottom (sticky)

**Message Bubbles**:
- Scout messages: Left-aligned, rounded-2xl, max-w-[80%]
- User messages: Right-aligned, rounded-2xl, max-w-[80%]
- Typing indicator with animated dots
- Suggested quick replies as pill buttons below Scout messages

**Context Cards**: When Scout references a dog, show inline card preview (compact version of swipe card)

### 6. User Profile & Preferences

**Sections**:
1. Profile photo + edit button
2. Lifestyle summary card showing onboarding answers
3. Preference sliders (size, age range, distance radius)
4. Learned preferences section: "Based on your swipes, you prefer..." with trait badges
5. Saved/liked dogs grid (grid-cols-2 on mobile, grid-cols-3 on desktop)

### 7. Navigation

**Bottom Tab Bar** (mobile):
- 4 tabs: Discover (home icon), Map (map-pin icon), Matches (heart icon), Profile (user icon)
- Active state: bolder icon weight
- Tab bar: `h-16`, fixed bottom, subtle top border

**Desktop Sidebar** (left-aligned):
- Logo at top
- Navigation items (text + icon)
- Scout chat quick access at bottom
- Width: `w-64`

---

## Key Interactions & Behaviors

**Swipe Mechanics**:
- Drag threshold: 80px horizontal movement
- Visual feedback: Card tilts in drag direction
- On release: Smooth animation off screen or snap back
- Card transitions: Scale and fade for next card reveal

**Loading States**:
- Skeleton cards with shimmer effect for image loading
- "Finding your matches..." with animated paw prints
- Lazy load images as cards appear

**Empty States**:
- No matches: Friendly illustration + "Expand your search?" CTA
- End of swipe stack: "You've seen all dogs! Check back soon" with map suggestion

**Success Moments**:
- Match confirmation: Celebratory modal with confetti effect (very brief)
- Visit scheduled: Success toast notification (top-right, auto-dismiss)

---

## Accessibility Standards

- All interactive elements min-h-12 for touch targets
- Form inputs with visible labels and focus states (ring-2 ring-offset-2)
- Sufficient contrast ratios throughout
- Skip navigation links
- Image alt text describes dog characteristics
- ARIA labels for icon-only buttons
- Keyboard navigation for all swipe actions (arrow keys)

---

## Images Strategy

**Required Images**:
1. **Onboarding hero**: Happy person with adopted dog (emotional, warm)
2. **Dog profile photos**: 3-5 per dog showing personality (playing, resting, close-up)
3. **Shelter photos**: Optional exterior shots for credibility
4. **Empty states**: Custom illustrations of dogs (not photos) for lighter moments
5. **App screenshots**: For marketing/help sections

**Image Treatment**:
- All dog photos: rounded-xl corners
- Hero images: rounded-t-xl (cards) or rounded-2xl (profiles)
- Aspect ratios: 4:3 for cards, 16:9 for profile heroes
- Placeholder: Subtle gradient with paw icon during load

---

## Icon Library

**Primary**: Heroicons (via CDN) - outline style for most UI, solid for active states
**Key Icons Needed**: 
- heart, x-mark, information-circle, map-pin, user, home, chat-bubble, arrow-left, share, funnel (filter), location-marker, calendar, phone, envelope