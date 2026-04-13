# Village - Event Social App

A social app where users can **create events**, **discover nearby events**, and **RSVP** to meet new people based on **location** and **hobbies**.

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/SyedK421767/CSCE482_Koopalings.git
cd CSCE482_Koopalings

# 2. Install all dependencies
npm run install-all

# 3. Set up the backend environment
cp village-backend/.env.example village-backend/.env
# Edit village-backend/.env with the real DATABASE_URL (ask a teammate)
```

## Running the App

There are two modes — pick the one that fits what you're testing:

### Local Web (recommended for development)

Runs the app in your browser. Needs the backend running locally.

```bash
npm run web
```

This starts both the backend (port 3000) and Expo web in one command.

### Mobile (Expo Go)

Runs the app on your phone via the Expo Go app. Uses the **production backend** automatically — no need to run the backend locally.

```bash
npm run mobile
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

The script auto-detects your platform:
- **Mac / Windows:** uses LAN mode (phone must be on the same WiFi)
- **WSL:** uses port forwarding through Windows (one-time setup required — see below)

> **WiFi note:** Your phone and computer must be on the same network, and the network must allow device-to-device traffic. Campus WiFi (e.g. TAMUlink, eduroam) typically blocks this. Use a **phone hotspot** with your laptop connected to it instead.

### Backend Only

If you only need the API server:

```bash
npm run backend
```

## WSL Setup (one-time)

WSL users need to set up port forwarding so your phone can reach the Expo dev server through Windows. Run this once in **PowerShell as Administrator**:

```powershell
.\setup-port-forward.ps1
```

This creates a scheduled task that automatically forwards ports on every Windows login. After this, `npm run mobile` handles everything.

## Platform Notes

| Platform | Web | Mobile |
|----------|-----|--------|
| **Mac / Windows** | `npm run web` | `npm run mobile` |
| **WSL** | `npm run web` | `npm run mobile` (port forwarding, no ngrok needed) |

All platforms use the same commands — the scripts detect your environment automatically.

## Project Structure

```
CSCE482_Koopalings/
├── village/              # Expo (React Native) frontend
│   ├── app/              # Screens (file-based routing)
│   ├── components/       # Shared components
│   └── lib/              # API clients, config, utilities
├── village-backend/      # Express + PostgreSQL backend
│   └── src/
│       ├── routes/       # API endpoints
│       └── chat/         # WebSocket chat
├── package.json          # Root scripts (npm run web/mobile/backend)
└── README.md
```

## Environment Variables

### Frontend (`village/.env`)
| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` | Google Places API key (already in repo) |

### Backend (`village-backend/.env`)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |

Copy `.env.example` to `.env` and fill in the values. **Never commit `.env` files with real credentials.**

## Tech Stack

- **Frontend:** React Native (Expo), TypeScript, Expo Router
- **Backend:** Node.js, Express, PostgreSQL (Supabase)
- **Realtime:** WebSockets (chat)
