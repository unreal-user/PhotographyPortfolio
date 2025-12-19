terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ==============================================================================
# PHASE 1: DNS & SSL Certificate
# ==============================================================================

# Route53 Hosted Zone
resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = {
    Name        = "${var.project_name}-hosted-zone"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "1"
  }
}

# ACM Certificate (must be in us-east-1 for CloudFront)
resource "aws_acm_certificate" "main" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = [
    "www.${var.domain_name}"
  ]

  tags = {
    Name        = "${var.project_name}-certificate"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "1"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# DNS validation records for ACM certificate
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main.zone_id
}

# Certificate validation waiter
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# ==============================================================================
# PHASE 2: S3 + CloudFront Static Site Hosting
# ==============================================================================

# S3 bucket for static website files
resource "aws_s3_bucket" "website" {
  bucket = "${var.project_name}-website"

  tags = {
    Name        = "${var.project_name}-website"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "2"
  }
}

# Block all public access (CloudFront will access via OAC)
resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for rollback capability
resource "aws_s3_bucket_versioning" "website" {
  bucket = aws_s3_bucket.website.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "website" {
  bucket = aws_s3_bucket.website.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CloudFront Origin Access Control (OAC) - modern replacement for OAI
resource "aws_cloudfront_origin_access_control" "website" {
  name                              = "${var.project_name}-oac"
  description                       = "OAC for ${var.project_name} website bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "website" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = [var.domain_name, "www.${var.domain_name}"]
  price_class         = "PriceClass_100" # US, Canada, Europe

  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.website.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.website.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600  # 1 hour
    max_ttl     = 86400 # 24 hours
  }

  # Custom error response for SPA routing
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.main.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name        = "${var.project_name}-cdn"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "2"
  }
}

# S3 bucket policy to allow CloudFront OAC access
resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.website.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.website.arn
          }
        }
      }
    ]
  })
}

# Route53 A record (IPv4) pointing to CloudFront
resource "aws_route53_record" "website_a" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.website.domain_name
    zone_id                = aws_cloudfront_distribution.website.hosted_zone_id
    evaluate_target_health = false
  }
}

# Route53 AAAA record (IPv6) pointing to CloudFront
resource "aws_route53_record" "website_aaaa" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.website.domain_name
    zone_id                = aws_cloudfront_distribution.website.hosted_zone_id
    evaluate_target_health = false
  }
}

# Route53 A record for www subdomain
resource "aws_route53_record" "website_www_a" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.website.domain_name
    zone_id                = aws_cloudfront_distribution.website.hosted_zone_id
    evaluate_target_health = false
  }
}

# Route53 AAAA record for www subdomain
resource "aws_route53_record" "website_www_aaaa" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.website.domain_name
    zone_id                = aws_cloudfront_distribution.website.hosted_zone_id
    evaluate_target_health = false
  }
}

# ==============================================================================
# PHASE 3: Cognito Authentication
# ==============================================================================

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-user-pool"

  # Username configuration
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # MFA configuration (optional for TOTP, we'll use custom email MFA)
  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  # Admin create user config (no self-signup)
  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  # Email configuration (use Cognito default for now)
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # User attribute schema
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  # Device tracking for remember device functionality
  device_configuration {
    challenge_required_on_new_device      = false
    device_only_remembered_on_user_prompt = true
  }

  # Deletion protection
  deletion_protection = "ACTIVE"

  tags = {
    Name        = "${var.project_name}-user-pool"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "3"
  }
}

