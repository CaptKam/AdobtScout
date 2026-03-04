
# Scout Application Flow & Pipeline Documentation

## Complete Platform Architecture

```mermaid
graph TB
    subgraph "User Portals"
        A[Adopter Portal]
        B[Shelter Portal]
        C[Admin Portal]
        D[Foster Portal]
    end
    
    subgraph "Core Services"
        E[Authentication]
        F[AI Services<br/>Gemini 2.0]
        G[Voice AI<br/>Vapi]
        H[Database<br/>PostgreSQL]
    end
    
    subgraph "Key Features"
        I[Swipe Discovery]
        J[AI Chat Scout]
        K[Intake System]
        L[Pipeline Management]
        M[Medical Records]
        N[Task Automation]
    end
    
    A --> E
    B --> E
    C --> E
    D --> E
    
    E --> H
    
    A --> I
    A --> J
    B --> K
    B --> L
    B --> M
    B --> N
    
    I --> F
    J --> F
    K --> F
    L --> H
    M --> H
    N --> H
    
    G --> J
    G --> K
```

## User Journey Flow

```mermaid
graph TD
    A[Landing Page] --> B{User Role?}
    B -->|Adopter| C[Adopter Onboarding]
    B -->|Shelter| D[Shelter Onboarding]
    B -->|Foster| E[Foster Onboarding]
    
    C --> F[Discover/Swipe]
    F --> G[Dog Profile]
    G --> H[Application]
    H --> I[Phone Screening<br/>AI Voice Call]
    I --> J[Messages/Chat]
    J --> K[Meet & Greet]
    K --> L[Adoption]
    
    D --> M[Operations Hub]
    M --> N[Intake Pipeline]
    N --> O[Medical Hold]
    O --> P[Behavior Eval]
    P --> Q[Photos Needed]
    Q --> R[Ready/Featured]
    R --> S[Adopted]
```

## Shelter Pipeline Status Flow

```mermaid
stateDiagram-v2
    [*] --> Intake
    Intake --> StrayHold: Stray Dog
    Intake --> MedicalHold: Needs Treatment
    Intake --> BehaviorEval: Assessment Needed
    
    StrayHold --> MedicalHold
    StrayHold --> BehaviorEval
    StrayHold --> PhotosNeeded
    
    MedicalHold --> BehaviorEval
    MedicalHold --> PhotosNeeded
    
    BehaviorEval --> PhotosNeeded
    BehaviorEval --> Ready
    
    PhotosNeeded --> Ready
    Ready --> Featured
    Featured --> Adopted
    Ready --> Adopted
    
    Adopted --> [*]
```

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API
    participant DB
    participant AI
    
    User->>Client: Submit Intake Form
    Client->>API: POST /api/shelter/dogs
    API->>DB: Create Dog Record
    DB-->>API: Dog ID
    API->>DB: Create Intake Record
    DB-->>API: Intake ID
    
    alt AI Health Check Enabled
        API->>AI: Analyze Health Concerns
        AI-->>API: Health Screening Result
        API->>DB: Save Health Screening
    end
    
    API-->>Client: Success Response
    Client-->>User: Show Confirmation
```

## Shelter Intake & Health Screening Flow

```mermaid
sequenceDiagram
    participant Staff as Shelter Staff
    participant UI as Intake Form
    participant API as Backend API
    participant DB as Database
    participant AI as Gemini AI
    
    Staff->>UI: Fill intake form
    Staff->>UI: Add dog photos
    Staff->>UI: Add health concerns (optional)
    
    UI->>API: POST /api/shelter/dogs
    API->>DB: Create dog record
    DB-->>API: Dog ID
    
    UI->>API: POST /api/shelter/intake
    API->>DB: Create intake record
    DB-->>API: Intake ID
    
    alt Health Concerns Added
        API->>AI: Analyze health concerns
        AI-->>API: Health screening results
        API->>DB: Save medical records
        DB-->>API: Record IDs
    end
    
    API-->>UI: Success with IDs
    UI-->>Staff: Show confirmation
    Staff->>UI: View in pipeline
