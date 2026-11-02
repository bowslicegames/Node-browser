"use strict";
async function registerSW() {
  if (!("serviceWorker" in navigator)) throw new Error("This browser does not support service workers.");
  if (location.protocol !== "https:" && location.hostname !== "localhost") {
    throw new Error("HTTPS is required for secure browser features.");
  }
  return navigator.serviceWorker.register("/uv/sw.js");
}