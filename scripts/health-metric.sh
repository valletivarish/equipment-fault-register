#!/bin/bash
# Called every minute by fault-register-health.timer. Sends 1 to CloudWatch
# when /api/health (Nginx -> FastAPI -> RDS) answers, otherwise 0.
TOKEN=$(curl -fsS -X PUT http://169.254.169.254/latest/api/token \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
REGION=$(curl -fsS -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/placement/region)

if curl -fsS -m 5 http://127.0.0.1/api/health > /dev/null; then value=1; else value=0; fi
aws cloudwatch put-metric-data --region "$REGION" --namespace FaultRegister \
  --metric-name AppHealthy --value "$value"
