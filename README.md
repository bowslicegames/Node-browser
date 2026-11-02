# Node Browser

A single Node.js web service that serves the browser interface and its proxy transport.

## Deploy on Render

This repository includes `render.yaml`. Create a Render Blueprint from the repository, or create a Node Web Service with build command `npm install` and start command `npm start`. Use Node 22 or newer.

Set `ACCESS_PASSWORD` to a private password of at least 12 characters. The blueprint generates `SESSION_SECRET`; if configuring manually, set a separate random value of at least 32 characters (for example, `openssl rand -hex 32`). Never commit secrets. Render supplies `PORT`.

Open the service over HTTPS, sign in, then enter an HTTP(S) address or search phrase. Service workers require HTTPS.

## Security

The browser interface and Wisp WebSocket require a signed, HttpOnly, Secure, SameSite=Strict session. Login attempts are rate-limited. The Wisp JS server allows TCP on ports 80 and 443 only, disables UDP and direct-IP connections, and limits concurrent streams. A custom DNS policy checks every resolved address and rejects a hostname if any answer is not globally routable. Keep the access password private.

## Upstream components

The application uses Ultraviolet, Epoxy Transport, Bare-Mux, and [Wisp JS](https://github.com/MercuryWorkshop/wisp-js). The deprecated `wisp-server-node` package is not used. Review upstream dependency licences before redistribution.