# Cognito User Pool Client (for React app)
resource "aws_cognito_user_pool_client" "web_client" {
  name         = "${var.project_name}-web-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # Auth flows
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_CUSTOM_AUTH",
    "ALLOW_ADMIN_USER_PASSWORD_AUTH"
  ]

  # Token validity
  id_token_validity      = 60  # 1 hour
  access_token_validity  = 60  # 1 hour
  refresh_token_validity = 30  # 30 days

  token_validity_units {
    id_token      = "minutes"
    access_token  = "minutes"
    refresh_token = "days"
  }

  # Security settings
  generate_secret                      = false # Public client (SPA)
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true
  enable_propagate_additional_user_context_data = false

  # OAuth flows (disabled for now, not using hosted UI)
  allowed_oauth_flows_user_pool_client = false

  # Read/write permissions
  read_attributes = [
    "email",
    "email_verified"
  ]

  write_attributes = [
    "email"
  ]
}

# ==============================================================================
# PHASE 4: Photo Upload S3 Bucket
# ==============================================================================

# S3 bucket for photo storage
resource "aws_s3_bucket" "photos" {
  bucket = "${var.project_name}-photos"

  tags = {
    Name        = "${var.project_name}-photos"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "4"
  }
}

# Block all public access (photos accessed via CloudFront + pre-signed URLs)
resource "aws_s3_bucket_public_access_block" "photos" {
  bucket = aws_s3_bucket.photos.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for rollback capability
resource "aws_s3_bucket_versioning" "photos" {
  bucket = aws_s3_bucket.photos.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CORS configuration for browser uploads
resource "aws_s3_bucket_cors_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = [
      "https://${var.domain_name}",
      "https://www.${var.domain_name}"
    ]
    expose_headers = [
      "ETag",
      "x-amz-server-side-encryption",
      "x-amz-request-id",
      "x-amz-id-2"
    ]
    max_age_seconds = 3600
  }
}

