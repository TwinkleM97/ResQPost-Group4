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

## Prereqs

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
### Test CICD Pipeline with act
```bash
ansible-playbook -i localhost, -c local ansible/ci.yml

```
---

## Terraform (IaC)

### Install AWS CLI for windows and just hit next until done

### Run the following command to see and add the aws to PATH on git bash

```bash
ls -l "/c/Program Files/Amazon/AWSCLIV2/aws.exe" \
      "/c/Program Files/Amazon/AWSCLI/bin/aws.exe" 2>/dev/null

#If first path
export PATH="/c/Program Files/Amazon/AWSCLIV2:$PATH"

#If second path
export PATH="/c/Program Files/Amazon/AWSCLI/bin:$PATH"

#Verify
aws --version

```
### If aws is not configured run the following

```bash
aws configure --profile capstone
# fill in: key, secret, region (e.g., us-east-1), output json

export AWS_PROFILE=capstone
export AWS_REGION=us-east-1   # or your region

```

### If running locally export terraform.exe to C:/terraform folder and add it to Sys Path
### Run the following to let git bash see the path

```bash
# point Git Bash to your Windows folder
export PATH="/c/terraform:$PATH"

# verify
which terraform
terraform -version

```

```bash
cd terraform
terraform init
terraform plan
terraform apply
# destroy when done..
terraform destroy
```
### Output will look like

```bash
Outputs:

app_ip = "<your-public-ip>"
db_host = "resqpost-pg.<any-random-string>.us-east-1.rds.amazonaws.com"
db_port = 5432

```
---

## Troubleshooting 'Could not submit alert'

### In case the alerts are not submitting, the alerts table was not created successfully.

```bash
#ssh into your ec2.
ssh -i resqpost-key.pem ec2-user@<your-public-ec2-ip>

#Show docker containers (should show resqpost-db)
docker ps

#Create table alerts

docker exec -it resqpost-db psql -U postgres -d resqpost \
  -c "CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50),
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    image_url TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
  );"

```

## CI/CD (GitHub Actions)

- Workflow file: `.github/workflows/ci-cd.yml`
- Use PRs, code review, and branching per your course requirements.
- Recommended: add unit tests (backend with `pytest`, frontend with `jest`) and publish coverage in the pipeline.

---

## Troubleshooting

### Note: If max vpc reached error occurs, do the following

```bash
#List existing vpc
aws ec2 describe-vpcs --query 'Vpcs[].{VpcId:VpcId, Cidr:CidrBlock, IsDefault:IsDefault, Name:Tags[?Key==`Name`]|[0].Value}' --output table

#Delete one of the vpc's

# Replace VPC_ID=...
VPC_ID=vpc-xxxxxxxx

# delete resources inside (example sequence)
# Subnets
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[].SubnetId' --output text | tr '\t' '\n' | while read S; do
  # NAT gateways in subnet
  aws ec2 describe-nat-gateways --filter Name=subnet-id,Values=$S --query 'NatGateways[].NatGatewayId' --output text | tr '\t' '\n' | xargs -r -n1 aws ec2 delete-nat-gateway --nat-gateway-id
  # ENIs in subnet
  aws ec2 describe-network-interfaces --filters "Name=subnet-id,Values=$S" --query 'NetworkInterfaces[].NetworkInterfaceId' --output text | tr '\t' '\n' | while read N; do
    aws ec2 detach-network-interface --attachment-id $(aws ec2 describe-network-interfaces --network-interface-ids $N --query 'NetworkInterfaces[0].Attachment.AttachmentId' --output text 2>/dev/null) 2>/dev/null || true
    aws ec2 delete-network-interface --network-interface-id $N 2>/dev/null || true
  done
  aws ec2 delete-subnet --subnet-id $S
done

# Detach & delete Internet Gateway
IGW=$(aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$VPC_ID" --query 'InternetGateways[].InternetGatewayId' --output text)
[ -n "$IGW" ] && aws ec2 detach-internet-gateway --internet-gateway-id "$IGW" --vpc-id "$VPC_ID" && aws ec2 delete-internet-gateway --internet-gateway-id "$IGW"

# Delete non-main route tables
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$VPC_ID" --query 'RouteTables[?Associations[?Main!=`true`]].RouteTableId' --output text | tr '\t' '\n' | xargs -r -n1 aws ec2 delete-route-table --route-table-id

# Delete non-default security groups
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text | tr '\t' '\n' | xargs -r -n1 aws ec2 delete-security-group --group-id

# Finally, delete the VPC
aws ec2 delete-vpc --vpc-id "$VPC_ID"


```
### If RDS DB already exists add to the group

```bash
# make sure your provider is pointed at the same account/region as the existing group
export AWS_PROFILE=capstone
export AWS_REGION=us-east-1

# see it in AWS (optional)
aws rds describe-db-subnet-groups --db-subnet-group-name resqpost-dbsubnet --query 'DBSubnetGroups[0].DBSubnetGroupName'

# import into state (resource address must match your code)
terraform import aws_db_subnet_group.dbsubnet resqpost-dbsubnet


```

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
