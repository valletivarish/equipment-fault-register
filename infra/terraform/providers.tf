terraform {
  required_version = ">= 1.10"

  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.70" }
    random = { source = "hashicorp/random", version = "~> 3.7" }
  }

  # Bucket and key are passed at init time (-backend-config) because the state
  # bucket is created once per AWS account by scripts/bootstrap-state.sh.
  # use_lockfile gives S3-native state locking without a DynamoDB table.
  backend "s3" {
    key          = "fault-register/terraform.tfstate"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = { Project = "fault-register", ManagedBy = "terraform" }
  }
}