# Lifecycle policies for photo management
resource "aws_s3_bucket_lifecycle_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id

  # Rule 1: Clean up temporary uploads after 7 days
  rule {
    id     = "cleanup-uploads"
    status = "Enabled"

    filter {
      prefix = "uploads/"
    }

    expiration {
      days = 7
    }
  }

  # Rule 2: Transition archived photos to cheaper storage after 30 days
  rule {
    id     = "archive-transition"
    status = "Enabled"

    filter {
      prefix = "archive/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
  }

  # Rule 3: Delete old versions after 90 days
  rule {
    id     = "cleanup-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# S3 bucket policy to enforce HTTPS-only access
resource "aws_s3_bucket_policy" "photos" {
  bucket = aws_s3_bucket.photos.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceHTTPSOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          "${aws_s3_bucket.photos.arn}",
          "${aws_s3_bucket.photos.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# ==============================================================================
# PHASE 4: DynamoDB Table for Photo Metadata
# ==============================================================================

# DynamoDB table for photo metadata
resource "aws_dynamodb_table" "photos" {
  name         = "${var.project_name}-photos"
  billing_mode = "PAY_PER_REQUEST" # On-demand pricing

  hash_key = "photoId"

  # Primary key attribute
  attribute {
    name = "photoId"
    type = "S"
  }

  # GSI attributes
  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "uploadDate"
    type = "S"
  }

  # Global Secondary Index for querying by status and upload date
  global_secondary_index {
    name            = "status-uploadDate-index"
    hash_key        = "status"
    range_key       = "uploadDate"
    projection_type = "ALL"
  }

  # Enable point-in-time recovery for data protection
  point_in_time_recovery {
    enabled = true
  }

  # Server-side encryption
  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "${var.project_name}-photos-metadata"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "4"
  }
}

# ==============================================================================
# PHASE 5: Lambda Functions + API Gateway
# ==============================================================================

# ----------------------------------------------------------------------------
# Lambda IAM Roles & Policies
# ----------------------------------------------------------------------------

# IAM role for Lambda functions
resource "aws_iam_role" "lambda_execution_role" {
  name = "${var.project_name}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-lambda-execution-role"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

# Attach basic Lambda execution policy (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# IAM policy for S3 upload access
resource "aws_iam_policy" "lambda_s3_upload_policy" {
  name        = "${var.project_name}-lambda-s3-upload-policy"
  description = "Allow Lambda to generate pre-signed URLs for S3 uploads"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.photos.arn}/uploads/*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-lambda-s3-upload-policy"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_s3_upload" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = aws_iam_policy.lambda_s3_upload_policy.arn
}

# IAM policy for S3 read/copy access
resource "aws_iam_policy" "lambda_s3_copy_policy" {
  name        = "${var.project_name}-lambda-s3-copy-policy"
  description = "Allow Lambda to copy objects between S3 folders"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:HeadObject",
          "s3:GetObject"
        ]
        Resource = [
          "${aws_s3_bucket.photos.arn}/uploads/*",
          "${aws_s3_bucket.photos.arn}/originals/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:CopyObject"
        ]
        Resource = [
          "${aws_s3_bucket.photos.arn}/originals/*",
          "${aws_s3_bucket.photos.arn}/archive/*"
        ]
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-lambda-s3-copy-policy"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_s3_copy" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = aws_iam_policy.lambda_s3_copy_policy.arn
}

# IAM policy for DynamoDB access
resource "aws_iam_policy" "lambda_dynamodb_policy" {
  name        = "${var.project_name}-lambda-dynamodb-policy"
  description = "Allow Lambda to read/write DynamoDB photo metadata"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.photos.arn,
          "${aws_dynamodb_table.photos.arn}/index/status-uploadDate-index"
        ]
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-lambda-dynamodb-policy"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = aws_iam_policy.lambda_dynamodb_policy.arn
}

# ====================
# CloudWatch Log Groups for Lambda Functions
# ====================

resource "aws_cloudwatch_log_group" "generate_upload_url_logs" {
  name              = "/aws/lambda/photography-project-generate-upload-url"
  retention_in_days = 14

  tags = {
    Name        = "photography-project-generate-upload-url-logs"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

resource "aws_cloudwatch_log_group" "create_photo_logs" {
  name              = "/aws/lambda/photography-project-create-photo"
  retention_in_days = 14

  tags = {
    Name        = "photography-project-create-photo-logs"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

resource "aws_cloudwatch_log_group" "list_photos_logs" {
  name              = "/aws/lambda/photography-project-list-photos"
  retention_in_days = 14

  tags = {
    Name        = "photography-project-list-photos-logs"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

resource "aws_cloudwatch_log_group" "get_photo_logs" {
  name              = "/aws/lambda/photography-project-get-photo"
  retention_in_days = 14

  tags = {
    Name        = "photography-project-get-photo-logs"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

resource "aws_cloudwatch_log_group" "update_photo_logs" {
  name              = "/aws/lambda/photography-project-update-photo"
  retention_in_days = 14

  tags = {
    Name        = "photography-project-update-photo-logs"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

resource "aws_cloudwatch_log_group" "delete_photo_logs" {
  name              = "/aws/lambda/photography-project-delete-photo"
  retention_in_days = 14

  tags = {
    Name        = "photography-project-delete-photo-logs"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

# ====================
# Lambda Functions
# ====================

resource "aws_lambda_function" "generate_upload_url" {
  filename      = "${path.module}/generate_upload_url.zip"
  function_name = "photography-project-generate-upload-url"
  role          = aws_iam_role.lambda_execution_role.arn
  handler       = "index.lambda_handler"
  runtime       = "python3.12"
  timeout       = 10
  memory_size   = 128

  source_code_hash = filebase64sha256("${path.module}/generate_upload_url.zip")

  environment {
    variables = {
      PHOTOS_BUCKET_NAME  = aws_s3_bucket.photos.id
      UPLOAD_EXPIRATION   = "300"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.generate_upload_url_logs,
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy_attachment.lambda_s3_upload
  ]

  tags = {
    Name        = "photography-project-generate-upload-url"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

resource "aws_lambda_function" "create_photo" {
  filename      = "${path.module}/create_photo.zip"
  function_name = "photography-project-create-photo"
  role          = aws_iam_role.lambda_execution_role.arn
  handler       = "index.lambda_handler"
  runtime       = "python3.12"
  timeout       = 10
  memory_size   = 128

  source_code_hash = filebase64sha256("${path.module}/create_photo.zip")

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.photos.name
      PHOTOS_BUCKET_NAME  = aws_s3_bucket.photos.id
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.create_photo_logs,
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy_attachment.lambda_dynamodb,
    aws_iam_role_policy_attachment.lambda_s3_upload
  ]

  tags = {
    Name        = "photography-project-create-photo"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

resource "aws_lambda_function" "list_photos" {
  filename      = "${path.module}/list_photos.zip"
  function_name = "photography-project-list-photos"
  role          = aws_iam_role.lambda_execution_role.arn
  handler       = "index.lambda_handler"
  runtime       = "python3.12"
  timeout       = 10
  memory_size   = 128

  source_code_hash = filebase64sha256("${path.module}/list_photos.zip")

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.photos.name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.list_photos_logs,
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy_attachment.lambda_dynamodb
  ]

  tags = {
    Name        = "photography-project-list-photos"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

resource "aws_lambda_function" "get_photo" {
  filename      = "${path.module}/get_photo.zip"
  function_name = "photography-project-get-photo"
  role          = aws_iam_role.lambda_execution_role.arn
  handler       = "index.lambda_handler"
  runtime       = "python3.12"
  timeout       = 10
  memory_size   = 128

  source_code_hash = filebase64sha256("${path.module}/get_photo.zip")

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.photos.name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.get_photo_logs,
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy_attachment.lambda_dynamodb
  ]

  tags = {
    Name        = "photography-project-get-photo"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

resource "aws_lambda_function" "update_photo" {
  filename      = "${path.module}/update_photo.zip"
  function_name = "photography-project-update-photo"
  role          = aws_iam_role.lambda_execution_role.arn
  handler       = "index.lambda_handler"
  runtime       = "python3.12"
  timeout       = 10
  memory_size   = 128

  source_code_hash = filebase64sha256("${path.module}/update_photo.zip")

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.photos.name
      PHOTOS_BUCKET_NAME  = aws_s3_bucket.photos.id
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.update_photo_logs,
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy_attachment.lambda_dynamodb,
    aws_iam_role_policy_attachment.lambda_s3_copy
  ]

  tags = {
    Name        = "photography-project-update-photo"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

resource "aws_lambda_function" "delete_photo" {
  filename      = "${path.module}/delete_photo.zip"
  function_name = "photography-project-delete-photo"
  role          = aws_iam_role.lambda_execution_role.arn
  handler       = "index.lambda_handler"
  runtime       = "python3.12"
  timeout       = 10
  memory_size   = 128

  source_code_hash = filebase64sha256("${path.module}/delete_photo.zip")

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.photos.name
      PHOTOS_BUCKET_NAME  = aws_s3_bucket.photos.id
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.delete_photo_logs,
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy_attachment.lambda_dynamodb,
    aws_iam_role_policy_attachment.lambda_s3_copy
  ]

  tags = {
    Name        = "photography-project-delete-photo"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

# ====================
# API Gateway REST API
# ====================

resource "aws_api_gateway_rest_api" "photos_api" {
  name        = "photography-project-api"
  description = "Photo management API for Photography Portfolio"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Name        = "photography-project-api"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}

# Cognito Authorizer
resource "aws_api_gateway_authorizer" "cognito_authorizer" {
  name            = "cognito-authorizer"
  rest_api_id     = aws_api_gateway_rest_api.photos_api.id
  type            = "COGNITO_USER_POOLS"
  provider_arns   = [aws_cognito_user_pool.admin_pool.arn]
  identity_source = "method.request.header.Authorization"
}

# ====================
# API Gateway Resources (Paths)
# ====================

# /photos
resource "aws_api_gateway_resource" "photos" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  parent_id   = aws_api_gateway_rest_api.photos_api.root_resource_id
  path_part   = "photos"
}

# /photos/upload-url
resource "aws_api_gateway_resource" "upload_url" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  parent_id   = aws_api_gateway_resource.photos.id
  path_part   = "upload-url"
}

# /photos/{photoId}
resource "aws_api_gateway_resource" "photo_by_id" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  parent_id   = aws_api_gateway_resource.photos.id
  path_part   = "{photoId}"
}

# ====================
# API Gateway Methods & Integrations
# ====================

# POST /photos/upload-url
resource "aws_api_gateway_method" "generate_upload_url_post" {
  rest_api_id   = aws_api_gateway_rest_api.photos_api.id
  resource_id   = aws_api_gateway_resource.upload_url.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito_authorizer.id
}

resource "aws_api_gateway_integration" "generate_upload_url_integration" {
  rest_api_id             = aws_api_gateway_rest_api.photos_api.id
  resource_id             = aws_api_gateway_resource.upload_url.id
  http_method             = aws_api_gateway_method.generate_upload_url_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.generate_upload_url.invoke_arn
}

# POST /photos
resource "aws_api_gateway_method" "create_photo_post" {
  rest_api_id   = aws_api_gateway_rest_api.photos_api.id
  resource_id   = aws_api_gateway_resource.photos.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito_authorizer.id
}

resource "aws_api_gateway_integration" "create_photo_integration" {
  rest_api_id             = aws_api_gateway_rest_api.photos_api.id
  resource_id             = aws_api_gateway_resource.photos.id
  http_method             = aws_api_gateway_method.create_photo_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.create_photo.invoke_arn
}

# GET /photos
resource "aws_api_gateway_method" "list_photos_get" {
  rest_api_id   = aws_api_gateway_rest_api.photos_api.id
  resource_id   = aws_api_gateway_resource.photos.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito_authorizer.id
}

resource "aws_api_gateway_integration" "list_photos_integration" {
  rest_api_id             = aws_api_gateway_rest_api.photos_api.id
  resource_id             = aws_api_gateway_resource.photos.id
  http_method             = aws_api_gateway_method.list_photos_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.list_photos.invoke_arn
}

# GET /photos/{photoId}
resource "aws_api_gateway_method" "get_photo_get" {
  rest_api_id   = aws_api_gateway_rest_api.photos_api.id
  resource_id   = aws_api_gateway_resource.photo_by_id.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito_authorizer.id
}

resource "aws_api_gateway_integration" "get_photo_integration" {
  rest_api_id             = aws_api_gateway_rest_api.photos_api.id
  resource_id             = aws_api_gateway_resource.photo_by_id.id
  http_method             = aws_api_gateway_method.get_photo_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.get_photo.invoke_arn
}

# PATCH /photos/{photoId}
resource "aws_api_gateway_method" "update_photo_patch" {
  rest_api_id   = aws_api_gateway_rest_api.photos_api.id
  resource_id   = aws_api_gateway_resource.photo_by_id.id
  http_method   = "PATCH"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito_authorizer.id
}

resource "aws_api_gateway_integration" "update_photo_integration" {
  rest_api_id             = aws_api_gateway_rest_api.photos_api.id
  resource_id             = aws_api_gateway_resource.photo_by_id.id
  http_method             = aws_api_gateway_method.update_photo_patch.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.update_photo.invoke_arn
}

# DELETE /photos/{photoId}
resource "aws_api_gateway_method" "delete_photo_delete" {
  rest_api_id   = aws_api_gateway_rest_api.photos_api.id
  resource_id   = aws_api_gateway_resource.photo_by_id.id
  http_method   = "DELETE"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito_authorizer.id
}

resource "aws_api_gateway_integration" "delete_photo_integration" {
  rest_api_id             = aws_api_gateway_rest_api.photos_api.id
  resource_id             = aws_api_gateway_resource.photo_by_id.id
  http_method             = aws_api_gateway_method.delete_photo_delete.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.delete_photo.invoke_arn
}

# ====================
# Lambda Permissions for API Gateway
# ====================

resource "aws_lambda_permission" "api_gateway_generate_upload_url" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.generate_upload_url.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.photos_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_create_photo" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create_photo.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.photos_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_list_photos" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.list_photos.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.photos_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_get_photo" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_photo.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.photos_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_update_photo" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.update_photo.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.photos_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_delete_photo" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.delete_photo.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.photos_api.execution_arn}/*/*"
}

# ====================
# CORS Configuration
# ====================

# OPTIONS /photos/upload-url (CORS)
resource "aws_api_gateway_method" "upload_url_options" {
  rest_api_id   = aws_api_gateway_rest_api.photos_api.id
  resource_id   = aws_api_gateway_resource.upload_url.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "upload_url_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  resource_id = aws_api_gateway_resource.upload_url.id
  http_method = aws_api_gateway_method.upload_url_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "upload_url_options_response" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  resource_id = aws_api_gateway_resource.upload_url.id
  http_method = aws_api_gateway_method.upload_url_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "upload_url_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  resource_id = aws_api_gateway_resource.upload_url.id
  http_method = aws_api_gateway_method.upload_url_options.http_method
  status_code = aws_api_gateway_method_response.upload_url_options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.upload_url_options_integration]
}

