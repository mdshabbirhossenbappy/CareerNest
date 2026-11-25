# CareerNest — University Career & Internship Platform

CareerNest is a verified university employment platform connecting students, graduates, verified employers, recruiters, and the University Career Office.

## Tech Stack
- Frontend: Plain HTML5, CSS3, Vanilla JavaScript (ES Modules, fetch API)
- Backend: Vercel Serverless Functions (Node.js) in /api
- Database: Google Sheets via secured Apps Script Web App bridge + Repository pattern (/lib)
- Security: bcryptjs (cost 12), HttpOnly + SameSite=Strict JWT cookies, zod strict validation, brute-force lockout, formula injection blocking, CSP headers, and AuditLog
- Testing & CI: Jest, ESLint, Prettier, GitHub Actions, Dependabot

## Environment Variables
Copy .env.example to .env and configure the same keys in Vercel Project Settings:
- GOOGLE_SERVICE_ACCOUNT_EMAIL: Deployed Google Apps Script Web App URL
- GOOGLE_PRIVATE_KEY: Shared secret matching EXPECTED_SECRET in scripts/googleAppsScript.gs
- GOOGLE_SHEET_ID: Google Spreadsheet ID
- JWT_SECRET: 64-character random hex secret
- ADMIN_SEED_EMAIL: Initial UNIVERSITY_ADMIN email
- ADMIN_SEED_PASSWORD: Initial UNIVERSITY_ADMIN password (min 10 chars, letters & numbers)
- ALLOWED_ORIGIN: Allowed CORS origin

## Local Setup & Testing

    npm install
    npm run format:check
    npm run lint
    npm test
    vercel dev

## API Endpoints
| Endpoint | Methods | Access | Description |
| :--- | :--- | :--- | :--- |
| /api/health | GET | Public | Service health check |
| /api/auth/register | POST | Public | Register STUDENT, EMPLOYER, or RECRUITER |
| /api/auth/login | POST | Public | Authenticate & issue HttpOnly JWT cookie |
| /api/auth/logout | POST | Public | Clear session cookie |
| /api/auth/me | GET | Authenticated | Return current authenticated user |
| /api/departments | GET, POST | Public / Admin | List or add university departments |
| /api/students/profile | GET, PUT, POST | STUDENT | Manage student profile & ?resource=saved bookmarks |
| /api/employers/profile | GET, PUT | EMPLOYER / RECRUITER | Manage company profile |
| /api/jobs | GET, POST, PUT | Public / Employer | Browse approved jobs (with skill match) or manage postings |
| /api/applications | GET, POST, PATCH | Authenticated | Apply to jobs, view history/interviews, enforce state machine |
| /api/notifications | GET, PATCH, POST | Authenticated | View/read notifications & ?resource=reports fraud reporting |
| /api/admin | GET, PATCH | UNIVERSITY_ADMIN | Stats, verify students/employers, approve jobs, handle reports |
