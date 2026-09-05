# Anyareport Client

React + Vite frontend for Anyareport, with resident, responder, and shared admin shells.

## Quick Start

```bash
npm install
npm run dev
```

The root `npm run dev` script starts both client and server together. The client runs on `http://localhost:5173` and proxies API requests to the server on `http://localhost:5000`.

If you only want the frontend:

```bash
npm run dev --prefix client
```

## Demo Logins

You can sign in with these demo accounts right away. In demo mode, any password works.

- Resident: `resident@demo.local`
- Tanod: `tanod@demo.local`
- Secretary: `secretary@demo.local`
- Responder: `responder@demo.local`
- Captain: `captain@demo.local`
- Kagawad: `kagawad.po@demo.local`
- Admin: `admin@demo.local`

## Role Areas

- Resident: reporting, report tracking, notifications, and profile
- Responder: live alerts, routing, history, and incident details
- Admin: incidents, map, heatmap, analytics, audit logs, users, export, and secretary intake

## Design System

- Primary red: `#E63333`
- Navy: `#282F49`
- White: `#FFFFFF`
- Headings: Bebas Neue
- Body: Roboto

## Notes

- Demo mode is enabled automatically when Firebase env values are left blank.
- Leaflet is used for report submission and routing views.
- Ant Design theming is centralized in `src/theme/antdTheme.ts`.
- The server can also run without MongoDB/Firebase keys for the demo flow, but it will log warnings until real credentials are added.
