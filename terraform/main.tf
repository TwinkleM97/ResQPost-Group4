terraform {
  required_version = ">= 1.5"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_availability_zones" "az" {}

########################
# VPC & networking
########################
resource "aws_vpc" "vpc" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = { Name = "resqpost-vpc", Project = var.project }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.vpc.id
  tags   = { Name = "resqpost-igw", Project = var.project }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.vpc.id
  cidr_block              = cidrsubnet(aws_vpc.vpc.cidr_block, 4, count.index)
  availability_zone       = data.aws_availability_zones.az.names[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "resqpost-public-${count.index}", Project = var.project }
}

resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.vpc.id
  tags   = { Name = "resqpost-public-rt", Project = var.project }
}

resource "aws_route" "default" {
  route_table_id         = aws_route_table.public_rt.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.igw.id
}

resource "aws_route_table_association" "assoc" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public_rt.id
}

########################
# Security group
########################
resource "aws_security_group" "app_sg" {
  name   = "resqpost-app-sg"
  vpc_id = aws_vpc.vpc.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "resqpost-app-sg", Project = var.project }
}

########################
# S3 bucket (optional create)
########################
resource "random_id" "bucket" {
  count       = var.create_bucket && length(var.bucket_name) == 0 ? 1 : 0
  byte_length = 4
}

locals {
  generated_bucketname = length(random_id.bucket) > 0 ? lower("${var.project}-uploads-${random_id.bucket[0].hex}") : ""
  uploads_bucket_name  = length(var.bucket_name) > 0 ? var.bucket_name : (
    var.create_bucket ? local.generated_bucketname : ""  # if not creating, must set var.bucket_name
  )
}

resource "aws_s3_bucket" "uploads" {
  count         = var.create_bucket ? 1 : 0
  bucket        = local.uploads_bucket_name
  force_destroy = true
  tags          = { Name = local.uploads_bucket_name, Project = var.project }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  count  = var.create_bucket && var.manage_bucket_policy ? 1 : 0
  bucket = aws_s3_bucket.uploads[0].id

  block_public_acls       = !var.s3_public_read
  block_public_policy     = !var.s3_public_read
  ignore_public_acls      = !var.s3_public_read
  restrict_public_buckets = !var.s3_public_read
}

resource "aws_s3_bucket_policy" "uploads_public" {
  count  = var.manage_bucket_policy && var.s3_public_read ? 1 : 0
  bucket = var.create_bucket ? aws_s3_bucket.uploads[0].id : local.uploads_bucket_name
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Sid       = "AllowPublicReadUploadsPrefix",
      Effect    = "Allow",
      Principal = "*",
      Action    = ["s3:GetObject"],
      Resource  = "arn:aws:s3:::${local.uploads_bucket_name}/uploads/*"
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.uploads]
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  count  = var.create_bucket && var.manage_bucket_policy ? 1 : 0
  bucket = aws_s3_bucket.uploads[0].id
  cors_rule {
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

########################
# CloudWatch logs
########################
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/${var.project}/backend"
  retention_in_days = var.log_retention_days
  tags              = { Project = var.project }
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/${var.project}/frontend"
  retention_in_days = var.log_retention_days
  tags              = { Project = var.project }
}

resource "aws_cloudwatch_log_group" "postgres" {
  name              = "/${var.project}/postgres"
  retention_in_days = var.log_retention_days
  tags              = { Project = var.project }
}

########################
# IAM for EC2 (logs + S3)
########################
resource "aws_iam_role" "ec2_role" {
  name = "${var.project}-ec2-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "ec2.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
  tags = { Project = var.project }
}

resource "aws_iam_role_policy" "ec2_inline" {
  name = "${var.project}-ec2-inline"
  role = aws_iam_role.ec2_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:DescribeLogStreams",
          "logs:PutLogEvents"
        ],
        Resource = "*"
      },
      {
        Effect = "Allow",
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ],
        Resource = [
          "arn:aws:s3:::${local.uploads_bucket_name}",
          "arn:aws:s3:::${local.uploads_bucket_name}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project}-ec2-instance-profile"
  role = aws_iam_role.ec2_role.name
  tags = { Project = var.project }
}

########################
# EC2 app
########################
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64"
}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  key_name               = var.key_name

  iam_instance_profile = aws_iam_instance_profile.ec2_profile.name

  user_data = templatefile("${path.module}/user-data.sh", {
    # DB in Docker
    db_user        = var.db_user
    db_password    = var.db_password
    db_name        = var.db_name

    # Containers
    backend_image  = var.backend_image
    frontend_image = var.frontend_image

    # AWS region for logs + SDKs
    aws_region     = var.aws_region

    # S3 params for backend + (optional) Nginx redirect
    s3_bucket      = local.uploads_bucket_name
    s3_public_read = var.s3_public_read

    # CloudWatch log groups
    cw_logs_backend  = aws_cloudwatch_log_group.backend.name
    cw_logs_frontend = aws_cloudwatch_log_group.frontend.name
    cw_logs_postgres = aws_cloudwatch_log_group.postgres.name
  })

  tags = { Name = "resqpost-app", Project = var.project }
}

########################
# Alarms (EC2)
########################
resource "aws_cloudwatch_metric_alarm" "ec2_high_cpu" {
  alarm_name          = "${var.project}-ec2-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 70
  dimensions          = { InstanceId = aws_instance.app.id }
  alarm_description   = "EC2 CPU > 70% (5 min)"
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "ec2_status_failed" {
  alarm_name          = "${var.project}-ec2-status-check-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  dimensions          = { InstanceId = aws_instance.app.id }
  alarm_description   = "EC2 instance status check failed"
  treat_missing_data  = "notBreaching"
}

########################
# Outputs
########################
output "app_public_ip"  { value = aws_instance.app.public_ip }
output "uploads_bucket" { value = local.uploads_bucket_name }
output "logs_backend"   { value = aws_cloudwatch_log_group.backend.name }
output "logs_frontend"  { value = aws_cloudwatch_log_group.frontend.name }
output "logs_postgres"  { value = aws_cloudwatch_log_group.postgres.name }
