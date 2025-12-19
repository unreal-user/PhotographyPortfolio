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

# ==============================================================================
# PHASE 3 OUTPUTS: Cognito Authentication
# ==============================================================================

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID for frontend configuration"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "cognito_app_client_id" {
  description = "Cognito App Client ID for frontend authentication"
  value       = aws_cognito_user_pool_client.web_client.id
}

output "cognito_user_pool_endpoint" {
  description = "Cognito User Pool endpoint"
  value       = aws_cognito_user_pool.main.endpoint
}

output "aws_region_cognito" {
  description = "AWS region for Cognito (for frontend config)"
  value       = var.aws_region
}

# ==============================================================================
# PHASE 4 OUTPUTS: Photo Storage (S3 + DynamoDB)
# ==============================================================================

output "photos_s3_bucket_name" {
  description = "S3 bucket name for photo storage"
  value       = aws_s3_bucket.photos.id
}

output "photos_s3_bucket_arn" {
  description = "S3 bucket ARN for IAM policies"
  value       = aws_s3_bucket.photos.arn
}

output "photos_s3_bucket_region" {
  description = "S3 bucket region"
  value       = aws_s3_bucket.photos.region
}

output "photos_dynamodb_table_name" {
  description = "DynamoDB table name for photo metadata"
  value       = aws_dynamodb_table.photos.name
}

output "photos_dynamodb_table_arn" {
  description = "DynamoDB table ARN for IAM policies"
  value       = aws_dynamodb_table.photos.arn
}
