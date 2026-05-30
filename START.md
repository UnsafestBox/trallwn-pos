# Trallwn Club POS — Startup

Requires Node 22+. Two terminals needed.

## Terminal 1 — API server (port 3001)
```bash
cd server
npm start          # or: npm run dev   (auto-restarts on changes)
```

## Terminal 2 — Frontend (port 5173)
```bash
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## First-time setup

1. Go to **Stock** and add your products (Guinness, Peroni, etc.)
2. Set stock quantities and min-stock alert levels
3. Switch to **POS** to open tabs and take orders
4. Settle tabs via **POS** or **Tabs** view
5. Check **Reports** for daily takings and stock alerts
