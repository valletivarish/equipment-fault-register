# AppHealthy is pushed every minute by the health timer on EC2 (1 = /api/health
# returned ok, 0 = it did not). CPU comes from the free 5-minute EC2 and RDS
# metrics; detailed 1-minute monitoring is not enabled to avoid extra cost.
# Alarm notifications. The e-mail subscription is added once with the CLI
# (aws sns subscribe), so no personal address is kept in this repository.
# Alarm messages carry no secrets; the AWS managed key avoids a monthly key charge.
#trivy:ignore:AWS-0136
resource "aws_sns_topic" "alerts" {
  name              = "fault-register-alerts"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_cloudwatch_metric_alarm" "app_unhealthy" {
  alarm_name          = "fault-register-app-unhealthy"
  alarm_description   = "Health check on EC2 failed for 3 consecutive minutes"
  namespace           = "FaultRegister"
  metric_name         = "AppHealthy"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "web_cpu_high" {
  alarm_name          = "fault-register-web-cpu-high"
  alarm_description   = "Sustained CPU above 80% suggests the instance is undersized"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  dimensions          = { InstanceId = aws_instance.web.id }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "fault-register"
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric", x = 0, y = 0, width = 12, height = 6
        properties = {
          title   = "Application health (1 = healthy)"
          region  = var.region
          stat    = "Minimum"
          period  = 60
          metrics = [["FaultRegister", "AppHealthy"]]
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 12, height = 6
        properties = {
          title  = "CPU utilisation (%)"
          region = var.region
          stat   = "Average"
          period = 300
          metrics = [
            ["AWS/EC2", "CPUUtilization", "InstanceId", aws_instance.web.id, { label = "EC2 web" }],
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.main.identifier, { label = "RDS" }],
          ]
        }
      },
      {
        type = "metric", x = 0, y = 6, width = 12, height = 6
        properties = {
          title  = "RDS free storage (bytes) and connections"
          region = var.region
          stat   = "Average"
          period = 300
          metrics = [
            ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", aws_db_instance.main.identifier],
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", aws_db_instance.main.identifier, { yAxis = "right" }],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 6, width = 12, height = 6
        properties = {
          title   = "EC2 network out (bytes)"
          region  = var.region
          stat    = "Sum"
          period  = 300
          metrics = [["AWS/EC2", "NetworkOut", "InstanceId", aws_instance.web.id]]
        }
      },
    ]
  })
}
