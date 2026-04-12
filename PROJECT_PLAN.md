# End-to-End Project Plan

## 1. Product scope

Build a single-admin shop payment system with:

- Customer master data
- Monthly billing and collection tracking
- Due/Paid status visibility
- Searchable customer records
- Home-level due summary
- Settings-level monthly collections

## 2. Requirements mapping

1. Add customer name, mobile, address, other info, previous balance:

- Covered by `POST /api/customers`
- Stored fields: `name`, `mobile`, `address`, `otherInfo`, `openingBalance`

2. Monthly billing + payment + due/paid card status:

- Bill creation: `POST /api/customers/:customerId/bills`
- Payment entry: `POST /api/customers/:customerId/payments`
- Card status logic:
  - Due remaining > 0 => `BILLED` with date
  - Due remaining = 0 => `PAID` with date

3. Search customer:

- `GET /api/customers?search=...`
- Search supports name, mobile, address, other info

4. Home page total due:

- `GET /api/reports/home-summary`
- Includes global due amount + due customer list

5. Settings monthly collections:

- `GET /api/reports/monthly-collections?months=6`
- Month-wise collection totals and transaction counts

6. Proper plan with edge cases:

- Included below (data model, scenarios, validation, testing, rollout)

## 3. Architecture

## Frontend (Expo)

- Authentication screen for admin login
- Home screen for overall due and due customers
- Customers screen:
  - Search
  - Add customer
  - View customer details
  - Add bill
  - Record payment
- Settings screen for monthly collection report + logout

## Backend (Node + Express + MongoDB)

- Auth module (single admin via env credentials)
- Customer module
- Billing module
- Reporting module
- JWT auth middleware
- Vercel serverless entry (`backend/api/index.js`)

## Database (MongoDB)

- `Customer`: profile, opening balance, credit balance
- `Bill`: one bill per customer per month
- `Payment`: payment ledger with applied amount and extra credit

## 4. Billing and payment logic

## Bill rules

- Each customer can have only one bill per month (`customerId + monthKey` unique)
- If customer has `creditBalance`, it auto-applies when a new bill is created

## Payment rules

- Payment can be applied to a selected bill
- If payment > bill due, extra amount goes to `creditBalance`
- If no unpaid bill exists, full payment becomes advance credit

## Due formula

$$
\text{customerTotalDue} = \max(0, \text{openingBalance} + \sum(\text{billAmount} - \text{billPaid}) - \text{creditBalance})
$$

## 5. Edge cases and handling

- Duplicate mobile while adding customer -> return `409`
- Duplicate monthly bill for same customer -> return `409`
- Partial payment -> bill status `PARTIAL`
- Exact payment -> bill status `PAID`
- Overpayment -> remainder moved to customer credit
- Payment without bill -> saved as advance credit
- Invalid month format (not `YYYY-MM`) -> return `400`
- Invalid IDs in routes -> return `400`
- Unauthorized access without token -> return `401`
- Stale token -> return `401`
- Empty customer list -> safe empty responses on frontend
- Inactive customers -> excluded by default from list and summaries

## 6. Security and operations

- Single-admin authentication using env credentials
- JWT with 12-hour expiry
- No secrets in source code
- Mongo URI and admin credentials provided through environment variables
- Recommend switching to `ADMIN_PASSWORD_HASH` for production security

## 7. Deployment plan

1. Deploy backend to Vercel from `backend` root.
2. Add backend env vars on Vercel.
3. Confirm health endpoint on deployed URL.
4. Set frontend `EXPO_PUBLIC_API_URL` to deployed backend `/api`.
5. Build Expo app for Android/iOS after API smoke test.

## 8. Testing plan

## API tests

- Login success/failure
- Add customer with valid/invalid payloads
- Add monthly bill twice for same month (second should fail)
- Partial payment then full payment flow
- Overpayment credit rollover flow
- Home summary values after sample data entries
- Monthly collection totals for last N months

## UI tests

- Login and logout flows
- Search accuracy by name/mobile
- Customer card status updates after bill/payment
- Home total due updates after payment
- Settings month filter and report display

## 9. Recommended next improvements

- Export monthly report to CSV/PDF
- Payment reminders via WhatsApp/SMS
- Customer statement print/share
- Offline-first queue for low network stores
- Daily backup and audit logging
- Optional multi-admin role support in future
