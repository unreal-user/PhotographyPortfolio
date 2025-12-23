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

# ==============================================================================
# PHASE 7 OUTPUTS: Photos CloudFront Distribution
# ==============================================================================

output "photos_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for photos"
  value       = aws_cloudfront_distribution.photos.id
}

output "photos_cloudfront_domain_name" {
  description = "CloudFront domain name for photos (use this for photo URLs)"
  value       = aws_cloudfront_distribution.photos.domain_name
}

output "photos_cdn_url" {
  description = "Full HTTPS URL for photos CDN"
  value       = "https://${aws_cloudfront_distribution.photos.domain_name}"
}

# ==============================================================================
# PHASE 5 OUTPUTS: Lambda Functions + API Gateway
# ==============================================================================

output "api_gateway_url" {
  description = "API Gateway base URL"
  value       = aws_api_gateway_stage.photos_api_stage.invoke_url
}

output "api_gateway_id" {
  description = "API Gateway REST API ID"
  value       = aws_api_gateway_rest_api.photos_api.id
}

output "api_gateway_stage" {
  description = "API Gateway stage name"
  value       = aws_api_gateway_stage.photos_api_stage.stage_name
}

output "api_endpoints" {
  description = "All API endpoint URLs"
  value = {
    generate_upload_url = "${aws_api_gateway_stage.photos_api_stage.invoke_url}/photos/upload-url"
    create_photo        = "${aws_api_gateway_stage.photos_api_stage.invoke_url}/photos"
    list_photos         = "${aws_api_gateway_stage.photos_api_stage.invoke_url}/photos"
    get_photo           = "${aws_api_gateway_stage.photos_api_stage.invoke_url}/photos/{photoId}"
    update_photo        = "${aws_api_gateway_stage.photos_api_stage.invoke_url}/photos/{photoId}"
    delete_photo        = "${aws_api_gateway_stage.photos_api_stage.invoke_url}/photos/{photoId}"
  }
}

output "lambda_function_arns" {
  description = "Lambda function ARNs"
  value = {
    generate_upload_url = aws_lambda_function.generate_upload_url.arn
    create_photo        = aws_lambda_function.create_photo.arn
    list_photos         = aws_lambda_function.list_photos.arn
    get_photo           = aws_lambda_function.get_photo.arn
    update_photo        = aws_lambda_function.update_photo.arn
    delete_photo        = aws_lambda_function.delete_photo.arn
  }
}

output "lambda_function_names" {
  description = "Lambda function names"
  value = {
    generate_upload_url = aws_lambda_function.generate_upload_url.function_name
    create_photo        = aws_lambda_function.create_photo.function_name
    list_photos         = aws_lambda_function.list_photos.function_name
    get_photo           = aws_lambda_function.get_photo.function_name
    update_photo        = aws_lambda_function.update_photo.function_name
    delete_photo        = aws_lambda_function.delete_photo.function_name
  }
}

output "cognito_authorizer_id" {
  description = "API Gateway Cognito authorizer ID"
  value       = aws_api_gateway_authorizer.cognito_authorizer.id
}

# ==============================================================================
# PHASE 6D OUTPUTS: SES Email Service
# ==============================================================================

output "ses_domain_verification_token" {
  description = "SES domain verification token - Add this as a TXT record in Route 53"
  value       = aws_ses_domain_identity.main.verification_token
}

output "ses_dkim_tokens" {
  description = "SES DKIM tokens - Add these as CNAME records in Route 53 for email authentication"
  value       = aws_ses_domain_dkim.main.dkim_tokens
}

output "ses_verification_status" {
  description = "SES domain verification status"
  value       = aws_ses_domain_identity.main.verification_status
}

output "ses_setup_instructions" {
  description = "Manual steps required to complete SES setup"
  value = <<-EOT

  ========================================
  SES SETUP INSTRUCTIONS
  ========================================

  1. VERIFY RECIPIENT EMAILS
     Check inbox for each recipient email and click the verification link:
${join("\n", [for email in var.contact_form_recipient_emails : "     - ${email}"])}

  2. ADD DNS RECORDS TO ROUTE 53

     a) Domain Verification (TXT record):
        Name:  _amazonses.${var.domain_name}
        Type:  TXT
        Value: ${aws_ses_domain_identity.main.verification_token}

     b) DKIM Records (3 CNAME records for email authentication):
${join("\n", [for token in aws_ses_domain_dkim.main.dkim_tokens : "        Name:  ${token}._domainkey.${var.domain_name}\n        Type:  CNAME\n        Value: ${token}.dkim.amazonses.com\n"])}

  3. WAIT FOR VERIFICATION
     - Domain verification: 24-72 hours after adding DNS records
     - Check status: aws ses get-identity-verification-attributes --identities ${var.domain_name}

  4. TEST CONTACT FORM
     - Contact form will only send to verified emails (sandbox mode)
     - To send to any email, request SES production access (takes ~24 hours)

  ========================================
  EOT
}
