variable "region" {
  description = "AWS region for every resource"
  type        = string
  default     = "us-east-1"
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
