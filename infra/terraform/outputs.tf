output "app_url" {
  value = "http://${aws_eip.web.public_ip}"
}

output "instance_id" {
  value = aws_instance.web.id
}

output "release_bucket" {
  value = local.release_bucket
}

output "db_endpoint" {
  value = aws_db_instance.main.address
}
