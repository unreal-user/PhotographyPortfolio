variable "project_name" {
  description = "Name of the project (used in resource naming and tagging)"
  type        = string
  default     = "photography-project"
}

variable "aws_region" {
  description = "AWS region for the state backend"
  type        = string
  default     = "us-east-1"
}

variable "state_bucket_name" {
  description = "Name of the S3 bucket for Terraform state"
  type        = string
  default     = "photography-project-terraform-state"
}

variable "lock_table_name" {
  description = "Name of the DynamoDB table for state locking"
  type        = string
  default     = "photography-project-terraform-locks"
}
