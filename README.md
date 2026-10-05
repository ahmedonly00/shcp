# SHCP - Smart Health Consultation Platform

A full-stack telemedicine platform designed to improve healthcare access by connecting patients, healthcare providers, and administrators in a unified digital workflow. The system supports appointment booking, AI-assisted symptom triage, real-time virtual consultation, digital prescriptions, secure authentication, and automated notifications.

This project was designed as a realistic healthcare software system that combines frontend engineering, backend development, AI integration, event-driven messaging, real-time communication, and containerized deployment. It demonstrates system design thinking, modular service separation, and the ability to build a production-like platform around a meaningful use case.

---

## Problem statement

Traditional healthcare delivery often suffers from fragmented workflows, delayed scheduling, limited remote access, and poor coordination between patients and providers. SHCP addresses these issues by creating a digital healthcare platform that centralizes core operations such as appointment flow, symptom evaluation, consultation management, and communications.

The project is built around the need to:

- reduce delays in patient care access
- enable remote digital consultations
- automate routine healthcare communication
- improve provider efficiency and patient engagement
- support AI-assisted triage for early clinical prioritization

---

## Project goals

- build a role-based healthcare platform for patients, providers, and admins
- support appointment booking and schedule coordination
- provide AI-assisted symptom analysis and risk prioritization
- enable real-time video consultation through WebRTC signaling
- manage patient records, appointments, and prescriptions digitally
- implement secure authentication and authorization
- support notifications using async messaging patterns
- deploy the system through a containerized multi-service architecture

---

## Why this project is technically strong

This project is not just a CRUD app. It combines multiple engineering concerns in one system:

- a full-stack application with separate frontend and backend layers
- asynchronous event-driven communication via RabbitMQ
- real-time communication using WebRTC and Socket.IO
- AI integration through a dedicated Python microservice
- secure JWT-based authentication and token validation
- shared PostgreSQL persistence with domain-driven data modeling
- Docker-based orchestration for multi-service deployment
- role-based healthcare workflows and data separation

This makes it a strong project for technical interviews, portfolio review, and software engineering discussions because it demonstrates practical system design and implementation across several domains.

---

## System architecture

SHCP follows a hybrid architecture that blends a modular monolith with independent services for specialized functionality.

### Architectural style

- Spring Boot core API acts as the main business application
- AI analysis is delegated to a dedicated Python Flask service
- real-time consultation signaling is handled by a Node.js server
- notification delivery is handled asynchronously through RabbitMQ
- Postgres provides the centralized transactional data layer
- Redis supports authentication flow, OTP, token state, and rate limiting
- Docker Compose orchestrates all services for local deployment

### High-level architecture diagram

```text
Client App (React)
      |
      v
Spring Boot Core API
   |-- Auth / Users / Roles
   |-- Appointments
   |-- Consultations
   |-- Symptom Analysis
   |-- EHR / Prescriptions
   |-- Notifications
   |
   +--> Python AI Service
   +--> Node.js Signaling Server
   +--> RabbitMQ
            |
            v
   Notification Consumer (Spring Boot)
            |
            +--> SMS / Email / Push
```

---

## Core services and responsibilities

### 1. Core API (Spring Boot)
The central backend application is responsible for all primary business logic.

Responsibilities:
- user authentication and authorization
- role-based access control
- patient and provider profile management
- appointment creation, confirmation, and status updates
- consultation lifecycle transitions
- symptom report processing and persistence
- EHR and prescription management
- analytics and operational reporting
- publishing notification events to the broker

This component acts as the main system orchestrator and business domain hub.

### 2. AI Service (Python + Flask)
The AI service handles medical triage intelligence.

Responsibilities:
- receive symptom text and body-map inputs
- detect language and extract relevant clinical signals
- classify urgency levels such as low, moderate, urgent, or emergency
- return recommended action and self-care guidance
- operate independently from the main backend for resilience

This service allows the platform to perform intelligent assessment without tightly coupling symptom analysis logic to the core Java application.

### 3. Signaling Server (Node.js + Socket.IO)
This service enables real-time peer communication for video consultations.

Responsibilities:
- handle WebRTC signaling messages
- validate JWT tokens for room access
- relay offer/answer/ICE candidate traffic between peers
- manage room membership and session lifecycle

The signaling layer is responsible for connection coordination rather than actual media transmission, which remains peer-to-peer.

### 4. Notification Consumer (Spring Boot)
This service consumes notification messages and performs delivery tasks.

Responsibilities:
- consume events from RabbitMQ
- identify channel type (SMS, email, push)
- fetch recipient details from the database
- call third-party providers or messaging services
- log status and retry results
- support downstream monitoring and audit trails

This separation ensures the user-facing API remains responsive and does not block on slow external delivery systems.

---

## Key features

### Patient features
- secure registration and login
- profile management
- provider search and availability browsing
- appointment booking and confirmation
- symptom submission and AI-based urgency detection
- access to consultation records, prescriptions, and history
- appointment reminder notifications

