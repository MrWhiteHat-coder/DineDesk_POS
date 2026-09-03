# 🚀 DineDesk POS — Deploy to Vercel + Render (Free)

## Architecture
```
Frontend (React CRA) → Vercel (free, auto-deploy)
Backend (FastAPI)    → Render (free tier)
Database (MongoDB)   → MongoDB Atlas (free M0)
```

---

## Step 1: MongoDB Atlas (Free Database)

1. Go to https://cloud.mongodb.com
2. Sign up / Log in
3. Click **"Build a Database"**
4. Choose **FREE** (M0 Shared) tier
5. Select region: **Mumbai (ap-south-1)** — closest to India
6. Create cluster (takes 1-3 min)
7. **Database Access** → Add new user:
   - Username: `dinedesk`
   - Password: (generate and SAVE this)
   - Role: **Read and write to any database**
8. **Network Access** → Add IP Address:
   - Click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - This allows Render + Vercel to connect
9. **Deployment** → Database → **"Connect"**
   - Choose **"Connect your application"**
   - Copy the connection string
   - Replace `<password>` with your actual password
   - Result looks like:
   ```
   mongodb+srv://dinedesk:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/DineDesk?retryWrites=true&w=majority
   ```
   - **SAVE THIS** — you'll need it for Render

---

## Step 2: Render Backend (Free API Server)

1. Go to https://dashboard.render.com
2. Sign up with your **GitHub account**
3. Click **"New +"** → **"Web Service"**
4. **Connect your GitHub repo**: `MrWhiteHat-coder/DineDesk_POS`
5. Fill in:
   - **Name**: `dinedesk-backend`
   - **Region**: Singapore or Mumbai (closest)
   - **Branch**: `main`
   - **Runtime**: Python 3
   - **Build Command**:
     ```
     pip install -r backend/requirements.txt
     ```
   - **Start Command**:
     ```
     uvicorn backend.server:app --host 0.0.0.0 --port $PORT
     ```
   - **Plan**: Free

6. **Environment Variables** (click "Advanced" → "Add Environment Variable"):
   ```
   MONGO_URL = mongodb+srv://dinedesk:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/DineDesk?retryWrites=true&w=majority
   DB_NAME = DineDesk
   JWT_SECRET = (generate a random 64-char string — run: python -c "import secrets; print(secrets.token_hex(32))")
   ADMIN_EMAIL = admin@foodflow.com
   ADMIN_PASSWORD = (your admin password)
   CORS_ORIGINS = https://YOUR-VERCEL-APP.vercel.app,http://localhost:3000
   FRONTEND_URL = https://YOUR-VERCEL-APP.vercel.app
   GEMINI_API_KEY = (your existing key)
   GMAIL_USER = support@revontechnologies.in
   GMAIL_APP_PASSWORD = (your Gmail app password)
   SENDER_EMAIL = support@revontechnologies.in
   SENDER_NAME = DineDesk
   LOG_LEVEL = INFO
   PYTHON_VERSION = 3.11.8
   ```

7. Click **"Create Web Service"**
8. Wait for deployment (2-5 min)
9. Your backend URL will be: `https://dinedesk-backend.onrender.com`
10. Test: Visit `https://dinedesk-backend.onrender.com/health`
    - Should return: `{"status":"healthy","version":"3.0.0","mongodb":"connected"}`

---

## Step 3: Vercel Frontend (Free Static Hosting)

1. Go to https://vercel.com
2. Sign up with your **GitHub account**
3. Click **"Add New..."** → **"Project"**
4. **Import** your repo: `MrWhiteHat-coder/DineDesk_POS`
5. Vercel auto-detects React — but since it's a monorepo:
   - **Root Directory**: `frontend`
   - **Build Command**: `yarn build`
   - **Output Directory**: `build`
   - **Install Command**: `yarn install --frozen-lockfile`
   - **Framework Preset**: CRA (Create React App)

6. **Environment Variables** → Add:
   ```
   REACT_APP_BACKEND_URL = https://dinedesk-backend.onrender.com
   REACT_APP_GOOGLE_CLIENT_ID = 19258355498-49tvakpu82hde931s8sp1dj42mbfa03k.apps.googleusercontent.com
   ```

7. Click **"Deploy"**
8. Wait for build (1-3 min)
9. Your frontend URL will be: `https://dinedesk-XXXX.vercel.app`

---

## Step 4: Update Backend CORS

Go back to **Render** → Environment Variables → Update:
```
CORS_ORIGINS = https://dinedesk-XXXX.vercel.app
FRONTEND_URL = https://dinedesk-XXXX.vercel.app
```

Then **"Manual Deploy"** → **"Deploy latest commit"** to restart with new CORS.

---

## Step 5: Custom Domain (revontechologies.in)

### On Vercel:
1. Vercel Project → **Settings** → **Domains**
2. Add `revontechologies.in`
3. Vercel gives you DNS records to add

### On your domain registrar (GoDaddy/Namecheap/etc):
Add these DNS records:
```
Type    Name    Value
A       @       76.76.21.21
CNAME   www     cname.vercel-dns.com
```

### On Render (optional custom domain):
1. Render → Settings → **Custom Domains**
2. Add `api.revontechologies.in`
3. Update DNS:
```
Type    Name    Value
CNAME   api     dinedesk-backend.onrender.com
```

---

## Step 6: Update Google OAuth

Go to https://console.cloud.google.com → APIs & Services → Credentials
1. Edit your OAuth Client ID
2. Add ** Authorized JavaScript origins**:
   ```
   https://revontechologies.in
   https://www.revontechologies.in
   https://dinedesk-XXXX.vercel.app   (Vercel preview URL)
   ```
3. Add **Authorized redirect URIs**:
   ```
   https://revontechologies.in
   https://www.revontechologies.in
   ```

---

## ⚠️ Render Free Tier Notes

- **Spin-down**: After 15 min of no traffic, Render puts the service to sleep
- **First request**: Takes 30-50 seconds to wake up
- **Workaround**: Use https://uptimerobot.com to ping `/health` every 5 minutes
  - Free plan allows 50 monitors
  - This keeps your backend awake 24/7

---

## 🧪 Test Checklist

After deployment:
- [ ] Visit `https://revontechologies.in` — frontend loads
- [ ] Login with email/password — works
- [ ] Google Sign-In — works
- [ ] Create an order — works
- [ ] View analytics — works
- [ ] AI insights — works (if Gemini key set)
- [ ] Print receipt — works
- [ ] Mobile responsive — works

---

## 🔄 Auto-Deploy

Both Vercel and Render auto-deploy when you push to `main`:
- **git push origin main** → Frontend rebuilds on Vercel (1-2 min)
- **git push origin main** → Backend rebuilds on Render (2-5 min)

---

## 💰 Total Cost: $0/month

| Service | Free Tier | Limits |
|---------|-----------|--------|
| Vercel | Hobby Plan | 100GB bandwidth/mo |
| Render | Free Web Service | 750 hours/mo (sleeps after 15min) |
| MongoDB Atlas | M0 Shared | 512MB storage |
| **Total** | **$0** | Sufficient for small-medium restaurants |
