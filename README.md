# SHCP - Smart Health Consultation Platform

A full-stack telemedicine platform built to improve healthcare access by connecting patients, providers, and administrators through a digital clinical workflow. The system supports appointment booking, AI-assisted symptom triage, consultation management, prescription workflows, real-time video communication, and notification delivery.

This project was developed to demonstrate a modern healthcare application built with a modular backend, a responsive frontend, AI-driven clinical support, and a scalable multi-service architecture.

---

## Why this project matters

Healthcare services often face delays, fragmented communication, and limited digital access. SHCP addresses this by creating a unified platform where:

- patients can book appointments and receive remote guidance
- providers can manage schedules and consultations digitally
- administrators can oversee operations and analytics
- AI can assist in triaging symptoms and prioritizing urgency
- notifications and reminders keep users informed in real time

The solution is designed to improve patient engagement, streamline clinic workflows, and support remote care delivery.

---

## Key capabilities

### Patient experience
- secure sign-up and login
- profile management
- provider browsing and availability lookup
- appointment booking and reminders
- AI-powered symptom analysis and urgency detection
- access to consultation history and digital prescriptions

### Provider workflow
- provider availability management
- appointment review and confirmation
- consultation initiation and completion
- online consultation coordination
- prescription issuance
- patient record and history review

### Administrative operations
- user and role management
- analytics and platform monitoring
- operational visibility across healthcare processes

### Real-time and messaging features
- WebRTC-based video consultation setup
- real-time signaling between users
- SMS, email, and push notifications
- async event-driven processing via messaging infrastructure

---

## Architecture overview

SHCP uses a hybrid architecture built for scalability and modularity:

- Core business logic in a Java Spring Boot application
- AI symptom analysis in a Python Flask microservice
- Real-time communication in a Node.js signaling server
- Messaging and notification processing with RabbitMQ and Spring Boot consumers
- Shared PostgreSQL database for transactional data
- Redis for auth/session-related support, OTP, and rate limiting
- Docker Compose for deployment and orchestration

### High-level system flow

```text
React Frontend
      |
      v
Spring Boot Core API
   |-- Auth & Users
   |-- Appointments
   |-- Consultations
   |-- Symptom Analysis
   |-- EHR & Prescriptions
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
- PostgreSQL
- JWT authentication

### AI and data processing
- Python
- Flask
- spaCy
- TensorFlow
- scikit-learn

### Real-time communication
- Node.js
- Socket.IO
- WebRTC

### Messaging and infrastructure
- RabbitMQ
- Redis
- Docker
- Docker Compose
- PostgreSQL 15

---

## Database design

The application uses PostgreSQL and follows a structured, role-based healthcare data model.

### Core tables
- `users`: shared identity and authentication table
- `patients`: patient-specific profile information
- `providers`: healthcare provider profile and specialization data
- `admins`: admin access and platform management data
- `availability`: provider time slots and booking windows
- `appointments`: booking and scheduling records
- `consultations`: consultation details and lifecycle status
- `prescriptions`: digital prescriptions and medication records
- `symptom_reports`: AI analysis submissions and urgency outcomes
- `health_records`: patient medical history and clinical data
- `notifications`: delivery logs and audit trails

### Design principles
- shared user identity across roles
- one-to-one role extension model
- strong scheduling and double-booking protections
- JSONB for flexible healthcare-related records
- event-driven notification processing

---

## Security and reliability

The project incorporates important production-style engineering practices:

- BCrypt password hashing
- JWT-based authentication and refresh token rotation
- Redis-backed token validation and rate limiting
- role-based access control at the API layer
- environment-based secrets and Docker secret handling
- health checks and service orchestration through Docker Compose

---

## What this project demonstrates

This repository showcases the ability to build and integrate:

- a resilient multi-service backend architecture
- a modern frontend application with a user-centered workflow
- AI-assisted healthcare decision support
- event-driven processing and async communication
- secure role-based access control
- operational infrastructure using Docker and cloud-ready services

It is especially relevant for roles involving:

- software engineering
- backend development
- full-stack engineering
- cloud and infrastructure work
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

## Running locally

### Prerequisites
- Docker Desktop
- Git
- Java 21
- Python 3.11
- Node.js

### Setup
```bash
cp .env.example .env
```

Then configure the required environment variables, including database, JWT, Redis, RabbitMQ, email credentials, and Firebase credentials.

### Start the platform
```bash
docker compose up --build -d
```

### Check status
```bash
docker compose ps
```

### Stop the platform
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

SHCP is a strong example of a production-style application that combines healthcare workflows, modern software engineering, and AI decision support in a single platform. It reflects practical software design decisions such as modularity, service isolation, asynchronous messaging, secure authentication, and scalable infrastructure.

This project is well suited for demonstrating technical depth, product thinking, and systems design on a portfolio or during interviews.

---

## Future improvements

- expand analytics and reporting dashboards
- improve AI triage models with clinical validation
- add multi-language patient support
- integrate stronger medical workflows and compliance controls
- add deployment automation and CI/CD pipelines

---

## Summary

SHCP is more than a demo project; it is a healthcare platform concept built to solve real operational challenges in digital care delivery. It combines frontend engineering, backend systems, AI integration, real-time communication, and cloud-style infrastructure in one cohesive solution.

The project was designed to reflect professional engineering practices and to communicate strong product thinking for software and technology roles.
