variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "photography-project"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Domain name for the portfolio site"
  type        = string
  default     = "test.com"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

# SES Email Configuration
variable "contact_form_sender_email" {
  description = "Email address to send contact form notifications FROM (e.g., noreply@yourdomain.com)"
  type        = string
  sensitive   = true
}

variable "contact_form_recipient_emails" {
  description = "List of email addresses to receive contact form notifications"
  type        = list(string)
  # Note: Cannot use sensitive = true because this is used in for_each
}
