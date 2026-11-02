"use strict";
const stockSW = "/uv/sw.js";
async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers.");
  }
  if (location.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(location.hostname)) {
    throw new Error("HTTPS is required for secure service-worker registration.");
  }
  await navigator.serviceWorker.register(stockSW, { scope: "/uv/" });
  await navigator.serviceWorker.ready;
}
