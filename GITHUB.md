# Terra Invest – Upload to GitHub Tutorial

Step-by-step guide to push your project to GitHub so you can deploy it to Linode later.

---

## Part 1: Install Git (if needed)

### Windows

1. Download Git: [git-scm.com/download/win](https://git-scm.com/download/win)
2. Run the installer (default options are fine)
3. Restart your terminal/PowerShell
4. Verify: `git --version`

### macOS

```bash
xcode-select --install
```

Or install via Homebrew: `brew install git`

---

## Part 2: Create a GitHub Account

1. Go to [github.com](https://github.com)
2. Click **Sign up**
3. Create an account (email, password, username)

---

## Part 3: Create a New Repository on GitHub

1. Log in to GitHub
2. Click the **+** in the top-right → **New repository**
3. Fill in:
   - **Repository name**: `terra-invest` (or any name)
   - **Description**: Optional (e.g. "Terra Invest VIP trading platform")
   - **Visibility**: **Private** (recommended) or **Public**
   - **Do NOT** check "Add a README" – your project already has files
4. Click **Create repository**

You’ll see a page with setup instructions. Keep it open.

---

## Part 4: Push Your Project from Your Computer

Open **PowerShell** or **Command Prompt** and run these commands in order.

### 4.1 Go to Your Project Folder

```powershell
cd C:\Users\d\Desktop\terra_invest
```

### 4.2 Initialize Git (first time only)

```powershell
git init
```

### 4.3 Configure Your Identity (first time only)

```powershell
git config user.name "Your Name"
git config user.email "your-email@example.com"
```

Use the same email as your GitHub account.

### 4.4 Check What Will Be Uploaded

Your `.gitignore` already excludes:

- `node_modules`
- `.env.local` (secrets)
- `.next` (build output)

So only source code and config will be pushed. Verify:

```powershell
git status
```

You should see your files listed as untracked.

### 4.5 Add All Files

```powershell
git add .
```

### 4.6 Create the First Commit

```powershell
git commit -m "Initial commit: Terra Invest project"
```

### 4.7 Rename Branch to main (if needed)

```powershell
git branch -M main
```

### 4.8 Connect to GitHub

Replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub username and repo name:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/terra-invest.git
```

Example: `git remote add origin https://github.com/johndoe/terra-invest.git`

### 4.9 Push to GitHub

```powershell
git push -u origin main
```

You’ll be asked to sign in:

- **HTTPS**: GitHub username + Personal Access Token (not your password)
- **SSH**: If you’ve set up SSH keys, use the SSH URL instead

---

## Part 5: GitHub Authentication

### Option A: HTTPS with Personal Access Token

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens**
2. **Tokens (classic)** → **Generate new token**
3. Name it (e.g. "Terra Invest")
4. Expiration: 90 days or No expiration
5. Scopes: check **repo**
6. Generate and copy the token
7. When `git push` asks for a password, paste the token (not your GitHub password)

### Option B: GitHub Desktop (simplest)

1. Download [desktop.github.com](https://desktop.github.com)
2. Sign in with your GitHub account
3. **File** → **Add local repository** → select `C:\Users\d\Desktop\terra_invest`
4. Use the GUI to commit and push

### Option C: SSH Key

1. Generate a key: `ssh-keygen -t ed25519 -C "your-email@example.com"`
2. Add the public key to GitHub: **Settings** → **SSH and GPG keys** → **New SSH key**
3. Use the SSH remote URL: `git@github.com:YOUR_USERNAME/terra-invest.git`

---

## Part 6: Future Updates

After the first push, use this workflow when you change code:

```powershell
cd C:\Users\d\Desktop\terra_invest

git add .
git commit -m "Describe your changes"
git push
```

---

## Part 7: Important – Never Commit Secrets

Your `.gitignore` already excludes `.env*`, so `.env.local` will **not** be pushed.

Never add:

- `.env.local`
- `.env`
- API keys
- Passwords

If you ever commit secrets by mistake:

1. Rotate the keys in Supabase
2. Remove the file from history or use `git filter-branch` / BFG Repo-Cleaner

---

## Quick Reference

| Step              | Command                                      |
|-------------------|----------------------------------------------|
| First-time setup  | `git init` → `git add .` → `git commit -m "Initial commit"` |
| Connect to GitHub | `git remote add origin https://github.com/USER/REPO.git` |
| Push              | `git push -u origin main`                    |
| Later updates     | `git add .` → `git commit -m "Message"` → `git push` |

---

## Troubleshooting

### "git is not recognized"

Install Git and restart the terminal.

### "Permission denied" or "Authentication failed"

Use a Personal Access Token instead of your password, or set up SSH.

### "failed to push some refs"

Someone else pushed first. Run:

```powershell
git pull origin main --rebase
git push
```

### "Repository not found"

Check the remote URL:

```powershell
git remote -v
```

Fix it if needed:

```powershell
git remote set-url origin https://github.com/YOUR_USERNAME/terra-invest.git
```
