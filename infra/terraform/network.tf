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

  ingress {
    description = "Public HTTP for the web application"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Package installs, PyPI, S3 and the SSM/CloudWatch endpoints"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "db" {
  name        = "fault-register-db"
  description = "PostgreSQL reachable only from the web server"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from the EC2 backend"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.web.id]
  }
}
