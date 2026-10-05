# SHCP - Smart Health Consultation Platform

A full-stack telemedicine and healthcare management platform designed to improve access to healthcare through digital consultation workflows. SHCP connects patients, providers, and administrators in a single system that supports appointment booking, remote consultation, AI-assisted symptom triage, prescription management, and automated notifications.

The platform was built to demonstrate professional software engineering practices in a healthcare context, combining a modern frontend, a modular backend, multi-service architecture, and secure data handling.

---

## Project vision

Healthcare delivery is often slowed by fragmented communication, delayed access to providers, and inefficient manual workflows. SHCP addresses these challenges by creating a unified digital healthcare platform that streamlines patient care and operational coordination.

The solution is designed to:

- simplify appointment booking and scheduling
- enable remote consultation between patients and providers
- support AI-based urgency assessment for symptom reports
- centralize patient records and prescriptions
- improve patient engagement through reminders and notifications
- provide a scalable architecture for real-world healthcare systems

---

## Core features

### Patient features
- secure registration and login
- profile management
- provider search and availability view
- appointment booking and scheduling
- AI-powered symptom analysis and urgency detection
- consultation history and digital medical records
- prescription access and follow-up reminders

### Provider features
- provider profile and availability management
- appointment review and confirmation
- consultation lifecycle management
- prescription issuance
- patient history review and clinical workflow support
- digital communication with patients during consultations

### Administrative features
- user and role management
- system monitoring and operational oversight
- analytics and reporting support
- healthcare workflow visibility across the platform

### Platform features
- JWT-based authentication and authorization
- WebRTC-based video consultation setup
- real-time signaling via Socket.IO
- notification delivery through SMS, email, and push channels
- event-driven communication with RabbitMQ
- Docker-based deployment and service orchestration

---

## Architecture

SHCP follows a hybrid architecture that combines a modular monolith with independent supporting services.

### Components
- Core backend: Java + Spring Boot
- Frontend: React + Vite
- AI service: Python + Flask
- Real-time signaling: Node.js + Socket.IO
- Database: PostgreSQL
- Cache and token storage: Redis
- Message broker: RabbitMQ
- Deployment: Docker Compose

### High-level architecture

```text
React Frontend
      |
      v
Spring Boot Core API
   |-- Authentication
   |-- Users & Roles
   |-- Appointments
   |-- Consultations
   |-- Symptoms & EHR
   |-- Prescriptions
   |-- Notifications
   |
   +--> Python AI Service
   +--> Node.js Signaling Server
   +--> RabbitMQ
            |
            v
   Notification Consumer
            |
            +--> SMS / Email / Push
```

This design decouples business logic, AI processing, real-time communication, and notifications while preserving a shared data layer and centralized user management.

---

## Technology stack

### Frontend
- React
- Vite
- TypeScript
- Material UI / Emotion
- Axios
- Firebase integration support

### Backend
- Java 21
- Spring Boot 3.x
- Spring Security
- Spring Data JPA / Hibernate
- PostgreSQL JDBC
- JWT

### AI and analytics
- Python
- Flask
- spaCy
- TensorFlow
- scikit-learn

### Real-time communication
- Node.js
- Express
- Socket.IO
- WebRTC

### Messaging and infrastructure
- Redis
- RabbitMQ
- Docker
- Docker Compose
- PostgreSQL 15

---

## Data model

The project uses PostgreSQL with a role-based healthcare data model.

### Key entities
- `users` — shared identity and authentication data
- `patients` — patient profile and record information
- `providers` — medical provider profile and specialization data
- `admins` — administrative user records
- `availability` — provider schedule/time slots
- `appointments` — patient-provider booking records
- `consultations` — consultation session details
- `prescriptions` — digital prescriptions issued after consultation
- `symptom_reports` — symptom input and AI assessment results
- `health_records` — patient medical history and related structured data
- `notifications` — delivery activity and message audit log

### Design principles
- shared identity model across user roles
- role-based data extension using one-to-one relationships
- strong appointment scheduling controls and double-booking protection
- JSONB for flexible healthcare data structures
- event-driven notification processing

---

## Security and reliability

The platform incorporates production-oriented engineering practices to support secure operation:

- BCrypt password hashing
- JWT-based authentication and token rotation
- Redis-backed refresh token and rate-limit enforcement
- role-based access control
- environment-based secret management
- health checks for running services
- Docker Compose orchestration for scalable local deployment

---

## Why this project is relevant for jobs

SHCP is a strong example of a full-stack software solution that combines product thinking, backend engineering, AI integration, and systems design. It demonstrates practical skills in:

- building modular and maintainable backend services
- integrating frontend and backend systems
- developing real-time communication features
- implementing secure authentication and authorization
- working with event-driven architectures
- deploying multi-service applications with Docker
- designing domain-driven healthcare workflows

This makes the project highly relevant for roles in:

- software engineering
- full-stack development
- backend engineering
- cloud and infrastructure
- AI-integrated product development
- healthcare technology systems

---

## Repository structure

```text
shcp/
├── .env.example
├── .github/
├── README.md
├── RUNNING.md
├── SEEDED_ACCOUNTS.md
├── docker-compose.yml
├── docs/
│   └── SHCP-Architecture-and-ERD.md
├── SHCP-Backend/
├── SHCP-Frontend/
├── ai-service/
├── notification-consumer/
├── signaling/
├── coturn/
├── secrets/
└── ...
```

---

## Local setup

### Prerequisites
- Docker Desktop
- Git
- Java 21
- Python 3.11
- Node.js

### Environment configuration
Create a `.env` file based on `.env.example` and configure the necessary values for:

- database credentials
- JWT secret
- Redis password
- RabbitMQ password
- email credentials
- Firebase credentials
- TURN server configuration

### Run the project
```bash
docker compose up --build -d
```

### Check status
```bash
docker compose ps
```

### Stop the project
```bash
docker compose down
```

---

## Access points

| Service | URL |
|--------|-----|
| Frontend | http://localhost |
| Backend API | http://localhost:8082 |
| API Health | http://localhost:8082/actuator/health |
| Signaling Server | http://localhost:3001/health |

---

## Project impact

SHCP demonstrates a realistic healthcare platform built with modern engineering practices and multi-service architecture. It combines patient-centered functionality with strong technical implementation, making it a compelling project to present in a portfolio, job application, or technical interview.

It reflects not only development capability, but also system thinking, architectural awareness, and the ability to build products that solve real-world problems.

---

## Future growth

Potential next steps include:

- expanding analytics and reporting dashboards
- improving triage accuracy with richer AI models
- adding multilingual support for local healthcare contexts
- enhancing compliance and security controls
- setting up CI/CD and deployment automation

---

## Summary

SHCP is a healthcare technology platform that brings together modern software engineering, AI-driven clinical support, and real-time communication in a single product. It showcases the ability to build scalable systems with meaningful user value, which is highly relevant for software and product-focused career opportunities.
