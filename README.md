# Anyareport

Barangay incident reporting and response platform with resident, responder, secretary, captain, kagawad, and admin experiences.

## Quick Start

```bash
npm install
npm run dev
```

The root `npm run dev` script starts both the server and client.

## Demo Logins

Demo mode is enabled when the Firebase env values are left blank.

- Resident: `resident@demo.local`
- Tanod: `tanod@demo.local`
- Secretary: `secretary@demo.local`
- Responder: `responder@demo.local`
- Captain: `captain@demo.local`
- Kagawad: `kagawad.po@demo.local`
- Admin: `admin@demo.local`

Any password works in demo mode.

## Project Structure

- `client/` React + Vite frontend
- `server/` Express + MongoDB backend

## Notes

- The project can run in demo mode without Firebase or MongoDB credentials.
- Add real environment values later in `client/.env` and `server/.env` when you are ready for live auth and persistence.
- Uploads, build output, and dependency folders are ignored by Git.