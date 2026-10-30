# us-west-2 (Oregon) instead of us-east-1, the other region the Learner Lab allows.
# Annual eGRID 2023 averages for the two grids are close (Virginia slightly lower),
# so this choice does not reduce carbon on its own.
variable "region" {
  description = "AWS region for every resource"
  type        = string
  default     = "us-west-2"
}

variable "instance_type" {
  description = "EC2 size for Nginx and FastAPI together"
  type        = string
  default     = "t3.micro"
}

variable "db_instance_class" {
  description = "RDS size"
  type        = string
  default     = "db.t3.micro"
}

variable "instance_profile" {
  description = "Existing instance profile (AWS Academy accounts cannot create IAM roles)"
  type        = string
  default     = "LabInstanceProfile"
}
