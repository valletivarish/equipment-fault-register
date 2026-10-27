#!/bin/bash
# Run once per AWS account before the first terraform init. Creates two private
# S3 buckets: Terraform state (shared by the laptop and CI) and release bundles.
# Both are created here because the AWS Academy account policy blocks a read
# that Terraform's aws_s3_bucket resource needs; Terraform manages the release
# bucket's settings afterwards.
set -euo pipefail
REGION=${AWS_REGION:-us-west-2}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

create_private_bucket() {
  local bucket=$1
  if ! aws s3api head-bucket --bucket "$bucket" --region "$REGION" 2>/dev/null; then
    # Outside us-east-1, S3 needs the region named as a location constraint.
    if [ "$REGION" = us-east-1 ]; then
      aws s3api create-bucket --bucket "$bucket" --region "$REGION"
    else
      aws s3api create-bucket --bucket "$bucket" --region "$REGION" \
        --create-bucket-configuration LocationConstraint="$REGION"
    fi
  fi
  aws s3api put-bucket-versioning --bucket "$bucket" --region "$REGION" \
    --versioning-configuration Status=Enabled
  aws s3api put-public-access-block --bucket "$bucket" --region "$REGION" \
    --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  echo "$bucket"
}

create_private_bucket "fault-register-tfstate-$ACCOUNT_ID"
create_private_bucket "fault-register-releases-$ACCOUNT_ID"
