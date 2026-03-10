# API Overview

## Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

## Orders
- `POST /api/orders` (student, multipart file upload)
- `GET /api/orders/my` (student)
- `GET /api/orders/queue` (admin)
- `PATCH /api/orders/:id/action` (admin)

## Health
- `GET /api/health`
