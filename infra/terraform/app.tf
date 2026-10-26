data "aws_ssm_parameter" "al2023_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_instance" "web" {
  ami                         = data.aws_ssm_parameter.al2023_ami.value
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.web.id]
  iam_instance_profile        = var.instance_profile
  associate_public_ip_address = true
  user_data                   = file("${path.module}/../../scripts/ec2-bootstrap.sh")
  monitoring                  = false

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 8
    encrypted   = true
  }

  # A newer AMI must not replace the running server on every apply; the
  # instance is updated in place by dnf instead.
  lifecycle {
    ignore_changes = [ami, user_data]
  }

  tags = { Name = "fault-register-web" }
}

# The Elastic IP is the stable public address given to examiners. It is kept
# for the whole assessment period and re-associated if the instance changes.
resource "aws_eip" "web" {
  domain = "vpc"
  tags   = { Name = "fault-register-web" }
}

resource "aws_eip_association" "web" {
  instance_id   = aws_instance.web.id
  allocation_id = aws_eip.web.id
}

resource "random_id" "bucket_suffix" {
  byte_length = 3
}

# Release bundles uploaded by the CD job and pulled by EC2 through SSM.
resource "aws_s3_bucket" "releases" {
  bucket        = "fault-register-releases-${random_id.bucket_suffix.hex}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "releases" {
  bucket                  = aws_s3_bucket.releases.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# SSE-S3 rather than a customer-managed KMS key: the bucket holds only code
# bundles (no secrets or user data), and a CMK would add a monthly key charge
# and key-policy management for no real gain in this risk profile.
#trivy:ignore:AWS-0132
resource "aws_s3_bucket_server_side_encryption_configuration" "releases" {
  bucket = aws_s3_bucket.releases.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "releases" {
  bucket = aws_s3_bucket.releases.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Old release bundles are deleted after 30 days so storage does not grow with
# every push; recent ones stay available for rollback.
resource "aws_s3_bucket_lifecycle_configuration" "releases" {
  bucket = aws_s3_bucket.releases.id

  rule {
    id     = "expire-old-releases"
    status = "Enabled"
    filter {}

    expiration {
      days = 30
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}
