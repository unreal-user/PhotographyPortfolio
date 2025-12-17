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

# ==============================================================================
# PHASE 2 OUTPUTS: S3 + CloudFront Static Hosting
# ==============================================================================

output "s3_bucket_name" {
  description = "S3 bucket name for website files"
  value       = aws_s3_bucket.website.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.website.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.website.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.website.domain_name
}

output "website_url" {
  description = "Website URL (HTTPS)"
  value       = "https://${var.domain_name}"
}

output "website_url_www" {
  description = "Website URL with www subdomain (HTTPS)"
  value       = "https://www.${var.domain_name}"
}
