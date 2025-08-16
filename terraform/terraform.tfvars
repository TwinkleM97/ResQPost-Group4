aws_region       = "us-east-1"
allowed_ssh_cidr = "174.116.34.102/32"

db_user     = "postgres"
db_password = "ChangeMe123!" # change if you want
db_name     = "resqpost"

backend_image  = "docker.io/twinklem97/resqpost-backend:latest"
frontend_image = "docker.io/twinklem97/resqpost-frontend:latest"

# optional: uncomment if you want SSH and have a key pair in AWS
key_name = "resqpost-key"

# Create a bucket (or set create_bucket=false to reuse)
create_bucket         = true
bucket_name           = "resqpost-s3-g4"  
manage_bucket_policy  = true        
s3_public_read        = true

log_retention_days = 30