### Provider features
- provider availability and schedule management
- patient appointment review
- consultation start/end workflow
- digital prescription issuance
- medical history access and review
- patient communication during active consultations

### Admin features
- user and role management
- operational visibility
- usage analytics and platform monitoring
- system-level oversight across services

### Platform features
- JWT-based authentication
- role-based access control
- real-time consultation handling
- asynchronous message-driven processing
- cloud-ready Docker deployment
- centralized healthcare data persistence

---

## Database design

The application uses PostgreSQL as the system of record. The schema is designed around healthcare workflows and role-based access.

### Core tables

#### users
Stores shared identity data for every user.

| Column | Type | Description |
|---|---|---|
| user_id | UUID / PK | unique user identifier |
| name | VARCHAR | user's full name |
| email | VARCHAR | login identifier |
| phone | VARCHAR | contact number |
| password_hash | VARCHAR | encrypted password |
| role | VARCHAR | PATIENT / PROVIDER / ADMIN |
| is_verified | BOOLEAN | account verification status |
| device_token | VARCHAR | push notification token |
| created_at | TIMESTAMP | created date |
| updated_at | TIMESTAMP | last update date |

#### patients
Stores patient-specific data linked to users.

| Column | Type | Description |
|---|---|---|
| user_id | UUID / PK, FK | same identity as users.user_id |
| date_of_birth | DATE | date of birth |
| gender | VARCHAR | gender |
| blood_group | VARCHAR | blood type |
| address | TEXT | physical address |
| emergency_contact | JSONB | emergency contact info |

#### providers
Stores provider profile information.

| Column | Type | Description |
|---|---|---|
| user_id | UUID / PK, FK | provider identity |
| specialty | VARCHAR | medical specialty |
| license_number | VARCHAR | professional license |
| bio | TEXT | provider biography |
| consultation_fee | DECIMAL | consultation price |
| rating | DECIMAL | provider rating |
| is_active | BOOLEAN | active availability status |
| years_experience | INTEGER | experience level |

#### availability
Represents provider time slots.

| Column | Type | Description |
|---|---|---|
| slot_id | UUID / PK | unique slot identifier |
| provider_id | UUID / FK | associated provider |
| start_time | TIMESTAMPTZ | slot opening time |
| end_time | TIMESTAMPTZ | slot closing time |
| is_booked | BOOLEAN | whether slot has been reserved |

#### appointments
Represents patient-provider booking records.

| Column | Type | Description |
|---|---|---|
| appointment_id | UUID / PK | appointment identifier |
| patient_id | UUID / FK | patient |
| provider_id | UUID / FK | provider |
| slot_id | UUID / FK | assigned time slot |
| scheduled_at | TIMESTAMPTZ | scheduled date and time |
| status | VARCHAR | pending / confirmed / completed / cancelled |
| fee | DECIMAL | appointment fee |
| payment_status | VARCHAR | paid / pending / waived |

#### consultations
Stores consultation sessions linked to appointments.

| Column | Type | Description |
|---|---|---|
| consultation_id | UUID / PK | consultation ID |
| appointment_id | UUID / FK | linked appointment |
| video_room_id | VARCHAR | generated room key |
| started_at | TIMESTAMPTZ | consultation start time |
| ended_at | TIMESTAMPTZ | consultation end time |
| duration_minutes | INTEGER | session duration |
| notes | TEXT | clinician notes |
| diagnosis | TEXT | diagnosis summary |
| status | VARCHAR | waiting / in_progress / completed |

#### prescriptions
Stores digital prescriptions issued by providers.

| Column | Type | Description |
|---|---|---|
| prescription_id | UUID / PK | unique prescription |
| consultation_id | UUID / FK | linked consultation |
| issued_by | UUID / FK | provider who issued it |
| patient_id | UUID / FK | patient |
| medications | JSONB | list of prescribed medications |
| valid_until | DATE | expiry date |
| issued_at | TIMESTAMPTZ | issue timestamp |

#### symptom_reports
Stores symptom submissions and AI analysis results.

| Column | Type | Description |
|---|---|---|
| report_id | UUID / PK | unique report ID |
| patient_id | UUID / FK | patient |
| symptom_text | TEXT | raw symptom description |
| symptoms | JSONB | extracted symptom list |
| language | VARCHAR | language of submitted text |
| ai_urgency | VARCHAR | urgency classification |
| ai_pathway | VARCHAR | recommended care route |
| ai_confidence | DECIMAL | model confidence |
| ai_raw_response | JSONB | full AI result payload |
| created_at | TIMESTAMPTZ | report timestamp |

#### health_records
Stores structured patient health history.

| Column | Type | Description |
|---|---|---|
| record_id | UUID / PK | health record ID |
| patient_id | UUID / FK | patient identity |
| diagnoses | JSONB | diagnosis history |
| medications | JSONB | current medicine record |
| allergies | JSONB | allergy data |
| vitals | JSONB | health measurements |
| documents | JSONB | uploaded records |

