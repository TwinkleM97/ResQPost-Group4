output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.resqpost_server.id
}

output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_eip.resqpost_eip.public_ip
}

output "instance_public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = aws_instance.resqpost_server.public_dns
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.resqpost_sg.id
}