<div align="center">
 
# 🏠 SMART HOSTEL MANAGEMENT SYSTEM (SHMS)
 
### Enterprise Multi-Tenant Hostel ERP & Security Platform
 
A Complete MERN Stack Based Hostel Management, Security, Attendance, Parent Monitoring & Operations Platform.
 
![Version](https://img.shields.io/badge/version-v1.0-blue)
![MERN](https://img.shields.io/badge/MERN-FullStack-green)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-success)
![Security](https://img.shields.io/badge/Security-Enterprise-red)
![JWT](https://img.shields.io/badge/JWT-Authentication-orange)
![Status](https://img.shields.io/badge/Status-Development-yellow)
 
</div>
 
---
 
# 📖 Project Overview
 
Smart Hostel Management System (SHMS) is a complete enterprise-grade Hostel ERP and Security Management Platform designed for educational institutions, hostels, PG accommodations, student residences and residential campuses.
 
The platform provides a centralized, secure and scalable environment for managing hostels, students, parents, rooms, beds, security operations, entry/exit monitoring, fees, complaints, notices, reports and audit logs.
 
---
 
# 🎯 Project Vision
 
```text
Owner Creates Hostel
│
▼
Create Warden & Guard
│
▼
Create Rooms & Beds
│
▼
Register Students
│
▼
Link Parents
│
▼
QR Based Security
│
▼
Entry / Exit Tracking
│
▼
Outpass Management
│
▼
Complaint Management
│
▼
Fees & Mess Management
│
▼
Reports & Audit Logs
🚀 Key Features

✅ Multi Hostel Architecture

✅ Role Based Access Control

✅ Student Management

✅ Parent Portal

✅ Hostel Administration

✅ Room & Bed Allocation

✅ One Time QR Security

✅ Entry / Exit Monitoring

✅ Outpass Workflow

✅ Complaint Management

✅ Fees Management

✅ Mess Management

✅ Notices & Notifications

✅ Security Monitoring

✅ Reports & Analytics

✅ Audit Logs

✅ Soft Delete System

✅ Multi Tenant Data Isolation

👥 System Roles
Role	DescriptionSYSTEM_ADMIN	Complete Platform Administrator
OWNER	Hostel Owner & Main Administrator
WARDEN	Daily Hostel Operations
GUARD	Security & Entry Operations
STUDENT	Hostel Resident
PARENT	Child Monitoring Portal
🏗 Enterprise Architecture
Plain Text
SYSTEM ADMIN
│
┌─────────────────────────┼─────────────────────────┐
│ │ │
▼ ▼ ▼
 
HOSTEL A HOSTEL B HOSTEL C
 
│ │ │
 
OWNER OWNER OWNER
 
│ │ │
 
┌────┴─────┐ ┌─────┴─────┐ ┌─────┴─────┐
 
WARDEN GUARD WARDEN GUARD WARDEN GUARD
 
│ │ │
 
STUDENTS STUDENTS STUDENTS
 
│ │ │
 
PARENTS PARENTS PARENTS
🔐 Role Hierarchy
Plain Text
SYSTEM_ADMIN
│
▼
OWNER
┌────┴────┐
▼ ▼
WARDEN GUARD
│
▼
STUDENT
│
▼
PARENT
🔒 Authentication Architecture
Plain Text
User Login
│
▼
 
Credentials Validation
 
│
▼
 
JWT Generation
 
│
▼
 
Role Validation
 
│
▼
 
Hostel Validation
 
│
▼
 
Permission Validation
 
│
▼
 
Authorized Access
🏢 Hostel Structure
Plain Text
Hostel
│
├── Block A
│ │
│ ├── Floor 1
│ │ │
│ │ ├── Room 101
│ │ │ ├── Bed A
│ │ │ ├── Bed B
│ │ │ └── Bed C
│ │
│ └── Floor 2
│
└── Block B
 
🛏 Room & Bed Management
Room Status
Plain Text
Available
Occupied
Reserved
Maintenance
Bed Status
Plain Text
Available
Occupied
Reserved
Maintenance
Features
Block Management
Floor Management
Room Management
Bed Management
Allocation Tracking
Release Tracking
Occupancy Monitoring
Allocation History
👨‍🎓 Student Management Module
Features

✅ Student Registration

✅ Student Profile

✅ Parent Linking

✅ Student ID Generation

✅ Room Allocation

✅ Bed Allocation

✅ QR Generation

✅ Entry / Exit History

✅ Outpass Requests

✅ Complaint Submission

✅ Fee Management

✅ Notifications

✅ Notices

👨‍👩‍👧 Parent Portal
Parent Features

✅ Child Profile

✅ Room Details

✅ Bed Allocation

✅ Entry / Exit History

✅ Outpass Approval Review

✅ Complaint Status

✅ Notifications

✅ Notices

✅ Fee Monitoring

🚪 One-Time QR Security
QR Flow
Plain Text
Student Login
│
▼
 
Generate QR
│
▼
 
Unique Token Created
│
▼
 
Guard Scan
│
▼
 
Backend Validation
│
▼
 
Entry / Exit Logged
│
▼
 
QR Expired
 
Validation Rules

✅ Unique Token

✅ Hostel Validation

✅ Student Validation

✅ Active Account

✅ Expiry Validation

✅ Gate Validation

✅ Usage Validation

🚨 Entry / Exit System
Workflow
Plain Text
Student
│
▼
 
QR Generated
│
▼
 
Guard Scan
│
▼
 
System Validation
│
▼
 
Entry / Exit Log
│
▼
 
Audit Record
Entry / Exit Log
Plain Text
Student
Date
Time
Hostel
Gate
Guard
QR Reference
Entry / Exit Type
📝 Outpass Management
Workflow
Plain Text
Student Request
│
▼
 
Parent Review
│
▼
 
Warden Review
│
▼
 
Owner Approval
│
▼
 
Final Status
Status
Plain Text
Pending
Approved
Rejected
Expired
Completed
📣 Complaint Management
Categories
Plain Text
Fan
Water
Electricity
Room
Food
Security
Cleanliness
Other
Workflow
Plain Text
Student Creates Complaint
│
▼
 
Warden Review
│
▼
 
Processing
│
▼
 
Resolution
Complaint Status
Plain Text
Pending
In Progress
Resolved
🔔 Notice & Notification System
Notice Targets
All Students
All Parents
Specific Block
Specific Floor
Specific Student
Notifications
Outpass Approved
Outpass Rejected
Complaint Updated
New Notice
Fee Due Reminder
Security Alert
Access Code Updated
💰 Fee Management
Features

✅ Fee Creation

✅ Due Date Tracking

✅ Paid Fees

✅ Outstanding Fees

✅ Overdue Monitoring

✅ Receipts

✅ Payment History

Status
Plain Text
Pending
Paid
Overdue
 
Future Upgrades

✅ Razorpay Integration

✅ UPI Integration

✅ Stripe Integration

🍽 Mess Management
Features

✅ Breakfast Menu

✅ Lunch Menu

✅ Dinner Menu

✅ Weekly Menu

✅ Food Ratings

✅ Reviews

✅ Student Feedback

🎥 Camera & Security Management
Camera Locations
Plain Text
Main Gate
Back Gate
Parking
Reception
Hostel Entrance
Common Areas
Features

✅ Camera Management

✅ Camera Assignment

✅ Security Events

✅ Live Monitoring

✅ Activity Logs

✅ Incident Reports

📊 Reports & Analytics
Reports

✅ Students Report

✅ Room Report

✅ Bed Report

✅ Occupancy Report

✅ Entry / Exit Report

✅ Outpass Report

✅ Complaint Report

✅ Fees Report

✅ Mess Report

✅ Security Report

Export Types
Plain Text
PDF
Excel
CSV
🗄 Database Architecture
Plain Text
Hostels
│
├── Users
│ ├── Owner
│ ├── Warden
│ ├── Guard
│ ├── Student
│ └── Parent
│
├── Blocks
├── Floors
├── Rooms
├── Beds
│
├── Room Allocations
├── Entry Exit Logs
├── QR Tokens
├── Outpasses
├── Complaints
├── Notices
├── Notifications
├── Fees
├── Cameras
├── Security Events
└── Audit Logs
🛡 Access Isolation Model
Plain Text
Owner A
│
▼
 
Hostel A Data
 
│
└── ✅ ALLOWED
 
Plain Text
Owner A
│
▼
 
Hostel B Data
 
│
└── ❌ DENIED
Plain Text
Student A
│
▼
 
Student B Data
 
│
└── ❌ DENIED
Plain Text
Parent A
│
▼
 
Other Student Data
 
│
└── ❌ DENIED
📋 Audit Logging

Every critical action is permanently recorded.

Example:

Plain Text
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
Audit Tracking

✅ Student Creation

✅ Room Change

✅ Fee Update

✅ Outpass Approval

✅ Entry Recording

✅ Settings Change

✅ User Updates

🗑 Soft Delete Policy

Records are never permanently deleted.

Status System
Plain Text
ACTIVE
INACTIVE
ARCHIVED
Preserved History

✅ Entry Logs

✅ Fees

✅ Complaints

✅ Allocation History

✅ Outpass History

✅ Audit Logs

🔐 Security Principles
Plain Text
✅ JWT Authentication
 
✅ Password Hashing
 
✅ Role Based Access
 
✅ Multi Tenant Isolation
 
✅ Audit Trails
 
✅ QR Verification
 
✅ Soft Delete
 
✅ Permission Scoping
 
✅ Hostel Validation
Plain Text
❌ Cross Hostel Data Access
 
❌ Fake Students
 
❌ Fake Dashboard Numbers
 
❌ Hardcoded Complaints
 
❌ Hardcoded Notifications
 
❌ Frontend Only Security
⚙ Technology Stack
Frontend
Plain Text
React.js
Vite
Tailwind CSS
React Router
Axios
Context API
Backend
Plain Text
Node.js
Express.js
REST API
JWT
Bcrypt
Database
Plain Text
MongoDB
Mongoose
Security
Plain Text
JWT
RBAC
Access Control
Audit Logs
Tenant Isolation
📂 Final Project Structure
Plain Text
SHMS
│
├── client
│ ├── assets
│ ├── components
│ ├── context
│ ├── hooks
│ ├── layouts
│ ├── pages
│ ├── routes
│ ├── services
│ ├── styles
│ └── utils
│
├── server
│ ├── config
│ ├── controllers
│ ├── middleware
│ ├── models
│ ├── routes
│ ├── services
│ ├── validators
│ ├── tests
│ └── utils
│
├── docs
│
├── README.md
├── DEPLOYMENT.md
├── SECURITY.md
└── .gitignore
🚦 Development Roadmap
Plain Text
✅ Phase 00 - Reset & Planning
✅ Phase 01 - MERN Foundation
✅ Phase 02 - Database Architecture
✅ Phase 03 - Authentication
 
⬜ Phase 04 - Multi Tenant System
⬜ Phase 05 - Owner Registration
⬜ Phase 06 - Hostel Access Codes
⬜ Phase 07 - Owner Dashboard
⬜ Phase 08 - Warden Module
⬜ Phase 09 - Guard Module
⬜ Phase 10 - Student Module
⬜ Phase 11 - Parent Module
⬜ Phase 12 - Room Management
⬜ Phase 13 - Allocation System
⬜ Phase 14 - QR System
⬜ Phase 15 - Entry Exit
⬜ Phase 16 - Outpass
⬜ Phase 17 - Complaints
⬜ Phase 18 - Notifications
⬜ Phase 19 - Fees
⬜ Phase 20 - Mess
⬜ Phase 21 - Camera Security
⬜ Phase 22 - Reports
⬜ Phase 23 - Audit Logs
⬜ Phase 24 - Testing
⬜ Phase 25 - UI/UX
⬜ Phase 26 - Deployment
🎯 Project Mission

Build the most secure, scalable and enterprise-ready Hostel Management Platform using MERN Stack with complete Multi-Tenant Architecture, QR Security, Parent Monitoring, Audit Logging and Real-Time Hostel Operations.
