# Smart Health Consultation Platform (SHCP)
## System Architecture & Database Design Document

**Author:** Ndayizeye Ahmed | ID: 25735 | AUCA
**Version:** 1.0
**Date:** March 2026

----

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Classification](#2-architecture-classification)
3. [System Architecture Diagram](#3-system-architecture-diagram)
4. [Service Descriptions](#4-service-descriptions)
5. [Inter-Service Communication](#5-inter-service-communication)
6. [Database Design (ERD)](#6-database-design-erd)
7. [Table Definitions & Relationships](#7-table-definitions--relationships)
8. [Data Flow Walkthrough](#8-data-flow-walkthrough)
9. [Infrastructure & Deployment](#9-infrastructure--deployment)
10. [Security Architecture](#10-security-architecture)

---

## 1. Project Overview

The Smart Health Consultation Platform (SHCP) is an AI-powered telemedicine system designed for the Rwandan healthcare context. It connects patients with licensed healthcare providers through secure video consultations, AI-assisted symptom analysis, digital prescriptions, and multilingual communication (Kinyarwanda, English, French).

The platform serves three user roles:

| Role | Responsibilities |
|---|---|
| **Patient** | Book appointments, submit symptoms, attend consultations, receive prescriptions |
| **Healthcare Provider** | Manage availability, conduct consultations, issue prescriptions, view patient EHRs |
| **Administrator** | Monitor platform analytics, manage users, oversee system health |

---

## 2. Architecture Classification

### 2.1 Architecture Pattern: Modular Monolith + Polyglot Services

The SHCP backend uses a **hybrid architecture** that combines two well-established patterns:

**A. Modular Monolith (Java Spring Boot Core)**

The Spring Boot application contains all primary business domains within a single deployable JAR. Each domain is isolated by package (`rw.shcp.appointments`, `rw.shcp.consultations`, etc.) with no direct class imports across domain boundaries at the service layer. This is the correct approach for this project size — a full microservice decomposition per domain would require an API Gateway, service discovery, and distributed transaction management (Saga pattern) with no practical gain at this scale.

**B. True Microservices (Three Independent Services)**

Three genuine microservices run alongside the core, each in its own container, in its own language, with its own deployment lifecycle:

- **Python Flask AI Service** — symptom analysis and urgency classification
- **Node.js WebRTC Signaling Server** — real-time video consultation coordination
- **Notification Consumer** — asynchronous message delivery (SMS, email, push)

This pattern is commonly called **Macro-service Architecture** — coarser than pure microservices, but with clear deployment boundaries between functional areas.

### 2.2 Architecture Properties Summary

| Property | Value |
|---|---|
| Pattern | Modular Monolith + Polyglot Microservices |
| Primary language | Java 21 (Spring Boot 3.5) |
| Secondary languages | Python 3.11 (Flask 3.0), Node.js 20 (Socket.IO 4) |
| Database strategy | Shared PostgreSQL 15 for the Java core |
| Sync communication | REST over HTTP (Core → AI Service) |
| Async communication | RabbitMQ topic exchange (Core → Notification Consumer) |
| Real-time communication | WebSocket via Socket.IO (Client → Signaling Server) |
| Authentication | Stateless JWT (HS256), Redis-whitelisted refresh tokens |
| Deployment | Docker Compose — one container per service |

---

## 3. System Architecture Diagram

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                         CLIENT APPLICATIONS                               ║
║              (React Web App  /  Android  /  iOS Mobile App)               ║
╚══════════════════╤════════════════════════════════╤═══════════════════════╝
                   │                                │
          REST (HTTP/JSON)                   WebSocket (Socket.IO)
          Port 8080                          Port 3001
                   │                                │
                   ▼                                ▼
╔══════════════════════════════╗    ╔═══════════════════════════════════════╗
║   SPRING BOOT CORE API        ║    ║      NODE.JS SIGNALING SERVER         ║
║   (Modular Monolith)          ║    ║      (WebRTC Coordination)            ║
║   rw.shcp.*                   ║    ║                                       ║
║                               ║    ║  • JWT authentication on connect      ║
║  ┌─────────────────────────┐  ║    ║  • In-memory room registry (max 2)    ║
║  │  auth                   │  ║    ║  • Relays: offer / answer /           ║
║  │  ├─ JWT generation       │  ║    ║    ICE candidates between peers       ║
║  │  ├─ BCrypt (strength 12) │  ║    ║  • Broadcasts: peer-joined /         ║
║  │  ├─ OTP via email        │  ║    ║    peer-left on disconnect            ║
║  │  └─ Redis token store    │  ║    ║  • Health: GET /health               ║
║  │                          │  ║    ╚═══════════════════════════════════════╝
║  │  users                   │  ║
║  │  ├─ Patient profiles     │  ║    ╔═══════════════════════════════════════╗
║  │  ├─ Provider profiles    │  ║    ║      PYTHON FLASK AI SERVICE          ║
║  │  └─ Admin management     │  ║    ║      (Symptom Analysis)               ║
║  │                          │  ║    ║                                       ║
║  │  appointments            │  ║    ║  POST /analyze                        ║
║  │  ├─ Slot booking         │  ║    ║  ├─ Language detection (rw/en/fr)     ║
║  │  ├─ Double-booking guard │  ║    ║  ├─ spaCy NLP extraction              ║
║  │  └─ Cron reminders       │  ║    ║  ├─ Negation detection                ║
║  │                          │  ║    ║  ├─ TensorFlow urgency classifier     ║
║  │  consultations           │  ║    ║  ├─ Rule-based care pathway           ║
║  │  ├─ Room ID generation   │◄─╫────╫─ Graceful degradation (heuristic     ║
║  │  └─ Status lifecycle     │  ║    ║    fallback when TF unavailable)      ║
║  │                          │  ║HTTP║  GET /health                          ║
║  │  symptoms ───────────────╫──╫───►║                                       ║
║  │  prescriptions           │  ║    ╚═══════════════════════════════════════╝
║  │  ehr                     │  ║
║  │  notifications           │  ║
║  │  └─ Publisher (async)    │  ║
║  │  analytics               │  ║
║  └─────────────────────────┘  ║
╚══════════════════╤════════════╝
                   │ publishes events (async, fire-and-forget)
                   ▼
╔══════════════════════════════════════════════════════════════════════════╗
║                              RABBITMQ 3.13                                ║
║                    Topic Exchange: shcp.health.exchange                   ║
║                                                                           ║
║   Routing key pattern           Queue                    DLQ fallback     ║
║   ─────────────────────────     ──────────────────────   ──────────────   ║
║   notification.sms.#     ──►   shcp.notifications.sms  ──►  dlq          ║
║   notification.email.#   ──►   shcp.notifications.email ──►  dlq         ║
║   notification.push.#    ──►   shcp.notifications.push  ──►  dlq         ║
║                                                                           ║
╚══════════════════════════════════════╤═══════════════════════════════════╝
                                       │ consumes (separate JVM)
                                       ▼
╔══════════════════════════════════════════════════════════════════════════╗
║               NOTIFICATION CONSUMER (Standalone Spring Boot JAR)          ║
║                                                                           ║
║   SmsConsumer                EmailConsumer           PushConsumer         ║
║   └─► Africa's Talking       └─► SendGrid API        └─► Firebase FCM    ║
║       REST API (Rwanda)          (transactional         (Android/iOS)    ║
║                                   email)                                  ║
║                                                                           ║
║   • Retry policy: 3 attempts, exponential backoff (1s → 2s → 4s)        ║
║   • Failed after retries → Dead Letter Queue                              ║
║   • Every attempt (success or fail) logged to notifications table         ║
╚══════════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════════╗
║                         SHARED INFRASTRUCTURE                             ║
║                                                                           ║
║   ┌─────────────────────────────┐   ┌──────────────────────────────┐     ║
║   │      POSTGRESQL 15          │   │          REDIS 7              │     ║
║   │                             │   │                               │     ║
║   │  • 7 Flyway migrations      │   │  Refresh token whitelist      │     ║
║   │  • UUID primary keys        │   │   refresh_token:{uid}:{jti}   │     ║
║   │  • JSONB for flexible data  │   │                               │     ║
║   │  • GIN indexes on JSONB     │   │  OTP storage (TTL 10 min)     │     ║
║   │  • Trigger: auto updated_at │   │   otp:{email}                 │     ║
║   │  • CHECK constraints        │   │                               │     ║
║   │  • Unique booking guard     │   │  Rate limiting                │     ║
║   │                             │   │   login_attempts:{email}      │     ║
║   └─────────────────────────────┘   │   (5 attempts / 15 min)       │     ║
║                                     └──────────────────────────────┘     ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## 4. Service Descriptions

### 4.1 Spring Boot Core API

**Technology:** Java 21, Spring Boot 3.5, Spring Security 6, Spring Data JPA, Hibernate 6
**Port:** 8080
**Container:** `shcp-api`

This is the central service. All client HTTP requests (except WebRTC signaling) go here. It is a **modular monolith** — all domains share one JVM, one database connection pool, and one security context.

| Domain Package | Responsibility |
|---|---|
| `auth` | Register, login, email OTP verification, JWT issuance, refresh token rotation, forgot/reset password |
| `users` | Patient and provider profile CRUD, provider availability management |
| `appointments` | Slot search, booking (with double-booking guard), cancellation, rescheduling, 24h/1h cron reminders |
| `consultations` | Start/end video consultations, generate WebRTC room IDs, lifecycle transitions |
| `symptoms` | Submit symptom text to AI service, persist report, update EHR with urgency |
| `ehr` | Electronic Health Record — lazily created per patient, updated by prescriptions and symptoms |
| `prescriptions` | Issue digital prescriptions, link to consultations, update EHR medication history |
| `notifications` | Publish events to RabbitMQ (fire-and-forget, async), log delivery audit |
| `analytics` | Platform-wide stats for admins, per-provider stats, per-patient health summary |

### 4.2 Python Flask AI Service

**Technology:** Python 3.11, Flask 3.0, spaCy 3.7, TensorFlow 2.16, scikit-learn
**Port:** 5000
**Container:** `shcp-ai`

Receives raw symptom text from the Core API and returns structured urgency analysis. Operates completely independently — if it is unavailable, the Core API falls back to a degraded response and never crashes.

**Processing pipeline (POST /analyze):**
1. Validate input (length, language code, body_map structure)
2. Detect language if not specified (`langdetect` with heuristic fallback)
3. Extract symptoms via spaCy NER + keyword matching with negation detection
4. Merge body-map click data as additional symptom signals
5. Vectorize symptom list for TensorFlow model
6. Classify urgency: `EMERGENCY / URGENT / MODERATE / LOW / UNKNOWN`
7. Apply rule-based care pathway (specialist recommendation, self-care tips, follow-up days)
8. Return full structured response with confidence score

**Degradation strategy:** If TensorFlow is unavailable or model files are absent, the service switches automatically to a rule-based heuristic classifier and returns `"degraded": true` in the response.

### 4.3 Node.js WebRTC Signaling Server

**Technology:** Node.js 20, Express 4, Socket.IO 4
**Port:** 3001
**Container:** `shcp-signaling`

Coordinates WebRTC peer-to-peer video connections. It **does not carry audio/video data** — that flows directly between browsers via WebRTC. It only relays the negotiation messages.

**Signaling protocol:**

| Client → Server | Purpose |
|---|---|
| `join { roomId, token }` | Authenticate (validates Spring Boot JWT) and enter room (max 2 peers) |
| `offer { to, sdp }` | Forward WebRTC offer SDP to the other peer |
| `answer { to, sdp }` | Forward WebRTC answer SDP to the other peer |
| `ice-candidate { to, candidate }` | Forward ICE connectivity candidate |
| `leave` | Deregister from room |

| Server → Client | Purpose |
|---|---|
| `joined { roomId, peers }` | Confirms join, returns existing peers in room |
| `peer-joined { userId, role, socketId }` | Notifies when second participant connects |
| `peer-left { socketId }` | Notifies on disconnect or leave |
| `error { message }` | JWT invalid, room full, missing parameters |

### 4.4 Notification Consumer

**Technology:** Java 21, Spring Boot 3.5 (standalone JAR)
**Container:** `shcp-notifications`

A completely separate Spring Boot application that shares no code with the Core API. It has its own `main()` class, its own `pom.xml`, and its own `Dockerfile`. It:

- Listens to three RabbitMQ queues
- Looks up the user's phone, email, or device token from the shared PostgreSQL database
- Delivers via Africa's Talking (SMS), SendGrid (email), or Firebase FCM (push)
- Retries up to 3 times with exponential backoff on failure
- Routes exhausted messages to the Dead Letter Queue for investigation
- Writes an audit record to `notifications` table after every delivery attempt

**Why it is separate from the Core API:** The Core API must respond to HTTP requests in milliseconds. Waiting for an SMS gateway or email provider (which can take seconds and may fail) would degrade the user experience. By publishing to RabbitMQ and having a separate consumer, the two concerns are fully decoupled. The Core API does not care whether the SMS was delivered.

---

## 5. Inter-Service Communication

### 5.1 Core API → AI Service (Synchronous REST)

```
AppointmentService / SymptomService
         │
         │  POST http://ai-service:5000/analyze
         │  Content-Type: application/json
         │  Body: { "symptom_text": "...", "language": "en", "body_map_data": {...} }
         │
         ▼
    Python Flask AI Service
         │
         │  Response (snake_case JSON):
         │  { "urgency_level": "URGENT", "confidence": 0.87,
         │    "degraded": false, "extracted_symptoms": [...],
         │    "recommended_action": "...", "self_care_tips": [...] }
         │
         ▼
    SymptomService (Java)
    • Wraps call in try-catch
    • On ResourceAccessException (timeout >5s): returns degraded response
    • On any exception: returns degraded response
    • Never propagates AI failure to the HTTP response
```

**Configuration:** Dedicated `RestTemplate` bean with snake_case `ObjectMapper`, 2s connect timeout, 5s read timeout.

### 5.2 Core API → Notification Consumer (Asynchronous RabbitMQ)

```
Any Service (AppointmentService, ConsultationService, PrescriptionService...)
         │
         │  notificationPublisher.publish(NotificationEvent.sms(userId, eventType, message, meta))
         │  @Async — returns immediately, runs in thread pool
         │
         ▼
    NotificationPublisher
         │  rabbitTemplate.convertAndSend(EXCHANGE, routingKey, event)
         │  Routing key format: "notification.{channel}.{eventType}"
         │  Example:            "notification.sms.appointment.confirmed"
         │
         ▼
    RabbitMQ Topic Exchange: shcp.health.exchange
         │
         ├──► shcp.notifications.sms   ──► SmsConsumer   → Africa's Talking
         ├──► shcp.notifications.email ──► EmailConsumer → SendGrid
         └──► shcp.notifications.push  ──► PushConsumer  → Firebase FCM
```

**Failure isolation:** If RabbitMQ is unavailable, `NotificationPublisher` logs the error and returns. The calling service completes successfully. Notifications are best-effort.

### 5.3 Client → Signaling Server (WebSocket / Socket.IO)

The browser establishes a persistent WebSocket connection to the signaling server only when entering a consultation room. The room ID is obtained from the Core API (`POST /api/consultations`) beforehand. JWT token validation on `join` ensures only the authenticated patient and their assigned provider can enter the room.

---

## 6. Database Design (ERD)

```
╔══════════════════════════════════════════════════════════════════════════╗
║                                  USERS                                    ║
║                                                                           ║
║  user_id UUID PK  │  name VARCHAR(100)  │  email VARCHAR(150) UNIQUE     ║
║  phone VARCHAR(20)│  role VARCHAR(20)   │  password_hash VARCHAR(255)    ║
║  is_verified BOOL │  language_pref      │  device_token VARCHAR(500)     ║
║  created_at TSTZ  │  updated_at TSTZ    │                                ║
║                                                                           ║
║  CHECK: role IN ('PATIENT', 'PROVIDER', 'ADMIN')                         ║
╚══════════════╤══════════════════┬═══════════════════════════════════════╝
               │                  │                          │
    ON DELETE CASCADE   ON DELETE CASCADE          ON DELETE CASCADE
               │                  │                          │
    ┌──────────▼──┐    ┌──────────▼──────────┐    ┌─────────▼──┐
    │  PATIENTS   │    │      PROVIDERS       │    │   ADMINS   │
    │             │    │                      │    │            │
    │ PK/FK       │    │ PK/FK user_id        │    │ PK/FK      │
    │  user_id    │    │ specialty VARCHAR     │    │  user_id   │
    │ date_of_    │    │ license_number UNIQUE │    │ department │
    │  birth DATE │    │ bio TEXT             │    │ created_at │
    │ gender      │    │ languages JSONB[]    │    └────────────┘
    │ blood_group │    │ consultation_fee     │
    │ address     │    │ rating DECIMAL(3,2)  │
    │ emergency_  │    │ is_active BOOLEAN    │
    │  contact    │    │ years_experience     │
    │  JSONB      │    └──────────┬───────────┘
    └──────┬──────┘               │
           │                      │ 1 provider : many slots
           │ 1:1                  │
           │                      ▼
    ┌──────▼──────────┐  ┌────────────────────────────┐
    │  HEALTH_RECORDS │  │        AVAILABILITY         │
    │                 │  │         (time slots)         │
    │ PK record_id    │  │                              │
    │ FK patient_id   │  │  PK slot_id UUID             │
    │                 │  │  FK provider_id              │
    │ diagnoses       │  │  start_time TIMESTAMPTZ      │
    │   JSONB[]       │  │  end_time   TIMESTAMPTZ      │
    │ medications     │  │  is_booked  BOOLEAN          │
    │   JSONB[]       │  │  appointment_type            │
    │ allergies       │  │                              │
    │   JSONB[]       │  │  UNIQUE(provider_id,         │
    │ vitals JSONB    │  │         start_time)          │
    │ immunizations   │  │  CHECK(end_time > start_time)│
    │   JSONB[]       │  └────────────┬─────────────────┘
    │ lab_results     │               │
    │   JSONB[]       │               │ FK slot_id (nullable)
    │ documents       │               │
    │   JSONB[]       │               │
    │                 │  ┌────────────▼──────────────────────────────────┐
    │ UNIQUE(         │  │                APPOINTMENTS                    │
    │  patient_id)    │  │                                                │
    └─────────────────┘  │  PK  appointment_id UUID                      │
           ▲             │  FK  patient_id  ─────────────── PATIENTS     │
           │             │  FK  provider_id ─────────────── PROVIDERS    │
           │             │  FK  slot_id     ─────────────── AVAILABILITY │
    reads  │             │      scheduled_at TIMESTAMPTZ                  │
    from   │             │      type    CHECK('VIDEO','FOLLOWUP','URGENT')│
    EHR    │             │      status  CHECK('PENDING','CONFIRMED',      │
           │             │              'IN_PROGRESS','COMPLETED',        │
           │             │              'CANCELLED','NO_SHOW')            │
           │             │      fee DECIMAL(10,2)                         │
           │             │      payment_status CHECK('PENDING','PAID',    │
           │             │                     'WAIVED','REFUNDED')       │
           │             │      cancellation_reason TEXT                  │
           │             │      created_at TIMESTAMPTZ                    │
           │             │                                                │
           │             │  UNIQUE(provider_id, scheduled_at)            │
           │             │   ← double-booking guard at DB level           │
           │             └───────────────────┬────────────────────────────┘
           │                                 │
           │                                 │ 1 appointment : 1 consultation
           │                                 │ ON DELETE CASCADE
           │                                 ▼
           │             ┌───────────────────────────────────────────────┐
           │             │              CONSULTATIONS                     │
           │             │                                                │
           │             │  PK  consultation_id UUID                     │
           │             │  FK  appointment_id UNIQUE  ← enforces 1:1   │
           │             │      video_room_id VARCHAR(100)               │
           │             │      started_at  TIMESTAMPTZ                  │
           │             │      ended_at    TIMESTAMPTZ                  │
           │             │      duration_minutes INTEGER                  │
           │             │      notes TEXT                               │
           │             │      diagnosis TEXT                           │
           │             │      recording_url VARCHAR(500)               │
           │             │      status CHECK('WAITING','IN_PROGRESS',    │
           │             │               'COMPLETED','ABANDONED')        │
           │             └───────────────────┬────────────────────────────┘
           │                                 │
           │                                 │ 1 consultation : many prescriptions
           │                                 ▼
           │             ┌───────────────────────────────────────────────┐
           └─────────────┤            PRESCRIPTIONS                      │
                         │                                                │
                         │  PK  prescription_id UUID                     │
                         │  FK  consultation_id ──── CONSULTATIONS       │
                         │  FK  issued_by ────────── PROVIDERS           │
                         │  FK  patient_id ───────── PATIENTS            │
                         │      medications JSONB[]                       │
                         │       [{ name, dosage, frequency,             │
                         │          durationDays }]                       │
                         │      interaction_alerts JSONB[]               │
                         │      digital_signature TEXT                    │
                         │      pharmacy_status CHECK('PENDING',         │
                         │       'DISPENSED','REJECTED',                  │
                         │       'REFILL_REQUESTED')                      │
                         │      valid_until DATE                          │
                         │      issued_at TIMESTAMPTZ                     │
                         └────────────────────────────────────────────────┘


    ┌──────────────────────────────────────────────────────────────────┐
    │                       SYMPTOM_REPORTS                             │
    │   (independent of appointments — patient can submit anytime)     │
    │                                                                   │
    │  PK  report_id UUID                                              │
    │  FK  patient_id ─────────────────────────────── PATIENTS        │
    │      symptoms JSONB[]    ← canonical symptom ids extracted       │
    │      body_map_data JSONB ← which body regions patient clicked    │
    │      symptom_text TEXT   ← original raw input                    │
    │      language VARCHAR(5) ← rw / en / fr                         │
    │      ai_urgency  CHECK('EMERGENCY','URGENT','ROUTINE',           │
    │                         'SELF_CARE','UNKNOWN')                    │
    │      ai_pathway VARCHAR(50)                                       │
    │      ai_confidence DECIMAL(5,2)                                   │
    │      ai_raw_response JSONB  ← full Flask response (audit trail)  │
    │      created_at TIMESTAMPTZ                                       │
    └──────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────────────┐
    │                        NOTIFICATIONS                              │
    │           (written by notification-consumer after delivery)       │
    │                                                                   │
    │  PK  notification_id UUID                                        │
    │  FK  user_id ────────────────────────────────── USERS           │
    │      type    VARCHAR(50)  ← event name e.g. "appointment.confirmed"│
    │      channel VARCHAR(10)  ← SMS / EMAIL / PUSH                   │
    │      message TEXT                                                 │
    │      status  CHECK('PENDING','SENT','FAILED','DEAD_LETTERED')    │
    │      retry_count INTEGER                                          │
    │      sent_at TIMESTAMPTZ                                          │
    │      error_detail TEXT                                            │
    │      metadata JSONB  ← appointmentId, consultationId, etc.       │
    │      created_at TIMESTAMPTZ                                       │
    └──────────────────────────────────────────────────────────────────┘
```

---

## 7. Table Definitions & Relationships

### 7.1 `users` — Identity Root

The central table. Every person on the platform has exactly one row here regardless of role. The `role` column determines which of the three sub-tables (`patients`, `providers`, `admins`) also has a row for them.

**Key constraints:**
- `email` is `UNIQUE` — used as the authentication identifier
- `role CHECK` prevents invalid roles at the database level
- `set_updated_at()` trigger fires on every UPDATE to maintain `updated_at` accurately
- `device_token` stores the FCM registration token for push notifications

### 7.2 `patients` / `providers` / `admins` — Role Sub-Tables

These tables use the **Shared Primary Key** pattern (also called Table-Per-Subclass):

```
patients.user_id = users.user_id   (not a foreign key that references, it IS the PK)
```

This means:
- There is no separate auto-generated patient ID
- Querying a patient's full profile is a single JOIN on `user_id`
- Deleting a `users` row automatically deletes the sub-table row via `ON DELETE CASCADE`
- A `users` row can only have ONE sub-table row (enforced by the shared PK)

In JPA this is implemented with `@MapsId` on the `Patient` and `Provider` entities.

### 7.3 `health_records` — One-to-One with Patient

`UNIQUE(patient_id)` enforces one EHR per patient at the database level. All clinical data columns are `JSONB` arrays to accommodate the flexible, evolving nature of medical records without schema migrations for each new field type.

The EHR is **lazily created** — it does not exist when a patient registers. It is created on first access (first symptom submission or first prescription). This avoids creating empty records for patients who never complete a consultation.

**JSONB fields and their purpose:**

| Column | Content |
|---|---|
| `diagnoses` | Array of diagnosis objects from consultations |
| `medications` | Array of current medications — updated on each new prescription |
| `allergies` | Known allergies entered by patient or recorded by provider |
| `vitals` | Latest vitals object (blood pressure, heart rate, weight, etc.) |
| `immunizations` | Vaccination history |
| `lab_results` | References to lab test results |
| `documents` | References to uploaded files (X-rays, reports) |

### 7.4 `availability` — Provider Schedule

Providers declare available time windows. Each row is one bookable slot.

**Key constraints:**
- `UNIQUE(provider_id, start_time)` prevents a provider from having two slots at the same time
- `CHECK(end_time > start_time)` prevents zero-duration or negative slots
- `is_booked` is flipped to `true` when an appointment claims the slot and back to `false` on cancellation

### 7.5 `appointments` — The Central Join

The appointment is the primary business transaction of the platform. It connects a patient, a provider, and an availability slot.

**Double-booking protection operates at two levels:**
1. Application level: `AppointmentService` checks `existsByProviderUserIdAndScheduledAt` before inserting
2. Database level: `UNIQUE(provider_id, scheduled_at)` rejects the INSERT even if the application check fails due to a race condition

**Status lifecycle:**
```
PENDING ──► CONFIRMED ──► IN_PROGRESS ──► COMPLETED
                │                              ▲
                └──► CANCELLED                 │
                └──► NO_SHOW ─────────────────┘
```

### 7.6 `consultations` — One-to-One with Appointment

`UNIQUE(appointment_id)` enforces that one appointment produces at most one consultation. The `video_room_id` is a UUID string generated by the Core API and passed to the signaling server as the room identifier.

**Status lifecycle:**
```
WAITING ──► IN_PROGRESS ──► COMPLETED
                └──────────► ABANDONED
```

### 7.7 `prescriptions` — Many-to-One with Consultation

A single consultation can produce multiple prescriptions (e.g., one for antibiotics and one for pain relief, or a revised prescription at a follow-up). The `medications` JSONB array contains the full list:

```json
[
  { "name": "Amoxicillin", "dosage": "500mg", "frequency": "3x/day", "durationDays": 7 },
  { "name": "Paracetamol", "dosage": "1000mg", "frequency": "as needed", "durationDays": 5 }
]
```

When a prescription is issued, the Core API also appends these medications to the patient's `health_records.medications` JSONB array — keeping the EHR current automatically.

### 7.8 `symptom_reports` — Independent Patient Input

Symptom reports are not linked to appointments. A patient can submit symptoms at any time — before booking, in the middle of the night, or after a consultation. The AI analysis result is stored in full in `ai_raw_response JSONB` to provide a complete audit trail and allow re-analysis if the AI model improves.

### 7.9 `notifications` — Delivery Audit Log

Every delivery attempt by the notification consumer is written here — successes and failures. This table is read-only from the Core API's perspective (used by `AnalyticsService`). It is written by the `notification-consumer` service. The `metadata JSONB` column stores event-specific context (e.g., `appointmentId`, `consultationId`) for debugging and admin review.

---

## 8. Data Flow Walkthrough

### 8.1 Patient Books an Appointment

```
1. Patient: GET  /api/providers               → browse available providers
2. Patient: GET  /api/providers/{id}/availability → see open slots
3. Patient: POST /api/appointments            → book a slot
   AppointmentService:
     a. Verify slot exists and is not booked
     b. Check no double-booking (DB unique constraint)
     c. Mark slot is_booked = true
     d. Create appointment (status = CONFIRMED)
     e. Publish NotificationEvent.email → "appointment.confirmed"
     f. Publish NotificationEvent.sms  → "appointment.confirmed"
4. RabbitMQ delivers to EmailConsumer → SendGrid sends confirmation email
5. RabbitMQ delivers to SmsConsumer  → Africa's Talking sends SMS
```

### 8.2 Patient Submits Symptoms

```
1. Patient: POST /api/symptoms/analyze
   SymptomService:
     a. Calls POST http://ai-service:5000/analyze (timeout 5s)
     b. If AI responds: parse urgency, pathway, symptoms
     c. If AI times out: use degraded response (UNKNOWN urgency)
     d. Persist SymptomReport with full ai_raw_response
     e. Update patient's health_records.vitals with latest urgency
     f. Return SymptomReportDto to patient
```

### 8.3 Provider Starts Video Consultation

```
1. Provider: POST /api/consultations          → start consultation
   ConsultationService:
     a. Verify appointment is CONFIRMED and owned by this provider
     b. Check no existing consultation for this appointment
     c. Transition appointment status → IN_PROGRESS
     d. Generate video_room_id (UUID)
     e. Create consultation (status = IN_PROGRESS)
     f. Publish push notification to patient: "consultation.started"

2. Both peers (patient + provider) connect to signaling server:
   Client: socket.emit("join", { roomId: video_room_id, token: jwt })
   Signaling: validates JWT → adds to room → broadcasts peer-joined

3. WebRTC negotiation via signaling server:
   Provider: emit("offer", { to: patientSocketId, sdp: ... })
   Patient:  receives "offer", creates answer
   Patient:  emit("answer", { to: providerSocketId, sdp: ... })
   Both:     exchange ICE candidates
   Result:   peer-to-peer video/audio connection established

4. Provider: PUT /api/consultations/{id}/end  → end consultation
   ConsultationService:
     a. Record ended_at, calculate duration_minutes
     b. Transition status → COMPLETED
     c. Transition appointment status → COMPLETED
     d. Publish notifications to patient
```

### 8.4 Appointment Reminder (Scheduled)

```
Every 15 minutes (cron: 0 */15 * * * *):
  AppointmentReminderScheduler.send24HourReminders()
  → Query appointments WHERE scheduled_at BETWEEN now+23h45m AND now+24h15m
    AND status = 'CONFIRMED'
  → For each: publish NotificationEvent.sms (appointment.reminder.24h)

Every 5 minutes (cron: 0 */5 * * * *):
  AppointmentReminderScheduler.send1HourReminders()
  → Query appointments WHERE scheduled_at BETWEEN now+45m AND now+75m
    AND status = 'CONFIRMED'
  → For each: publish NotificationEvent.sms  (appointment.reminder.1h)
              publish NotificationEvent.push (appointment.reminder.1h)
```

---

## 9. Infrastructure & Deployment

### 9.1 Docker Compose Services

| Container | Image | Port | Role |
|---|---|---|---|
| `shcp-api` | Custom (Java 21 JRE) | 8080 | Core API |
| `shcp-ai` | Custom (Python 3.11 slim) | 5000 | AI microservice |
| `shcp-signaling` | Custom (Node.js 20 alpine) | 3001 | WebRTC signaling |
| `shcp-notifications` | Same JAR as API | — | Notification consumer |
| `shcp-db` | postgres:15-alpine | 5432 | Primary database |
| `shcp-redis` | redis:7-alpine | 6379 | Cache / token store |
| `shcp-rabbitmq` | rabbitmq:3.13-management | 5672 / 15672 | Message broker |

All containers share `shcp-net` (bridge network) and communicate by container name (DNS). No container is accessible from outside except through the declared port mappings.

### 9.2 Database Migrations (Flyway)

| Version | Description |
|---|---|
| V1 | `users` table + `set_updated_at()` trigger |
| V2 | `patients`, `providers`, `admins` sub-tables |
| V3 | `health_records`, `availability`, `appointments` |
| V4 | `consultations`, `symptom_reports`, `prescriptions` |
| V5 | `notifications` table |
| V6 | B-tree and GIN indexes for performance |
| V7 | `metadata JSONB` column on `notifications` |

Flyway runs automatically on API startup. If a migration fails, the application refuses to start, preventing schema drift.

### 9.3 Health Checks

Every container defines a Docker health check:
- `shcp-api`: `curl -f http://localhost:8080/actuator/health`
- `shcp-ai`: `curl -f http://localhost:5000/health`
- `shcp-signaling`: `wget -qO- http://localhost:3001/health`
- `shcp-db`: `pg_isready -U shcp_user -d shcp`
- `shcp-redis`: `redis-cli ping`
- `shcp-rabbitmq`: `rabbitmq-diagnostics ping`

Dependent services (`shcp-api`, `shcp-notifications`) only start after their dependencies pass health checks via `condition: service_healthy`.

---

## 10. Security Architecture

### 10.1 Authentication Flow

```
Register → Email OTP (6-digit, stored in Redis, TTL 10 min)
         → Verify OTP → Account enabled

Login    → BCrypt(strength=12) password check
         → Rate limit: 5 failed attempts per 15 min (Redis counter)
         → On success: issue ACCESS token (15 min) + REFRESH token (7 days)

ACCESS token claims: { userId, email, role, isVerified, type:"ACCESS" }
REFRESH token claims: { userId, jti(UUID), type:"REFRESH" }

Refresh  → Validate REFRESH token signature and type
         → Check jti exists in Redis whitelist
         → Delete old jti from Redis (rotation)
         → Issue new ACCESS + REFRESH token pair

Logout   → Delete jti from Redis → refresh token immediately invalidated

Reset    → Pattern-scan Redis for all refresh_token:{userId}:* keys
         → Delete all → all sessions invalidated on password change
```

### 10.2 Authorization

- All endpoints except `/api/auth/**`, `/api/docs/**`, `/actuator/health` require a valid `Authorization: Bearer <access_token>` header
- Method-level security (`@PreAuthorize`) enforces role-based access:
  - `hasRole('PROVIDER')` on `start consultation`, `end consultation`, `issue prescription`
  - `hasRole('ADMIN')` on analytics overview endpoints
- Ownership checks in service layer: a patient cannot read another patient's EHR, a provider cannot end another provider's consultation
- The signaling server independently validates the same JWT — it does not trust any other input

### 10.3 Data Protection

| Concern | Approach |
|---|---|
| Passwords | BCrypt strength 12 — never stored in plaintext |
| JWT secret | 256-bit minimum, stored in environment variable / Docker secret |
| Database credentials | Environment variables, never in source code |
| FCM credentials | Mounted as Docker secret volume (`/run/secrets/`) |
| CORS | Allowlist-only, configured via `FRONTEND_URL` environment variable |
| SQL injection | Prevented by JPA/Hibernate parameterised queries — no raw SQL |
| Rate limiting | Redis-backed login throttle (5 attempts / 15 min per email) |

---

*Document generated from source code analysis of the SHCP-Backend, ai-service, signaling, and notification-consumer modules.*
