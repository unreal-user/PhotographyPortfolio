# ==============================================================================
# PHASE 1 OUTPUTS: DNS & SSL Certificate
# ==============================================================================

output "hosted_zone_id" {
  description = "Route53 hosted zone ID"
  value       = aws_route53_zone.main.zone_id
}

output "hosted_zone_name_servers" {
  description = "Route53 hosted zone name servers (configure these at your domain registrar)"
  value       = aws_route53_zone.main.name_servers
}

output "certificate_arn" {
  description = "ACM certificate ARN for CloudFront"
  value       = aws_acm_certificate.main.arn
}

output "certificate_status" {
  description = "ACM certificate validation status"
  value       = aws_acm_certificate.main.status
}

output "domain_name" {
  description = "Primary domain name"
  value       = var.domain_name
}
