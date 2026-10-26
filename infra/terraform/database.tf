resource "random_password" "db_master" {
  length  = 32
  special = false
}

resource "random_password" "db_app" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "fault-register"
  subnet_ids = aws_subnet.private[*].id
}

# Single-AZ micro instance: the register is a small, low-traffic workload, so
# Multi-AZ would double the always-on compute for availability it does not need.
resource "aws_db_instance" "main" {
  identifier                 = "fault-register"
  engine                     = "postgres"
  engine_version             = "16"
  instance_class             = var.db_instance_class
  allocated_storage          = 20
  storage_type               = "gp3"
  storage_encrypted          = true
  db_name                    = "faults"
  username                   = "faultadmin"
  password                   = random_password.db_master.result
  db_subnet_group_name       = aws_db_subnet_group.main.name
  vpc_security_group_ids     = [aws_security_group.db.id]
  publicly_accessible        = false
  multi_az                   = false
  backup_retention_period    = 1
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot      = true
  skip_final_snapshot        = true
  apply_immediately          = true
}

# The deploy script on EC2 reads these at release time, so database
# credentials never pass through GitHub or the frontend bundle.
resource "aws_ssm_parameter" "db_host" {
  name  = "/fault-register/db/host"
  type  = "String"
  value = aws_db_instance.main.address
}

resource "aws_ssm_parameter" "db_master_password" {
  name  = "/fault-register/db/master-password"
  type  = "SecureString"
  value = random_password.db_master.result
}

resource "aws_ssm_parameter" "db_app_password" {
  name  = "/fault-register/db/app-password"
  type  = "SecureString"
  value = random_password.db_app.result
}
