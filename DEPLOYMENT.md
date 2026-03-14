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
git clone https://github.com/YOUR_USERNAME/terrainvest.git
cd terrainvest
```

> If your repo is private, use SSH or a personal access token:
> ```bash
> git clone git@github.com:YOUR_USERNAME/terrainvest.git
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
pm2 start npm --name "terrainvest" -- start
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
sudo nano /etc/nginx/sites-available/terrainvest
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
sudo ln -s /etc/nginx/sites-available/terrainvest /etc/nginx/sites-enabled/
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
nano ~/terrainvest/deploy.sh
```

```bash
#!/bin/bash
set -e
cd ~/terrainvest
git pull
npm install
npm run build
pm2 restart terrainvest
echo "Deployment complete! Visit your site to verify."
```

```bash
chmod +x ~/terrainvest/deploy.sh
```

To deploy updates:

```bash
~/terrainvest/deploy.sh
```

---

## Part 7: Point DNS to Your Server

This section explains how to connect your domain (e.g. `example.com`) to your Linode server so visitors reach your app.

### 7.1 What You Need

- **Domain** – purchased from a registrar (Namecheap, GoDaddy, Cloudflare, Google Domains, etc.)
- **Server IP** – your Linode IPv4 address (e.g. `123.45.67.89`)

### 7.2 DNS Records to Add

Add these **A records** at your domain registrar:

| Type | Name (Host) | Value (Points to) | TTL  |
|------|-------------|-------------------|------|
| A    | `@`         | `YOUR_SERVER_IP`  | 300  |
| A    | `www`       | `YOUR_SERVER_IP`  | 300  |

- **@** = root domain (`example.com`)
- **www** = subdomain (`www.example.com`)
- **Value** = your Linode server’s IPv4 address

### 7.3 Step-by-Step by Registrar

#### Namecheap

1. Log in → **Domain List** → click your domain
2. Go to **Advanced DNS**
3. Click **Add New Record**
4. Add:
   - Type: **A Record**
   - Host: `@` → Value: `YOUR_SERVER_IP` → TTL: Automatic
   - Type: **A Record**
   - Host: `www` → Value: `YOUR_SERVER_IP` → TTL: Automatic
5. Remove any existing A records for `@` or `www` that point elsewhere (or they’ll conflict)
6. Save

#### GoDaddy

1. Log in → **My Products** → click your domain → **DNS**
2. Click **Add** (or **Add Record**)
3. Add:
   - Type: **A** → Name: `@` → Value: `YOUR_SERVER_IP` → TTL: 1 Hour
   - Type: **A** → Name: `www` → Value: `YOUR_SERVER_IP` → TTL: 1 Hour
4. Delete old A records for `@` and `www` if they exist
5. Save

#### Cloudflare

1. Log in → select your domain
2. Go to **DNS** → **Records**
3. Add:
   - Type: **A** → Name: `@` → IPv4: `YOUR_SERVER_IP` → Proxy: Off (grey cloud) or On (orange) for CDN
   - Type: **A** → Name: `www` → IPv4: `YOUR_SERVER_IP` → Proxy: same as above
4. Remove conflicting A records
5. Save

> **Cloudflare Proxy (orange cloud):** Hides your server IP and adds CDN. Use **Off** first to test, then enable if you want.

#### Google Domains (now Squarespace)

1. Log in → **My Domains** → click your domain
2. Go to **DNS** (or **Nameservers**)
3. Under **Custom records**, add:
   - Type: **A** → Host: `@` → Data: `YOUR_SERVER_IP` → TTL: 3600
   - Type: **A** → Host: `www` → Data: `YOUR_SERVER_IP` → TTL: 3600
4. Remove old A records if needed
5. Save

#### Linode DNS (if you use Linode for DNS)

1. **DNS** → **Add a domain** (or select existing)
2. Add records:
   - Type: **A** → Hostname: (leave blank for root) → IP: `YOUR_SERVER_IP`
   - Type: **A** → Hostname: `www` → IP: `YOUR_SERVER_IP`
3. Update your domain’s nameservers at the registrar to Linode’s (e.g. `ns1.linode.com`, `ns2.linode.com`)

### 7.4 Understanding the Fields

| Field | Meaning |
|-------|---------|
| **A Record** | Maps a hostname to an IPv4 address |
| **@** | Root domain (example.com) |
| **www** | Subdomain (www.example.com) |
| **TTL** | How long DNS caches the record (300–3600 seconds is fine) |
| **CNAME** | Points one hostname to another; use A records for root and www for simplicity |

### 7.5 After Adding Records

1. **Wait** – DNS can take 5–60 minutes (sometimes up to 48 hours)
2. **Check propagation:**
   ```bash
   dig example.com +short
   dig www.example.com +short
   ```
   Both should return your server IP.
3. **Update Nginx** – Ensure your Nginx config has `server_name example.com www.example.com;` (Part 4)
4. **Get SSL** – Run `sudo certbot --nginx -d example.com -d www.example.com` (Part 5)

### 7.6 Troubleshooting

| Problem | Fix |
|---------|-----|
| Domain shows old site | Wait for DNS propagation; clear browser cache |
| "Site can’t be reached" | Check A records point to correct IP; verify Nginx is running |
| www doesn’t work | Add A record for `www`; check Nginx `server_name` |
| Wrong nameservers | If using Cloudflare/Linode DNS, point domain’s nameservers to them first |

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

## Part 9: Starting Up After a Reboot

When your Linode reboots, run these commands to bring everything back up:

```bash
# 1. SSH in
ssh root@YOUR_SERVER_IP
# (or: ssh terra@YOUR_SERVER_IP if you use the terra user)

# 2. Start the app (PM2)
cd ~/terrainvest
pm2 start terrainvest
# If that fails (app not in PM2), use:
# pm2 start npm --name "terrainvest" -- start

# 3. Start Nginx (usually auto-starts, but just in case)
sudo systemctl start nginx

# 4. Verify
pm2 status
curl -I http://localhost:3000
```

**If PM2 says "process not found":** The app was removed from PM2. Start it again:

```bash
cd ~/terrainvest
pm2 start npm --name "terrainvest" -- start
pm2 save
pm2 startup
```

**If PM2 already auto-started:** Running `pm2 start terrainvest` will just confirm it's running. Check with `pm2 status`.

---

## Part 10: Useful Commands

| Task              | Command                          |
|-------------------|----------------------------------|
| View logs         | `pm2 logs terrainvest`          |
| Restart app       | `pm2 restart terrainvest`       |
| Stop app          | `pm2 stop terrainvest`          |
| Nginx status      | `sudo systemctl status nginx`    |
| Nginx reload      | `sudo systemctl reload nginx`    |

---

## Part 11: Troubleshooting

### App won't start

```bash
pm2 logs terrainvest --lines 50
```

Check `.env.local` and that `npm run build` succeeds.

### 502 Bad Gateway

- App not running: `pm2 restart terrainvest`
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
cd ~ && git clone YOUR_REPO terrainvest && cd terrainvest
npm install
nano .env.local   # Add Supabase vars
npm run build
pm2 start npm --name "terrainvest" -- start
pm2 save && pm2 startup

# 5. Nginx
sudo nano /etc/nginx/sites-available/terrainvest   # Config from Part 4
sudo ln -s /etc/nginx/sites-available/terrainvest /etc/nginx/sites-enabled/
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
