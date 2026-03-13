# Heinrix TBM Application

<p align="center">
  <img src="images/heinrix_logo.png" alt="Heinrix Logo" width="280" />
</p>

<p align="center">
  A digital safety management platform for construction site TBM (Tool Box Meeting) operations
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Flutter-3.x-02569B?logo=flutter&logoColor=white" alt="Flutter" />
  <img src="https://img.shields.io/badge/Firebase-Backend-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/Cloud%20Functions-TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Platform-iOS%20%7C%20Android-2ea44f" alt="Platform" />
</p>

## Overview
The Heinrix TBM Application is a platform that integrates the entire workflow of on-site safety meetings (TBM)—from creation and participant management to signature collection and automated PDF report generation.  
It supports operational scenarios tailored for head office administrators, partner companies (subcontractors), and workers, while leveraging Firebase for real-time data synchronization and role-based access control.

## Core Features
- Manage project creation/modification/deletion and participant modes.
- Role-based access control (Head Office / Partner Company / Worker).
- Workflow for site participation requests and approvals.
- TBM attendance and signature management.
- Automated generation and storage of TBM documents in PDF format.
- Data aggregation and consistency handling via Firebase Functions.

## App Screen Guide (Home & Key Screens)

### Home Screen
- The main dashboard of the application.
- Quickly access core tasks via TBM progress cards, announcements, and the bottom navigation bar (Home / Notifications / My Profile).

<img src="docs/images/home.png" alt="Home Screen" width="280" />

### Menu Drawer (Address Resolved)
- Displays the successfully resolved physical address based on the company or project scope.
- Operators can view the actual site location instead of just an ID.

<img src="docs/images/2.png" alt="Menu Drawer Address Display" width="280" />

### Find Company / Join via Invite Link
- Request to join a company using an invite link, or search for a specific company/site.
- Track the status of your join requests via the "My Request History" tab.

<img src="docs/images/3.png" alt="Find Company" width="280" />

### Worker & Company Management
- Comprehensively manage workforce data separated by Worker and Company tabs.
- Supports search, sorting, project filtering, and editing of roles and affiliations.

<img src="docs/images/4.png" alt="Worker and Company Management" width="280" />

### TBM Report Management
- Search and view daily/weekly reports in the safety document history.
- Identify documents easily by session status (e.g., DRAFT) and creation date.

<img src="docs/images/5.png" alt="TBM Report Management" width="280" />

### Create TBM (1/4 - Task Information)
- The initial step to input the project name, task name, and task location.
- Add specific task items to the bottom list and proceed to the next step.

<img src="docs/images/6.png" alt="Create TBM Step 1" width="280" />

### Review TBM (2/4 - Workplace & Task Details)
- Review the company, partner, and administrator details along with task specifics.
- Instantly modify inputs using the edit button on the right side of each section.

<img src="docs/images/7.png" alt="Review TBM Step 2" width="280" />

### Review TBM (3/4 - Personnel & Site Photos)
- Check a summary of attending/non-attending personnel and the signature completion status.
- Access the worker management screen and upload or take site photos directly.

<img src="docs/images/8.png" alt="Review TBM Step 3" width="280" />

### Add Workers / Attendance Management
- Manage worker additions, role assignments, fixed attendance status, and signature status.
- Ensure real-time consistency of site personnel data through individual edit/delete actions.

<img src="docs/images/9.png" alt="Add Workers and Attendance Management" width="280" />

### Review TBM (4/4 - Admin Final Signature)
- The final TBM review step to input the administrator's signature (or reset it if necessary).
- Complete the document generation flow by confirming the "Admin Final Signature Complete" action.

<img src="docs/images/7-1.png" alt="Review TBM Step 4 Admin Final Signature" width="280" />

### Reference PDF
- `test_tbm.pdf` is an example of the final document generated upon completing a TBM.
- You can review how the admin's final signature, task details, and attendee information are structured in the PDF format.
- Use this to verify that all signatures are properly reflected and no required fields are missing.

[View test_tbm.pdf](./lib/test_tbm.pdf)

### Project Info (1/3 - Basic TBM Info)
- The initial setup phase to input the company name, project name, site address, and TBM leader.
- Navigate the project creation flow seamlessly using the Prev/Next buttons.

<img src="docs/images/10.png" alt="Project Info Step 1" width="280" />

### Project List & Operations Status
- View projects using company scope selection, search bars, and status/period filters.
- Check operational details like progress status, TBM schedule, recurring days, and invite links in a card format.

<img src="docs/images/11.png" alt="Project List and Operations Status" width="280" />

### Project Info (2/3 - Period & Operation Mode)
- Set the TBM operation period and choose the operation mode (Project-linked vs. Continuous).
- Adjust start/end dates, active times, and recurring days of the week on a single screen.

<img src="docs/images/12.png" alt="Project Info Step 2" width="280" />

### Project Info (3/3 - Participant Mode)
- Define the operational scope by selecting the participant mode (Include Partner Companies vs. Head Office Personnel Only).
- Access company/worker management, review participant counts, set up advance notifications, and finalize the setup.

<img src="docs/images/13.png" alt="Project Info Step 3" width="280" />

## TBM ERD
- An ERD visualizing the relational structure of the TBM domain collections (Company / Project / Session / Worker / Signature).
- Note: The `tbm_erd.png` file is not currently in the repository; once added to the designated path, it will be displayed below.

<img src="docs/images/tbm_erd_from_firestore_v1.drawio.png" alt="TBM ERD from Firestore v1" width="500" />

## Tech Stack
- Frontend: Flutter, Provider
- Backend: Firebase Auth, Cloud Firestore, Cloud Functions (TypeScript)
- Infra: Firebase Hosting, Firebase Storage
- Document: PDF Engine (Integrated with `pdf` and `pdf-lib`)

## Architecture Summary
- Client: Flutter module structure based on Screen / Controller / State / Widgets.
- Server: HTTP Cloud Functions combined with Firestore Rules for permission validation.
- Data: Multi-tenant model centered around the `companies` collection, utilizing sub-collections for projects, workers, and sessions.

## Getting Started
```bash
flutter pub get
flutter run
```

## Deploy Functions
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

## Repository Structure
```text
lib/
  feature/
    auth/
    home/
    tbm_form/
functions/
  src/
docs/
  architecture/
  data-model/
  education/
```

## Documentation
- Reverse Engineering Spec: `docs/firestore_model_reverse_spec.md`
- Architecture Overview: `docs/education/00_overview.md`

## License
Private project. All rights reserved.
