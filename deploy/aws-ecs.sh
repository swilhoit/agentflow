#!/bin/bash
# AWS ECS Deployment Script for AgentFlow

set -e

echo "Deploying AgentFlow to AWS ECS..."

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPOSITORY="agentflow"
CLUSTER_NAME="agentflow-cluster"
SERVICE_NAME="agentflow-service"
TASK_DEFINITION="agentflow-task"

# Build and push Docker image to ECR
echo "Building Docker image..."
docker build -t ${ECR_REPOSITORY}:latest .

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Create ECR repository if it doesn't exist
aws ecr describe-repositories --repository-names ${ECR_REPOSITORY} --region ${AWS_REGION} 2>/dev/null || \
  aws ecr create-repository --repository-name ${ECR_REPOSITORY} --region ${AWS_REGION}

# Tag and push image
echo "Pushing image to ECR..."
docker tag ${ECR_REPOSITORY}:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest

# Create ECS cluster if it doesn't exist
aws ecs describe-clusters --clusters ${CLUSTER_NAME} --region ${AWS_REGION} 2>/dev/null || \
  aws ecs create-cluster --cluster-name ${CLUSTER_NAME} --region ${AWS_REGION}

echo "Deployment complete! Image pushed to ECR."
echo "Next steps:"
echo "1. Create an ECS task definition using the pushed image"
echo "2. Create an ECS service"
echo "3. Configure environment variables in the task definition"
