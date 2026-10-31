# Anyareport

Barangay incident reporting and response platform with resident, responder, secretary, captain, kagawad, and admin experiences.

## Quick Start

```bash
npm install
npm run dev
```

The root `npm run dev` script starts both the server and client.

## Environment setup

Copy the example files to local environment files, then replace the placeholder values:

```powershell
Copy-Item client\.env.example client\.env
Copy-Item server\.env.example server\.env
```

Get Firebase web settings from Firebase Console > Project settings > Your apps. The server's `FIREBASE_ADMIN_SDK_KEY` accepts a Firebase Admin service-account JSON value or a path to a service-account JSON file. Add the MongoDB, Gemini, and Cloudinary values for the services you use. Blank optional reCAPTCHA and hotline values leave those integrations unset.

For Vercel and Render, add the same variables in each service's environment-variable settings instead of uploading `.env` files. Set the client `VITE_API_URL` to the backend origin and `VITE_SOCKET_URL` to the Socket.IO origin (or leave it blank to use `VITE_API_URL`). Set the server `CLIENT_URL` to the deployed client origin. Redeploy the client after changing `VITE_` variables because they are included in the frontend build.

Do not commit local `.env` files or put server secrets in client variables. Values beginning with `VITE_` are exposed to the browser; use them only for frontend configuration, not private keys or passwords. `.env.example` files contain placeholders and are safe to share.

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