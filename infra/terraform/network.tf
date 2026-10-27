data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_hostnames = true
  tags                 = { Name = "fault-register" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

# The web server needs a public subnet for its Elastic IP. There is no NAT
# gateway: the database never needs outbound internet access, and a NAT gateway
# would be the most expensive always-on part of this small deployment.
resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.20.1.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
  tags              = { Name = "fault-register-public" }
}

# RDS requires a subnet group spanning two availability zones even for a
# single-AZ instance.
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.20.${count.index + 11}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = { Name = "fault-register-private-${count.index}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "web" {
  name        = "fault-register-web"
  description = "Public HTTP to Nginx only; no SSH, administration uses SSM"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "db" {
  name        = "fault-register-db"
  description = "PostgreSQL reachable only from the web server"
  vpc_id      = aws_vpc.main.id
}

# Rules are separate resources so the web and database groups can refer to
# each other without a dependency cycle.
resource "aws_vpc_security_group_ingress_rule" "web_http" {
  security_group_id = aws_security_group.web.id
  description       = "Public HTTP for the web application"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"
}

# The web server has no route to the open internet on any port. It reaches S3
# (release bundles and the Amazon Linux package repositories, which are hosted
# in S3) through the free gateway endpoint, and SSM, Parameter Store and
# CloudWatch through interface endpoints inside the VPC.
resource "aws_vpc_security_group_egress_rule" "web_to_s3" {
  security_group_id = aws_security_group.web.id
  description       = "HTTPS to S3 through the gateway endpoint"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  prefix_list_id    = aws_vpc_endpoint.s3.prefix_list_id
}

resource "aws_vpc_security_group_egress_rule" "web_to_endpoints" {
  security_group_id            = aws_security_group.web.id
  description                  = "HTTPS to the SSM and CloudWatch interface endpoints"
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.endpoints.id
}

resource "aws_vpc_security_group_egress_rule" "web_to_db" {
  security_group_id            = aws_security_group.web.id
  description                  = "PostgreSQL to RDS only"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.db.id
}

resource "aws_vpc_security_group_ingress_rule" "db_from_web" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL from the EC2 backend"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.web.id
}

resource "aws_security_group" "endpoints" {
  name        = "fault-register-endpoints"
  description = "Interface endpoints reachable only from the web server"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "endpoints_from_web" {
  security_group_id            = aws_security_group.endpoints.id
  description                  = "HTTPS from the EC2 backend"
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.web.id
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.public.id]
}

# One subnet only: each interface endpoint is billed per AZ per hour, and the
# single web server lives in one AZ.
resource "aws_vpc_endpoint" "interface" {
  for_each            = toset(["ssm", "ssmmessages", "ec2messages", "monitoring"])
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.region}.${each.key}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.public.id]
  security_group_ids  = [aws_security_group.endpoints.id]
  private_dns_enabled = true
}
