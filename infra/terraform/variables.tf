# us-west-2 (Oregon) is chosen over us-east-1, the other region the Learner Lab
# allows, because its grid has a much lower carbon intensity.
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
