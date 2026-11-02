# Node Browser

A single Node.js web service that serves the browser interface and its proxy transport.

## Deploy on Render

This repository includes `render.yaml`. Create a Render Blueprint from the repository, or create a Node Web Service with:

- Build command: `npm install`
- Start command: `npm start`
- Node.js: 22 or newer

Set `ACCESS_PASSWORD` to a private password of at least 12 characters. The blueprint generates `SESSION_SECRET`; if configuring manually, set it to a separate random value of at least 32 characters (for example, generate one with `openssl rand -hex 32`). Never commit either secret. Render supplies `PORT`.

Open the service over HTTPS, sign in, then enter an HTTP(S) address or search phrase. Service workers require HTTPS.

## Security

The browser interface and Wisp WebSocket require a signed, HttpOnly, Secure, SameSite=Strict session. Login attempts are rate-limited. The Wisp JS server is configured to block private, loopback, reserved, and direct-IP destinations; it permits TCP on ports 80 and 443 only, disables UDP, and limits concurrent streams. Keep the access password private.

## Upstream components

The application uses Ultraviolet, Epoxy Transport, Bare-Mux, and [Wisp JS](https://github.com/MercuryWorkshop/wisp-js). The deprecated `wisp-server-node` package is not used. Review the upstream dependency licences before redistribution.
