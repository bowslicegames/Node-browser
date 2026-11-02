"use strict";
const form = document.getElementById("browser-form");
const address = document.getElementById("address");
const navForm = document.getElementById("nav-form");
const navAddress = document.getElementById("nav-address");
const frame = document.getElementById("uv-frame");
const welcome = document.getElementById("welcome");
const browser = document.getElementById("browser");
const status = document.getElementById("status");
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
let currentUrl = "";

function resolveAddress(input) {
  const value = input.trim();
  if (!value) throw new Error("Enter a web address or search term.");
  try {
    const parsed = new URL(value);
    if (["http:", "https:"].includes(parsed.protocol)) return parsed.href;
    throw new Error("Only http and https addresses are supported.");
  } catch (error) {
    if (error.message.includes("Only http")) throw error;
  }
  try {
    const parsed = new URL("https://" + value);
    if (parsed.hostname.includes(".")) return parsed.href;
  } catch {}
  return "https://www.google.com/search?q=" + encodeURIComponent(value);
}

async function navigate(input) {
  const url = resolveAddress(input);
  status.textContent = "Connecting…";
  try {
    await registerSW();
    const wispUrl = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/wisp/";
    if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
      await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
    }
    currentUrl = url;
    navAddress.value = url;
    address.value = url;
    welcome.hidden = true;
    browser.hidden = false;
    frame.src = __uv$config.prefix + __uv$config.encodeUrl(url);
    status.textContent = "";
  } catch (error) {
    status.textContent = "Could not start the browser: " + error.message;
    console.error(error);
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  navigate(address.value);
});
navForm.addEventListener("submit", event => {
  event.preventDefault();
  navigate(navAddress.value);
});
document.querySelectorAll("[data-url]").forEach(button => {
  button.addEventListener("click", () => navigate(button.dataset.url));
});
document.getElementById("back").addEventListener("click", () => {
  try { frame.contentWindow.history.back(); } catch {}
});
document.getElementById("forward").addEventListener("click", () => {
  try { frame.contentWindow.history.forward(); } catch {}
});
document.getElementById("reload").addEventListener("click", () => {
  try { frame.contentWindow.location.reload(); } catch { if (currentUrl) navigate(currentUrl); }
});
document.getElementById("home").addEventListener("click", () => {
  browser.hidden = true;
  welcome.hidden = false;
  frame.src = "about:blank";
  address.focus();
});
document.getElementById("new-window").addEventListener("click", () => {
  browser.hidden = true;
  welcome.hidden = false;
  frame.src = "about:blank";
  address.focus();
});
document.getElementById("logout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  location.replace("/login");
});
