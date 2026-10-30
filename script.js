// @ts-nocheck
/* eslint-env browser, es2022 */
/* jshint esversion: 11, browser: true */
/* HomeNest PK - main script. Works even if loaded in <head> (waits for the DOM). */
const start = () => {
  "use strict";

  /* ---------- Config ---------- */
  // Set this to your n8n chat webhook when you host the page yourself.
  const CHAT_WEBHOOK_URL = "";

  /* ---------- Data ---------- */
  const PRODUCTS = [
    { id: "HN-KET-001", name: "Electric Kettle 1.8L", cat: "Appliances", price: 3500, emoji: "☕", tone: "#fde7c4", desc: "Auto shut-off, boil-dry protection, 1500W." },
    { id: "HN-PAN-002", name: "Non-Stick Pan Set (3 pcs)", cat: "Cookware", price: 6200, emoji: "🍳", tone: "#d9efe6", desc: "PFOA-free coating for gas and electric stoves." },
    { id: "HN-LUN-003", name: "Insulated Lunch Box", cat: "Accessories", price: 1900, emoji: "🍱", tone: "#e3e8fb", desc: "Three compartments, keeps food warm for 4 hours." },
    { id: "HN-BLE-004", name: "Portable Blender 500ml", cat: "Appliances", price: 4200, emoji: "🥤", tone: "#fbdde3", desc: "USB-C rechargeable, about 15 blends per charge." },
    { id: "HN-BED-005", name: "Cotton Bedsheet Set (King)", cat: "Bedding", price: 5500, emoji: "🛏️", tone: "#e9e2f5", desc: "100% cotton with 2 pillow covers." }
  ];

  const KB = [
    { re: /track|where.*order|order status/i, a: "Please share your order number (like #1001) and I will check the status. Orders usually arrive in 5–7 business days." },
    { re: /ship|deliver/i, a: "Standard shipping takes 5–7 business days and express takes 2–3. Shipping is Rs. 200, free above Rs. 5,000." },
    { re: /return|refund|exchange/i, a: "You can return unused items within 7 days of delivery. Refunds reach your original payment method in 5–7 business days." },
    { re: /cancel/i, a: "Orders can be cancelled before they ship. Send your order number and I will pass it to our team." },
    { re: /warrant/i, a: "Kettles have a 1-year warranty, pan sets and blenders 6 months. Email a photo and your order number to start a claim." },
    { re: /pay|cod|cash|card/i, a: "We accept Cash on Delivery, cards and bank transfer. Checkout is secure." },
    { re: /human|agent|call|contact/i, a: "Email hello@homenest.example or call +92 300 0000000. We reply within 24 hours." },
    { re: /hello|hi\b|salam|assalam/i, a: "Hello! How can I help you today?" }
  ];
  const QUICK = ["Track my order", "Return policy", "Shipping time", "Talk to a human"];

  /* ---------- Helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const money = n => "Rs. " + new Intl.NumberFormat("en-PK").format(n);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
  };
  const toastEl = $("#toast"); let toastTimer;
  const toast = msg => { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2000); };

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  const savedTheme = store.get("theme", null);
  if (savedTheme) root.dataset.theme = savedTheme;
  $("#themeBtn").addEventListener("click", () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark"; store.set("theme", root.dataset.theme);
  });

  /* ---------- Mobile menu ---------- */
  const nav = $("#nav"), menuBtn = $("#menuBtn");
  const setMenu = open => { nav.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", String(open)); };
  menuBtn.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
  nav.addEventListener("click", e => { if (e.target.closest("a")) setMenu(false); });

  /* ---------- Products + cart ---------- */
  let cart = store.get("cart", {});
  let activeCat = "All";
  const cartCount = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const renderCount = () => { $("#cartCount").textContent = cartCount(); };

  const renderFilters = () => {
    const cats = ["All", ...new Set(PRODUCTS.map(p => p.cat))];
    $("#filters").innerHTML = cats.map(c => <button class="chip" data-cat="${c}" aria-pressed="${c === activeCat}">${c}</button>).join("");
  };
  const renderGrid = () => {
    const list = PRODUCTS.filter(p => activeCat === "All" || p.cat === activeCat);
    $("#grid").innerHTML = list.map(p => `
      <article class="card">
        <div class="card__img" style="background:${p.tone}" aria-hidden="true">${p.emoji}</div>
        <div class="card__body">
          <span class="card__cat">${p.cat}</span><h3>${p.name}</h3><p>${p.desc}</p>
          <div class="card__foot"><span class="price">${money(p.price)}</span>
            <button class="btn btn--primary btn--sm" data-add="${p.id}">Add</button></div>
        </div>
      </article>`).join("");
  };
  $("#filters").addEventListener("click", e => {
    const b = e.target.closest("[data-cat]"); if (!b) return;
    activeCat = b.dataset.cat; renderFilters(); renderGrid();
  });
  $("#grid").addEventListener("click", e => {
    const b = e.target.closest("[data-add]"); if (!b) return;
    cart[b.dataset.add] = (cart[b.dataset.add] || 0) + 1; store.set("cart", cart); renderCount();
    toast(PRODUCTS.find(p => p.id === b.dataset.add).name + " added to cart");
  });


  /* ---------- Chat ---------- */
  const chat = $("#chat"), log = $("#chatLog");
  const addMsg = (text, who) => { const d = document.createElement("div"); d.className = "msg msg--" + who; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; };
  const answer = async q => {
    if (CHAT_WEBHOOK_URL) {
      try {
        const r = await fetch(CHAT_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: q }) });
        const j = await r.json(); return j.output || j.reply || j.text;
      } catch { /* fall back to local answers */ }
    }
    const hit = KB.find(k => k.re.test(q));
    return hit ? hit.a : "I am not sure about that. I will connect you with our team, and they will contact you within 24 hours.";
  };
  const send = async text => {
    const q = text.trim(); if (!q) return;
    addMsg(q, "user"); addMsg("…", "bot");
    const typing = log.lastChild; const a = await answer(q); typing.textContent = a; log.scrollTop = log.scrollHeight;
  };
  const openChat = open => {
    chat.classList.toggle("open", open);
    if (open && !log.children.length) addMsg("Hi! I am the HomeNest assistant. Ask me about orders, shipping, returns or products.", "bot");
    if (open) $("#chatInput").focus();
  };
  $("#chatQuick").innerHTML = QUICK.map(q => <button class="chip" type="button">${q}</button>).join("");
  $("#chatQuick").addEventListener("click", e => { const b = e.target.closest(".chip"); if (b) send(b.textContent); });
  $("#chatForm").addEventListener("submit", e => { e.preventDefault(); const i = $("#chatInput"); send(i.value); i.value = ""; });
  $("#chatFab").addEventListener("click", () => openChat(!chat.classList.contains("open")));
  $("#chatClose").addEventListener("click", () => openChat(false));
  document.addEventListener("click", e => { if (e.target.closest("[data-open-chat]")) openChat(true); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { openChat(false); setMenu(false); } });

  /* ---------- Contact form ---------- */
  $("#contactForm").addEventListener("submit", e => {
    e.preventDefault();
    const f = e.target, note = $("#formNote");
    const { name, email, message } = f.elements;
    const ok = name.value.trim() && /^\S+@\S+\.\S+$/.test(email.value) && message.value.trim();
    note.textContent = ok ? "Thank you! We will reply within 24 hours." : "Please fill in your name, a valid email and a message.";
    if (ok) f.reset();
  });

  /* ---------- Init ---------- */
  $("#year").textContent = new Date().getFullYear();
  renderFilters(); renderGrid(); renderCount();
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();