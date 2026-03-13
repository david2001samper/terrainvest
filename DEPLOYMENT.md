# Terra Invest – Linode Deployment Guide

Complete tutorial for deploying Terra Invest to a Linode server for web hosting.

> **First time?** Push your code to GitHub first – see **[GITHUB.md](./GITHUB.md)** for the full tutorial.

---

## Prerequisites

- **GitHub repo** – your code pushed to GitHub (see [GITHUB.md](./GITHUB.md))
- **Linode account** – [linode.com](https://linode.com)
- **Domain name** (optional but recommended for production)
- **Supabase project** – already configured for your app
- **Git** – for deploying code

---

## Part 1: Create a Linode Server

### 1.1 Create a Linode Instance

1. Log in to [Linode Cloud Manager](https://cloud.linode.com)
2. Click **Create** → **Linode**
3. Choose:
   - **Region**: Pick closest to your users (e.g. Frankfurt, Newark)
   - **Image**: **Ubuntu 24.04 LTS**
   - **Plan**: **Shared CPU – Nanode 1GB** ($5/mo) or **2GB** ($12/mo) for production
4. Set root password (or SSH key)
5. Click **Create Linode**

### 1.2 Get Your Server IP

After creation, note the **IPv4 address** (e.g. `123.45.67.89`).

---

## Part 2: Initial Server Setup

### 2.1 Connect via SSH

```bash
ssh root@YOUR_SERVER_IP
```

### 2.2 Create a Non-Root User

```bash
adduser terra
usermod -aG sudo terra
su - terra
```

### 2.3 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.4 Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # Should show v20.x
```

### 2.5 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 2.6 Install Nginx (Reverse Proxy)

```bash
sudo apt install -y nginx
```

### 2.7 Install Git

```bash
sudo apt install -y git
```

---

## Part 3: Deploy the Application

### 3.1 Clone Your Repository

Use the URL from your GitHub repo (see [GITHUB.md](./GITHUB.md) if you haven't pushed yet):

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/terra_invest.git
cd terra_invest
```

> If your repo is private, use SSH or a personal access token:
> ```bash
> git clone git@github.com:YOUR_USERNAME/terra_invest.git
> ```

### 3.2 Install Dependencies

```bash
npm install
```

### 3.3 Create Environment File

```bash
nano .env.local
```

Add your variables (replace with real values):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

### 3.4 Build the Application

```bash
npm run build
```

### 3.5 Start with PM2

**Option A – Direct command:**
```bash
pm2 start npm --name "terra-invest" -- start
```

**Option B – Using ecosystem config (recommended):**
```bash
pm2 start ecosystem.config.cjs
```

Then save and enable startup:
```bash
pm2 save
pm2 startup
```

Follow the command PM2 prints to enable startup on boot.

### 3.6 Verify It Runs

```bash
pm2 status
curl http://localhost:3000
```

You should see HTML output.

---

## Part 4: Configure Nginx

### 4.1 Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/terra-invest
```

Paste (replace `YOUR_DOMAIN` and `YOUR_SERVER_IP`):

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN.com www.YOUR_DOMAIN.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

If you don’t have a domain yet, use:

```nginx
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4.2 Enable Site and Restart Nginx

```bash
sudo ln -s /etc/nginx/sites-available/terra-invest /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4.3 Open Firewall

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## Part 5: SSL with Let's Encrypt (HTTPS)

### 5.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 5.2 Get Certificate

**With domain:**

```bash
sudo certbot --nginx -d YOUR_DOMAIN.com -d www.YOUR_DOMAIN.com
```

**Without domain:** skip this; use HTTP only until you add a domain.

### 5.3 Auto-Renewal

```bash
sudo certbot renew --dry-run
```

Certbot sets up a cron job for renewal.

---

## Part 6: Deployment Script (Optional)

Create a deploy script for easy updates:

```bash
nano ~/terra_invest/deploy.sh
```

```bash
#!/bin/bash
set -e
cd ~/terra_invest
git pull
npm install
npm run build
pm2 restart terra-invest
echo "Deployment complete! Visit your site to verify."
```

```bash
chmod +x ~/terra_invest/deploy.sh
```

To deploy updates:

```bash
~/terra_invest/deploy.sh
```

---

## Part 7: Domain Setup (If Using One)

### 7.1 DNS Records

In your domain registrar (e.g. Namecheap, Cloudflare):

| Type | Name | Value        | TTL |
|------|------|--------------|-----|
| A    | @    | YOUR_SERVER_IP | 300 |
| A    | www  | YOUR_SERVER_IP | 300 |

### 7.2 Wait for Propagation

DNS can take 5–60 minutes. Check with:

```bash
dig YOUR_DOMAIN.com +short
```

---

## Part 8: Supabase Configuration

### 8.1 Allowed URLs

In Supabase Dashboard → **Authentication** → **URL Configuration**:

- **Site URL**: `https://YOUR_DOMAIN.com` (or `http://YOUR_SERVER_IP` for testing)
- **Redirect URLs**: add:
  - `https://YOUR_DOMAIN.com/**`
  - `https://YOUR_DOMAIN.com/auth/callback`
  - `http://YOUR_SERVER_IP/**` (if testing without domain)

---

## Part 9: Useful Commands

| Task              | Command                          |
|-------------------|----------------------------------|
| View logs         | `pm2 logs terra-invest`          |
| Restart app       | `pm2 restart terra-invest`       |
| Stop app          | `pm2 stop terra-invest`          |
| Nginx status      | `sudo systemctl status nginx`    |
| Nginx reload      | `sudo systemctl reload nginx`    |

---

## Part 10: Troubleshooting

### App won't start

```bash
pm2 logs terra-invest --lines 50
```

Check `.env.local` and that `npm run build` succeeds.

### 502 Bad Gateway

- App not running: `pm2 restart terra-invest`
- Wrong port: Nginx should proxy to `http://127.0.0.1:3000`

### Auth redirect issues

- Add your domain/IP to Supabase redirect URLs
- Ensure `NEXT_PUBLIC_SUPABASE_URL` matches your Supabase project

### Out of memory

Upgrade Linode plan or add swap:

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Quick Reference: First-Time Setup

```bash
# 1. SSH in
ssh root@YOUR_IP

# 2. Create user
adduser terra && usermod -aG sudo terra && su - terra

# 3. Install stack
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git
sudo npm install -g pm2

# 4. Deploy
cd ~ && git clone YOUR_REPO terra_invest && cd terra_invest
npm install
nano .env.local   # Add Supabase vars
npm run build
pm2 start npm --name "terra-invest" -- start
pm2 save && pm2 startup

# 5. Nginx
sudo nano /etc/nginx/sites-available/terra-invest   # Config from Part 4
sudo ln -s /etc/nginx/sites-available/terra-invest /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
sudo ufw allow 22,80,443 && sudo ufw enable
```

---

## Next Steps for Production

1. **Monitoring**: Use Linode Longview or external monitoring
2. **Backups**: Enable Linode Backups
3. **CDN**: Cloudflare in front of your domain
4. **Database**: Supabase is hosted; no extra DB setup needed
5. **Scaling**: Upgrade Linode plan or add more instances behind a load balancer
