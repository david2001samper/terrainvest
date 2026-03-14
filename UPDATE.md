# Terra Invest – Update Server Guide

How to deploy local changes to your Linode server.

---

## Quick Steps

### 1. Push to GitHub (on your PC)

```powershell
cd C:\Users\d\Desktop\terra_invest
git add .
git commit -m "Describe your changes"
git push
```

### 2. Update on Server (SSH into Linode)

```bash
cd ~/terrainvest
git pull
npm install
npm run build
pm2 restart terrainvest
```

### 3. Run Database Migrations (if any)

If the update includes new SQL migrations:

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy the contents of the migration file (e.g. `supabase-migration-default-balance.sql`, `supabase-migration-deposits-withdrawals.sql`)
3. Paste and run

**Migration files:**
- `supabase-migration-default-balance.sql` – default balance for new users
- `supabase-migration-deposits-withdrawals.sql` – deposits, withdrawals, lock accounts, content pages
- `supabase-migration-home-content.sql` – home page editable sections (journey, mission, values, CTA)
- `supabase-migration-testimonials.sql` – client testimonials & video testimonials for homepage
- `supabase-migration-fix-signup-trigger.sql` – fix "Database error saving new user" on signup

---

## Using the Deploy Script

If you set up the deploy script:

```bash
~/terrainvest/deploy.sh
```

This runs: `git pull` → `npm install` → `npm run build` → `pm2 restart terrainvest`

---

## Checklist

| Step | Where | Command |
|------|-------|---------|
| 1. Commit & push | Your PC | `git add .` → `git commit -m "message"` → `git push` |
| 2. Pull & rebuild | Linode | `cd ~/terrainvest` → `git pull` → `npm run build` → `pm2 restart terrainvest` |
| 3. DB migrations | Supabase | Run any new `.sql` files in SQL Editor |

---

## Troubleshooting

- **Build fails:** Check `npm run build` output; may need more memory (add swap)
- **App won't start:** `pm2 logs terrainvest --lines 50`
- **Old content showing:** Hard refresh (Ctrl+Shift+R) or clear cache
