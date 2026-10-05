# SHCP - Smart Health Consultation Platform

A full-stack telemedicine and healthcare management platform designed to connect patients with licensed healthcare providers, enable AI-assisted symptom triage, support secure digital consultations, and streamline appointment and notification workflows.

This project combines a modular Spring Boot backend, a React frontend, AI-driven symptom analysis, a WebRTC signaling service, and supporting infrastructure such as PostgreSQL, Redis, RabbitMQ, and Docker Compose.

---

## Table of Contents

- [Project Overview](#project-overview)
- [System Goals](#system-goals)
- [Key Features](#key-features)
- [User Roles](#user-roles)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Running the Project](#running-the-project)
- [Accessing the Application](#accessing-the-application)
- [Database Schema](#database-schema)
- [Authentication & Security](#authentication--security)
- [Notifications & Messaging](#notifications--messaging)
- [Deployment Notes](#deployment-notes)
- [License](#license)

---

## Project Overview

SHCP is an AI-powered healthcare platform built for digital patient care in the Rwandan healthcare context. It provides a complete flow for:

- patient registration and login
- appointment booking with provider availability
- AI symptom assessment and urgency classification
- consultation management
- digital prescriptions
- patient health record tracking
- reminders and notifications
- video consultation coordination using WebRTC
- admin monitoring and platform analytics

The platform is structured around a central Spring Boot core API and several independent services for AI analysis, signaling, and notifications.

---

## System Goals

The project aims to:

- make healthcare access easier and more efficient
- reduce delays in medical triage
- enable remote consultation between patients and providers
- support digital workflows for healthcare operations
- integrate AI-assisted clinical decision support
- provide a scalable and modular microservice-style deployment model

---

## Key Features

### Patient Features
- create and manage patient profile
- browse healthcare providers
- view provider availability and book appointments
- submit symptoms for AI-assisted evaluation
- receive urgency classification and recommended action
- access consultation history and related medical records
- receive appointment reminders via SMS/email/push

### Provider Features
- manage provider profile and consultation schedule
- define availability slots
- review patient appointments and medical history
- start, conduct, and end consultations
- issue digital prescriptions
- maintain consultation notes and diagnosis records

### Admin Features
- manage users and roles
- monitor platform analytics
- review system health and activity
- oversee operational metrics

### System Features
- JWT-based authentication and role-based authorization
- Redis-backed token and rate limiting support
- PostgreSQL data persistence
- RabbitMQ-based event-driven notifications
- WebRTC signaling for real-time video communication
- AI-based urgency detection using symptom analysis
- Dockerized deployments for reproducible local and cloud hosting

---

## User Roles

| Role | Responsibilities |
|------|----------------|
| Patient | Book appointments, submit symptoms, attend consultations, receive prescriptions |
| Provider | Manage availability, conduct consultations, issue prescriptions, view patient records |
| Admin | Monitor system, manage users, oversee operational metrics and analytics |

---

## Architecture

SHCP follows a hybrid architecture:

- Modular monolith in the core Spring Boot backend
- Independent services for AI processing, signaling, and notifications
- Shared PostgreSQL database for transactional data
- Redis for refresh tokens, OTP handling, and rate limiting
- RabbitMQ for async notification events
- WebRTC-based real-time consultation flow

### High-Level Architecture

```text
Client App (React)
       |
       | REST / JSON
       v
Spring Boot Core API
   |-- Auth & Users
   |-- Appointments
   |-- Consultations
   |-- Symptoms / EHR
   |-- Prescriptions
   |-- Notifications
   |
   +--> AI Service (Python Flask) [HTTP]
   +--> Signaling Server (Node.js + Socket.IO) [WebSocket]
   +--> RabbitMQ
            |
            v
   Notification Consumer (Spring Boot)
            |
            +--> SMS / Email / Push Delivery
```

### Main Services

#### 1. Core API
The central application built with Java and Spring Boot. It handles:
- user authentication
- appointment workflows
- consultation lifecycle
- symptom report processing
- EHR and prescription management
- notification publishing
- analytics and admin reporting

#### 2. AI Service
A Python Flask service that accepts symptom text and body-map data and returns:
- urgency classification
- extracted symptoms
- recommended action
- self-care tips
- confidence score

#### 3. Signaling Server
A Node.js service using Socket.IO for WebRTC negotiation between provider and patient during video consultations. It relays SDP offers, answers, and ICE candidates.

#### 4. Notification Consumer
A separate Spring Boot listener that consumes RabbitMQ events and fulfills delivery through:
- SMS
- email
- push notifications

---

## Technology Stack

### Frontend
- React
- Vite
- TypeScript
- Material UI / Emotion
- Firebase (for web/mobile integration support)
- Axios
- Tailwind CSS (used alongside component styling)
- PWA support via Vite plugin

### Backend
- Java 21
- Spring Boot 3.x
- Spring Security
- Spring Data JPA / Hibernate
- PostgreSQL JDBC
- JWT authentication
- REST APIs

### AI Service
- Python 3.x
- Flask
- spaCy
- scikit-learn
- TensorFlow
- language detection and symptom processing

### Real-time / WebRTC
- Node.js
- Express
- Socket.IO
- WebRTC negotiation pipeline

### Messaging & Caching
- Redis 7
- RabbitMQ 3.13
- Docker networking

### Database
- PostgreSQL 15

### DevOps / Deployment
- Docker
- Docker Compose
- environment variables and secret mounts
- health checks for service readiness

---

## Repository Structure

```text
shcp/
├── .env.example
├── .github/
├── .gitignore
├── README.md
├── RUNNING.md
├── SEEDED_ACCOUNTS.md
├── build_output.txt
├── docker-compose.yml
├── docs/
│   └── SHCP-Architecture-and-ERD.md
├── SHCP-Backend/
│   └── patientsMgt/
├── SHCP-Frontend/
├── ai-service/
├── coturn/
├── notification-consumer/
├── signaling/
├── secrets/
└── ...
```

### Meaning of major directories
- `SHCP-Backend` - Java service containing core business logic
- `SHCP-Frontend` - React application for the web dashboard
- `ai-service` - AI analysis service
- `signaling` - real-time consultation signaling service
- `notification-consumer` - message-driven notification processor
- `docs` - architecture and ERD documentation
- `coturn` - TURN server configuration for WebRTC media relay
- `secrets` - credentials and secret files

---

## Prerequisites

Before running the project locally, install:

- Docker Desktop
- Git
- Node.js (for frontend dev work, optional)
- Java 21 (for backend development, optional)
- Python 3.11 (for AI service development, optional)

---

## Environment Configuration

Create a `.env` file from the sample:

```bash
cp .env.example .env
```

### Required variables

```env
DB_PASSWORD=your_db_password
JWT_SECRET=your_jwt_secret
REDIS_PASSWORD=your_redis_password
RABBITMQ_PASS=your_rabbitmq_pass
MAIL_USERNAME=your_gmail_address
MAIL_PASSWORD=your_gmail_app_password
COTURN_SECRET=your_turn_secret
```

### Optional variables
```env
FRONTEND_URL=http://localhost
COTURN_EXTERNAL_IP=your_public_ip
VITE_API_BASE_URL=http://localhost:8082
VITE_SIGNALING_URL=http://localhost:3001
```

### Firebase credentials
The application expects a Firebase credential file at:

```text
secrets/fcm-credentials.json
```

If not available, an empty placeholder may be used temporarily.

---

## Running the Project

### First-time setup
```bash
docker compose up --build -d
```

### Subsequent runs
```bash
docker compose up -d
```

### Check running services
```bash
docker compose ps
```

### View logs
```bash
docker compose logs -f
```

### Stop services
```bash
docker compose down
```

To remove all volumes and reset state:
```bash
docker compose down -v
```

---

## Accessing the Application

Once all services are healthy, the app is available at:

| Service | URL |
|---------|-----|
| Frontend | http://localhost |
| Backend API | http://localhost:8082 |
| Health Check | http://localhost:8082/actuator/health |
| Signaling Health | http://localhost:3001/health |

---

## Default Seeded Accounts

The project includes seeded accounts for testing:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@shcp.rw | Admin@1234 |
| Provider | ahmed.provider@yopmail.com | Ahmed@123 |
| Patient | marie.uwimana@yopmail.com | Ahmed@123 |
| Pharmacist | marie.mukamana@yopmail.com | Ahmed@123 |

Other seeded accounts generally use:
```text
Ahmed@123
```

---

## Database Schema

The database is centered around PostgreSQL and uses a role-based data model.

### Core Entities

#### users
Stores shared authentication and profile information for all users.

| Field | Type | Description |
|-------|------|-------------|
| user_id | UUID / PK | unique user identifier |
| name | VARCHAR | full name |
| email | VARCHAR (unique) | login identifier |
| phone | VARCHAR | contact number |
| password_hash | VARCHAR | BCrypt-encrypted password |
| role | VARCHAR | PATIENT / PROVIDER / ADMIN |
| is_verified | BOOLEAN | account verification status |
| language_pref | VARCHAR | preferred language |
| device_token | VARCHAR | FCM token |
| created_at | TIMESTAMP | creation time |
| updated_at | TIMESTAMP | last update |

#### patients
One-to-one extension of the `users` table for patient-specific information.

| Field | Type | Description |
|-------|------|-------------|
| user_id | UUID / PK, FK | same ID as users.user_id |
| date_of_birth | DATE | patient DOB |
| gender | VARCHAR | gender |
| blood_group | VARCHAR | blood type |
| address | TEXT | address |
| emergency_contact | JSONB | emergency details |
| created_at | TIMESTAMP | creation time |

#### providers
One-to-one extension of `users` for provider information.

| Field | Type | Description |
|-------|------|-------------|
| user_id | UUID / PK, FK | same ID as users.user_id |
| specialty | VARCHAR | medical specialty |
| license_number | VARCHAR | professional license |
| bio | TEXT | provider biography |
| languages | JSONB / array-like | spoken languages |
| consultation_fee | DECIMAL | fee per consultation |
| rating | DECIMAL | provider rating |
| is_active | BOOLEAN | availability status |
| years_experience | INTEGER | years of practice |

#### admins
One-to-one extension for administrative users.

| Field | Type | Description |
|-------|------|-------------|
| user_id | UUID / PK, FK | same ID as users.user_id |
| department | VARCHAR | admin department |
| created_at | TIMESTAMP | creation time |

#### availability
Stores provider time slots.

| Field | Type | Description |
|-------|------|-------------|
| slot_id | UUID / PK | unique slot ID |
| provider_id | UUID / FK | provider |
| start_time | TIMESTAMPTZ | slot start |
| end_time | TIMESTAMPTZ | slot end |
| is_booked | BOOLEAN | whether slot is assigned |
| appointment_type | VARCHAR | type of appointment |

#### appointments
Core transactional unit connecting patient, provider, and availability.

| Field | Type | Description |
|-------|------|-------------|
| appointment_id | UUID / PK | unique appointment ID |
| patient_id | UUID / FK | patient |
| provider_id | UUID / FK | provider |
| slot_id | UUID / FK | booked time slot |
| scheduled_at | TIMESTAMPTZ | appointment time |
| type | VARCHAR | VIDEO / FOLLOWUP / URGENT |
| status | VARCHAR | PENDING / CONFIRMED / IN_PROGRESS / COMPLETED / CANCELLED / NO_SHOW |
| fee | DECIMAL | appointment fee |
| payment_status | VARCHAR | PENDING / PAID / WAIVED / REFUNDED |
| cancellation_reason | TEXT | cancellation details |
| created_at | TIMESTAMP | creation time |

#### consultations
Represents a consultation session linked to an appointment.

| Field | Type | Description |
|-------|------|-------------|
| consultation_id | UUID / PK | consultation ID |
| appointment_id | UUID / FK | underlying appointment |
| video_room_id | VARCHAR | generated WebRTC room ID |
| started_at | TIMESTAMPTZ | consultation start |
| ended_at | TIMESTAMPTZ | consultation completion |
| duration_minutes | INTEGER | consultation duration |
| notes | TEXT | clinician notes |
| diagnosis | TEXT | diagnosis text |
| recording_url | VARCHAR | recording reference |
| status | VARCHAR | WAITING / IN_PROGRESS / COMPLETED / ABANDONED |

#### prescriptions
Issued prescriptions after consultation.

| Field | Type | Description |
|-------|------|-------------|
| prescription_id | UUID / PK | unique prescription ID |
| consultation_id | UUID / FK | linked consultation |
| issued_by | UUID / FK | provider who issued it |
| patient_id | UUID / FK | patient |
| medications | JSONB | medicine details |
| interaction_alerts | JSONB | medication warnings |
| digital_signature | TEXT | provider signature |
| pharmacy_status | VARCHAR | PENDING / DISPENSED / REJECTED / REFILL_REQUESTED |
| valid_until | DATE | prescription validity |
| issued_at | TIMESTAMPTZ | issue time |

#### symptom_reports
Stores symptom submissions and AI evaluation results.

| Field | Type | Description |
|-------|------|-------------|
| report_id | UUID / PK | symptom report ID |
| patient_id | UUID / FK | patient |
| symptom_text | TEXT | original symptom text |
| symptoms | JSONB | extracted symptoms |
| body_map_data | JSONB | region click selections |
| language | VARCHAR | rw / en / fr |
| ai_urgency | VARCHAR | EMERGENCY / URGENT / ROUTINE / SELF_CARE / UNKNOWN |
| ai_pathway | VARCHAR | recommended care pathway |
| ai_confidence | DECIMAL | confidence score |
| ai_raw_response | JSONB | full AI output |
| created_at | TIMESTAMPTZ | report time |

#### health_records
Stores electronic health record data.

| Field | Type | Description |
|-------|------|-------------|
| record_id | UUID / PK | EHR ID |
| patient_id | UUID / FK | patient |
| diagnoses | JSONB | diagnosis history |
| medications | JSONB | active medication history |
| allergies | JSONB | allergies |
| vitals | JSONB | vitals data |
| immunizations | JSONB | vaccination history |
| lab_results | JSONB | lab-related references |
| documents | JSONB | uploaded documents |

#### notifications
Stores audit trail of delivery attempts.

| Field | Type | Description |
|-------|------|-------------|
| notification_id | UUID / PK | unique notification ID |
| user_id | UUID / FK | recipient |
| type | VARCHAR | event type |
| channel | VARCHAR | SMS / EMAIL / PUSH |
| message | TEXT | notification content |
| status | VARCHAR | PENDING / SENT / FAILED / DEAD_LETTERED |
| retry_count | INTEGER | number of retries |
| sent_at | TIMESTAMPTZ | send timestamp |
| error_detail | TEXT | failure info |
| metadata | JSONB | related metadata |
| created_at | TIMESTAMPTZ | creation time |

### Relationship Summary

```text
users
 ├── patients
 ├── providers
 └── admins

patients
 ├── health_records
 └── appointments

providers
 ├── availability
 ├── appointments
 └── prescriptions

appointments
 ├── consultations
 └── notifications (indirectly via events)

symptom_reports
 └── patient

notifications
 └── user
```

### Database Design Notes
- `users` is the root table for all identities
- each role uses a shared primary key pattern
- `health_records` is created lazily when needed
- `appointments` enforce double-booking protection
- `consultations` are linked one-to-one to appointments
- `notifications` acts as an audit log for message delivery attempts
- JSONB is used for flexible and evolving healthcare data

---

## Authentication & Security

SHCP uses JWT-based authentication and role-based authorization.

### Authentication flow
- user registers
- email OTP verification
- password hashing using BCrypt
- login issues access and refresh tokens
- refresh token rotation and Redis validation
- logout invalidates refresh tokens

### Security features
- BCrypt password hashing
- JWT token validation
- Redis-based refresh token whitelist
- rate limiting on authentication attempts
- endpoint-level authorization using roles
- CORS allowlist configuration
- environment-based secrets and credentials storage

---

## Notifications & Messaging

The platform uses asynchronous messaging for notifications.

### Notification Flow
1. service triggers notification event
2. event is published to RabbitMQ
3. notification consumer reads the event
4. appropriate delivery channel is used:
   - SMS via Africa's Talking
   - email via SendGrid
   - push via Firebase FCM

### Examples
- appointment confirmation
- appointment reminders
- consultation started
- prescription issued
- reminder notifications

---

## Deployment Notes

The project is containerized with Docker Compose and includes several independent services:

- `shcp-frontend`
- `shcp-api`
- `shcp-ai`
- `shcp-signaling`
- `shcp-db`
- `shcp-redis`
- `shcp-rabbitmq`
- `shcp-notifications`
- `shcp-coturn`

This deployment model makes the project portable and suitable for local development, staging, and cloud-hosted deployments.

---

## License

This project is intended for academic, educational, and prototype healthcare platform development. Please check the repository for the exact license terms before using it in production or commercial deployments.

---

## Summary

SHCP is a modern telemedicine platform that combines healthcare workflows, AI-driven symptom evaluation, WebRTC consultation support, secure user management, and robust backend infrastructure. It is a strong example of a modular healthcare application with multi-service architecture, cloud-friendly deployments, and a database model designed around patient care operations.
