# Workout Platform

A comprehensive, offline-first workout and fitness training platform built with Next.js, Supabase, and PWA technology. Inspired by Heavy, this platform provides a complete solution for users, coaches, and administrators to manage workout programs, track progress, and train anywhere.

## Features

### For Users
- View assigned workout programs
- Complete exercises with video guidance
- Track progress offline and sync when online
- View personal stats and streaks
- Install as PWA for app-like experience
- Train anywhere with full offline support

### For Coaches
- **تماريني (My Exercises)** - Manage exercise library
- Create and edit workout programs
- Assign programs to users
- Monitor user progress and completion rates
- Duplicate existing programs for quick setup
- Enable/disable user accounts

### For Admins
- Manage coach accounts
- View system-wide analytics
- Oversee all programs and users
- Enable/disable coaches

### Technical Features
- **Offline-First Architecture** - Full app functionality without internet
- **Progressive Web App** - Installable on all platforms
- **Background Sync** - Progress syncs automatically when online
- **Role-Based Security** - Database-level access control with RLS
- **Video Integration** - YouTube and Vimeo support
- **Muscle Visualization** - Interactive body model showing target muscles
- **TypeScript** - Full type safety throughout

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Offline Storage**: IndexedDB (via idb)
- **PWA**: Service Worker + Web App Manifest
- **State Management**: React Context + Custom Hooks
- **Video**: YouTube/Vimeo iframe embedding

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account (supabase.com)
- (Optional) Image for PWA icons

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at supabase.com
2. Run the database migration (supabase/migrations/001_initial_schema.sql)
3. Run the seed data (supabase/seed.sql)
4. Get your credentials from Project Settings → API

### 3. Configure Environment Variables

```bash
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
```

### 4. Generate PWA Icons

```bash
npx pwa-asset-generator your-logo.png public/icons --background "#ffffff"
```

### 5. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

## Project Structure

See IMPLEMENTATION_STATUS.md for detailed architecture information.

## Deployment

Deploy to Vercel, Netlify, or any platform supporting Next.js.
Ensure HTTPS is enabled for PWA features.

## Documentation

- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) - Implementation details and progress
- [supabase/migrations/](supabase/migrations/) - Database schema
- [src/types/](src/types/) - TypeScript type definitions

## License

MIT
