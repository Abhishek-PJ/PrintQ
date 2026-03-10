# PrintQ — Intelligent Print Queue Management

A full-stack MERN application for managing college print-shop queues in real time. Students upload documents, get a live token, and track their order status. Shop admins manage the live queue and history. Super admins oversee shops, users, and all orders.

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS v3, Socket.IO Client, Axios, pdfjs-dist, JSZip |
| Backend | Node.js 18+, Express, TypeScript, Mongoose 8, Socket.IO |
| Database | MongoDB (local or Atlas) |
| Auth | JWT + bcryptjs |
| File Storage | AWS S3 + CloudFront (presigned URLs, auto-delete after 24 h) |
| File Upload | Multer (memory storage, 25 MB limit, PDF + DOCX) |

---

## Features

- **Student** — Register, pick an approved shop, upload a PDF or Word doc, configure per-page print rules (color, sided, page range), choose binding, pay online or at counter, track live token status via Socket.IO
- **Admin (Shop Owner)** — Register a print shop with custom per-page pricing, manage the live queue (call / print / skip / complete), download uploaded files via CloudFront presigned URLs, view filterable order history & analytics
- **Super Admin** — Approve / reject shop registrations, edit or delete users & shops, change user roles, view all orders across every shop
- **Tokens** — Format `[A–J][001–999]`, reset daily at midnight via node-cron
- **PDF Preview** — In-browser page-by-page PDF preview before submission
- **Smart print rules** — First rule auto-fills the full page range; each new rule continues from where the last one ended

> Super Admin is created via the seed script — it cannot be self-registered.

---

## Project Structure

```
PrintQ/
├── server/                  # Express API (MVC + TypeScript)
│   └── src/
│       ├── config/          # env.ts, db.ts
│       ├── controllers/     # auth, order, shop, superadmin
│       ├── middleware/      # auth guard, multer upload, error handler
│       ├── models/          # User, Order, Shop (Mongoose)
│       ├── routes/          # auth, order, shop, superadmin
│       ├── scripts/         # seedAdmin.ts
│       ├── services/        # print.service.ts
│       ├── sockets/         # Socket.IO setup & event emitters
│       ├── types/           # shared TypeScript interfaces
│       ├── utils/           # JWT helpers, pricing calc, token counter
│       ├── app.ts
│       └── server.ts
└── client/                  # React SPA (Vite + TypeScript)
    └── src/
        ├── api/             # Axios clients (auth, orders, shops, superadmin)
        ├── components/      # Navbar, ProtectedRoute
        ├── context/         # AuthContext (JWT persistence)
        ├── pages/           # HomePage, LoginPage, RegisterPage
        │                    # StudentDashboard, StudentOrders, StudentLayout
        │                    # AdminDashboard, AdminShopRegistration
        │                    # SuperAdminDashboard
        ├── styles/          # Tailwind CSS entry
        └── types.ts         # Shared frontend types
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- MongoDB (local instance or Atlas URI)
- AWS account with an S3 bucket + CloudFront distribution (optional for local dev — files will still upload but URLs won't be CDN-served)

### 1. Backend

```bash
cd server
npm install
cp .env.example .env   # fill in values (see Environment Variables below)
npm run dev             # http://localhost:5000
```

### 2. Frontend

```bash
cd client
npm install
cp .env.example .env   # set VITE_API_BASE_URL and VITE_SOCKET_URL
npm run dev             # http://localhost:5173
```

### 3. Seed the Super Admin

```bash
cd server
npm run seed:admin
```

---

## Environment Variables

### `server/.env`

```env
# App
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database
MONGODB_URI=mongodb://127.0.0.1:27017/printq

# Auth
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=1d

# Super Admin seed
SEED_ADMIN_NAME=PrintQ Admin
SEED_ADMIN_EMAIL=admin@printq.local
SEED_ADMIN_PASSWORD=Admin@123

# AWS S3 + CloudFront
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
AWS_CLOUDFRONT_DOMAIN=https://xxxxx.cloudfront.net
```

### `client/.env`

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## Available Scripts

| Location | Command | Description |
|----------|---------|-------------|
| `server/` | `npm run dev` | Start API with nodemon + ts-node |
| `server/` | `npm run build` | Compile TypeScript to `dist/` |
| `server/` | `npm start` | Run compiled build |
| `server/` | `npm run seed:admin` | Create the super admin account |
| `client/` | `npm run dev` | Start Vite dev server |
| `client/` | `npm run build` | Production build to `dist/` |
| `client/` | `npm run preview` | Preview production build |

---

## Environment Variables

Create `server/.env` with:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/printq
JWT_SECRET=your_jwt_secret
SEED_ADMIN_NAME=Super Admin
SEED_ADMIN_EMAIL=admin@printq.com
SEED_ADMIN_PASSWORD=admin123
```

The client uses Vite env vars (optional):

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## Features

### Student Flow
- Register as a student and log in
- Browse approved print shops
- Select a shop, upload a document, configure print options (color mode, copies, paper size, sided, binding)
- Receive a token number and track order status in real time via Socket.IO

### Admin (Shop Owner) Flow
- Register as an admin and submit shop details (name, address, phone, services)
- Await Super Admin approval
- Once approved, manage the live print queue — call, print, skip, or complete orders
- View order history with filters (status, color mode, date range, filename search)
- Analytics dashboard with status distribution, color-mode breakdown, and summary cards

### Super Admin Flow
- Log in with seeded credentials
- **Shops tab** — view all shop registrations; approve or reject pending shops
- **Users tab** — view all users; change any user's role (student / admin / superadmin)
- **Orders tab** — view every order across all shops

---

## API Routes

### Auth — `/api/auth`
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/register` | Public |
| POST | `/login` | Public |
| GET | `/me` | Authenticated |

### Orders — `/api/orders`
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/` | Student |
| GET | `/mine` | Student |
| GET | `/queue` | Admin |
| GET | `/history` | Admin |
| PATCH | `/:id/action` | Admin |

### Shops — `/api/shops`
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/register` | Admin |
| GET | `/mine` | Admin |
| GET | `/approved` | Student |

### Super Admin — `/api/superadmin`
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/shops` | Super Admin |
| PATCH | `/shops/:id/status` | Super Admin |
| GET | `/users` | Super Admin |
| PATCH | `/users/:id/role` | Super Admin |
| GET | `/orders` | Super Admin |

---

## Build for Production

```bash
# Server
cd server && npm run build   # outputs to dist/

# Client
cd client && npm run build   # outputs to dist/
```

---

## License

MIT

---

## Author

Developed by **Abhishek Nalatawad** — [abhia7535@gmail.com](mailto:abhia7535@gmail.com)
