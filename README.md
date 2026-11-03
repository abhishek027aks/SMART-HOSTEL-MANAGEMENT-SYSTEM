# 🏠 Smart Hostel Management System (SHMS)

### Enterprise Multi-Tenant Hostel ERP, Management & Security Platform

A comprehensive **MERN Stack-based Hostel Management System** designed to digitize hostel administration, student accommodation, security operations, parent communication, and day-to-day hostel activities.

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0-blue?style=for-the-badge" alt="Version 1.0" />
  <img src="https://img.shields.io/badge/Stack-MERN-green?style=for-the-badge" alt="MERN Stack" />
  <img src="https://img.shields.io/badge/Database-MongoDB-success?style=for-the-badge" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Auth-JWT-orange?style=for-the-badge" alt="JWT" />
  <img src="https://img.shields.io/badge/Architecture-Multi--Tenant-purple?style=for-the-badge" alt="Multi Tenant" />
  <img src="https://img.shields.io/badge/Status-In%20Development-yellow?style=for-the-badge" alt="Development" />
</p>

---

## 📖 Table of Contents

- [Project Overview](#-project-overview)
- [Project Vision](#-project-vision)
- [Core Objectives](#-core-objectives)
- [Key Features](#-key-features)
- [System Roles](#-system-roles)
- [Enterprise Architecture](#-enterprise-architecture)
- [Role-Based Access Control](#-role-based-access-control-rbac)
- [Authentication Architecture](#-authentication-architecture)
- [Hostel Structure](#-hostel-structure)
- [Modules and Functionalities](#-modules-and-functionalities)
  - [Student Management](#1-student-management)
  - [Parent Portal](#2-parent-portal)
  - [Room and Bed Management](#3-room-and-bed-management)
  - [QR-Based Security](#4-one-time-qr-security)
  - [Entry and Exit Monitoring](#5-entry--exit-monitoring)
  - [Outpass Management](#6-outpass-management)
  - [Complaint Management](#7-complaint-management)
  - [Notice and Notification System](#8-notice--notification-system)
  - [Fee Management](#9-fee-management)
  - [Mess Management](#10-mess-management)
  - [Camera and Security Management](#11-camera--security-management)
  - [Reports and Analytics](#12-reports--analytics)
- [Database Architecture](#-database-architecture)
- [Multi-Tenant Data Isolation](#-multi-tenant-data-isolation)
- [Audit Logging](#-audit-logging)
- [Soft Delete Policy](#-soft-delete-policy)
- [Security Principles](#-security-principles)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Development Roadmap](#-development-roadmap)
- [Future Enhancements](#-future-enhancements)
- [Project Mission](#-project-mission)

---

## 📖 Project Overview

**Smart Hostel Management System (SHMS)** is an enterprise-oriented Hostel ERP and Security Management Platform developed for:

- Educational institutions
- College and university hostels
- Private hostels and PG accommodations
- Student residential facilities
- Multi-hostel organizations
- Residential campuses

The platform provides a centralized environment for managing multiple hostels, administrators, wardens, guards, students, and parents.

It aims to replace manual registers, disconnected spreadsheets, and traditional administrative processes with a structured digital management system.

SHMS brings hostel operations together through a unified platform covering:

- Hostel and facility administration
- Student registration and profile management
- Parent account linking and monitoring
- Block, floor, room, and bed management
- Student room and bed allocation
- QR-based entry and exit security
- Outpass requests and approval workflows
- Complaint registration and resolution
- Fee tracking and payment records
- Mess menu and food feedback
- Notices and notifications
- Camera and security event management
- Reports, analytics, and audit trails

## 🎯 Project Vision

The main vision of SHMS is to create a centralized and secure hostel ecosystem where hostel owners can manage their facilities while authorized users perform their assigned operations.

### Overall Operational Flow

```text
             SYSTEM ADMIN
                  |
                  ▼
           OWNER REGISTRATION
                  |
                  ▼
            CREATE HOSTEL
                  |
                  ▼
       CREATE WARDEN & GUARD
                  |
                  ▼
         CREATE HOSTEL STRUCTURE
                  |
          ┌───────┴────────┐
          ▼                ▼
        BLOCKS            FLOORS
          |                |
          └───────┬────────┘
                  ▼
             ROOMS & BEDS
                  |
                  ▼
          STUDENT REGISTRATION
                  |
                  ▼
             PARENT LINKING
                  |
                  ▼
          ROOM / BED ALLOCATION
                  |
                  ▼
           QR-BASED SECURITY
                  |
                  ▼
          ENTRY / EXIT TRACKING
                  |
                  ▼
           OUTPASS MANAGEMENT
                  |
                  ▼
        COMPLAINTS & NOTICES
                  |
                  ▼
        FEES & MESS MANAGEMENT
                  |
                  ▼
          REPORTS & AUDIT LOGS
```

## 🎯 Core Objectives

1. Centralize hostel administration through a single platform.
2. Support multiple independent hostels within one system.
3. Maintain secure, role-based access to hostel information.
4. Digitize student registration and accommodation management.
5. Improve hostel gate security through one-time QR verification.
6. Provide parents with controlled access to their children's information.
7. Simplify outpass, complaint, fee, and mess operations.
8. Maintain reliable activity records through audit logging.
9. Reduce manual administrative work.
10. Build a scalable foundation for future hostel automation.

## 🚀 Key Features

| Module | Main Capabilities |
|---|---|
| Multi-Hostel Architecture | Multiple hostels and independent data |
| User Management | Role-based accounts and permissions |
| Student Management | Registration and student profiles |
| Parent Portal | Child monitoring and updates |
| Hostel Management | Hostel and facility administration |
| Room Management | Blocks, floors, rooms, and beds |
| Allocation | Student room and bed assignment |
| QR Security | One-time QR generation and verification |
| Entry / Exit | Gate activity and movement records |
| Outpass | Request and approval workflow |
| Complaints | Complaint registration and resolution |
| Fees | Fee records, dues, and receipts |
| Mess | Menu, ratings, and feedback |
| Notices | Targeted hostel announcements |
| Notifications | Operational updates and alerts |
| Camera Security | Camera assignments and security events |
| Reports | Operational reports and analytics |
| Audit Logs | Critical activity history |
| Soft Delete | Preserve historical records |
| Tenant Isolation | Restrict access between hostels |

## 👥 System Roles

SHMS follows a hierarchical access-control model.

| Role | Description |
|---|---|
| `SYSTEM_ADMIN` | Platform-level administration and management |
| `OWNER` | Hostel owner and primary hostel administrator |
| `WARDEN` | Daily hostel operations and administration |
| `GUARD` | Gate security and entry/exit operations |
| `STUDENT` | Hostel resident and service user |
| `PARENT` | Authorized monitoring of linked student |

### Role Hierarchy

```text
                 SYSTEM_ADMIN
                      |
                      ▼
                    OWNER
                      |
              ┌───────┴───────┐
              ▼               ▼
            WARDEN           GUARD
              |
              ▼
            STUDENT
              |
              ▼
             PARENT
```

**Note:** This diagram represents the organizational hierarchy. Actual application permissions are determined by assigned roles, permissions, hostel ownership, and linked student relationships.

## 🏗 Enterprise Architecture

SHMS is designed around a multi-hostel architecture.

Each hostel operates within its own data scope, with an authorized owner and assigned operational users.

```text
                    SYSTEM ADMIN
                         |
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
       HOSTEL A       HOSTEL B       HOSTEL C
          |              |              |
        OWNER          OWNER          OWNER
          |              |              |
     ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
     ▼         ▼    ▼         ▼    ▼         ▼
  WARDEN    GUARD WARDEN    GUARD WARDEN    GUARD
     |         |    |         |    |         |
     └────┬────┘    └────┬────┘    └────┬────┘
          ▼              ▼              ▼
       STUDENTS       STUDENTS       STUDENTS
          |              |              |
          ▼              ▼              ▼
       PARENTS        PARENTS        PARENTS
```

### Architecture Principles

- Centralized platform management
- Independent hostel data boundaries
- Role-based authorization
- Hostel-specific operational records
- Controlled parent-student relationships
- Secure backend API access
- Historical activity tracking

## 🔐 Role-Based Access Control (RBAC)

The application uses Role-Based Access Control to restrict functionality according to the user's assigned role.

| Operation | System Admin | Owner | Warden | Guard | Student | Parent |
|---|---|---|---|---|---|---|
| Platform administration | Yes | No | No | No | No | No |
| Hostel management | Controlled | Yes | Assigned | No | No | No |
| Staff management | Controlled | Yes | Assigned | No | No | No |
| Student management | Controlled | Yes | Assigned | No | Own profile | Linked child |
| Room management | Controlled | Yes | Assigned | No | View own | View linked child |
| Gate operations | Controlled | Controlled | Assigned | Yes | QR generation | No |
| Outpass requests | Controlled | Controlled | Review | No | Create | Review |
| Complaint management | Controlled | Controlled | Manage | No | Create | View status |
| Fee monitoring | Controlled | Controlled | Assigned | No | Own fees | Linked child |
| Notices | Controlled | Yes | Assigned | Security notices | Receive | Receive |

`Controlled` means the operation depends on configured permissions and tenant scope. The final permissions must be enforced by backend middleware and resource-level authorization, not only by hiding frontend elements.

## 🔑 Authentication Architecture

The authentication system is designed around JWT-based authentication and backend authorization.

### Authentication Flow

```text
             USER LOGIN
                 |
                 ▼
       CREDENTIAL VALIDATION
                 |
                 ▼
          PASSWORD HASH CHECK
                 |
                 ▼
           JWT GENERATION
                 |
                 ▼
          ROLE VALIDATION
                 |
                 ▼
         HOSTEL VALIDATION
                 |
                 ▼
        PERMISSION VALIDATION
                 |
                 ▼
          RESOURCE VALIDATION
                 |
                 ▼
          AUTHORIZED ACCESS
```

### Authentication Principles

- Secure password hashing using Bcrypt
- JWT-based authentication
- Role verification
- Hostel ownership verification
- Permission-based authorization
- Protected API routes
- User account status validation

## 🏢 Hostel Structure

Each hostel contains a structured hierarchy of accommodation facilities.

```text
HOSTEL
  |
  ├── BLOCK A
  |     |
  |     ├── FLOOR 1
  |     |     |
  |     |     ├── ROOM 101
  |     |     |     ├── BED A
  |     |     |     ├── BED B
  |     |     |     └── BED C
  |     |     |
  |     |     └── ROOM 102
  |     |
  |     └── FLOOR 2
  |
  └── BLOCK B
        |
        ├── FLOOR 1
        └── FLOOR 2
```

### Hostel Management

- Hostel creation and configuration
- Block management
- Floor management
- Room management
- Bed management
- Capacity tracking
- Occupancy monitoring
- Facility status management

## 🛏 Room & Bed Management

### Room Status

- `AVAILABLE`
- `OCCUPIED`
- `RESERVED`
- `MAINTENANCE`

### Bed Status

- `AVAILABLE`
- `OCCUPIED`
- `RESERVED`
- `MAINTENANCE`

### Functionalities

- Create and manage blocks.
- Create floors within blocks.
- Create rooms within floors.
- Configure room capacity.
- Create individual beds.
- Allocate students to beds.
- Track room occupancy.
- Maintain allocation and release history.
- Prevent invalid or duplicate allocations.

## 🧩 Modules and Functionalities

### 1. Student Management

The Student Management Module handles student registration, profiles, accommodation, and hostel-related activities.

**Features**

- Student registration
- Student profile management
- Unique student ID generation
- Parent account linking
- Room allocation
- Bed allocation
- QR code generation
- Entry and exit history
- Outpass requests
- Complaint submission
- Fee information
- Notifications and notices

### 2. Parent Portal

The Parent Portal provides authorized parents with access to information about their linked child.

**Parent Features**

- Child profile
- Room and bed details
- Entry and exit history
- Outpass request review
- Complaint status
- Notifications
- Hostel notices
- Fee monitoring

Parent access must be restricted to the student accounts explicitly linked to that parent.

### 3. Room and Bed Management

This module manages the complete hostel accommodation structure.

**Features**

- Block and floor configuration
- Room creation
- Bed creation
- Room capacity management
- Availability status
- Student allocation
- Allocation history
- Release tracking
- Occupancy monitoring

### 4. One-Time QR Security

The QR Security Module is designed to support controlled hostel gate access.

**QR Workflow**

```text
          STUDENT LOGIN
                |
                ▼
          GENERATE QR
                |
                ▼
       UNIQUE TOKEN CREATED
                |
                ▼
            GUARD SCANS
                |
                ▼
       BACKEND TOKEN VALIDATION
                |
                ▼
       STUDENT & HOSTEL CHECK
                |
                ▼
        GATE & EXPIRY CHECK
                |
                ▼
        ENTRY / EXIT RECORD
                |
                ▼
           TOKEN EXPIRED
```

**QR Validation Rules**

- Unique token verification
- Student identity validation
- Hostel identity validation
- Active account verification
- Token expiry validation
- Gate validation
- Token usage validation
- Duplicate scan prevention

A one-time token should be invalidated atomically after successful use to prevent replay or duplicate access.

### 5. Entry & Exit Monitoring

The Entry / Exit Module maintains hostel movement records.

**Workflow**

```text
STUDENT
   |
   ▼
QR GENERATION
   |
   ▼
GUARD SCAN
   |
   ▼
BACKEND VALIDATION
   |
   ▼
ENTRY / EXIT RECORD
   |
   ▼
AUDIT RECORD
```

**Entry / Exit Log Fields**

- Student reference
- Date
- Time
- Hostel
- Gate
- Guard reference
- QR reference
- Movement type (`ENTRY` / `EXIT`)

### 6. Outpass Management

The Outpass Module manages student leave requests and approval workflows.

**Workflow**

```text
          STUDENT REQUEST
                 |
                 ▼
           PARENT REVIEW
                 |
                 ▼
           WARDEN REVIEW
                 |
                 ▼
           OWNER APPROVAL
                 |
                 ▼
             FINAL STATUS
```

**Outpass Status**

- `PENDING`
- `APPROVED`
- `REJECTED`
- `EXPIRED`
- `COMPLETED`

The workflow should maintain the identity and timestamp of every approval or rejection.

### 7. Complaint Management

Students can submit hostel-related complaints and monitor their progress.

**Complaint Categories**

- Fan
- Water
- Electricity
- Room
- Food
- Security
- Cleanliness
- Other

**Complaint Workflow**

```text
STUDENT CREATES COMPLAINT
           |
           ▼
      WARDEN REVIEW
           |
           ▼
        PROCESSING
           |
           ▼
        RESOLUTION
           |
           ▼
      STATUS UPDATED
```

**Complaint Status**

- `PENDING`
- `IN_PROGRESS`
- `RESOLVED`

### 8. Notice & Notification System

The platform provides announcements and operational notifications.

**Notice Targeting**

- All students
- All parents
- Specific block
- Specific floor
- Specific student

**Notification Events**

- Outpass approved
- Outpass rejected
- Complaint updated
- New notice published
- Fee due reminder
- Security alert
- Access code updated

Notifications should be generated from actual system events and authorized database records.

### 9. Fee Management

The Fee Management Module is designed to track hostel fee records and payment status.

**Features**

- Fee creation
- Due date tracking
- Paid fee records
- Outstanding fee tracking
- Overdue monitoring
- Receipt records
- Payment history

**Fee Status**

- `PENDING`
- `PAID`
- `OVERDUE`

**Planned Payment Integrations**

- Razorpay
- UPI
- Stripe

Payment gateway integrations require separate configuration, secure payment verification, and transaction reconciliation.

### 10. Mess Management

The Mess Management Module supports hostel food planning and student feedback.

**Features**

- Breakfast menu
- Lunch menu
- Dinner menu
- Weekly menu
- Food ratings
- Reviews
- Student feedback

### 11. Camera & Security Management

The Camera and Security Module is designed to organize hostel surveillance information and security events.

**Camera Locations**

- Main Gate
- Back Gate
- Parking
- Reception
- Hostel Entrance
- Common Areas

**Features**

- Camera management
- Camera assignment
- Security events
- Live monitoring integration
- Activity logs
- Incident reports

Camera connectivity and live video access depend on compatible camera hardware, network configuration, and supported streaming integrations.

### 12. Reports & Analytics

The Reports Module provides structured operational information for hostel administration.

**Available Report Categories**

- Student Report
- Room Report
- Bed Report
- Occupancy Report
- Entry / Exit Report
- Outpass Report
- Complaint Report
- Fees Report
- Mess Report
- Security Report

**Planned Export Formats**

- PDF
- Excel
- CSV

Reports should be generated from actual authorized database records rather than hardcoded dashboard values.

## 🗄 Database Architecture

SHMS uses MongoDB with Mongoose for data modeling and database operations.

### Main Data Entities

```text
HOSTELS
   |
   ├── USERS
   |     ├── SYSTEM_ADMIN
   |     ├── OWNER
   |     ├── WARDEN
   |     ├── GUARD
   |     ├── STUDENT
   |     └── PARENT
   |
   ├── BLOCKS
   ├── FLOORS
   ├── ROOMS
   ├── BEDS
   |
   ├── ROOM ALLOCATIONS
   ├── ENTRY / EXIT LOGS
   ├── QR TOKENS
   ├── OUTPASSES
   ├── COMPLAINTS
   ├── NOTICES
   ├── NOTIFICATIONS
   ├── FEES
   ├── CAMERAS
   ├── SECURITY EVENTS
   └── AUDIT LOGS
```

### Data Relationship Principles

- Each hostel owns its operational records.
- Blocks belong to their respective hostels.
- Floors belong to blocks.
- Rooms belong to floors.
- Beds belong to rooms.
- Student allocations reference students and beds.
- Entry / exit records reference students and guards.
- QR tokens reference their authorized student and hostel.
- Outpasses reference the requesting student and approval records.
- Parent accounts are linked to authorized students.
- Audit logs preserve important operation history.

Actual collection schemas, indexes, and references should be documented alongside their implementation.

## 🛡 Multi-Tenant Data Isolation

Multi-tenant isolation is one of the core architectural requirements of SHMS.

Every hostel must operate within its own authorized data boundary.

### Example 1: Owner Access

```text
OWNER A
   |
   ▼
HOSTEL A DATA
   |
   ▼
   ALLOWED
```

### Example 2: Cross-Hostel Access

```text
OWNER A
   |
   ▼
HOSTEL B DATA
   |
   ▼
   DENIED
```

### Example 3: Student Access

```text
STUDENT A
   |
   ▼
STUDENT B PRIVATE DATA
   |
   ▼
   DENIED
```

### Example 4: Parent Access

```text
PARENT A
   |
   ▼
UNLINKED STUDENT DATA
   |
   ▼
   DENIED
```

### Tenant Isolation Rules

- Every tenant-specific request must be scoped to an authorized hostel.
- Owners must not access another owner's hostel records.
- Wardens must access only their assigned hostel data.
- Guards must access only authorized security operations.
- Students must access only their permitted personal information.
- Parents must access only linked student information.
- Backend APIs must validate tenant scope independently of frontend requests.

**Important:** Tenant isolation must be enforced on the server side for every relevant read, create, update, and delete operation.

## 📋 Audit Logging

SHMS is designed to maintain an audit trail of important system operations.

### Example Audit Record

```text
User: Warden Rahul

Action:
Created Student

Student:
STU-00025

Hostel:
HST-00001

Date:
30-09-2026

Time:
10:35 AM
```

### Audit Tracking Categories

- Student creation
- Room changes
- Bed allocation
- Fee updates
- Outpass approvals
- Entry recording
- Exit recording
- Settings changes
- User updates
- Security-related activities

Audit records should capture the actor, action, affected resource, timestamp, and relevant context. Access to audit records must also be permission-controlled.

## 🗑 Soft Delete Policy

SHMS follows a soft-delete-oriented data preservation policy.

Instead of immediately removing important records, the system is designed to preserve historical information.

### Record Status

- `ACTIVE`
- `INACTIVE`
- `ARCHIVED`

### Historical Information to Preserve

- Entry / Exit Logs
- Fee Records
- Complaints
- Room Allocation History
- Outpass History
- Audit Logs

Soft deletion helps maintain operational history, accountability, and reporting continuity.

## 🔐 Security Principles

Security is a foundational requirement of SHMS.

### Security Controls

- JWT Authentication
- Password Hashing
- Role-Based Access Control
- Multi-Tenant Isolation
- Audit Trails
- QR Verification
- Soft Delete
- Permission Scoping
- Hostel Validation
- Protected Backend Routes
- Resource-Level Authorization

### Security Restrictions

The system must prevent:

- Cross-hostel data access
- Unauthorized student information access
- Unauthorized parent access
- Duplicate QR token usage
- Expired QR token usage
- Unauthorized approval actions
- Fake dashboard numbers
- Hardcoded complaint records
- Hardcoded notifications
- Frontend-only security enforcement

Security validation must always happen on the backend. Frontend restrictions alone are not sufficient.

## ⚙ Technology Stack

SHMS is built using the MERN technology ecosystem.

### Frontend

| Technology | Purpose |
|---|---|
| React.js | User interface |
| Vite | Development and build tooling |
| Tailwind CSS | UI styling |
| React Router | Application navigation |
| Axios | API communication |
| Context API | Shared application state |

### Backend

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | Backend framework |
| REST API | Client-server communication |
| JWT | Authentication |
| Bcrypt | Password hashing |

### Database

| Technology | Purpose |
|---|---|
| MongoDB | NoSQL database |
| Mongoose | MongoDB object modeling |

### Security Architecture

- JWT-based authentication
- RBAC authorization
- Access control
- Audit logging
- Tenant isolation
- Password hashing
- Backend request validation

## 📂 Project Structure

The following is the intended high-level organization of the SHMS project. The actual repository may contain additional configuration, scripts, tests, and supporting documentation.

```text
SMART-HOSTEL-MANAGEMENT-SYSTEM/
│
├── client/
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── context/
│       ├── hooks/
│       ├── layouts/
│       ├── pages/
│       ├── routes/
│       ├── services/
│       ├── styles/
│       └── utils/
│
├── server/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── validators/
│   ├── tests/
│   └── utils/
│
├── docs/
│
├── deliverables/
│
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md
```

## 🚦 Development Roadmap

The following roadmap represents the project's planned development sequence. Completion status should be updated according to actual implementation and testing.

| Phase | Development Area | Status |
|---|---|---|
| 00 | Reset & Planning | Completed |
| 01 | MERN Foundation | Completed |
| 02 | Database Architecture | Completed |
| 03 | Authentication | Completed |
| 04 | Multi-Tenant System | Planned |
| 05 | Owner Registration | Planned |
| 06 | Hostel Access Codes | Planned |
| 07 | Owner Dashboard | Planned |
| 08 | Warden Module | Planned |
| 09 | Guard Module | Planned |
| 10 | Student Module | Planned |
| 11 | Parent Module | Planned |
| 12 | Room Management | Planned |
| 13 | Allocation System | Planned |
| 14 | QR System | Planned |
| 15 | Entry / Exit | Planned |
| 16 | Outpass | Planned |
| 17 | Complaints | Planned |
| 18 | Notifications | Planned |
| 19 | Fees | Planned |
| 20 | Mess | Planned |
| 21 | Camera Security | Planned |
| 22 | Reports | Planned |
| 23 | Audit Logs | Planned |
| 24 | Testing | Planned |
| 25 | UI/UX | Planned |
| 26 | Deployment | Planned |

## 🔮 Future Enhancements

The platform can be extended with additional integrations and operational capabilities, including:

- Razorpay payment gateway
- UPI payment integration
- Stripe payment integration
- Real-time notification delivery
- Advanced analytics dashboards
- Camera and surveillance integrations
- Automated report generation
- Improved mobile experience
- Advanced security monitoring
- Production deployment and monitoring

These are planned enhancements and should not be considered available until implemented and tested.

## 🧪 Quality & Testing Goals

Before production deployment, the system should be validated for:

- Authentication and authorization
- Role-based permissions
- Cross-hostel data isolation
- Student and parent access restrictions
- Room and bed allocation conflicts
- QR expiry and duplicate-scan prevention
- Outpass approval workflows
- Fee record consistency
- Complaint workflow correctness
- Audit log integrity
- API validation and error handling
- Frontend production build
- Backend integration tests

## 🎯 Project Mission

The mission of Smart Hostel Management System is to build a secure, scalable, and enterprise-ready Hostel Management Platform using the MERN Stack.

SHMS aims to bring hostel administration, student accommodation, parent monitoring, QR-based security, financial records, and daily hostel operations into one unified digital ecosystem.

The long-term goal is to make hostel operations more organized, transparent, accountable, and efficient.

---

## 🏠 Smart Hostel Management System

**Secure • Scalable • Multi-Hostel • Enterprise Ready**

Built with ❤️ using the MERN Stack.

---

<p align="center">
  <strong>SMART HOSTEL MANAGEMENT SYSTEM</strong><br/>
  A Unified Platform for Modern Hostel Operations
</p>