```

## User & Application Approval Pipeline Flow

```mermaid
stateDiagram-v2
    [*] --> UserSignup: New User Arrives
    
    state UserSignup {
        [*] --> RoleSelection: Choose Role
        RoleSelection --> AdopterPath: Adopter
        RoleSelection --> ShelterPath: Shelter
        RoleSelection --> FosterPath: Foster
    }
    
    state AdopterPath {
        [*] --> ProfileCreation: Complete Profile
        ProfileCreation --> AutoApproved: Profile Complete
        AutoApproved --> CanBrowse: Ready to Discover
    }
    
    state ShelterPath {
        [*] --> ShelterOnboarding: Enter Shelter Info
        ShelterOnboarding --> PendingApproval: Awaiting Admin Review
        
        state PendingApproval {
            [*] --> AdminReview: Admin Checks Details
            AdminReview --> Approved: Verification Passed
            AdminReview --> Rejected: Verification Failed
        }
    }
    
    state FosterPath {
        [*] --> FosterOnboarding: Complete Foster Profile
        FosterOnboarding --> FosterPending: Awaiting Approval
        
        state FosterPending {
            [*] --> AdminFosterReview: Admin Verification
            AdminFosterReview --> FosterApproved: Background Check Passed
            AdminFosterReview --> FosterRejected: Not Approved
        }
    }
    
    UserSignup --> AdopterPath
    UserSignup --> ShelterPath
    UserSignup --> FosterPath
    
    ShelterPath --> ShelterActive: Approved
    FosterPath --> FosterActive: Approved
    
    state ApplicationFlow {
        [*] --> UserSwipes: Browse Dogs
        UserSwipes --> ApplicationSubmitted: Submit Application
        ApplicationSubmitted --> PendingReview: In Review Queue
        
        state PendingReview {
            [*] --> AIReview: AI Screening
            AIReview --> PhoneScreening: Schedule AI Call
            PhoneScreening --> TranscriptReview: Call Complete
            TranscriptReview --> AdminApplicationReview: Admin Reviews All
            
            state AdminApplicationReview {
                [*] --> CheckResponses: Review Answers
                CheckResponses --> CheckAI: Review AI Score
                CheckAI --> CheckTranscript: Review Call
                CheckTranscript --> Decision: Make Decision
            }
        }
        
        PendingReview --> ApplicationApproved: Approved
        PendingReview --> ApplicationRejected: Rejected
        PendingReview --> NeedsMoreInfo: Request Info
        
        NeedsMoreInfo --> PendingReview: Info Provided
    }
    
    AdopterPath --> ApplicationFlow: Applies for Dog
    
    ApplicationApproved --> MeetGreet: Schedule Visit
    MeetGreet --> ReadyForCheckout: Visit Complete
    ReadyForCheckout --> Completed: Adoption Finalized
    
    ApplicationRejected --> [*]
    Completed --> [*]
```

## Application Status Progression

```mermaid
graph LR
    A[Application Submitted] --> B{AI Review}
    B -->|High Score| C[Phone Screening Scheduled]
    B -->|Low Score| D[Needs Manual Review]
    
    C --> E[AI Voice Call]
    E --> F[Transcript Generated]
    F --> G[Awaiting Admin Review]
    
    D --> G
    G --> H{Admin Decision}
    
    H -->|Approve| I[Approved Status]
    H -->|Request Info| J[Needs Info]
    H -->|Reject| K[Rejected]
    
    J --> L[Applicant Responds]
    L --> G
    
    I --> M[Interview Scheduled]
    M --> N[Meet & Greet]
    N --> O[Ready for Checkout]
    O --> P[Completed/Adopted]
