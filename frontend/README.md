# Contactless Order Service - Frontend

A modern, mobile-first contactless ordering web application built with Next.js 14.

## Features

- 🍽️ **Digital Menu** - Browse food items with categories and search
- 🛒 **Cart Management** - Add/remove items, quantity controls, special instructions
- 💳 **Multiple Payment Options** - MoMo, VNPay, Cash
- 📱 **Mobile-First Design** - Optimized for QR code scanning
- 🇻🇳 **Vietnamese-First** - UI in Vietnamese with icons

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Zustand** - State management
- **Framer Motion** - Animations
- **Axios** - HTTP client

## Getting Started

### Prerequisites

- Node.js 18+ (or Docker)
- Backend API running at `http://localhost:8000`

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

### Using Docker

```bash
# Build image
docker build -t contactless-ui .

# Run container
docker run -p 3000:3000 contactless-ui
```

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Welcome/Auth screen
│   ├── menu/              # Menu screen
│   ├── order/[id]/        # Order confirmation
│   ├── payment/           # Payment selection
│   └── tracking/[id]/     # Order tracking
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── CategoryTabs.tsx
│   ├── FoodCard.tsx
│   ├── CartDrawer.tsx
│   └── ...
├── lib/                   # Utilities
│   ├── api.ts            # Axios instance
│   ├── auth.ts           # Auth helpers
│   └── types.ts          # TypeScript types
└── store/                 # Zustand stores
    └── cartStore.ts
```

## User Flow

1. **QR Scan** → Customer scans QR code with table ID
2. **Welcome** → Auto-login for returning guests or quick guest auth
3. **Menu** → Browse categories, search, add to cart
4. **Cart** → Review items, add special instructions
5. **Order Confirmation** → View order, cancel within 2 minutes
6. **Payment** → Choose MoMo, VNPay, or Cash
7. **Tracking** → Real-time order status updates

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## License

MIT

## Testing

We use **Jest** for unit testing and **Playwright** for End-to-End (E2E) testing.

### Prerequisites

Run the following to install test dependencies:

```bash
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @types/jest ts-jest playwright @playwright/test
npx playwright install
```

### Running Tests

```bash
# Run Unit Tests (Cart, Components)
npx jest

# Run E2E Tests (User Flows, Mobile, Race Conditions)
npx playwright test

# Run Load Tests (Performance)
npx jest frontend/tests/performance/load.test.ts
```