# OPTIONS /photos (CORS)
resource "aws_api_gateway_method" "photos_options" {
  rest_api_id   = aws_api_gateway_rest_api.photos_api.id
  resource_id   = aws_api_gateway_resource.photos.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "photos_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  resource_id = aws_api_gateway_resource.photos.id
  http_method = aws_api_gateway_method.photos_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "photos_options_response" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  resource_id = aws_api_gateway_resource.photos.id
  http_method = aws_api_gateway_method.photos_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "photos_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  resource_id = aws_api_gateway_resource.photos.id
  http_method = aws_api_gateway_method.photos_options.http_method
  status_code = aws_api_gateway_method_response.photos_options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.photos_options_integration]
}

# OPTIONS /photos/{photoId} (CORS)
resource "aws_api_gateway_method" "photo_by_id_options" {
  rest_api_id   = aws_api_gateway_rest_api.photos_api.id
  resource_id   = aws_api_gateway_resource.photo_by_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "photo_by_id_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  resource_id = aws_api_gateway_resource.photo_by_id.id
  http_method = aws_api_gateway_method.photo_by_id_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "photo_by_id_options_response" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  resource_id = aws_api_gateway_resource.photo_by_id.id
  http_method = aws_api_gateway_method.photo_by_id_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "photo_by_id_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id
  resource_id = aws_api_gateway_resource.photo_by_id.id
  http_method = aws_api_gateway_method.photo_by_id_options.http_method
  status_code = aws_api_gateway_method_response.photo_by_id_options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,PATCH,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.photo_by_id_options_integration]
}

# ====================
# API Gateway Deployment & Stage
# ====================

resource "aws_api_gateway_deployment" "photos_api_deployment" {
  rest_api_id = aws_api_gateway_rest_api.photos_api.id

  depends_on = [
    aws_api_gateway_integration.generate_upload_url_integration,
    aws_api_gateway_integration.create_photo_integration,
    aws_api_gateway_integration.list_photos_integration,
    aws_api_gateway_integration.get_photo_integration,
    aws_api_gateway_integration.update_photo_integration,
    aws_api_gateway_integration.delete_photo_integration,
    aws_api_gateway_integration_response.upload_url_options_integration_response,
    aws_api_gateway_integration_response.photos_options_integration_response,
    aws_api_gateway_integration_response.photo_by_id_options_integration_response
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "photos_api_stage" {
  deployment_id = aws_api_gateway_deployment.photos_api_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.photos_api.id
  stage_name    = "prod"

  tags = {
    Name        = "photography-project-api-prod"
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "5"
  }
}
