🏠 Smart Hostel Management System (SHMS)
Enterprise Multi-Hostel Management Platform

SHMS is a modern MERN-stack based hostel management platform designed for educational institutions, private hostels, PG accommodations, and large residential campuses.

The platform follows a secure multi-tenant architecture where each hostel operates independently while being managed under a centralized system.

🚀 Core Features
🔐 Multi Role Access Control
System Admin
Owner
Warden
Guard
Student
Parent

Each role has dedicated permissions and restricted access according to hostel policies.

🏢 Multi Hostel Architecture
Multiple hostels under one platform
Unique Hostel ID
Hostel Access Code
Complete tenant isolation
Role based hostel access
👨‍🎓 Student Management
Student Registration
Student Profile
Parent Linking
Hostel Allocation
Room Allocation
Bed Allocation
Student History
Soft Delete System
👨‍👩‍👦 Parent Portal

Parents can access:

Child Profile
Fee Status
Entry/Exit Records
Outpass Status
Notifications
Complaint Status
🛏 Room & Bed Management

Structure:

Plain Text
Hostel
└── Block
└── Floor
└── Room
└── Bed

Features:

Room Status
Bed Status
Occupancy Tracking
Allocation History
Release History
🚪 Smart Security System
One-Time QR Authentication
Plain Text
Student Generates QR
↓
Guard Scans QR
↓
System Verification
↓
Entry / Exit Recorded

Security Validation:

Hostel Validation
Student Validation
Expiry Check
Usage Check
Gate Validation
Token Verification
📋 Outpass Management

Approval Workflow:

Plain Text
Student
↓
Outpass Request
↓
Parent Review
↓
Warden Review
↓
Owner Review
↓
Final Approval

Status:

Pending
Approved
Rejected
Expired
Completed
🔧 Complaint Management

Categories:

Electricity
Water
Fan
Room
Food
Cleanliness
Security
Other

Status:

Pending
In Progress
Resolved
💰 Finance Management
Fees Management
Due Tracking
Payment History
Overdue Monitoring
Receipt Generation

Future Ready:

Razorpay Integration
Stripe Integration
Online Payments
🍽 Mess Management
Breakfast
Lunch
Dinner
Weekly Menu
Food Reviews
Ratings
🎥 Security & Surveillance
Camera Management
Live Streams
Gate Monitoring
Security Events
Access Control
📊 Reports & Analytics

Reports Available:

Students
Rooms
Beds
Occupancy
Entry Exit
Outpass
Fees
Complaints
Security

Exports:

PDF
Excel
CSV
📝 Audit Logs

Every critical action is tracked.

Example:

Plain Text
User: Warden Rahul
Action: Student Created
Student ID: STU-00025
Hostel: HST-00001
Time: 30-09-2026 10:35 AM
🔒 Security Rules

✅ Hostel Data Isolation

✅ Role-Based Access

✅ JWT Authentication

✅ Password Hashing

✅ Audit Logs

✅ Soft Delete

✅ Access Control

❌ No Fake Data

❌ No Dummy Records

❌ No Hardcoded Security

❌ No Cross Hostel Access

🏗 Technology Stack
Frontend
React.js
Vite
Tailwind CSS
React Router
Backend
Node.js
Express.js
Database
MongoDB
Mongoose
Security
JWT
Bcrypt
RBAC
Tenant Isolation
📂 Project Structure
Plain Text
SHMS
│
├── client/
├── server/
│
├── README.md
├── DEPLOYMENT.md
├── SECURITY.md
└── .gitignore
🔄 Development Roadmap

✅ Phase 00 - Reset & Planning

✅ Phase 01 - MERN Foundation

✅ Phase 02 - Database Architecture

✅ Phase 03 - Authentication

⬜ Phase 04-26 In Progress

🎯 Project Vision

Owner creates Hostel → Warden & Guard Management → Student Onboarding → Parent Linking → QR Security → Entry/Exit Monitoring → Outpass → Complaints → Fees → Reports → Audit Logs

A complete enterprise-grade hostel ecosystem powered by the MERN stack.
