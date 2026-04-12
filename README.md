# Shop Payment Management App

Admin-only app to manage customers, monthly billing, and payment collections.

## What is included

- Expo React Native frontend with professional UI theme
- Node.js + Express + MongoDB backend API
- JWT-based single-admin login
- Monthly bill creation + payment entry + due/paid card status
- Search customers
- Home dashboard with total due amount
- Settings report for month-wise collections
- Vercel deployment config for backend

## Project structure

- `backend`: API, Mongo models, auth, billing logic, reports, Vercel config
- `frontend`: Expo app, login/dashboard/customers/settings screens
- `PROJECT_PLAN.md`: complete implementation plan with edge cases and roadmap

## Backend setup

1. Open terminal:

```bash
cd backend
npm install
cp .env.example .env
```

2. Update `backend/.env` with valid values:

- `MONGODB_URI`
- `JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` (or `ADMIN_PASSWORD_HASH`)

3. Run backend locally:

```bash
npm run dev
```

Backend health check:

- `GET http://localhost:3000/api/health`

## Frontend setup

1. Open terminal:

```bash
cd frontend
npm install
cp .env.example .env
```

2. Set API URL in `frontend/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

3. Run Expo app:

```bash
npm start
```

## Deploy backend to Vercel

1. Push this project to GitHub.
2. Create new Vercel project.
3. Set **Root Directory** to `backend`.
4. Add environment variables in Vercel:

- `MONGODB_URI`
- `JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`

5. Deploy.
6. Use your deployed API URL in frontend `EXPO_PUBLIC_API_URL`, for example:

```env
EXPO_PUBLIC_API_URL=https://your-backend.vercel.app/api
```

## Important MongoDB note (checked)

Connection check was run with `mongosh` using the latest provided credentials and returned:

- `{ ok: 1 }`

This confirms MongoDB authentication is working. If your password contains special characters (like `@`, `:` or `/`), URL-encode it before placing it in `MONGODB_URI`.

## API summary

- `POST /api/auth/login`
- `GET /api/customers`
- `POST /api/customers`
- `GET /api/customers/:customerId`
- `PATCH /api/customers/:customerId`
- `POST /api/customers/:customerId/bills`
- `POST /api/customers/:customerId/payments`
- `GET /api/reports/home-summary`
- `GET /api/reports/monthly-collections`