#### notifications
Stores the delivery audit trail for all outbound messages.

| Column | Type | Description |
|---|---|---|
| notification_id | UUID / PK | unique notification record |
| user_id | UUID / FK | recipient |
| type | VARCHAR | event type |
| channel | VARCHAR | SMS / EMAIL / PUSH |
| message | TEXT | message body |
| status | VARCHAR | sent / failed / pending |
| retry_count | INTEGER | retry attempts |
| sent_at | TIMESTAMPTZ | delivery timestamp |
| metadata | JSONB | event-related metadata |

### Design notes
- `users` acts as the root identity table for all roles
- role-specific tables extend the core user identity
- `appointments` are central to the healthcare workflow
- `consultations` are linked to appointments in a one-to-one relationship
- `symptom_reports` are independent from appointments and can be submitted outside booking flow
- `notifications` serve as an audit system for outbound communication
- JSONB is used for flexible records such as allergies, vitals, symptoms, and metadata

---

## Security design

Security is a core part of the platform and was designed for a real healthcare workflow.

### Authentication flow
- user registers and verifies account identity
- password is stored using BCrypt hashing
- JWT tokens are issued on login
- refresh tokens are stored and validated in Redis
- refresh token rotation prevents replay attacks
- logout invalidates the active session token state

### Authorization model
- endpoints are protected based on role and permission requirements
- patient, provider, and admin flows are isolated by access control rules
- ownership checks ensure users can only access the data they are allowed to access

### Additional security practices
- environment-based configuration for credentials and secrets
- Redis-backed rate limiting for repeated failed authentication attempts
- service-level isolation for sensitive operations
- CORS configuration to restrict allowed origins

---

## Messaging and async workflows

The platform uses RabbitMQ for asynchronous communication to avoid blocking the main API on slow or unreliable external systems.

### Example flow
- appointment is created
- event is published to RabbitMQ
- notification consumer receives the message
- message is routed to the appropriate channel
- SMS, email, or push delivery is performed asynchronously

This pattern keeps the core application responsive and allows message retries and audit logging without degrading user-facing API performance.

---

## Real-time consultation flow

The platform enables real-time consultation using WebRTC, with a signaling server coordinating connection setup.

### Flow
1. patient and provider start a consultation session
2. backend creates or validates a consultation room
3. both users connect to the signaling server using JWT-authenticated Socket.IO clients
4. signaling server relays offers, answers, and ICE candidates between peers
5. direct peer-to-peer media connection is established
6. consultation status is updated in the backend when completed

This architecture keeps media traffic decentralized while still providing a reliable connection orchestration layer.

---

## Deployment architecture

The project is containerized with Docker Compose and includes separate services for each major application concern.

### Services in deployment
- `shcp-frontend`
- `shcp-api`
- `shcp-ai`
- `shcp-signaling`
- `shcp-db`
- `shcp-redis`
- `shcp-rabbitmq`
- `shcp-notifications`
- `shcp-coturn`

### Why this matters
This deployment strategy demonstrates a production-oriented approach to service separation and environment orchestration, which is highly relevant for engineering interviews and system design discussions.

---

## Tech decision rationale

### Why Spring Boot?
Spring Boot provides a strong foundation for enterprise application development, including REST APIs, security, data persistence, and modular service organization.

### Why Python for AI?
Python is highly effective for NLP and machine learning workflows, especially for symptom analysis, language processing, and AI-driven inference.

### Why RabbitMQ?
RabbitMQ decouples critical business actions from slower external notification systems and allows effective retry and queue-based processing.

### Why Redis?
Redis is used for fast, lightweight state management such as JWT refresh validation, OTP storage, rate limiting, and session-related support.

### Why WebRTC?
WebRTC enables peer-to-peer video communication with minimal server-side media processing, which makes it appropriate for real-time healthcare consultations.

---

## Business impact

The project is designed to solve a real-world healthcare problem rather than just demonstrate a technology stack. It supports a digital care workflow that can improve:

- patient access to medical services
- workflow efficiency for clinics and providers
- response time for urgent symptoms
- communication reliability between stakeholders
- operational monitoring and healthcare service management

---

## Future improvements

- improve AI triage model accuracy with larger clinical datasets
- add more granular analytics and dashboarding
- expand multi-language support
- strengthen compliance and audit workflows
- add CI/CD pipelines and automated deployment checks
- improve observability with centralized logging and monitoring

---

## Summary

SHCP is a healthcare platform built to demonstrate practical software engineering in a complex domain. It combines frontend development, backend architecture, data modeling, AI integration, security, message-driven processing, real-time communication, and deployment orchestration in a single cohesive system.

The project is strong for technical interviews and portfolio review because it showcases not only product thinking, but also engineering depth across architecture, infrastructure, and system design.
