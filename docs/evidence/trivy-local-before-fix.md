| Tool | Version | CRITICAL | HIGH | MEDIUM | LOW | Result |
|---|---|---|---|---|---|---|
| trivy | 0.76.1 | 1 | 1 | 4 | 2 | **FAIL** |

- LOW AWS-0089 S3 Bucket Logging (app.tf)
- HIGH AWS-0132 S3 encryption should use Customer Managed Keys (app.tf)
- MEDIUM AWS-0077 RDS Cluster and RDS instance should have backup retention longer than default 1 day (database.tf)
- LOW AWS-0133 Enable Performance Insights to detect potential problems (database.tf)
- MEDIUM AWS-0176 RDS IAM Database Authentication Disabled (database.tf)
- MEDIUM AWS-0177 RDS Deletion Protection Disabled (database.tf)
- CRITICAL AWS-0104 A security group rule should not allow unrestricted egress to any IP address. (network.tf)
- MEDIUM AWS-0178 VPC Flow Logs is a feature that enables you to capture information about the IP traffic go (network.tf)
