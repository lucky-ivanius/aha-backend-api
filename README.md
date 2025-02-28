# AHA Backend API

## Overview

This project is a backend API built with TypeScript that integrates with Clerk for authentication.

## Features

- User authentication (Clerk integration)
- User management
- Session handling with auto-expiry and revocation
- User statistics
- API documentation with Swagger UI

## Tech Stack

- **Language**: TypeScript
- **Framework**: Hono
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Clerk
- **Validation**: Zod
- **Logging**: Winston
- **Documentation**: Swagger UI

## API Endpoints

### Auth

- `POST /api/auth/signin`: Create a new session using Clerk token
- `POST /api/auth/signout`: End the current session

### Users

- `GET /api/users`: List all users
- `GET /api/users/me`: Get current user info
- `PATCH /api/users/me`: Update user profile
- `GET /api/users/stats`: User statistics
- `GET /api/users/password`: Password status
- `POST /api/users/password`: Set password
- `PUT /api/users/password`: Change password

### Sessions

- `GET /api/sessions`: List active sessions
- `DELETE /api/sessions/:sessionId`: Revoke a specific session

## Database Schema

- **Users**: Basic user information
- **Sessions**: Manages active user sessions
- **UserProviders**: Links users to authentication providers

## Environment Variables

```
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
ORIGINS=http://localhost:3000
MAX_USER_ACTIVE_SESSIONS=5

# Database
PG_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres

# Clerk Auth
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_JWKS_PUBLIC_KEY=your_clerk_jwks_public_key
CLERK_AUTHORIZED_PARTIES=your_clerk_authorized_parties
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Clerk account

### Setup

1. Clone the repository
2. Install dependencies:
   ```
   pnpm install
   ```
3. Create a `.env` file with the required environment variables
4. Run database migrations:
   ```
   pnpm drizzle-kit push
   ```
5. Start the server:
   ```
   pnpm dev
   ```

### Docker Setup

```
docker-compose up -d --build
```

## API Documentation

Once the server is running, access the Swagger UI documentation at:

```
http://localhost:3000/api/docs
```
