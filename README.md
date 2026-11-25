# DevReview AI

An AI-powered code review and documentation platform. Upload a code snippet, get instant analysis covering style, complexity, potential bugs, and auto-generated documentation — all in one place.

---

## Features

- **AI Code Review** — Automated analysis of code quality, style, and complexity via Google Gemini (or a local mock for development)
- **User Authentication** — Register and login with JWT-based sessions
- **Snippet Management** — Save, list, view, and delete your code snippets
- **Documentation Generation** — Auto-generated JSDoc/comments and unit test stubs per snippet
- **Code Structure Graph** — Visual representation of code structure from the review result
- **Protected Routes** — All snippet and review endpoints require authentication

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, React Router, Bootstrap 5 |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL 16 (via Prisma ORM) |
| Auth | bcryptjs + JWT |
| AI | Google Gemini API (mock provider available) |
| Containerization | Docker & Docker Compose |

---

## Project Structure

```
Dev_Review_DEPI/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma        # DB models: User, Snippet, Review, Documentation
│   ├── src/
│   │   ├── middleware/
│   │   │   └── auth.ts          # JWT auth middleware
│   │   ├── routes/
│   │   │   └── snippets.ts      # Snippet & review REST endpoints
│   │   ├── services/
│   │   │   ├── auth.service.ts  # Register/login logic
│   │   │   └── ai/              # AI provider abstraction (Gemini + mock)
│   │   ├── lib/
│   │   │   └── prisma.ts        # Prisma client singleton
│   │   └── server.ts            # Express app entry point
│   └── .env.example
├── frontend/
│   └── src/
│       ├── Components/          # React components (Login, Register, Dashboard, etc.)
│       ├── context/             # Auth context & provider
│       ├── services/            # API client helpers
│       └── types/               # Shared TypeScript types
├── docker-compose.yml
└── README.md
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Docker](https://www.docker.com/) and Docker Compose

---

### Option A — Docker (Recommended)

Runs the full stack (database, backend, frontend) with a single command.

1. **Clone the repo**
   ```bash
   git clone https://github.com/1YoussefQenawy/Dev_Review_DEPI.git
   cd Dev_Review_DEPI
   ```

2. **Configure environment** (optional — defaults work out of the box with the mock AI provider)
   ```bash
   cp backend/.env.example .env
   # Edit .env if you want to use Gemini instead of the mock provider
   ```

3. **Start everything**
   ```bash
   docker compose up --build
   ```

4. **Open the app**
   - Frontend: http://localhost
   - Backend API: http://localhost:5000

---

### Option B — Local Development

#### Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in DATABASE_URL and JWT_SECRET in .env
npx prisma migrate dev
npm run dev
```

The backend runs on `http://localhost:5000`.

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

---

## Environment Variables

Create `backend/.env` based on `backend/.env.example`:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET` | Secret key for signing JWTs | — |
| `AI_PROVIDER` | `mock` (no API key needed) or `gemini` | `mock` |
| `GEMINI_API_KEY` | Your Google Gemini API key | — |
| `GEMINI_MODEL` | Gemini model name (e.g. `gemini-1.5-flash`) | — |
| `AI_TIMEOUT_MS` | Request timeout in ms | `30000` |
| `AI_MAX_INPUT_CHARS` | Max code characters accepted | `20000` |
| `PORT` | Backend port | `5000` |

> **Never commit your real `.env` file.** It is listed in `.gitignore`.

---

## API Endpoints

All `/api/snippets` routes require an `Authorization: Bearer <token>` header.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create a new account |
| `POST` | `/api/auth/login` | Login and receive a JWT |

### Snippets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/snippets` | List all snippets for the logged-in user |
| `POST` | `/api/snippets` | Upload a new snippet (triggers AI review) |
| `GET` | `/api/snippets/:id` | Get a single snippet |
| `DELETE` | `/api/snippets/:id` | Delete a snippet |
| `GET` | `/api/snippets/:id/review` | Get the AI review result for a snippet |

**POST `/api/snippets` body:**
```json
{
  "title": "My function",
  "language": "javascript",
  "code": "function add(a, b) { return a + b; }"
}
```

The review runs in the background. Poll `GET /api/snippets/:id/review` until the status is `analyzed`.

---

## Running Tests

```bash
cd backend
npm test
```

Tests cover the AI service layer (analyzer, config, schema, Gemini provider).

---

## Team

| Member | Role |
|--------|------|
| Member 1 | Frontend |
| Member 2 | Frontend |
| Member 3 | Backend — REST APIs, validation, file handling |
| Member 4 | Database & Security — Prisma, bcrypt, JWT |
| Member 5 | AI Integration |
| Member 6 | DevOps / Docker |

---

## License

This project was built as part of the DEPI program. All rights reserved.
