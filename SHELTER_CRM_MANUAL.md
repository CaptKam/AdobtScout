
# Scout Shelter CRM - User Manual

## Table of Contents
1. [Getting Started](#getting-started)
2. [Operations Hub](#operations-hub)
3. [Dog Management](#dog-management)
4. [Pipeline View](#pipeline-view)
5. [Intake System](#intake-system)
6. [Inbox & Communications](#inbox--communications)
7. [Automation & Protocols](#automation--protocols)
8. [Medical Records](#medical-records)
9. [Task Management](#task-management)
10. [Foster Management](#foster-management)
11. [Community Resources](#community-resources)
12. [Donations & Fundraising](#donations--fundraising)
13. [Applications & Adoptions](#applications--adoptions)
14. [Checkout Process](#checkout-process)
15. [Staff Management](#staff-management)
16. [Calendar](#calendar)
17. [Analytics & Reports](#analytics--reports)
18. [Settings](#settings)

---

## Getting Started

### Logging In
1. Navigate to `/shelter/login`
2. Enter your shelter email and password
3. Click "Sign In"

**Default Demo Account:**
- Email: `shelter@happytails.org`
- Password: `password123`

### Navigation Overview
The CRM is organized into 6 main mega-modules accessible from the sidebar:

**Main Navigation:**
- **Operations Hub**: Daily command center with tasks, alerts, and pipeline overview
- **Dogs**: Complete dog management and profiles
- **Pipeline**: Visual drag-and-drop pipeline for moving dogs through stages
- **Inbox**: Unified communications with adopters
- **Automation**: Workflow automation and protocols
- **Management**: Settings, staff, analytics, and configuration

**Additional Modules (under "More"):**
- Foster, Medical, Resources, Donations, Calendar, Staff, Analytics

---

## Operations Hub

The Operations Hub is your daily command center that shows everything requiring immediate attention.

### Dashboard Overview

**Quick Stats:**
- Overdue tasks (highlighted in red if any)
- Tasks due today
- Vaccines due this week
- Dogs in intake
- Dogs in medical hold
- Dogs ready for adoption

### Today's Tasks
- View all tasks due today with checkboxes for quick completion
- Priority indicators (urgent, high, medium, low)
- Linked to specific dogs when applicable
- One-click task completion

### Overdue Alert Section
If you have overdue tasks, they appear prominently at the top with:
- Red border highlighting
- Task details and due date
- Quick completion checkbox
- Priority and type badges

### Tomorrow's Preview
See upcoming tasks for tomorrow to plan ahead

### Dogs Needing Attention
Quick list of dogs in:
- Intake status
- Medical hold
- Requiring immediate action

### Vaccines Due This Week
- Shows all vaccines due within 7 days
- Dog name and vaccine type
- Due date badge
- Color-coded by urgency

**Navigation:**
- Click "View All" on any section to go to the detailed page
- Quick links to Tasks, Calendar, and other modules

---

## Dog Management

### Viewing Dogs

Navigate to **Dogs** in the sidebar to see all your dogs with multiple view options.

**View Types:**
1. **Grid View**: Card-based layout with photos (default)
2. **List View**: Compact list with key details
3. **Table View**: Spreadsheet-style with sortable columns

**Quick Stats Bar:**
Click on any stat to filter:
- All Dogs
- Intake (blue)
- Medical Hold (yellow)
- Behavior Eval (purple)
- Ready (green)
- Adopted (emerald)

### Filtering Options
- **Search**: By name or breed
- **Status**: Filter by pipeline status
- **Size**: Small, Medium, Large, Extra Large
- **View Toggle**: Switch between grid, list, and table views

### Adding a Dog
1. Click **"Add Dog"** button
2. Fill in required information:
   - Name, breed, age
   - Size, weight, gender
   - Photos (at least one required)
   - Temperament traits
   - Medical information
   - Bio and special needs
3. Click **"Save"**

### Dog Card Actions
Each dog card has a three-dot menu (⋮) with:
- **View Details**: See full profile
- **Edit**: Update dog information
- **Remove**: Delete dog from system

### Setting Urgency Levels
For dogs needing immediate placement:
1. Edit the dog
2. Set **Urgency Level**:
   - **Normal**: Standard timeline
   - **Urgent**: Needs placement within 2 weeks (orange badge)
   - **Critical**: Immediate placement needed (red badge)
3. Add **Urgency Reason** and **Deadline**

### Dog Detail Page
Comprehensive view with tabs:
- **Overview**: Photos, bio, characteristics
- **Medical**: Health records, vaccines, medications
- **Behavior**: Assessments and notes
- **History**: Timeline of events
- **Applications**: Active adoption applications

---

## Pipeline View

Visual drag-and-drop interface for managing dogs through your shelter workflow.

### Pipeline Stages
Dogs move through these stages:
1. **Intake** (Blue): New arrivals
2. **Stray Hold** (Yellow): 72-hour legal hold
3. **Medical Hold** (Red): Receiving medical care
4. **Behavior Eval** (Purple): Behavioral assessment
5. **Photos Needed** (Pink): Needs professional photos
6. **Ready** (Green): Available for adoption
7. **Featured** (Orange): Highlighted dogs
8. **Adopted** (Emerald): Successfully placed

### Using the Pipeline

**Moving Dogs:**
1. Click and hold a dog card
2. Drag to the desired stage column
3. Drop to update status
4. System automatically updates intake records

**Visual Indicators:**
- **Days in Stage**: Shows how long dog has been in current status
- **Overdue Warning**: Orange indicator if >7 days in stage
- **Photo Badge**: Pink "Needs photos" badge if no photos uploaded
- **Special Needs**: Yellow badge if dog has special requirements
- **Urgency**: Red/orange alert icons for urgent/critical dogs

**Performance:**
- Virtualized lists handle 100+ dogs smoothly
- Optimistic updates (changes appear instantly)
- Real-time sync with database

### Search & Filter
- Search by dog name or breed
- Filter shows across all pipeline stages

**Tips:**
- Use Pipeline for quick status updates
- Drag multiple dogs in succession
- Monitor "days in stage" to identify bottlenecks

---

## Intake System

### Recording New Intakes

**Intake Types:**
- **Stray**: Found wandering without owner
- **Owner Surrender**: Surrendered by owner
- **Transfer**: From another organization
- **Return**: Returned by adopter
- **Rescue**: Rescued from dangerous situation
- **Born in Care**: Born at the shelter

**Three-Step Process:**

**Step 1: Dog Information**
- Name, breed, age
- Size, weight, gender, color
- Microchip ID (if available)
- Initial notes

**Step 2: Intake Details**
- Select intake type
- Document source information
- Assess **Initial Condition**:
  - Critical → Excellent (5 levels)
- Record initial weight
- Add intake notes

**Step 3: Pipeline & Holds**
- Set **Pipeline Status** (defaults to "Intake")
- If applicable, set **Hold Type**:
  - **Stray Hold**: 72 hours required (auto-calculated)
  - **Medical Hold**: Until cleared
  - **Legal Hold**: Court-ordered
  - **Behavior Hold**: Safety assessment

### Managing Pipeline Status
1. Go to **Pipeline** page for visual management
2. Or use **Intake** page for detailed records
3. Update status as dog progresses
4. Add notes about each stage

### Recording Outcomes
When a dog leaves your care:
1. Open the intake record
2. Click **"Record Outcome"**
3. Select outcome type:
   - Adopted
   - Transferred
   - Returned to Owner
   - Euthanized
   - Died in Care
   - Other
4. Add notes
5. Pipeline status updates automatically

---

## Inbox & Communications

Unified inbox for all adopter communications about dogs.

### Conversation Management

**Status Types:**
- **Open**: Active conversations (green)
- **Pending**: Awaiting response (yellow)
- **Closed**: Resolved conversations (gray)

### Inbox Layout
- **Left Sidebar**: Conversation list with unread badges
- **Main Panel**: Selected conversation thread
- **Right Actions**: Status, priority, and assignment controls

### Responding to Messages
1. Navigate to **Inbox** in sidebar
2. Click on a conversation
3. View full conversation history
4. Type response in message box
5. Press Enter or click Send

### Conversation Actions

**Change Status:**
- Open → Active conversation
- Pending → Awaiting follow-up
- Closed → Resolved/archived

**Set Priority:**
- **Urgent**: Red - Emergency situations
- **High**: Orange - Time-sensitive
- **Normal**: Blue - Standard inquiries
- **Low**: Gray - General questions

**Assign to Staff:**
- Delegate conversations to team members
- Track who's handling what
- Filter by assignment

### Unread Messages
- Badge on Inbox menu shows total unread count
- Individual conversation badges show unread per thread
- Auto-mark as read when opened

### Quick Actions Menu (⋮)
- Change conversation status
- Update priority level
- Assign to staff member
- Archive conversation

**Best Practices:**
- Respond within 24 hours
- Use priority flags appropriately
- Assign to staff with relevant expertise
- Add internal notes for context

---

## Automation & Protocols

Automate repetitive workflows to save time and ensure consistency.

### Automation Rules

**Creating Rules:**
1. Navigate to **Automation** in sidebar
2. Click **"Add Rule"**
3. Select from pre-built templates:
   - Create Intake Tasks
   - Schedule Next Vaccine
   - Stray Hold Complete
   - Medical Complete
   - Ready for Adoption
   - Overdue Task Alert

**Rule Components:**
- **Trigger**: What starts the automation
  - Dog created
  - Vaccine applied
  - Hold expired
  - Medical cleared
  - Status change
  - Task overdue
- **Action**: What happens automatically
  - Create tasks
  - Schedule vaccine
  - Update pipeline
  - Publish & notify
  - Create alert

### Managing Rules
- **Active Rules**: Currently running (green indicator)
- **Inactive Rules**: Paused or disabled (gray)
- Toggle active/inactive with switch
- Edit rule parameters
- Delete unused rules

### Medical Protocols

Pre-configured care sequences:

**Puppy Vaccine Series:**
- Week 6: DHPP #1
- Week 9: DHPP #2
- Week 12: DHPP #3, Rabies
- Week 16: DHPP #4

**Adult Dog Intake:**
- Day 1: Health check, weight, photos, DHPP
- Day 3: Behavior assessment
- Day 7: Spay/neuter scheduling

**Medical Care Package:**
- Day 1: Flea/tick, deworming, heartworm test
- Day 30: Heartworm prevention

**Spay/Neuter Workflow:**
- Day -1: Pre-surgical exam, NPO
- Day 0: Surgery
- Day 1: Post-op check
- Day 10: Suture removal

### Applying Protocols
1. Click **"Use Template"** in Medical
2. Select protocol
3. Choose dog
4. System creates all scheduled tasks and records automatically

**Benefits:**
- Eliminate manual task creation
- Ensure nothing is missed
- Standardize care across all dogs
- Save 15-20 minutes per intake

---

## Medical Records

### Adding Medical Records

1. Navigate to **Medical** in sidebar
2. Click **"Add Record"**
3. Select the dog
4. Choose **Record Type**:
   - **Vaccine**: Immunizations
   - **Treatment**: Medical treatments
   - **Exam**: Health checkups
   - **Surgery**: Surgical procedures
   - **Medication**: Prescriptions
   - **Weight Check**: Weight monitoring

### Vaccine Records

**Required Information:**
- Vaccine name (Rabies, DHPP, Bordetella, etc.)
- Manufacturer
- Lot number
- **Next Due Date** (for automatic reminders)
- Veterinarian name
- Cost

**Built-in Vaccine Types:**
- Rabies
- DHPP (Distemper, Hepatitis, Parvo, Parainfluenza)
- Bordetella (Kennel Cough)
- Leptospirosis
- Canine Influenza
- Lyme Disease

### Medication Management

**Tracking Active Medications:**
- Medication name
- Dosage and frequency
- Instructions
- Start/end dates
- Refill tracking

### Viewing Upcoming Vaccines

**Upcoming Tab:**
- Vaccines due in next 30 days
- **Overdue** vaccines (red highlight)
- **Due soon** vaccines (within 14 days, orange)
- Dog name and vaccine type
- Quick actions to reschedule

### Medical Templates

Use templates for common procedures:
1. Click **"Use Template"**
2. Select template (e.g., "New Intake Medical")
3. Choose the dog
4. Template creates all necessary records instantly

**Available Templates:**
- New Intake Medical
- Puppy Vaccine Series
- Adult Dog Intake
- Spay/Neuter Package
- Senior Dog Wellness

---

## Task Management

### Creating Tasks

1. Go to **Tasks** in sidebar
2. Click **"Add Task"**
3. Fill in details:
   - **Title**: Task description
   - **Task Type**: Category
   - **Priority**: Low → Urgent
   - **Due Date/Time**
   - **Assign to**: Role or staff member
   - **Link to Dog**: (optional)
4. Click **"Create Task"**

### Task Types
- **Vaccine**: Vaccination appointments
- **Medical**: Medical care needed
- **Spay/Neuter**: Surgical procedures
- **Grooming**: Bathing, nail trims
- **Behavior Eval**: Assessments
- **Follow Up**: Check-ins
- **Admin**: Paperwork
- **Custom**: Other tasks

### Priority Levels
- **Urgent**: Red - Immediate action required
- **High**: Orange - Important, do today
- **Medium**: Blue - Standard priority
- **Low**: Gray - Can wait

### Completing Tasks
- Click checkbox next to task
- Task moves to "Completed" status
- Completion timestamp recorded automatically

### Filtering & Searching
- **Status Filter**: Pending, Overdue, Completed
- **Priority Filter**: All priorities or specific level
- **Type Filter**: By task category
- **Search**: Find by title or description

### Quick Stats
View at-a-glance:
- Pending tasks count
- Overdue tasks (red)
- Completed tasks

**Tips:**
- Set realistic due dates
- Use priority appropriately
- Link tasks to dogs for context
- Review overdue tasks daily

---

## Foster Management

### Viewing Available Fosters

1. Go to **Foster** in sidebar
2. See list of approved foster parents
3. View their:
   - Current capacity (e.g., 1/2 dogs)
   - Location and distance
   - Size preferences
   - Special needs capabilities
   - Availability status

### Creating Foster Assignments

**Step 1: Select Dog & Type**
1. Click **"New Assignment"**
2. Choose dog from dropdown
3. Select assignment type:
   - **Standard**: Regular fostering
   - **Medical**: Special medical needs
   - **Behavioral**: Behavior modification
   - **Hospice**: End-of-life care
   - **Emergency**: Urgent temporary placement

**Step 2: Choose Foster**
- Browse available fosters
- See capacity and preferences
- View distance from shelter
- Click to select

**Step 3: Assignment Details**
- Set expected end date
- Add care instructions
- Specify feeding schedule
- Note behavioral considerations
- Add any special requirements

**Step 4: Review & Create**
- Review all details
- Click **"Create Assignment"**
- Foster receives notification

### Managing Active Assignments

**Assignment Statuses:**
- **Pending**: Awaiting foster acceptance
- **Active**: Dog currently in foster
- **Completed**: Foster period ended

### Foster Check-ins
- Schedule regular check-ins
- Add progress notes
- Update care instructions as needed
- Track dog's adjustment

**Statistics:**
- Total foster capacity
- Currently fostered dogs
- Available spots
- Active assignments

---

## Community Resources

Manage services you offer to pet owners in your community.

### Resource Types
- **Pet Food Pantry**: Free/low-cost food
- **Vaccinations**: Vaccine clinics
- **Spay/Neuter Services**: Surgical assistance
- **Microchipping**: ID services
- **Training Classes**: Behavior training
- **Behavior Support**: Consultation
- **Pet Supplies**: Equipment and gear
- **Emergency Shelter**: Temporary boarding
- **Other**: Custom resources

### Adding Resources

1. Navigate to **Resources** (under "More")
2. Click **"Add Resource"**
3. Fill in details:
   - **Resource Type**
   - **Title**: Name of service
   - **Description**: What you offer
   - **Availability**: Daily, Weekly, Monthly, By Appointment
   - **Schedule**: Specific hours/days
   - **Eligibility Notes**: Who qualifies
   - **Cost**: Free, Low Cost, Sliding Scale, Varies
   - **Contact**: Phone, email, website

### Managing Resources
- **Active Resources**: Currently offered (displayed on public profile)
- **Inactive Resources**: Temporarily unavailable
- Toggle active/inactive status
- Edit resource details
- Delete unused resources

### Statistics Dashboard
- Total active resources
- Inactive resources
- Free services count

**Public Display:**
Resources appear on your shelter's public profile page, making it easy for community members to find help.

**Best Practices:**
- Keep contact information current
- Update availability regularly
- Be clear about eligibility requirements
- Include cost information upfront

---

## Donations & Fundraising

### Donation Settings

1. Navigate to **Donations** (under "More")
2. Configure:
   - **Accept Donations**: Enable/disable
   - **Suggested Amounts**: Quick-select donation levels
   - **Payment Processor**: Stripe integration

### Creating Campaigns

**Campaign Types:**
- General operating fund
- Medical emergency fund
- Building/renovation projects
- Specific dog medical needs
- Program funding

**Campaign Setup:**
1. Click **"Create Campaign"**
2. Enter details:
   - Title and description
   - Goal amount
   - End date (optional)
   - Featured image
3. Click **"Launch Campaign"**

### Campaign Management

**Active Campaigns:**
- Track progress with visual progress bar
- See donor count
- View current amount vs goal
- Monitor donation activity

**Actions:**
- Edit campaign details
- Pause/resume campaign
- Close completed campaigns
- Send thank-you emails

### Donation Tracking

**Dashboard Stats:**
- Total raised
- Total donations count
- Donor count
- Average donation

**Recent Donations:**
- Donor name
- Amount
- Campaign (if applicable)
- Date/time
- Payment method

### Public Donation Page

Your shelter gets a public donation page at:
`/donate/[your-shelter-id]`

Features:
- Quick donate buttons (suggested amounts)
- Custom amount option
- Campaign selection
- Secure payment processing
- Automatic receipts

---

## Applications & Adoptions

### Application Review Process

**Application Tabs:**
- **Pending Review**: New applications
- **Transcript Review**: Phone screening completed
- **In Progress**: Approved, moving forward
- **Completed**: Finalized adoptions
- **All**: View everything

### Reviewing Applications

**Step 1: Initial Review**
1. Click **"Review"** on application
2. Review applicant information:
   - Contact details
   - Living situation (home type, yard, etc.)
   - Family members
   - Household pets
   - Experience level
   - Application responses
3. Check verification status

**Step 2: Decision**
- **Approve**: Moves to phone screening
- **Reject**: Provide rejection reason
- **Request More Info**: Ask follow-up questions

### Phone Screening

AI-powered phone screening via Vapi:
1. System calls applicant automatically
2. Asks configured screening questions
3. Records conversation
4. Generates summary and transcript

**Reviewing Transcripts:**
1. Applications show "Review Transcript" badge
2. Click to expand
3. Read AI summary and full transcript
4. See call duration and timestamp
5. Decide next steps

### Meet & Greet Scheduling

1. After successful phone screening
2. Click **"Schedule Meet & Greet"**
3. Select date and time
4. System sends notification to adopter
5. Event appears on calendar

### Completing Adoptions

1. After successful meet & greet
2. Click **"Complete Adoption"**
3. Enter adoption fee
4. Add final notes
5. Click **"Finalize"**
6. Dog status → "Adopted"
7. Application → "Completed"

### Admin Notes

Throughout the process:
- Add internal notes (private to shelter)
- Document observations
- Track concerns
- Note special considerations

---

## Checkout Process

Fast mobile checkout for quick adoptions (under 3 minutes).

### Starting Checkout

1. Go to **Checkout** (under Applications)
2. See dogs ready for checkout
3. Click **"Start Checkout"** on adoption
4. Timer begins tracking

### Step 1: Payment
- Verify adoption fee
- Select payment method:
  - Cash
  - Credit/Debit Card
  - Check
  - Fee Waived
- Optional: Check "Waive adoption fee"
- Click **"Next"**

### Step 2: Contract
- Display adoption contract to adopter
- Key provisions:
  - Proper care requirements
  - Veterinary care commitment
  - Return policy
- Check "Adopter has signed the contract"
- Click **"Next"**

### Step 3: Microchip
- Enter microchip number
- Select registry:
  - AKC Reunite
  - HomeAgain
  - PetLink
  - 24PetWatch
- Check "Microchip ownership transferred"
- Click **"Next"**

### Step 4: Supplies
Check off go-home kit items:
- ☐ Food sample
- ☐ Leash
- ☐ Collar
- ☐ ID tag
- ☐ Vaccination records
- ☐ Care guide

Add notes for adopter

### Step 5: Complete
- Review all information
- Click **"Complete Adoption"**
- 🎉 Celebration screen
- Processing time recorded
- Systems update automatically

### Viewing Completed Checkouts
- **Completed Today** tab
- Average processing time
- Review past checkouts

---

## Staff Management

### Adding Staff Members

1. Go to **Staff** (under "More")
2. Click **"Add Staff"**
3. Enter information:
   - Full name
   - Email address
   - Phone number
   - Role: Owner, Manager, Staff, Volunteer
4. Set permissions
5. Click **"Save"**

### Permission System

**What staff can do:**
- ☐ Manage Dogs
- ☐ Manage Tasks
- ☐ View Medical Records
- ☐ Edit Medical Records
- ☐ Manage Staff
- ☐ View Reports

### Staff Roles

**Owner:**
- Full access to everything
- Can manage all staff
- Financial access

**Manager:**
- Manage operations and staff
- View all records
- Can't modify financial settings

**Staff:**
- Day-to-day operations
- Limited admin access
- Task and dog management

**Volunteer:**
- Limited access
- Assigned tasks only
- Basic dog interaction

### Managing Staff

**Active/Inactive Status:**
- Toggle with switch
- Inactive staff can't log in
- Preserve historical records

**Editing Staff:**
- Click three-dot menu (⋮)
- Select "Edit"
- Update information
- Save changes

**Removing Staff:**
- Click three-dot menu (⋮)
- Select "Remove"
- Confirm deletion
- Staff account removed

### Staff Statistics
- Total staff count
- Active staff
- Managers count
- Volunteers count

---

## Calendar

### Viewing Scheduled Events

Navigate to **Calendar** (under "More") to see:
- Tasks due
- Vaccine appointments
- Meet & greet visits
- Foster check-ins
- Other scheduled events

### Calendar Views
- **Month View**: See entire month
- **Day Detail**: Click date for daily schedule

### Event Types (Color-Coded)
- 🔵 **Vaccines**: Blue
- 🔴 **Medical**: Red
- 🟣 **Tasks**: Purple
- 🟢 **Appointments**: Green

### Navigation
- Previous/Next month arrows
- **"Today"** button to jump to current date
- Click dates to view details

### Creating Events
Events are created automatically when you:
- Create tasks with due dates
- Add vaccine records with next-due dates
- Schedule meet & greets
- Set up foster check-ins

---

## Analytics & Reports

### Dashboard Metrics

**Key Performance Indicators:**
- **Adoption Rate**: Percentage of dogs adopted
- **Average Length of Stay**: Days in shelter
- **Intake Trends**: Monthly intake patterns
- **Outcome Types**: Distribution of outcomes

### Custom Date Ranges
- Last 7 days
- Last 30 days
- Last 90 days
- Custom date range

### Charts & Visualizations

**Intake Pipeline:**
- Visual funnel of dog statuses
- Conversion rates between stages

**Adoption Timeline:**
- Average time to adoption
- Trend over time

**Intake Sources:**
- Where dogs come from
- Source distribution

**Outcome Distribution:**
- Pie chart of all outcomes
- Success metrics

### Exporting Data
(Feature coming soon)

---

## Settings

### Shelter Information

Update your shelter details:
- Shelter name
- Contact email and phone
- Physical address
- Website URL
- Description

### Operating Hours
- Set shelter hours
- Format: "Mon-Fri: 10am-6pm, Sat-Sun: 11am-5pm"
- Select timezone

### Notification Preferences

Configure alerts:
- ☐ Email Notifications
- ☐ SMS Notifications

### Adoption Requirements

Configure policies:
- Standard adoption fee ($)
- ☐ Require home visit
- ☐ Require references
- ☐ Auto-approve applications

### Branding
- Upload shelter logo
- Customize colors
- Public profile settings

---

## Tips & Best Practices

### Daily Workflow

**Morning:**
1. Check Operations Hub for alerts
2. Review overdue tasks
3. Check inbox for new messages

**Throughout Day:**
4. Update pipeline as needed
5. Complete tasks
6. Respond to messages
7. Update medical records

**End of Day:**
8. Mark completed tasks
9. Plan tomorrow's priorities
10. Review dashboard metrics

### Data Entry Best Practices

- Use consistent naming conventions
- Be thorough with medical records
- Add photos regularly (dogs change as they settle)
- Update pipeline status promptly
- Document all adopter interactions

### Communication

- Respond to messages within 24 hours
- Keep adopters informed of progress
- Set clear expectations
- Use priority flags appropriately

### Task Management

- Set realistic due dates
- Assign tasks to appropriate staff
- Use automation for recurring tasks
- Complete tasks promptly to avoid backlog

### Medical Records

- Record vaccines immediately
- Set next-due dates for reminders
- Keep medication logs updated
- Document any health changes

---

## Troubleshooting

### Common Issues

**Can't log in?**
- Verify email and password
- Check account is active
- Contact admin if locked

**Don't see expected dogs?**
- Check filter settings
- Clear search box
- Verify dog hasn't been archived

**Tasks not appearing?**
- Check status filter
- Verify due date range
- Check assignment filters

**Application not showing?**
- Refresh the page
- Check correct tab
- Verify dog adoption status

**Message not sending?**
- Check internet connection
- Verify message isn't empty
- Try refreshing page

### Getting Help

Contact your shelter administrator for:
- Technical issues
- Permission problems
- Feature requests
- Training needs

---

## Keyboard Shortcuts

- **Enter**: Send message (in inbox)
- **Tab**: Navigate between form fields
- **Esc**: Close dialogs
- **Ctrl/Cmd + K**: Quick search (coming soon)

---

## Mobile Access

The Shelter CRM is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones

For mobile checkout, use a tablet for optimal experience.

---

## Security & Privacy

### Data Protection
- All data encrypted in transit and at rest
- Staff can only see data per their permissions
- Application data confidential to shelter staff
- Adopter information protected

### Password Security
- Use strong, unique passwords
- Don't share login credentials
- Log out when finished on shared computers

### Access Logs
System tracks:
- Who accessed what data
- When actions were taken
- Changes to records

---

## What's New in 2025

### Major Features Added

**Operations Hub:**
- Centralized daily command center
- Real-time task and alert dashboard
- Quick-access pipeline overview

**Pipeline View:**
- Visual drag-and-drop interface
- 8 customizable pipeline stages
- Days-in-stage tracking
- Virtualized for 100+ dogs

**Unified Inbox:**
- All adopter communications in one place
- Status and priority management
- Staff assignment
- Unread tracking

**Automation Engine:**
- Pre-built automation rules
- Medical protocol templates
- Automatic task creation
- Workflow optimization

**Community Resources:**
- Public-facing resource directory
- Multi-type resource support
- Availability and cost tracking

**Donations & Fundraising:**
- Campaign management
- Progress tracking
- Public donation pages
- Stripe integration

**Enhanced Mobile:**
- Full mobile responsiveness
- Touch-optimized controls
- Mobile checkout process

---

## Appendix: Field Definitions

### Dog Fields
- **Urgency Level**: How quickly placement needed
- **Pipeline Status**: Where dog is in shelter process
- **Energy Level**: Activity requirements
- **Temperament**: Personality traits
- **Special Needs**: Medical or behavioral considerations

### Intake Types
- **Stray**: Found without owner
- **Owner Surrender**: Given up by owner
- **Transfer**: From another organization
- **Return**: Previously adopted, returned
- **Rescue**: Removed from dangerous situation
- **Born in Care**: Born at shelter

### Pipeline Statuses
- **Intake**: Initial processing
- **Stray Hold**: Legal hold period
- **Medical Hold**: Receiving medical care
- **Behavior Eval**: Assessment in progress
- **Photos Needed**: Requires professional photos
- **Ready**: Available for adoption
- **Featured**: Highlighted for adoption
- **Adopted**: Successfully placed

### Task Priorities
- **Urgent**: Immediate action required
- **High**: Important, do today
- **Medium**: Standard priority
- **Low**: Can wait

### Assignment Types (Foster)
- **Standard**: Regular fostering
- **Medical**: Special medical needs
- **Behavioral**: Behavior modification
- **Hospice**: End-of-life care
- **Emergency**: Urgent temporary placement

---

## Support & Training

For additional help:
- Email: support@scout.app
- Phone: (555) 123-4567
- Training videos: scout.app/training
- Community forum: community.scout.app

**Office Hours:**
Monday-Friday: 9am-5pm PT

---

*Last Updated: June 2025*
*Version: 2.0*
