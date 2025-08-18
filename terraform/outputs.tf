# (kept light—main outputs are already in main.tf)
output "docker_images" {
  value = {
    backend  = var.backend_image
    frontend = var.frontend_image
  }
}