```

## Admin Review Dashboard Flow

```mermaid
graph TB
    subgraph "Admin Dashboard Tabs"
        A1[Pending Review]
        A2[Pending Transcript Review]
        A3[Approved]
        A4[Rejected]
        A5[All Applications]
    end
    
    subgraph "Application Card Actions"
        B1[View Details]
        B2[Review AI Score]
        B3[Listen to Call]
        B4[Read Transcript]
        B5[Add Admin Notes]
    end
    
    subgraph "Admin Actions"
        C1[Approve Application]
        C2[Reject with Reason]
        C3[Request More Info]
        C4[Schedule Interview]
    end
    
    A1 --> B1
    A2 --> B3
    
    B1 --> B2
    B1 --> B4
    B1 --> B5
    
    B5 --> C1
    B5 --> C2
    B5 --> C3
    
    C1 --> A3
    C2 --> A4
    C3 --> A1
```

## Shelter Pipeline Drag & Drop Flow

```mermaid
stateDiagram-v2
    [*] --> Intake: New Dog Arrives
    
    state Intake {
        [*] --> BasicInfo: Staff enters details
        BasicInfo --> PhotoCheck: System checks photos
        PhotoCheck --> HealthCheck: AI health screening
    }
    
    Intake --> StrayHold: If stray
    Intake --> MedicalHold: If needs medical
    Intake --> BehaviorEval: Ready for assessment
    
    state StrayHold {
        [*] --> Waiting: 72hr hold period
        Waiting --> HoldExpired: Timer expires
    }
    
    state MedicalHold {
        [*] --> Treatment: Receiving care
        Treatment --> Recovery: Monitoring
        Recovery --> Cleared: Vet approval
    }
    
    state BehaviorEval {
        [*] --> Assessment: Staff evaluation
        Assessment --> Scored: Results recorded
    }
    
    StrayHold --> MedicalHold: If medical needs
    StrayHold --> PhotosNeeded: If hold expires
    MedicalHold --> PhotosNeeded: When cleared
    BehaviorEval --> PhotosNeeded: Assessment done
    
    PhotosNeeded --> Ready: Professional photos added
    Ready --> Featured: Staff highlights
    Featured --> Adopted: Application approved
    Ready --> Adopted: Application approved
    
    Adopted --> [*]
```

## Task Automation System

```mermaid
graph TD
    subgraph "Trigger Events"
        A1[New Intake]
        A2[Status Change]
        A3[Scheduled Time]
        A4[Medical Record]
    end
    
    subgraph "Automation Rules"
        B1[Vaccine Schedule]
        B2[Follow-up Tasks]
        B3[Photo Reminders]
        B4[Behavior Eval]
    end
    
    subgraph "Task Generation"
        C1[Create Task]
        C2[Assign Staff]
        C3[Set Priority]
        C4[Set Due Date]
    end
    
    subgraph "Notifications"
        D1[Email Alert]
        D2[Dashboard Badge]
        D3[Mobile Push]
    end
    
    A1 --> B1
    A1 --> B4
    A2 --> B2
    A2 --> B3
    A3 --> B1
    A4 --> B2
    
    B1 --> C1
    B2 --> C1
    B3 --> C1
    B4 --> C1
    
    C1 --> C2
    C2 --> C3
    C3 --> C4
    
    C4 --> D1
    C4 --> D2
    C4 --> D3
```

## Medical Records System

```mermaid
graph TB
    subgraph "Data Sources"
        A1[Manual Entry]
        A2[AI Health Screening]
        A3[Vet Records Upload]
    end
    
    subgraph "Record Types"
        B1[Vaccines]
        B2[Treatments]
        B3[Exams]
        B4[Medications]
        B5[Surgeries]
        B6[Weight Checks]
    end
    
    subgraph "Features"
        C1[Due Date Tracking]
        C2[Booster Reminders]
        C3[Cost Tracking]
        C4[Document Attachments]
    end
    
    subgraph "Automation"
        D1[Auto-generate Tasks]
        D2[Alert Staff]
        D3[Update Dashboard]
    end
    
    A1 --> B1 & B2 & B3 & B4 & B5 & B6
    A2 --> B2 & B3
    A3 --> B1 & B2 & B4 & B5
    
    B1 --> C1 & C2
    B2 --> C3 & C4
    B3 --> C4
    B4 --> C1 & C3
    B5 --> C3 & C4
    B6 --> C1
    
    C1 --> D1
    C2 --> D2
    C1 --> D3
