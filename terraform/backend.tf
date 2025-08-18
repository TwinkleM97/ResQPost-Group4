terraform {
  required_version = ">= 1.5"
  backend "s3" {}  # values are passed at init time from the workflow
}
