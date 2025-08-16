# ResQPost

End-to-end sample stack for a DevOps/Cloud capstone:
- **Backend:** Flask + SQLAlchemy
- **Frontend:** React
- **DB (local demo):** SQLite (file)
- **DB (containerized):** Postgres (via docker-compose) — optional
- **IaC:** Terraform
- **CI/CD:** GitHub Actions
- **Orchestration (local):** Ansible

---

## Repo Layout

```
RESQPOST/
├── backend/
│   ├── app.py                 # Flask main application
│   ├── models.py              # SQLAlchemy models
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile             # Backend Docker configuration
│   ├── .env.example           # Environment variables template
│   └── venv/                  # (optional) legacy venv; not required with Ansible
├── frontend/
│   ├── public/
│   │   ├── index.html         # Main HTML template
│   │   └── favicon.ico        # App icon
│   ├── src/
│   │   ├── components/
│   │   │   ├── AlertDetail.js # Alert details page
│   │   │   ├── AlertForm.js   # Submit alert form
│   │   │   ├── AlertList.js   # List all alerts
│   │   │   ├── MapView.js     # Map view with pins
│   │   │   └── Home.js        # Landing page
│   │   ├── App.js             # Main React component
│   │   ├── index.js           # React entry point
│   │   └── App.css            # Global styles
│   ├── package.json           # NPM dependencies
│   ├── package-lock.json      # NPM lock file
│   └── Dockerfile             # Frontend Docker configuration
├── ansible/
│   ├── up.yml                 # Bring everything up (build once, fast starts)
│   ├── up_fast.yml            # FAST: CRA dev server (no build)
│   └── down.yml               # Tear everything down
├── docker-compose.yml         # Multi-container setup (optional)
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # GitHub Actions pipeline
└── README.md                  # Project documentation
```

---

## ⚡ Recommended: Open in WSL for Speed

If you're on Windows, use **VS Code Remote – WSL** (much faster than `/mnt/c` for Node/React):

1. Copy the project into Linux:
   ```bash
   mkdir -p ~/projects
   rsync -a "/mnt/c/Users/<you>/Downloads/Capstone/Capestone-ResQPost/"      ~/projects/Capestone-ResQPost/
   cd ~/projects/Capestone-ResQPost
   ```
2. Open in VS Code (WSL window):
   ```bash
   code .
   ```

> You’ll see `WSL: Ubuntu` in the VS Code status bar.

---

## Prereqs (Ubuntu/WSL)

Install Ansible once:
```bash
sudo apt-get update -y
sudo apt-get install -y ansible
```

(First run of the playbooks may prompt for your sudo password to install a few packages.)

---
### Give Appropriate Permissions for Docker

```bash
# 1) Make sure Docker Desktop is running on Windows
#    Settings → Resources → WSL Integration → Enable for "Ubuntu"

# 2) In WSL, add your user to the docker group (so no sudo needed)
sudo groupadd docker 2>/dev/null || true
sudo usermod -aG docker $USER

# 3) Refresh your shell's groups (no reboot needed)
newgrp docker

# 4) Sanity check
docker ps
docker compose version || docker-compose --version
```
---
### Create fronend/.env.local
```bash
REACT_APP_API_URL=http://127.0.0.1:5000

```
---

## Quickstart (Ansible)

### Standard (build once, then fast starts)
```bash
# Bring everything up (builds frontend once, starts Flask + static build)
ansible-playbook -i localhost, -c local ansible/up.yml -K
# If prompted for sudo, add -K: ansible-playbook ... up.yml -K
```

### Fast Mode (no build, runs CRA dev server)
```bash
ansible-playbook -i localhost, -c local ansible/up_fast.yml
```

### Tear down (both modes)
```bash
ansible-playbook -i localhost, -c local ansible/down.yml
```

**Endpoints**
- Frontend: http://localhost:3000  
- Backend (Flask): http://127.0.0.1:5000  
- Logs: `./logs/backend.out`, `./logs/frontend.out`

---

## Environment & Databases

- **Local demo default:** SQLite file at `backend/resqpost.db`  
  (Ansible sets `DATABASE_URL=sqlite:////<abs-path>/backend/resqpost.db`.)

- **Docker Postgres (optional):** Put this in `backend/.env`:
  ```env
  DATABASE_URL=postgresql+psycopg2://postgres:postgres@db:5432/resqpost
  ```
  Then:
  ```bash
  # Requires Docker Desktop with WSL integration enabled
  docker compose up -d --build
  docker compose down -v
  ```

If `backend/.env` doesn’t exist, the playbook will copy `.env.example` if present.

---

## Common Operations

**Watch logs**
```bash
tail -n 50 -f logs/backend.out
tail -n 50 -f logs/frontend.out
```

**Free ports (if a previous process is stuck)**
```bash
fuser -k 5000/tcp 3000/tcp || true
```

**Node version**
- Playbooks use **Node 20 (LTS)** via `nvm` (more stable for CRA).
- If `npm ci` fails due to lock mismatch, the playbook falls back to `npm install`.

---

## Terraform (IaC)

```bash
cd terraform
terraform init
terraform plan
terraform apply
# destroy when done
terraform destroy
```

---

## CI/CD (GitHub Actions)

- Workflow file: `.github/workflows/ci-cd.yml`
- Use PRs, code review, and branching per your course requirements.
- Recommended: add unit tests (backend with `pytest`, frontend with `jest`) and publish coverage in the pipeline.

---

## Troubleshooting

- **Frontend build is slow**  
  Make sure you’re running in **WSL home** (`~/projects/...`) not `/mnt/c/...`.

- **Frontend dev server exits early / OOM**  
  Use Fast Mode (`ansible/up_fast.yml`), which sets memory flags and skips the heavy build.

- **Ansible asks for sudo**  
  Add `-K` once (you’ll be prompted for your password), or pre-install:
  ```bash
  sudo apt-get update -y
  sudo apt-get install -y python3 python3-venv python3-pip curl psmisc
  ```

- **Module not found / case mismatch**  
  Linux is case-sensitive. Ensure your import paths match filenames exactly.

---

## Notes

- These playbooks run everything **locally** for a quick, reproducible demo.
- For production-style runs, prefer Docker + a managed database + your CI/CD workflow.
- SQLite is for local dev only; swap to Postgres when containerized or in cloud.
