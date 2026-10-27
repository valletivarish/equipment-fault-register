# Adopts resources created by a local apply whose state upload was interrupted.

import {
  to = aws_security_group.endpoints
  id = "sg-05a31e5b02591c7b8"
}

import {
  to = aws_vpc_endpoint.interface["ec2messages"]
  id = "vpce-062671a605b36644e"
}

import {
  to = aws_vpc_endpoint.interface["monitoring"]
  id = "vpce-0a58d1481963cb0b8"
}

import {
  to = aws_vpc_endpoint.interface["ssm"]
  id = "vpce-099df837d89982dd6"
}

import {
  to = aws_vpc_endpoint.interface["ssmmessages"]
  id = "vpce-0cb3e89bf6fe9d11f"
}

import {
  to = aws_vpc_endpoint.s3
  id = "vpce-0f97877d9a2a9d65d"
}

import {
  to = aws_vpc_security_group_egress_rule.web_to_endpoints
  id = "sgr-072c86875d31002ee"
}

import {
  to = aws_vpc_security_group_egress_rule.web_to_s3
  id = "sgr-0b95ddc0d93304813"
}

import {
  to = aws_vpc_security_group_ingress_rule.endpoints_from_web
  id = "sgr-0534f1d31092857a7"
}
