# Scout Platform - Approval Workflows Documentation

This document provides a comprehensive overview of all approval workflows across the Scout dog adoption platform. Each workflow is managed by specific departments with clear status transitions and responsibilities.

---

## Table of Contents

1. [Shelter Account Approval](#1-shelter-account-approval)
2. [Dog/Pet Listing Approval](#2-dogpet-listing-approval)
3. [Foster Account Approval](#3-foster-account-approval)
4. [Trust & Safety Eligibility Review](#4-trust--safety-eligibility-review)
5. [Adoption Application Approval](#5-adoption-application-approval)
6. [Phone Screening Workflow](#6-phone-screening-workflow)
7. [User Account Status Management](#7-user-account-status-management)
8. [Complete Adoption Journey Flow](#8-complete-adoption-journey-flow)

---

## 1. Shelter Account Approval

### Overview
When a new shelter registers on the Scout platform, their account requires approval by a Platform Admin before they can list dogs or receive applications.

### Managed By
**Platform Admin** (`platform_admin` role)

### Statuses

| Status | Description |
|--------|-------------|
| `pending` | Shelter has completed registration, awaiting admin review |
| `approved` | Admin has approved the shelter to operate on the platform |
| `rejected` | Admin rejected the shelter application with a documented reason |

### Workflow

```
Shelter Registration → Pending Review → Admin Decision
                                            ↓
                              ┌─────────────┴─────────────┐
                              ↓                           ↓
                          Approved                    Rejected
                              ↓                           ↓
                    Can list dogs,              Cannot access
                    receive applications        shelter features
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/shelters/pending` | GET | Get all pending shelter applications |
| `/api/admin/shelters/:id/approve` | PATCH | Approve a shelter |
| `/api/admin/shelters/:id/reject` | PATCH | Reject a shelter (requires `reason`) |

### Database Fields
- `approvalStatus`: 'pending' | 'approved' | 'rejected'
- `approvedBy`: ID of admin who made the decision
- `approvedAt`: Timestamp of approval/rejection
- `rejectionReason`: Required when rejecting

---

## 2. Dog/Pet Listing Approval

### Overview
All dogs listed on the platform (by shelters or rehomers) must be reviewed and approved by Platform Admin before becoming visible to adopters.

### Managed By
**Platform Admin** (`platform_admin` role)

### Statuses

| Status | Description |
|--------|-------------|
| `pending` | Dog has been listed, awaiting admin review |
| `approved` | Admin approved, dog is now visible to adopters |
| `rejected` | Admin rejected the listing with a documented reason |

### Workflow

```
Dog Listed (Shelter/Rehomer) → Pending Review → Admin Decision
                                                      ↓
                                        ┌─────────────┴─────────────┐
                                        ↓                           ↓
                                    Approved                    Rejected
                                        ↓                           ↓
                              Visible to adopters,         Not visible,
                              can receive applications     owner notified
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/dogs/pending` | GET | Get all pending dog listings |
| `/api/admin/dogs/:id/approve` | PATCH | Approve a dog listing |
| `/api/admin/dogs/:id/reject` | PATCH | Reject a listing (requires `reason`) |

### Database Fields
- `approvalStatus`: 'pending' | 'approved' | 'rejected'
- `approvedBy`: ID of admin who made the decision
- `approvedAt`: Timestamp of approval/rejection
- `rejectionReason`: Required when rejecting

### Notes
- Dogs with `listingType: 'rehome'` follow the same approval process
- Urgent/critical dogs may receive expedited review

---

## 3. Foster Account Approval

### Overview
Users who wish to become foster caregivers must apply and be approved by Platform Admin before they can access foster features and receive foster placements.

### Managed By
**Platform Admin** (`platform_admin` role)

### Statuses

| Status | Description |
|--------|-------------|
| `pending` | User has applied to be a foster caregiver |
| `approved` | Admin approved foster capability |
| `rejected` | Admin rejected with a documented reason |

### Workflow

```
User Applies for Foster → Pending Review → Admin Decision
                                                 ↓
                                   ┌─────────────┴─────────────┐
                                   ↓                           ↓
                               Approved                    Rejected
                                   ↓                           ↓
                         Can access foster mode,        Cannot access
                         receive foster placements      foster features
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/fosters/pending` | GET | Get all pending foster applications |
| `/api/admin/fosters/:id/approve` | PATCH | Approve a foster application |
| `/api/admin/fosters/:id/reject` | PATCH | Reject (requires `reason`) |

### Database Fields (on `userProfiles`)
- `fosterApprovalStatus`: 'pending' | 'approved' | 'rejected'
- `fosterApprovedBy`: ID of admin who made the decision
- `fosterApprovedAt`: Timestamp of approval/rejection
- `fosterRejectionReason`: Required when rejecting

### Reviewed Information
- `fosterTimeCommitment`: How much time user can dedicate
- `fosterSizePreference`: Size of dogs user can foster
- `fosterSpecialNeedsWilling`: Willingness to foster special needs dogs
- `fosterEmergencyAvailability`: Available for emergency placements
- `fosterPreviousExperience`: Prior fostering experience
- `fosterCapacity`: Number of dogs user can foster at once

---

## 4. Trust & Safety Eligibility Review

### Overview
Trust & Safety (T&S) conducts eligibility reviews on adoption applicants before their applications are passed to shelters. This pre-screening ensures only suitable adopters reach the shelter's application queue.

### Managed By
- **Trust & Safety Team** (`trust_safety` role) - for standard reviews
- **Platform Admin** (`platform_admin` role) - for escalated cases and overrides

### Statuses

| Status | Description |
|--------|-------------|
| `pending_eligibility` | Application submitted, awaiting T&S review |
| `eligible` | T&S determined adopter meets eligibility criteria |
| `ineligible` | T&S determined adopter does not meet criteria |
| `escalated` | Complex case escalated to Platform Admin for override decision |

### Workflow

```
Application Submitted → Pending Eligibility → T&S Review
                                                   ↓
                              ┌────────────────────┼────────────────────┐
                              ↓                    ↓                    ↓
                          Eligible            Ineligible            Escalated
                              ↓                    ↓                    ↓
                     Proceeds to            Application          Platform Admin
                     Shelter/Admin          ends                  reviews
                     review                                           ↓
                                                              ┌───────┴───────┐
                                                              ↓               ↓
                                                          Override to    Confirm
                                                          Eligible       Ineligible
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/eligibility-metrics` | GET | Get counts per eligibility status |
| `/api/admin/eligibility-queue` | GET | Get list of journeys by status (query param: `status`) |
| `/api/admin/eligibility/:id/eligible` | PATCH | Mark as eligible (optional: `notes`) |
| `/api/admin/eligibility/:id/ineligible` | PATCH | Mark as ineligible (requires `reason`, optional: `notes`) |
| `/api/admin/eligibility/:id/escalate` | PATCH | Escalate to Platform Admin (requires `reason`, optional: `notes`) |
| `/api/admin/eligibility/:id/override` | PATCH | Platform Admin override (requires `decision`: 'eligible' or 'ineligible', optional: `notes`) |

### Database Fields (on `adoptionJourneys`)
- `eligibilityStatus`: 'pending_eligibility' | 'eligible' | 'ineligible' | 'escalated'
- `eligibilityNotes`: Notes from the reviewer
- `eligibilityReviewedBy`: ID of T&S staff who reviewed
- `eligibilityReviewedAt`: Timestamp of review
- `escalatedTo`: ID of Platform Admin for escalated cases
- `escalatedAt`: Timestamp of escalation
- `escalationReason`: Reason for escalation

### Review Criteria
T&S reviews the following flags and information:
- Red flags (automatic blocks): animal cruelty history, frequent returns
- Yellow flags (warnings): first-time owner with high-energy breed, space concerns
- User profile completeness
- Previous adoption history
- Lifestyle compatibility with requested dog

---

## 5. Adoption Application Approval

### Overview
Adoption applications are managed differently depending on who owns the dog:
- **Platform-owned dogs** (no shelter): Admin manages the application
- **Shelter-managed dogs**: The shelter manages the application exclusively

### 5A. Platform-Owned Dog Applications

**Managed By:** Platform Admin (`platform_admin` role)

#### Statuses

| Status | Description |
|--------|-------------|
| `active` | Application in progress |
| `approved` | Admin approved, proceeds to phone screening |
| `rejected` | Admin rejected with documented reason |
| `blocked` | Concerning application blocked by admin |

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/adoption-journeys` | GET | Get all applications for platform-owned dogs |
| `/api/admin/adoption-journeys/:id/approve` | PATCH | Approve application |
| `/api/admin/adoption-journeys/:id/reject` | PATCH | Reject application |
| `/api/adoption-journeys/:id/initiate-call` | POST | Manually initiate VAPI phone screening (requires `phoneNumber`, admin only) |
| `/api/admin/adoption-journeys/:id/approve-transcript` | PATCH | Approve transcript, move to Meet & Greet (requires `awaiting_review` status) |

#### Security Guard
Admin routes automatically verify that the dog has no `shelterId` (platform-owned). Attempting to manage a shelter-managed dog returns: `403 - This application is managed by the shelter, not admin`

### 5B. Shelter-Managed Dog Applications

**Managed By:** Shelter Staff (user with `shelter` role)

#### Shelter Approval Status

| Status | Description |
|--------|-------------|
| `pending` | Application awaiting shelter review |
| `approved` | Shelter approved (auto-triggers VAPI if feature flag enabled) |
| `rejected` | Shelter rejected with documented reason |

#### Journey Status

| Status | Description |
|--------|-------------|
| `active` | Application in progress |
| `completed` | Adoption has been finalized |

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/shelter/applications` | GET | Get all applications for shelter's dogs |
| `/api/shelter/applications/:applicationId` | PATCH | Update application status |
| `/api/shelter/applications/:applicationId/approve` | PATCH | Approve application (auto-initiates VAPI if enabled) |
| `/api/shelter/applications/:applicationId/reject` | PATCH | Reject application (requires `reason`) |
| `/api/shelter/applications/:applicationId/complete-adoption` | POST | Mark adoption as complete |
| `/api/shelter/applications/:applicationId/schedule-meet-greet` | POST | Schedule meet & greet |
| `/api/shelter/applications/:applicationId/message` | POST | Send message to applicant |
| `/api/shelter/applications/:applicationId/messages` | GET | Get message thread |
| `/api/shelter/applicants/:applicationId` | GET | Get specific application details |
| `/api/shelter/applicants/:applicationId/decision` | POST | Legacy decision endpoint |

#### Phone Screening Integration
When a shelter approves an application and the `shelter_phone_screening` feature flag is enabled:
1. Application `currentStep` is set to `phone_screening`
2. `phoneScreeningStatus` is set to `pending`
3. System automatically attempts to initiate VAPI call using applicant's phone number
4. Status updates to `scheduled` on success, or `failed` on error

---

## 6. Phone Screening Workflow

### Overview
Phone screening is conducted via VAPI AI voice calls. This automated screening interviews adopters about their lifestyle, experience, and compatibility with the dog they're applying for.

### Managed By
- **Platform Admin** - for platform-owned dogs (manual initiation)
- **Shelter Staff** - for shelter-managed dogs (automatic on approval)

### Statuses

**Implemented Statuses:**
| Status | Description | Set By |
|--------|-------------|--------|
| `pending` | Approval complete, call not yet initiated | Shelter approval handler |
| `scheduled` | VAPI call has been scheduled | After VAPI call initiated |
| `in_progress` | Call is currently happening | VAPI webhook |
| `completed` | Call finished, transcript available | VAPI webhook |
| `failed` | VAPI call failed (technical error) | Error handling |

**Admin Transcript Review Statuses** (for platform-owned dogs only):
| Status | Description | Set By |
|--------|-------------|--------|
| `awaiting_review` | Transcript ready for admin review | *Not currently wired - endpoint expects this status but no transition sets it* |
| `approved` | Admin reviewed and approved → proceeds to Meet & Greet | Admin approve-transcript endpoint |

**Implementation Note:** The admin transcript approval endpoint (`/api/admin/adoption-journeys/:id/approve-transcript`) checks for `phoneScreeningStatus === "awaiting_review"` before allowing approval. However, no current code path transitions the status from `completed` to `awaiting_review`. This represents an incomplete workflow that would need backend changes to fully support admin transcript review for platform-owned dogs.

For shelter-managed dogs, phone screening completes at `completed` status and shelters can proceed directly to meet & greet without requiring transcript approval.

### Workflow

#### Platform-Owned Dogs (Admin)
```
Application Approved → Admin Initiates Call → VAPI Conducts Interview
                                                       ↓
                                  Call Completed (transcript saved)
                                                       ↓
                                              Awaiting Review
                                                       ↓
                                 Admin Reviews Transcript & Approves
                                                       ↓
                                               Meet & Greet
```

#### Shelter-Managed Dogs (Automatic)
```
Shelter Approves Application → VAPI Call Auto-Initiated
                                          ↓
                               ┌──────────┴──────────┐
                               ↓                     ↓
                           Scheduled              Failed
                               ↓                     ↓
                          Call Starts          Manual follow-up
                               ↓                  required
                          Completed
                               ↓
                    Transcript available
                    in application details
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/adoption-journeys/:id/initiate-call` | POST | Initiate call manually (admin only, requires `phoneNumber`) |
| `/api/adoption-journeys/:id/start-my-call` | POST | User-initiated phone screening (adopters can start their own call) |
| `/api/admin/adoption-journeys/:id/approve-transcript` | PATCH | Approve transcript (admin, requires `awaiting_review` status) |
| `/api/vapi/webhook` | POST | VAPI callback with call results and transcript |

**Note:** Shelters do not have a separate initiate-call endpoint. Phone screening is automatically initiated when a shelter approves an application (if the `shelter_phone_screening` feature flag is enabled).

### Database Fields (on `adoptionJourneys`)
- `phoneScreeningStatus`: Status values as listed above
- `phoneScreeningScheduledAt`: When call was scheduled
- `phoneScreeningCallId`: VAPI call ID
- `phoneScreeningTranscript`: Full call transcript
- `phoneScreeningSummary`: AI-generated summary
- `phoneScreeningScore`: Compatibility score from VAPI
- `phoneScreeningCompletedAt`: Timestamp of call completion
- `phoneScreeningNotes`: Additional notes or error information

---

## 7. User Account Status Management

### Overview
Platform Admins can suspend or activate user accounts as needed for moderation, policy violations, or at user request.

### Managed By
**Platform Admin** (`platform_admin` role)

### Statuses

| Status | Description |
|--------|-------------|
| `active` (true) | Normal account access |
| `suspended` (false) | Account suspended, cannot log in |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | Get all users with status |
| `/api/admin/users/:id/status` | PATCH | Update user status (suspend/activate) |

### Database Fields (on `users`)
- `isActive`: Boolean indicating account status

### Effects of Suspension
- User cannot log in (blocked at authentication)
- Active sessions are invalidated
- Existing applications are not automatically affected

---

## 8. Complete Adoption Journey Flow

### End-to-End Workflow

This diagram shows how all approval workflows connect to create the complete adoption journey:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PLATFORM SETUP PHASE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Shelter Registers] ──→ Admin Approves Shelter                             │
│                                    ↓                                         │
│  [Shelter Lists Dog] ──→ Admin Approves Dog Listing                         │
│                                    ↓                                         │
│                          Dog visible to adopters                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ADOPTER APPLICATION PHASE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Adopter Applies] ──→ Trust & Safety Eligibility Review                    │
│                                    ↓                                         │
│                    ┌───────────────┼───────────────┐                        │
│                    ↓               ↓               ↓                        │
│                Eligible       Ineligible       Escalated                    │
│                    ↓               ↓               ↓                        │
│                    │          [End]         Platform Admin                  │
│                    │                        Override Decision               │
│                    ↓                               ↓                        │
│                    └───────────────┬───────────────┘                        │
│                                    ↓                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION REVIEW PHASE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌──────────────────────────┬──────────────────────────┐                  │
│    │    PLATFORM-OWNED DOG    │    SHELTER-MANAGED DOG   │                  │
│    ├──────────────────────────┼──────────────────────────┤                  │
│    │                          │                          │                  │
│    │  Admin Reviews           │  Shelter Reviews         │                  │
│    │  Application             │  Application             │                  │
│    │         ↓                │         ↓                │                  │
│    │  ┌──────┼──────┐         │  ┌──────┴──────┐         │                  │
│    │  ↓      ↓      ↓         │  ↓             ↓         │                  │
│    │ Approve Reject Block     │ Approve       Reject     │                  │
│    │  ↓                       │  ↓                       │                  │
│    │  │                       │  │ (auto-VAPI if         │                  │
│    │  │                       │  │  feature enabled)     │                  │
│    └──┼───────────────────────┼──┼───────────────────────┘                  │
│       └───────────────────────┴──┘                                           │
│                    ↓                                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PHONE SCREENING PHASE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Platform Dogs:                  Shelter Dogs:                              │
│  [Admin Initiates Call]          [Auto-initiated on Approval]               │
│            ↓                              ↓                                  │
│            └──────────────┬───────────────┘                                 │
│                           ↓                                                  │
│                  VAPI Conducts Interview                                    │
│                           ↓                                                  │
│                Transcript Generated                                         │
│                           ↓                                                  │
│         Admin/Shelter Reviews (optional)                                    │
│                           ↓                                                  │
│                      Proceeds                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FINALIZATION PHASE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Meet & Greet Scheduled] ──→ In-Person Meeting                             │
│                                    ↓                                         │
│                    ┌───────────────┴───────────────┐                        │
│                    ↓                               ↓                        │
│             Successful                        Not a Match                   │
│                    ↓                               ↓                        │
│          Complete Adoption                   [End Journey]                  │
│                    ↓                                                        │
│            Dog Adopted!                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Admin Role Permissions Summary

| Role | Permissions |
|------|-------------|
| `platform_admin` | All approvals, T&S override, user management, shelter management, platform-owned dog applications |
| `trust_safety` | Eligibility reviews, escalation to platform admin |
| `shelter` | Manage own shelter's dogs and applications only |
| `ai_ops` | AI knowledge base management |

---

## Status Field Quick Reference

### Shelter Approval
`approvalStatus`: pending → approved / rejected

### Dog Listing
`approvalStatus`: pending → approved / rejected

### Foster Account
`fosterApprovalStatus`: pending → approved / rejected

### T&S Eligibility
`eligibilityStatus`: pending_eligibility → eligible / ineligible / escalated

### Shelter Application Approval
`shelterApprovalStatus`: pending → approved / rejected

### Adoption Journey
`status`: active → completed
`currentStep`: application → phone_screening → meet_greet → adoption → completed

### Phone Screening
`phoneScreeningStatus`: pending → scheduled → in_progress → completed / failed
(Admin flow adds: awaiting_review → approved)

### User Account
`isActive`: true (active) / false (suspended)

---

*Last updated: December 2024*
