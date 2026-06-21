# 🧁 CurlyCakes — Baker's Helper

A pink/white Telegram Mini App for pastry chefs. Plan multiple cakes, get one aggregated shopping list, save your recipes by category.

- **Shopping** — make a list → add cakes → add ingredients (g/kg/ml/l/pcs). The app sums everything into one combined buy list and sends it as a Telegram message.
- **Recipes** — categorized notebook (Sponge / Cream / Frosting / Decoration / Dough / Other or your own).
- **Edit anytime** — names, quantities, and units update instantly.
- **Stored locally** — data lives in your phone's browser/Telegram cache (private to you, no server).

---

## 🚀 Deploy — full step-by-step

### Step 1 — Push to GitHub

You already have a GitHub account. From this folder, in Terminal:

```bash
cd /Users/williamsbereng/Downloads/curlycakes-app
git init
git add .
git commit -m "Initial CurlyCakes mini app"
```

Then on github.com:

1. Click **+** (top right) → **New repository**
2. Name: `curlycakes-app` — keep it **Public** (Vercel free tier works either way, public is simpler)
3. **Do NOT** check "Add README" / "Add .gitignore" — we already have them
4. Click **Create repository**

GitHub will now show you commands. Copy the two lines under **"…or push an existing repository from the command line"** and run them in Terminal. They look like:

```bash
git remote add origin https://github.com/YOUR_USERNAME/curlycakes-app.git
git branch -M main
git push -u origin main
```

Done. Refresh GitHub — your code is there.

---

### Step 2 — Deploy on Vercel (recommended over Railway for Next.js)

> Why Vercel: Next.js is made by Vercel, so deployment is one click, free forever for personal projects, gives you `https://...vercel.app` automatically (Telegram requires HTTPS).

1. Go to **https://vercel.com** → **Sign up with GitHub**
2. Click **Add New… → Project**
3. Find **curlycakes-app** in the list → **Import**
4. Leave everything default (Framework: Next.js auto-detected, Build Command auto, Output auto)
5. **Environment Variables**: none needed for v1 ✅
6. Click **Deploy**

After ~1 minute you'll get a URL like `https://curlycakes-app.vercel.app`. Open it on your phone — it should look the same as in your browser.

**Every time you push to GitHub** (`git push`), Vercel re-deploys automatically. No extra steps.

> ℹ️ If you ever prefer Railway: New Project → Deploy from GitHub repo → pick `curlycakes-app`. No env vars. Railway will give you a `*.up.railway.app` URL — use that instead in Step 3.

---

### Step 3 — Create the Telegram Bot + Mini App

1. Open Telegram → search **@BotFather** → start a chat.
2. Send `/newbot`
   - Bot name (display): `CurlyCakes`
   - Username (must end with `bot`): e.g. `CurlyCakesHelperBot`
   - BotFather replies with an **HTTP API token** — save it somewhere (you don't need it for the mini app itself, but keep it for later if you ever add a backend).
3. Send `/newapp` to BotFather.
   - Pick the bot you just made
   - Title: `CurlyCakes`
   - Short description: `Plan cakes, get one shopping list.`
   - Photo: upload a 640×360 banner (you have `Banners/` in your CurlyCakes folder — use one)
   - GIF demo: skip (send `/empty`)
   - **Web App URL**: paste your Vercel URL → `https://curlycakes-app.vercel.app`
   - Short name: `app` (this becomes part of the launch link)
4. BotFather replies with a direct launch link, e.g. `https://t.me/CurlyCakesHelperBot/app` — tap it on your phone. Your mini app opens inside Telegram. 🎉

**Bonus — make it open from the menu button:**
- Send `/mybots` → pick your bot → **Bot Settings** → **Menu Button** → **Configure menu button**
- Text: `Open CurlyCakes`
- URL: same Vercel URL
- Now the bot chat shows a permanent button to launch your app.

---

## 🛠 Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## 📁 Project structure

```
app/             Next.js routes (single page with tabs)
components/      UI: Header, Tabs, ShoppingLists, Recipes
lib/             Types, localStorage hook, aggregation, Telegram SDK helpers
```

## 💡 Possible next steps (when you're ready)

- Cloud sync between devices (add Supabase or Vercel Postgres)
- Cake templates ("Vanilla sponge" you can reuse across lists)
- Price tracking per ingredient → cost estimate per order
- Multi-language (RO / HU / EN)
