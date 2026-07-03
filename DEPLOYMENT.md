# NewsMind Deployment Guide

This guide describes how to deploy the NewsMind platform:
1. **Backend & AI Service** to a DigitalOcean Droplet (via Docker Compose).
2. **Frontend** to Vercel.

---

## 1. Preparing the Code for GitHub

We have initialized a git repository and committed all files. To push the code:

1. Create a **private** or public repository on GitHub.
2. In your local terminal, run the following commands (replace the URL with your repository URL):
   ```bash
   git remote add origin https://github.com/your-username/newsmind.git
   git branch -M main
   git push -u origin main
   ```

---

## 2. Deploying Backend & AI Service to DigitalOcean

### Prerequisites on DigitalOcean:
- A DigitalOcean Droplet (1 GB RAM / 1 vCPU is sufficient, e.g., the regular $6/month droplet).
- **Ubuntu 22.04 LTS** or similar OS.
- Docker and Docker Compose installed on the droplet.

### Step-by-Step Droplet Setup:

1. **SSH into your Droplet:**
   ```bash
   ssh root@your_droplet_ip
   ```

2. **Install Docker and Docker Compose (if not already installed):**
   ```bash
   sudo apt update
   sudo apt install -y docker.io docker-compose-v2
   sudo systemctl enable --now docker
   ```

3. **Clone your GitHub Repository:**
   ```bash
   git clone https://github.com/your-username/newsmind.git
   cd newsmind
   ```

4. **Create a `.env` file in the root directory:**
   Copy the example configuration:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` using nano:
   ```bash
   nano .env
   ```
   Fill in your actual API keys and secrets:
   - `GEMINI_API_KEY`: Your Google Gemini API Key.
   - `NVIDIA_API_KEY`: Your NVIDIA NIM API Key.
   - `FRONTEND_URL`: The URL of your Vercel frontend (e.g., `https://newsmind-frontend.vercel.app` - you can update this after Vercel deployment).
   - `CORS_ORIGIN`: Match the `FRONTEND_URL`.
   - `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET`: Secure random strings.

5. **Start the Services:**
   ```bash
   docker compose up -d --build
   ```
   This will build the NestJS backend and FastAPI AI service, pull the PostgreSQL image, and start all containers.

6. **Run Database Migrations and Seed Data:**
   Once the containers are running, execute the database migration and seeding scripts:
   ```bash
   # Run PostgreSQL migrations
   docker compose exec backend npm run db:migrate

   # Seed the database (admin: admin@newsmind.local / Newsmind@12345)
   docker compose exec backend npm run db:seed
   ```

7. **Configuring Domain and Reverse Proxy (SSL):**
   Since you already have a domain for the backend (e.g., `api.newsmind.com`):
   - Point your domain's **A record** in your domain registrar to your Droplet's public IP address.
   - Set up **Nginx** or **Caddy** on the host Droplet to act as a reverse proxy forwarding port `4000` (NestJS) to your domain with SSL.
   - Example Caddy setup (`/etc/caddy/Caddyfile`):
     ```caddy
     api.yourdomain.com {
         reverse_proxy localhost:4000
     }
     ```

---

## 3. Deploying Frontend to Vercel

Vercel natively supports Next.js applications and handles building, hosting, and SSL automatically.

### Step-by-Step Vercel Setup:

1. Go to [Vercel](https://vercel.com/) and sign in with GitHub.
2. Click **"Add New"** > **"Project"**.
3. Import your `newsmind` repository.
4. Configure the Project settings:
   - **Framework Preset:** Next.js
   - **Root Directory:** Edit and select `frontend/`.
5. Add **Environment Variables** in Vercel:
   - Since Next.js configures rewrites for `/api` (which forwards requests to NestJS), you **do not** need to expose your backend IP or domain in `NEXT_PUBLIC_` variables. The Next.js API rewrites in `frontend/next.config.ts` will direct traffic based on the deployment config:
     - To ensure Vercel routes `/api/*` to your production backend, you can configure Next.js environment variable rewrites, or update your NestJS backend URL in a middleware/fetch call, or configure Next.js rewrites:
     - Open [frontend/next.config.ts](file:///d:/newsmind/frontend/next.config.ts) and notice it points to `http://localhost:4000`. In production, you should set a rewrite destination or use custom env variables.
     - **Recommendation**: Set up a `BACKEND_API_URL` environment variable in Vercel (pointing to your backend domain: `https://api.yourdomain.com/api/v1`) and update `next.config.ts` or route handlers to use it.
6. Click **Deploy**.

---

## 4. How the Simplified Stack Helps DigitalOcean Deployment

Since we trimmed down several heavy layers:
- **No Redis / BullMQ Needed**: You save system resources (RAM and CPU) on the droplet. The application is completely stateless, meaning it only needs a standard PostgreSQL database, allowing you to use the smallest and cheapest droplet tier ($4-$6/month).
- **Single-Shot AI Endpoint**: Instead of managing background queues, workers, and multiple external AI connections, everything runs inline in a single fast request. This guarantees reliable execution on limited server specs.
