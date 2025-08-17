############################
# Global / Project settings
############################
variable "project" {
  description = "Project tag/prefix."
  type        = string
  default     = "resqpost"
}

variable "aws_region" {
  description = "AWS region (e.g., us-east-1)."
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR allowed to SSH (e.g., 203.0.113.10/32)."
  type        = string
}

############################
# Database (Dockerized PG)
############################
variable "db_user" {
  description = "PostgreSQL username."
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "PostgreSQL password."
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "resqpost"
}

############################
# EC2 / SSH
############################
variable "key_name" {
  description = "EC2 key pair name (or null)."
  type        = string
  default     = null
}

############################
# Container images
############################
variable "backend_image" {
  description = "Backend image (e.g. twinklem97/resqpost-backend:latest)."
  type        = string
  default     = ""      # <-- make optional
}

variable "frontend_image" {
  description = "Frontend image (e.g. twinklem97/resqpost-frontend:latest)."
  type        = string
  default     = ""     
}
# Fallback to :latest on Docker Hub if CI doesn't pass an image
locals {
  backend_image_effective  = var.backend_image  != "" ? var.backend_image  : "docker.io/twinklem97/resqpost-backend:latest"
  frontend_image_effective = var.frontend_image != "" ? var.frontend_image : "docker.io/twinklem97/resqpost-frontend:latest"
}

############################
# S3 uploads
############################
variable "bucket_name" {
  description = "If set, use this bucket name for uploads; if empty and create_bucket=true, one is generated."
  type        = string
  default     = ""
}

variable "create_bucket" {
  description = "Create an S3 bucket (true) or use existing (false)."
  type        = bool
  default     = true
}

variable "manage_bucket_policy" {
  description = "Manage public-read policy/CORS on the bucket from Terraform."
  type        = bool
  default     = true
}

variable "s3_public_read" {
  description = "If true, images are publicly readable. Otherwise backend will return signed URLs."
  type        = bool
  default     = true
}

############################
# CloudWatch / Logging
############################
variable "log_retention_days" {
  description = "CloudWatch Logs retention in days."
  type        = number
  default     = 30
}