```

## API Route Map

```mermaid
graph TB
    subgraph "Shelter Routes"
        A[/api/shelter]
        A --> B[/dogs]
        A --> C[/intake]
        A --> D[/medical]
        A --> E[/applications]
        A --> F[/tasks]
        A --> G[/dashboard]
        A --> H[/pipeline]
        A --> I[/calendar]
        A --> J[/staff]
    end
    
    subgraph "Admin Routes"
        K[/api/admin]
        K --> L[/users]
        K --> M[/metrics]
        K --> N[/approvals]
        K --> O[/features]
        K --> P[/marketing]
        K --> Q[/knowledge-base]
    end
    
    subgraph "AI Services"
        R[/api/generate-pet-names]
        S[/api/analyze-photo]
        T[/api/health-screening]
    end
    
    subgraph "Voice AI"
        U[/api/vapi/webhook]
        V[/api/consultation/initiate]
    end
    
    B --> B1[GET - List<br/>POST - Create<br/>PUT - Update]
    C --> C1[POST - Create<br/>PATCH - Update Status]
    D --> D1[GET - Records<br/>POST - Add Record<br/>POST - Health Screening]
    E --> E1[GET - List<br/>PATCH - Update]
    F --> F1[GET - List<br/>POST - Create<br/>PATCH - Complete]
    G --> G1[GET - Metrics]
    H --> H1[GET - Dogs by Stage]
```

## Database Schema Overview

```mermaid
erDiagram
    USERS ||--o{ DOGS : owns
    USERS ||--o{ USER_PROFILES : has
    USERS ||--o{ SHELTER_PROFILES : has
    
    DOGS ||--o{ INTAKE_RECORDS : has
    DOGS ||--o{ MEDICAL_RECORDS : has
    DOGS ||--o{ BEHAVIOR_ASSESSMENTS : has
    DOGS ||--o{ ADOPTION_JOURNEYS : "applied for"
    
    INTAKE_RECORDS ||--o{ HEALTH_SCREENING_RESULTS : generates
    
    ADOPTION_JOURNEYS ||--o{ CONSULTATION_CALLS : includes
    ADOPTION_JOURNEYS ||--|| USERS : belongs_to
    
    SHELTER_TASKS ||--o| DOGS : "assigned to"
    SHELTER_TASKS ||--o| USERS : "assigned to staff"
    
    AUTOMATION_RULES ||--o{ SHELTER_TASKS : generates
    
    MEDICAL_RECORDS ||--o{ SHELTER_TASKS : "triggers"
    
    CONVERSATIONS ||--|| DOGS : about
    CONVERSATIONS ||--|| USERS : between
    CONVERSATIONS ||--o{ MESSAGES : contains
```

## AI Integration Architecture

```mermaid
graph TB
    subgraph "User Interactions"
        A1[Photo Upload]
        A2[Health Concern Report]
        A3[Chat Message]
        A4[Name Generation Request]
    end
    
    subgraph "AI Processing Layer"
        B1[Gemini Vision API<br/>Breed ID]
        B2[Gemini 2.0 Flash Thinking<br/>Health Analysis]
        B3[Gemini Pro<br/>Scout Chat]
        B4[Gemini Pro<br/>Name Generator]
    end
    
    subgraph "Context Assembly"
        C1[User Profile]
        C2[Scout Insights]
        C3[Dog Database]
        C4[Knowledge Base]
    end
    
    subgraph "Results Storage"
        D1[Dog Record]
        D2[Medical Records]
        D3[Chat History]
        D4[Scout Insights DB]
    end
    
    A1 --> B1
    A2 --> B2
    A3 --> B3
    A4 --> B4
    
    B3 --> C1 & C2 & C3 & C4
    
    B1 --> D1
    B2 --> D2
    B3 --> D3 & D4
    B4 --> D1
```

