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
