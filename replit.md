# Scout - AI-Powered Dog Adoption Matching Platform

## Overview
Scout is an intelligent dog adoption matching platform that uses AI for compatibility matching and a Tinder-style swiping interface to connect adopters with dogs. It features a unified 2-role architecture for Adopters (who can switch between adopt, foster, and rehome modes) and Shelters (who manage multiple dog listings). The platform's core purpose is to facilitate ethical adoption and compassionate rescue by providing a tailored experience for each user type, leveraging AI for highly personalized matches. The business vision is to become the leading platform for dog adoption, increasing successful placements and reducing the number of dogs in shelters.

## User Preferences
I want the agent to prioritize developing the core user-facing features and ensuring a smooth, intuitive user experience, especially for the unified multi-mode architecture. I prefer an iterative development approach where features are built and tested incrementally. For AI-related tasks, ensure the "Scout" persona is consistently maintained as compassionate, knowledgeable, and ethical, explicitly avoiding language that implies dogs are "for sale." Do not make changes to the `server/data/seed-database.ts` file without explicit instruction.

## System Architecture

### UI/UX Decisions
The platform features a modern, intuitive UI inspired by dating apps with an 11-step onboarding questionnaire and a Tinder-style swipe discovery interface using Framer Motion. A warm orange color scheme, Inter and Playfair Display typography, and emphasis on smooth transitions define the aesthetic. Navigation is handled by role-aware bottom tabs for mobile and a sidebar for desktop. Profile pages feature a three-tier layout with a Mission Control task tracker and mode-specific content. The application is 100% mobile-responsive with a mobile-first approach, using Tailwind CSS breakpoints and ensuring accessible touch targets and safe areas. Mode-specific colors (orange for adopt, blue for foster, purple for rehome) are applied via CSS custom properties.

### Technical Implementations
- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI, Wouter for routing, TanStack Query for data fetching.
- **Backend**: Express.js with a RESTful API.
- **AI Integration**: OpenAI GPT-5 via Replit AI Integrations for compatibility analysis and personalized match explanations.
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: Email/Password via Passport.js with bcrypt.
- **Onboarding**: Frictionless guest mode for adopters with `localStorage` data, converting to a full account upon authentication.
- **Unified Profile Architecture**: `UserProfile` model supports adopter, rehomer, and foster fields, with a `mode` field tracking intent.
- **Tri-Mode Architecture**: Distinct user modes ('adopt', 'foster', 'rehome') with dedicated navigation and content visibility.
- **Security**: Role-based access control and authentication guards.
- **Urgency System**: Dogs can be marked 'urgent' or 'critical' with visual indicators and priority sorting.
- **Admin Role Architecture**: Tiered admin roles (`platform_admin`, `trust_safety`, `shelter_admin`, `ai_ops`) with specialized permissions and an eligibility review system.
- **Shelter Staff Permissions System**: 8-role hierarchy (owner > manager > medical/behavior/foster_coordinator/adoption_counselor > kennel > volunteer) with 13 granular permissions per staff member. Roles have default permissions that can be customized. Supports custom titles (e.g., "Head Veterinarian"). API endpoints: GET/POST/PATCH/DELETE `/api/shelter/staff`, invitation system at `/api/shelter/staff/invite`.
- **Terminology Migration**: UI uses "Pets" instead of "Dogs" for future multi-animal type expansion, while underlying data models remain `Dog`-centric.
- **Centralized Pipeline State Management**: All dog stage transitions go through `transitionDogStage()` in `pipeline-store.ts` with source tracking (drag/panel/automation/task/quick_action/bulk). The `canTransition()` function validates business rules before allowing moves (e.g., no intake→adopted, no medical_hold exit without clearance). The Pipeline page derives `selectedDog` from the store rather than maintaining duplicate local state.
- **Blockers System**: `client/src/lib/blockers.ts` provides `deriveBlockers()` to calculate blocking states from dog/intake data. Blockers include: intakeIncomplete, medicalIncomplete, behaviorIncomplete, photosMissing, strayHoldActive, legalHoldActive. Operations Hub shows "Today's Blockers" section routing users to Pipeline with specific dogs focused.
- **Pipeline Deep Linking**: Pipeline accepts query params `?focus={dogId}` to auto-select and open a dog's side panel, and `?filter={stage}` to highlight a specific column. Used by Operations Hub for routing workflows.

### Feature Specifications
- **Core Modes**:
    - **Adoption Mode**: AI-powered matching, accurate dog profiles, swipe UX, chat, AI assistant.
    - **Rehoming Mode**: Onboarding flow, AI rewriting for dog descriptions, matching with adopters/fosters, owner-to-adopter chat.
    - **Foster Mode**: Map of nearby animals needing foster, foster preference profiles, emergency foster activation, AI care instructions.
- **Shelter Portal**: Multi-user dashboard, bulk dog upload, behavior/medical notes, AI assistant for bios, urgent animal alerts.
- **Landing Page**: Marketing-focused with CTAs.
- **Swipe Discovery**: Tinder-style card stack with dog details and AI compatibility.
- **AI Matching**: Analyzes user lifestyle and dog needs.
- **Map View**: Geolocation-based discovery with urgent dog highlighting.
- **Dog Profile Pages**: Comprehensive info, compatibility breakdown, "Schedule Visit" CTA.
- **Adoption Application & Journey Tracking**: 4-step journey with AI-powered phone screening and progress visualization.
- **Scout AI Chat Assistant**: Advanced conversational AI for personalized guidance.
- **User Profile**: Edit lifestyle, preferences, view saved dogs, mission control, mode switcher.
- **Admin Portal**: User management, dog approvals, application review, AI knowledge base, marketing partners management.
- **Marketing Partners System**: CRUD for advertisers and locations, map integration, advertiser tiers.
- **Shelter CRM Portal**: Pet management, intake records, medical tracking, task management, applications.
- **Unified Medical Timeline**: Merges medical records, treatment plans, and vet referrals chronologically in pet detail pages.
- **Google Tasks-Style Task System**: Calendar-integrated task management with subtasks, drag-and-drop reordering, inline editing, quick add, and due date/time scheduling. Features a collapsible sidebar on desktop and sheet on mobile.
- **Shelter Calendar**: Google Calendar-style interface with React Big Calendar showing availability windows, blocked dates, meet & greets, tasks, and vaccine reminders.

## External Dependencies
- **Replit AI Integrations**: Used for accessing OpenAI GPT-5.
- **Passport.js**: For email/password authentication.
- **PostgreSQL**: Relational database.
- **Nominatim API**: Used for geocoding addresses.
- **Vapi AI**: Voice AI platform for phone screening calls with adopters.