terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Data sources
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Security Group
resource "aws_security_group" "resqpost_sg" {
  name_prefix = "resqpost-sg"
  description = "Security group for ResQPost application"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
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

  ingress {
    description = "React Dev Server"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Flask API"
    from_port   = 5000
    to_port     = 5000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "resqpost-security-group"
  }
}

# Key Pair
resource "aws_key_pair" "resqpost_key" {
  key_name   = "resqpost-key"
  public_key = file(var.public_key_path)
}

# EC2 Instance
resource "aws_instance" "resqpost_server" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  
  key_name               = aws_key_pair.resqpost_key.key_name
  security_groups        = [aws_security_group.resqpost_sg.name]
  
  associate_public_ip_address = true

  root_block_device {
    volume_type = "gp3"
    volume_size = var.volume_size
    encrypted   = true
  }

  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    docker_compose_version = "2.20.2"
  }))

  tags = {
    Name = "resqpost-server"
    Environment = var.environment
  }
}

# Elastic IP
resource "aws_eip" "resqpost_eip" {
  instance = aws_instance.resqpost_server.id
  domain   = "vpc"

  tags = {
    Name = "resqpost-elastic-ip"
  }
}