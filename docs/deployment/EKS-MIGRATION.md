# EKS Migration Guide -- Zopkit Platform

> Engineering reference for migrating the Zopkit multi-tenant SaaS platform from a single EC2 instance to AWS EKS + ECR.
> This document is copy-paste ready. All commands, manifests, and code snippets use real service names, ports, and domains.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Subdomain & DNS Strategy](#2-subdomain--dns-strategy)
3. [EKS Cluster Setup](#3-eks-cluster-setup)
4. [ECR -- Container Registry](#4-ecr----container-registry)
5. [Kubernetes Manifests](#5-kubernetes-manifests)
6. [What Breaks at Scale -- Code Changes Required](#6-what-breaks-at-scale----code-changes-required)
7. [CI/CD Pipeline](#7-cicd-pipeline)
8. [Observability](#8-observability)
9. [Security](#9-security)
10. [Cost Analysis](#10-cost-analysis)
11. [Migration Runbook (Step-by-Step)](#11-migration-runbook-step-by-step)
12. [Scaling Playbook](#12-scaling-playbook)
13. [Disaster Recovery](#13-disaster-recovery)

---

## 1. Architecture Overview

### 1.1 Current State -- Single EC2 + PM2 + Nginx

```
                          ┌──────────────────────────────────────────────────┐
                          │  EC2 Instance  (35.171.71.112)                  │
                          │  t3.xlarge, us-east-1                           │
                          │                                                  │
   Internet               │  ┌────────────────────────────────────────────┐  │
      │                   │  │  Nginx (reverse proxy + static serving)    │  │
      │                   │  │  - *.zopkit.com → localhost:3000/4000/5000 │  │
      │  DNS:             │  │  - SSL termination (Let's Encrypt)         │  │
      │  *.zopkit.com     │  │  - Static file serving for frontends      │  │
      │  → 35.171.71.112  │  └──────┬────────────┬────────────┬──────────┘  │
      │                   │         │            │            │              │
      └──────────────────►│  ┌──────▼──────┐ ┌──▼────────┐ ┌─▼───────────┐ │
                          │  │ PM2: wrapper│ │ PM2: crm   │ │ PM2: hrms   │ │
                          │  │ backend     │ │ backend    │ │ backend     │ │
                          │  │ :3000       │ │ :4000      │ │ :5000       │ │
                          │  │ + cron jobs │ │            │ │             │ │
                          │  │ + websocket │ │            │ │             │ │
                          │  └──────┬──────┘ └──┬────────┘ └─┬───────────┘ │
                          │         │            │            │              │
                          └─────────┼────────────┼────────────┼──────────────┘
                                    │            │            │
                          ┌─────────▼────────────▼────────────▼──────────────┐
                          │  External Services                                │
                          │  - Supabase PostgreSQL (db.supabase.co)          │
                          │  - AWS SNS + SQS (inter-app messaging)            │
                          │  - Kinde (OAuth2/OIDC)                            │
                          │  - Stripe (billing)                               │
                          │  - Brevo (email)                                  │
                          │  - Elasticsearch (logging)                        │
                          │  - Route 53 (DNS)                                 │
                          └───────────────────────────────────────────────────┘
```

**Problems with current state:**
- Single point of failure -- one EC2 instance serves everything
- No horizontal scaling -- PM2 cluster mode is limited to one machine
- In-memory caches (auth, roles, tenant lookups) are pod-local only
- Cron jobs (credit expiry, trial checks, event cleanup) run on every PM2 process
- WebSocket connections are pinned to one process
- No rolling deploys -- PM2 reload causes brief connection drops
- SSL certificates managed manually via Let's Encrypt / certbot
- No autoscaling based on load

### 1.2 Target State -- EKS + ALB + CloudFront + S3 + Redis

```
                     ┌──────────────────────────────────────────────────────────┐
                     │  AWS Cloud  (us-east-1)                                  │
                     │                                                          │
  Internet           │  ┌──────────────────────────────────────┐                │
     │               │  │  CloudFront (3 distributions)        │                │
     │               │  │  app.zopkit.com  → S3: wrapper-fe    │                │
     │               │  │  crm.zopkit.com  → S3: crm-fe        │                │
     │               │  │  hrms.zopkit.com → S3: hrms-fe        │                │
     │               │  └──────────────────────────────────────┘                │
     │               │                                                          │
     │               │  ┌──────────────────────────────────────┐                │
     │  DNS:         │  │  ACM Certificate (*.zopkit.com)      │                │
     │  Route 53     │  └──────────────────────────────────────┘                │
     │               │                                                          │
     │               │  ┌──────────────────────────────────────────────────┐    │
     │               │  │  Application Load Balancer (ALB)                 │    │
     │               │  │  - api.zopkit.com → wrapper-backend              │    │
     │               │  │  - crm-api.zopkit.com → crm-backend             │    │
     │               │  │  - hrms-api.zopkit.com → hrms-backend            │    │
     │               │  │  - {tenant}.zopkit.com → wrapper-backend         │    │
     │               │  │    (tenant vanity subdomain routing)             │    │
     │               │  │  - WebSocket upgrade: /ws path                   │    │
     └──────────────►│  └───────┬──────────────┬───────────────┬───────────┘    │
                     │          │              │               │                │
                     │  ┌───────▼──────┐ ┌────▼─────────┐ ┌──▼────────────┐    │
                     │  │ EKS Cluster  │ │              │ │               │    │
                     │  │              │ │              │ │               │    │
                     │  │ Namespace:   │ │              │ │               │    │
                     │  │ zopkit-prod  │ │              │ │               │    │
                     │  │              │ │              │ │               │    │
                     │  │ ┌──────────┐ │ │ ┌──────────┐│ │ ┌──────────┐ │    │
                     │  │ │ wrapper  │ │ │ │ crm      ││ │ │ hrms     │ │    │
                     │  │ │ backend  │ │ │ │ backend  ││ │ │ backend  │ │    │
                     │  │ │ 2-6 pods │ │ │ │ 2-4 pods ││ │ │ 2-4 pods│ │    │
                     │  │ │ :3000    │ │ │ │ :4000    ││ │ │ :5000   │ │    │
                     │  │ └────┬─────┘ │ │ └────┬─────┘│ │ └───┬─────┘ │    │
                     │  │      │       │ │      │      │ │     │       │    │
                     │  │ ┌────▼───────▼─▼──────▼──────▼─▼─────▼─────┐ │    │
                     │  │ │  ElastiCache Redis (cluster mode)        │ │    │
                     │  │ │  - Auth cache (replaces in-memory Map)   │ │    │
                     │  │ │  - WebSocket pub/sub fan-out             │ │    │
                     │  │ │  - Cron leader election                  │ │    │
                     │  │ │  - Rate limiting (shared state)          │ │    │
                     │  │ └──────────────────────────────────────────┘ │    │
                     │  │                                              │    │
                     │  │ ┌──────────────────────────────────────────┐ │    │
                     │  │ │  K8s CronJobs                            │ │    │
                     │  │ │  - credit-expiry (hourly)                │ │    │
                     │  │ │  - trial-expiry (every 5 min)            │ │    │
                     │  │ │  - event-cleanup (daily)                 │ │    │
                     │  │ │  - subscription-safety-net (daily)       │ │    │
                     │  │ └──────────────────────────────────────────┘ │    │
                     │  └──────────────────────────────────────────────┘    │
                     │                                                      │
                     │  External (unchanged):                               │
                     │  - Supabase PostgreSQL                               │
                     │  - AWS SNS + SQS (inter-app messaging)               │
                     │  - Kinde, Stripe, Brevo, Elasticsearch               │
                     └──────────────────────────────────────────────────────┘
```

### 1.3 AWS Services Used

| Service | Purpose | Why |
|---------|---------|-----|
| **EKS** | Container orchestration | Auto-healing, rolling deploys, HPA, multi-AZ |
| **ECR** | Container image registry | Private, integrated with EKS, lifecycle policies |
| **ALB** (via AWS LB Controller) | Load balancing + SSL termination | Host-based routing, WebSocket support, ACM integration |
| **ACM** | SSL/TLS certificates | Free wildcard cert for *.zopkit.com, auto-renewal |
| **ElastiCache Redis** | Shared cache + pub/sub | Replace in-memory auth cache, WS fan-out, leader election |
| **S3** | Static frontend hosting | 3 buckets for 3 SPAs, versioned deployments |
| **CloudFront** | CDN for frontends | Global edge caching, HTTPS, SPA routing (404 -> index.html) |
| **Route 53** | DNS management | Already in use; add ALB alias records |
| **Secrets Manager** | Secret storage | Rotate secrets without redeploying pods |
| **CloudWatch** | Metrics + logs | Container Insights for K8s, log aggregation |
| **IAM (IRSA)** | Pod-level AWS access | No access keys in env vars; pods assume IAM roles |
| **VPC** | Network isolation | Private subnets for pods, public subnets for ALB |

---

## 2. Subdomain & DNS Strategy

### 2.1 Domain Architecture

```
zopkit.com                          → CloudFront (landing page / marketing site)
app.zopkit.com                      → CloudFront → S3 (wrapper frontend SPA)
crm.zopkit.com                      → CloudFront → S3 (CRM frontend SPA)
hrms.zopkit.com                     → CloudFront → S3 (HRMS frontend SPA)
api.zopkit.com                      → ALB → wrapper-backend pods (port 3000)
crm-api.zopkit.com                  → ALB → crm-backend pods (port 4000)
hrms-api.zopkit.com                 → ALB → hrms-backend pods (port 5000)
{tenant-slug}.zopkit.com            → ALB → wrapper-backend pods (tenant vanity)
```

### 2.2 Route 53 DNS Records

```bash
# Wildcard record pointing to ALB (covers tenant vanity subdomains + API subdomains)
*.zopkit.com          A     ALIAS   → k8s-zopkitprod-xxxxxxx.us-east-1.elb.amazonaws.com

# Fixed frontend subdomains pointing to CloudFront
app.zopkit.com        A     ALIAS   → d1234567890.cloudfront.net
crm.zopkit.com        A     ALIAS   → d0987654321.cloudfront.net
hrms.zopkit.com       A     ALIAS   → d1122334455.cloudfront.net

# Root domain (landing page)
zopkit.com            A     ALIAS   → d5566778899.cloudfront.net
```

**Important DNS ordering**: Route 53 resolves exact-match records before wildcard records. This means `app.zopkit.com` resolves to CloudFront (exact match) while `acme-corp.zopkit.com` resolves to the ALB (wildcard match). This is the key mechanism that lets fixed subdomains go to CloudFront while tenant subdomains go to the ALB.

### 2.3 ACM Wildcard Certificate

```bash
# Request wildcard certificate (covers *.zopkit.com AND zopkit.com)
aws acm request-certificate \
  --domain-name "zopkit.com" \
  --subject-alternative-names "*.zopkit.com" \
  --validation-method DNS \
  --region us-east-1

# ACM will provide CNAME records for validation. Add them to Route 53:
# _acme-challenge.zopkit.com → _xxxxx.acm-validations.aws
# This validates both the root domain and the wildcard.

# Note: For CloudFront, the certificate MUST be in us-east-1 (global).
# For ALB, the certificate must be in the same region as the ALB (us-east-1).
# Since we are in us-east-1 for both, one certificate works for everything.
```

### 2.4 ALB Host-Based Routing Logic

The ALB Ingress controller uses host-based routing rules to distinguish between API traffic and tenant vanity subdomains:

```
Priority 1 (exact): Host == api.zopkit.com       → wrapper-backend service
Priority 2 (exact): Host == crm-api.zopkit.com   → crm-backend service
Priority 3 (exact): Host == hrms-api.zopkit.com  → hrms-backend service
Priority 4 (wildcard): Host == *.zopkit.com       → wrapper-backend service
                        (tenant vanity subdomains -- backend resolves tenant from Host header)
```

The wrapper backend already reads the `Host` header to determine which tenant is being accessed. In EKS, this behavior remains unchanged -- the ALB just routes the traffic to the correct backend service.

### 2.5 Custom Domain Support

Zopkit already supports custom domains (e.g., `portal.acme-corp.com` -> tenant dashboard). The flow:

1. Tenant configures custom domain in settings
2. Backend creates CNAME verification record via Route 53 API
3. Tenant adds CNAME: `portal.acme-corp.com` -> `acme-corp.zopkit.com`
4. Tenant adds TXT record for verification
5. Backend verifies TXT record, marks domain as verified
6. ALB receives traffic on the custom domain (since CNAME resolves to the ALB via the wildcard)

**EKS change needed**: Add the custom domains to the ACM certificate or use a separate certificate. For dynamic custom domains, use **ACM + Route 53 automation** or **cert-manager with Let's Encrypt** inside the cluster.

For the initial migration, custom domain SSL can be handled by adding a cert-manager ClusterIssuer:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: devops@zopkit.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          ingress:
            class: alb
```

### 2.6 Reserved Subdomain List

These subdomains must never be assigned to tenants:

```
app, api, crm, crm-api, hrms, hrms-api, www, mail, smtp, ftp,
admin, dashboard, portal, status, docs, blog, support, help,
staging, dev, test, demo, sandbox,
ns1, ns2, ns3, ns4, mx, autodiscover, autoconfig,
_dmarc, _domainkey, _acme-challenge
```

The backend should validate against this list during tenant onboarding (in `features/onboarding/`). This list should be stored as a constant, not hardcoded in route handlers.

---

## 3. EKS Cluster Setup

### 3.1 Prerequisites

```bash
# Install required CLI tools
brew install awscli eksctl kubectl helm

# Configure AWS CLI
aws configure
# AWS Access Key ID: <from IAM user>
# AWS Secret Access Key: <from IAM user>
# Default region: us-east-1
# Default output format: json

# Verify
aws sts get-caller-identity
```

### 3.2 VPC Setup

Use the default EKS VPC template with public + private subnets across 2 AZs:

```yaml
# vpc.yaml -- CloudFormation stack for EKS networking
# This creates the VPC, subnets, NAT gateways, and route tables.
# eksctl can create this automatically, but explicit control is better for production.

AWSTemplateFormatVersion: '2010-09-09'
Description: VPC for Zopkit EKS Cluster

Parameters:
  VpcCidr:
    Type: String
    Default: '10.0.0.0/16'
  AvailabilityZone1:
    Type: String
    Default: 'us-east-1a'
  AvailabilityZone2:
    Type: String
    Default: 'us-east-1b'

Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Ref VpcCidr
      EnableDnsSupport: true
      EnableDnsHostnames: true
      Tags:
        - Key: Name
          Value: zopkit-eks-vpc

  # Public Subnets (for ALB)
  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: '10.0.1.0/24'
      AvailabilityZone: !Ref AvailabilityZone1
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: zopkit-public-1a
        - Key: kubernetes.io/role/elb
          Value: '1'

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: '10.0.2.0/24'
      AvailabilityZone: !Ref AvailabilityZone2
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: zopkit-public-1b
        - Key: kubernetes.io/role/elb
          Value: '1'

  # Private Subnets (for EKS nodes)
  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: '10.0.10.0/24'
      AvailabilityZone: !Ref AvailabilityZone1
      Tags:
        - Key: Name
          Value: zopkit-private-1a
        - Key: kubernetes.io/role/internal-elb
          Value: '1'

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: '10.0.11.0/24'
      AvailabilityZone: !Ref AvailabilityZone2
      Tags:
        - Key: Name
          Value: zopkit-private-1b
        - Key: kubernetes.io/role/internal-elb
          Value: '1'

  InternetGateway:
    Type: AWS::EC2::InternetGateway

  VPCGatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway

  # NAT Gateway for private subnets (pods need outbound internet for Supabase, Kinde, Stripe, etc.)
  NATGatewayEIP:
    Type: AWS::EC2::EIP
    Properties:
      Domain: vpc

  NATGateway:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt NATGatewayEIP.AllocationId
      SubnetId: !Ref PublicSubnet1

  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC

  PublicRoute:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: '0.0.0.0/0'
      GatewayId: !Ref InternetGateway

  PublicSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet1
      RouteTableId: !Ref PublicRouteTable

  PublicSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet2
      RouteTableId: !Ref PublicRouteTable

  PrivateRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC

  PrivateRoute:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PrivateRouteTable
      DestinationCidrBlock: '0.0.0.0/0'
      NatGatewayId: !Ref NATGateway

  PrivateSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PrivateSubnet1
      RouteTableId: !Ref PrivateRouteTable

  PrivateSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PrivateSubnet2
      RouteTableId: !Ref PrivateRouteTable

Outputs:
  VpcId:
    Value: !Ref VPC
  PublicSubnets:
    Value: !Join [',', [!Ref PublicSubnet1, !Ref PublicSubnet2]]
  PrivateSubnets:
    Value: !Join [',', [!Ref PrivateSubnet1, !Ref PrivateSubnet2]]
```

```bash
# Deploy the VPC stack
aws cloudformation create-stack \
  --stack-name zopkit-eks-vpc \
  --template-body file://vpc.yaml \
  --region us-east-1
```

### 3.3 EKS Cluster Creation (eksctl)

```yaml
# cluster.yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: zopkit-prod
  region: us-east-1
  version: "1.29"

vpc:
  id: "vpc-xxxxxxxxx"  # From VPC stack output
  subnets:
    public:
      us-east-1a:
        id: "subnet-aaaa"  # PublicSubnet1
      us-east-1b:
        id: "subnet-bbbb"  # PublicSubnet2
    private:
      us-east-1a:
        id: "subnet-cccc"  # PrivateSubnet1
      us-east-1b:
        id: "subnet-dddd"  # PrivateSubnet2

iam:
  withOIDC: true  # Required for IRSA

managedNodeGroups:
  - name: zopkit-workers
    instanceType: t3.medium  # 2 vCPU, 4 GB RAM
    desiredCapacity: 3
    minSize: 2
    maxSize: 6
    privateNetworking: true  # Nodes in private subnets
    volumeSize: 50  # GB EBS
    volumeType: gp3
    labels:
      role: worker
    tags:
      Environment: production
      Project: zopkit
    iam:
      withAddonPolicies:
        albIngress: true
        cloudWatch: true
        autoScaler: true

cloudWatch:
  clusterLogging:
    enableTypes:
      - api
      - audit
      - authenticator
      - controllerManager
      - scheduler

addons:
  - name: vpc-cni
    version: latest
  - name: coredns
    version: latest
  - name: kube-proxy
    version: latest
  - name: aws-ebs-csi-driver
    version: latest
    wellKnownPolicies:
      ebsCSIController: true
```

```bash
# Create the cluster (takes 15-20 minutes)
eksctl create cluster -f cluster.yaml

# Verify
kubectl get nodes
kubectl cluster-info
```

### 3.4 Fargate Profile (Cost-Saving Alternative for CronJobs)

Fargate is ideal for CronJobs because you only pay when the job runs, rather than keeping nodes warm:

```bash
# Create Fargate profile for CronJobs
eksctl create fargateprofile \
  --cluster zopkit-prod \
  --name zopkit-cronjobs \
  --namespace zopkit-prod \
  --labels workload-type=cronjob \
  --region us-east-1
```

Any pod with the label `workload-type: cronjob` in the `zopkit-prod` namespace will run on Fargate.

### 3.5 Namespaces

```bash
kubectl create namespace zopkit-prod
kubectl create namespace zopkit-staging

# Set default namespace
kubectl config set-context --current --namespace=zopkit-prod

# Label namespaces for network policies
kubectl label namespace zopkit-prod environment=production
kubectl label namespace zopkit-staging environment=staging
```

### 3.6 IRSA -- IAM Roles for Service Accounts

```bash
# 1. Create IAM policy for Route 53 access (DNS management for tenant subdomains)
cat > route53-policy.json << 'POLICY'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "route53:ChangeResourceRecordSets",
        "route53:ListResourceRecordSets",
        "route53:GetHostedZone"
      ],
      "Resource": "arn:aws:route53:::hostedzone/Z0123456789ABCDEFGHIJ"
    },
    {
      "Effect": "Allow",
      "Action": "route53:ListHostedZones",
      "Resource": "*"
    }
  ]
}
POLICY

aws iam create-policy \
  --policy-name ZopkitRoute53Access \
  --policy-document file://route53-policy.json

# 2. Create IAM policy for S3 access (frontend deployments)
cat > s3-policy.json << 'POLICY'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::zopkit-wrapper-frontend/*",
        "arn:aws:s3:::zopkit-wrapper-frontend",
        "arn:aws:s3:::zopkit-crm-frontend/*",
        "arn:aws:s3:::zopkit-crm-frontend",
        "arn:aws:s3:::zopkit-hrms-frontend/*",
        "arn:aws:s3:::zopkit-hrms-frontend"
      ]
    }
  ]
}
POLICY

aws iam create-policy \
  --policy-name ZopkitS3Access \
  --policy-document file://s3-policy.json

# 3. Create IRSA for the wrapper backend service account
eksctl create iamserviceaccount \
  --cluster zopkit-prod \
  --namespace zopkit-prod \
  --name wrapper-backend-sa \
  --attach-policy-arn arn:aws:iam::123456789012:policy/ZopkitRoute53Access \
  --approve

# 4. Create IRSA for Secrets Manager access
cat > secrets-policy.json << 'POLICY'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:zopkit/*"
    }
  ]
}
POLICY

aws iam create-policy \
  --policy-name ZopkitSecretsAccess \
  --policy-document file://secrets-policy.json

eksctl create iamserviceaccount \
  --cluster zopkit-prod \
  --namespace zopkit-prod \
  --name zopkit-secrets-sa \
  --attach-policy-arn arn:aws:iam::123456789012:policy/ZopkitSecretsAccess \
  --approve
```

### 3.7 Install AWS Load Balancer Controller

```bash
# Add the EKS Helm chart repo
helm repo add eks https://aws.github.io/eks-charts
helm repo update

# Install the AWS Load Balancer Controller
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=zopkit-prod \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller

# Verify
kubectl get deployment -n kube-system aws-load-balancer-controller
```

### 3.8 Security Groups

| Security Group | Inbound Rules | Purpose |
|---|---|---|
| `zopkit-alb-sg` | 80/443 from 0.0.0.0/0 | ALB accepts public HTTPS |
| `zopkit-nodes-sg` | 3000,4000,5000 from `zopkit-alb-sg` | Nodes accept traffic only from ALB |
| `zopkit-redis-sg` | 6379 from `zopkit-nodes-sg` | Redis accepts traffic only from nodes |
| `zopkit-nodes-sg` | ALL from `zopkit-nodes-sg` (self) | Pod-to-pod communication within cluster |

---

## 4. ECR -- Container Registry

### 4.1 Create Repositories

```bash
# One repository per service
aws ecr create-repository --repository-name zopkit/wrapper-backend --region us-east-1
aws ecr create-repository --repository-name zopkit/crm-backend --region us-east-1
aws ecr create-repository --repository-name zopkit/hrms-backend --region us-east-1

# Optionally, one for CronJob runner (if separate image)
aws ecr create-repository --repository-name zopkit/cronjob-runner --region us-east-1
```

### 4.2 Lifecycle Policies

```bash
# Keep only the last 10 tagged images to save storage costs
# Apply to each repository
LIFECYCLE_POLICY='{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 tagged images",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["sha-"],
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 2,
      "description": "Remove untagged images after 1 day",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 1
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}'

for REPO in zopkit/wrapper-backend zopkit/crm-backend zopkit/hrms-backend zopkit/cronjob-runner; do
  aws ecr put-lifecycle-policy \
    --repository-name "$REPO" \
    --lifecycle-policy-text "$LIFECYCLE_POLICY" \
    --region us-east-1
done
```

### 4.3 Image Tagging Strategy

Every image gets two tags:
- `sha-<short git SHA>` -- immutable, tracks exact commit
- `latest` -- mutable, points to most recent build

```bash
# Example tags for a commit abc1234:
# 123456789012.dkr.ecr.us-east-1.amazonaws.com/zopkit/wrapper-backend:sha-abc1234
# 123456789012.dkr.ecr.us-east-1.amazonaws.com/zopkit/wrapper-backend:latest
```

Kubernetes deployments reference the `sha-` tag for deterministic rollouts. The `latest` tag is only used for local development.

### 4.4 Dockerfiles

#### Wrapper Backend (backend/Dockerfile)

```dockerfile
# ──────────────────────────────────────────────
# Stage 1: Install dependencies
# ──────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy only package.json for the backend workspace
COPY backend/package.json ./backend/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter wrapper-backend --prod

# ──────────────────────────────────────────────
# Stage 2: Build TypeScript
# ──────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/ ./backend/

RUN pnpm install --frozen-lockfile --filter wrapper-backend
RUN pnpm --filter wrapper-backend run build

# ──────────────────────────────────────────────
# Stage 3: Production image
# ──────────────────────────────────────────────
FROM node:22-alpine AS production

RUN apk add --no-cache tini dumb-init

# Non-root user for security
RUN addgroup -g 1001 -S zopkit && \
    adduser -S zopkit -u 1001 -G zopkit

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules

# Copy compiled JS from builder stage
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/package.json

# Copy Drizzle migrations (needed at runtime for db:migrate)
COPY --from=builder /app/backend/src/db/migrations ./backend/src/db/migrations
COPY --from=builder /app/backend/drizzle.config.dist.ts ./backend/drizzle.config.dist.ts

USER zopkit

EXPOSE 3000

# Use tini as PID 1 for proper signal handling (SIGTERM -> graceful shutdown)
ENTRYPOINT ["tini", "--"]

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1

CMD ["node", "backend/dist/bootstrap.js"]
```

#### CRM Backend (crm/Dockerfile)

```dockerfile
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY crm/package.json ./crm/
RUN pnpm install --frozen-lockfile --filter crm-backend --prod

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY crm/ ./crm/
RUN pnpm install --frozen-lockfile --filter crm-backend
RUN pnpm --filter crm-backend run build

FROM node:22-alpine AS production
RUN apk add --no-cache tini
RUN addgroup -g 1001 -S zopkit && adduser -S zopkit -u 1001 -G zopkit
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/crm/node_modules ./crm/node_modules
COPY --from=builder /app/crm/dist ./crm/dist
COPY --from=builder /app/crm/package.json ./crm/package.json
USER zopkit
EXPOSE 4000
ENTRYPOINT ["tini", "--"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health/live || exit 1
CMD ["node", "crm/dist/bootstrap.js"]
```

#### HRMS Backend (hrms/Dockerfile)

```dockerfile
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY hrms/package.json ./hrms/
RUN pnpm install --frozen-lockfile --filter hrms-backend --prod

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY hrms/ ./hrms/
RUN pnpm install --frozen-lockfile --filter hrms-backend
RUN pnpm --filter hrms-backend run build

FROM node:22-alpine AS production
RUN apk add --no-cache tini
RUN addgroup -g 1001 -S zopkit && adduser -S zopkit -u 1001 -G zopkit
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/hrms/node_modules ./hrms/node_modules
COPY --from=builder /app/hrms/dist ./hrms/dist
COPY --from=builder /app/hrms/package.json ./hrms/package.json
USER zopkit
EXPOSE 5000
ENTRYPOINT ["tini", "--"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/health/live || exit 1
CMD ["node", "hrms/dist/bootstrap.js"]
```

### 4.5 Build and Push Commands

```bash
# Authenticate Docker with ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Set variables
export AWS_ACCOUNT_ID=123456789012
export AWS_REGION=us-east-1
export GIT_SHA=$(git rev-parse --short HEAD)
export ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Build and push wrapper-backend
docker build -f backend/Dockerfile -t ${ECR_REGISTRY}/zopkit/wrapper-backend:sha-${GIT_SHA} -t ${ECR_REGISTRY}/zopkit/wrapper-backend:latest .
docker push ${ECR_REGISTRY}/zopkit/wrapper-backend:sha-${GIT_SHA}
docker push ${ECR_REGISTRY}/zopkit/wrapper-backend:latest

# Build and push crm-backend
docker build -f crm/Dockerfile -t ${ECR_REGISTRY}/zopkit/crm-backend:sha-${GIT_SHA} -t ${ECR_REGISTRY}/zopkit/crm-backend:latest .
docker push ${ECR_REGISTRY}/zopkit/crm-backend:sha-${GIT_SHA}
docker push ${ECR_REGISTRY}/zopkit/crm-backend:latest

# Build and push hrms-backend
docker build -f hrms/Dockerfile -t ${ECR_REGISTRY}/zopkit/hrms-backend:sha-${GIT_SHA} -t ${ECR_REGISTRY}/zopkit/hrms-backend:latest .
docker push ${ECR_REGISTRY}/zopkit/hrms-backend:sha-${GIT_SHA}
docker push ${ECR_REGISTRY}/zopkit/hrms-backend:latest
```

---

## 5. Kubernetes Manifests

All manifests go in a `k8s/` directory at the repo root. Structure:

```
k8s/
  base/
    namespace.yaml
    configmap.yaml
    secrets.yaml
    ingress.yaml
    pdb.yaml
  wrapper-backend/
    deployment.yaml
    service.yaml
    hpa.yaml
  crm-backend/
    deployment.yaml
    service.yaml
    hpa.yaml
  hrms-backend/
    deployment.yaml
    service.yaml
    hpa.yaml
  cronjobs/
    credit-expiry.yaml
    trial-expiry.yaml
    event-cleanup.yaml
    subscription-safety-net.yaml
```

### 5.1 Namespace

```yaml
# k8s/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: zopkit-prod
  labels:
    environment: production
    project: zopkit
```

### 5.2 ConfigMap (Non-Secret Environment Variables)

```yaml
# k8s/base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: zopkit-config
  namespace: zopkit-prod
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  DISABLE_LOGGING: "false"

  # Wrapper backend
  WRAPPER_PORT: "3000"
  WRAPPER_HOST: "0.0.0.0"
  FRONTEND_URL: "https://app.zopkit.com"
  BACKEND_URL: "https://api.zopkit.com"

  # CRM backend
  CRM_PORT: "4000"
  CRM_FRONTEND_URL: "https://crm.zopkit.com"
  CRM_BACKEND_URL: "https://crm-api.zopkit.com"

  # HRMS backend
  HRMS_PORT: "5000"
  HRMS_FRONTEND_URL: "https://hrms.zopkit.com"
  HRMS_BACKEND_URL: "https://hrms-api.zopkit.com"

  # Database pool sizing (per pod -- CRITICAL: see section 6.4)
  DB_POOL_MAX: "5"
  DB_SYSTEM_POOL_MAX: "2"
  DB_STATEMENT_TIMEOUT_MS: "30000"
  DB_IDLE_IN_TX_TIMEOUT_MS: "30000"

  # Kinde (non-secret parts)
  KINDE_DOMAIN: "https://zopkit.kinde.com"
  KINDE_ISSUER_URL: "https://zopkit.kinde.com"
  KINDE_SITE_URL: "https://app.zopkit.com"
  KINDE_POST_LOGOUT_REDIRECT_URL: "https://app.zopkit.com"
  KINDE_POST_LOGIN_REDIRECT_URL: "https://app.zopkit.com/auth/callback"

  # Redis
  REDIS_HOST: "zopkit-redis.xxxxxx.0001.use1.cache.amazonaws.com"
  REDIS_PORT: "6379"
  REDIS_TLS: "true"

  # Route 53
  HOSTED_ZONE_ID: "Z0123456789ABCDEFGHIJ"
  BASE_DOMAIN: "zopkit.com"

  # Cors
  CORS_ORIGINS: "https://app.zopkit.com,https://crm.zopkit.com,https://hrms.zopkit.com"

  # Fastify
  FASTIFY_REQUEST_TIMEOUT_MS: "30000"
```

### 5.3 Secrets (Reference to AWS Secrets Manager)

First, install the External Secrets Operator:

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets --create-namespace
```

```yaml
# k8s/base/secret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: zopkit-prod
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: zopkit-secrets-sa

---
# k8s/base/external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: zopkit-secrets
  namespace: zopkit-prod
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: zopkit-secrets
    creationPolicy: Owner
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: zopkit/production/database
        property: url
    - secretKey: JWT_SECRET
      remoteRef:
        key: zopkit/production/auth
        property: jwt_secret
    - secretKey: KINDE_CLIENT_ID
      remoteRef:
        key: zopkit/production/kinde
        property: client_id
    - secretKey: KINDE_CLIENT_SECRET
      remoteRef:
        key: zopkit/production/kinde
        property: client_secret
    - secretKey: KINDE_M2M_CLIENT_ID
      remoteRef:
        key: zopkit/production/kinde
        property: m2m_client_id
    - secretKey: KINDE_M2M_CLIENT_SECRET
      remoteRef:
        key: zopkit/production/kinde
        property: m2m_client_secret
    - secretKey: STRIPE_SECRET_KEY
      remoteRef:
        key: zopkit/production/stripe
        property: secret_key
    - secretKey: STRIPE_WEBHOOK_SECRET
      remoteRef:
        key: zopkit/production/stripe
        property: webhook_secret
    - secretKey: BREVO_API_KEY
      remoteRef:
        key: zopkit/production/brevo
        property: api_key
    - secretKey: SNS_INTER_APP_TOPIC_ARN
      remoteRef:
        key: zopkit/production/messaging
        property: sns_inter_app_topic_arn
    - secretKey: SNS_BROADCAST_TOPIC_ARN
      remoteRef:
        key: zopkit/production/messaging
        property: sns_broadcast_topic_arn
    - secretKey: SQS_WRAPPER_QUEUE_URL
      remoteRef:
        key: zopkit/production/messaging
        property: sqs_wrapper_queue_url
    - secretKey: SNS_LARGE_PAYLOAD_BUCKET
      remoteRef:
        key: zopkit/production/messaging
        property: sns_large_payload_bucket
    - secretKey: AWS_ACCESS_KEY_ID
      remoteRef:
        key: zopkit/production/aws
        property: access_key_id
    - secretKey: AWS_SECRET_ACCESS_KEY
      remoteRef:
        key: zopkit/production/aws
        property: secret_access_key
    - secretKey: ELASTICSEARCH_URL
      remoteRef:
        key: zopkit/production/elasticsearch
        property: url
    - secretKey: SENTRY_DSN
      remoteRef:
        key: zopkit/production/sentry
        property: dsn
    - secretKey: COOKIE_SECRET
      remoteRef:
        key: zopkit/production/auth
        property: cookie_secret
```

### 5.4 Wrapper Backend Deployment

```yaml
# k8s/wrapper-backend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wrapper-backend
  namespace: zopkit-prod
  labels:
    app: wrapper-backend
    version: v1
spec:
  replicas: 2
  revisionHistoryLimit: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0        # Zero-downtime: never remove a pod before a new one is ready
      maxSurge: 1              # Create 1 extra pod during rollout
  selector:
    matchLabels:
      app: wrapper-backend
  template:
    metadata:
      labels:
        app: wrapper-backend
        version: v1
    spec:
      serviceAccountName: wrapper-backend-sa
      terminationGracePeriodSeconds: 30
      containers:
        - name: wrapper-backend
          image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/zopkit/wrapper-backend:sha-PLACEHOLDER
          imagePullPolicy: Always
          ports:
            - containerPort: 3000
              name: http
              protocol: TCP
          envFrom:
            - configMapRef:
                name: zopkit-config
            - secretRef:
                name: zopkit-secrets
          env:
            - name: PORT
              value: "3000"
            - name: HOST
              value: "0.0.0.0"
            - name: SERVICE_NAME
              value: "wrapper-backend"
            # Disable in-process cron jobs -- they run as K8s CronJobs now
            - name: DISABLE_CRON_JOBS
              value: "true"
            # Pod identity (for logging and leader election)
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: POD_IP
              valueFrom:
                fieldRef:
                  fieldPath: status.podIP
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
          # Readiness probe: pod only receives traffic when ready
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          # Liveness probe: restart pod if unhealthy
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 15
            timeoutSeconds: 5
            failureThreshold: 3
          # Startup probe: give the app time to initialize (DB connections, etc.)
          startupProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 10  # 5s + 10*5s = 55s max startup time
          # Graceful shutdown: Fastify already handles SIGTERM
          # preStop hook gives ALB time to deregister the pod before SIGTERM
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 5"]
      # Spread pods across AZs for high availability
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: wrapper-backend
```

### 5.5 Wrapper Backend Service

```yaml
# k8s/wrapper-backend/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: wrapper-backend
  namespace: zopkit-prod
  labels:
    app: wrapper-backend
spec:
  type: ClusterIP
  ports:
    - port: 3000
      targetPort: 3000
      protocol: TCP
      name: http
  selector:
    app: wrapper-backend
```

### 5.6 Wrapper Backend HPA

```yaml
# k8s/wrapper-backend/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: wrapper-backend-hpa
  namespace: zopkit-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: wrapper-backend
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 75
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60   # Wait 60s before scaling up again
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300  # Wait 5 min before scaling down (avoid flapping)
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

### 5.7 CRM Backend Deployment, Service, HPA

```yaml
# k8s/crm-backend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crm-backend
  namespace: zopkit-prod
  labels:
    app: crm-backend
spec:
  replicas: 2
  revisionHistoryLimit: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app: crm-backend
  template:
    metadata:
      labels:
        app: crm-backend
    spec:
      serviceAccountName: wrapper-backend-sa
      terminationGracePeriodSeconds: 30
      containers:
        - name: crm-backend
          image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/zopkit/crm-backend:sha-PLACEHOLDER
          imagePullPolicy: Always
          ports:
            - containerPort: 4000
              name: http
          envFrom:
            - configMapRef:
                name: zopkit-config
            - secretRef:
                name: zopkit-secrets
          env:
            - name: PORT
              value: "4000"
            - name: HOST
              value: "0.0.0.0"
            - name: SERVICE_NAME
              value: "crm-backend"
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
          resources:
            requests:
              cpu: "200m"
              memory: "384Mi"
            limits:
              cpu: "750m"
              memory: "768Mi"
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 4000
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health/live
              port: 4000
            initialDelaySeconds: 15
            periodSeconds: 15
            timeoutSeconds: 5
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health/live
              port: 4000
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 10
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 5"]
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: crm-backend

---
# k8s/crm-backend/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: crm-backend
  namespace: zopkit-prod
  labels:
    app: crm-backend
spec:
  type: ClusterIP
  ports:
    - port: 4000
      targetPort: 4000
      protocol: TCP
      name: http
  selector:
    app: crm-backend

---
# k8s/crm-backend/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: crm-backend-hpa
  namespace: zopkit-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: crm-backend
  minReplicas: 2
  maxReplicas: 4
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 75
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

### 5.8 HRMS Backend Deployment, Service, HPA

```yaml
# k8s/hrms-backend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hrms-backend
  namespace: zopkit-prod
  labels:
    app: hrms-backend
spec:
  replicas: 2
  revisionHistoryLimit: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app: hrms-backend
  template:
    metadata:
      labels:
        app: hrms-backend
    spec:
      serviceAccountName: wrapper-backend-sa
      terminationGracePeriodSeconds: 30
      containers:
        - name: hrms-backend
          image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/zopkit/hrms-backend:sha-PLACEHOLDER
          imagePullPolicy: Always
          ports:
            - containerPort: 5000
              name: http
          envFrom:
            - configMapRef:
                name: zopkit-config
            - secretRef:
                name: zopkit-secrets
          env:
            - name: PORT
              value: "5000"
            - name: HOST
              value: "0.0.0.0"
            - name: SERVICE_NAME
              value: "hrms-backend"
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
          resources:
            requests:
              cpu: "200m"
              memory: "384Mi"
            limits:
              cpu: "750m"
              memory: "768Mi"
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 5000
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health/live
              port: 5000
            initialDelaySeconds: 15
            periodSeconds: 15
            timeoutSeconds: 5
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health/live
              port: 5000
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 10
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 5"]
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: hrms-backend

---
# k8s/hrms-backend/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: hrms-backend
  namespace: zopkit-prod
  labels:
    app: hrms-backend
spec:
  type: ClusterIP
  ports:
    - port: 5000
      targetPort: 5000
      protocol: TCP
      name: http
  selector:
    app: hrms-backend

---
# k8s/hrms-backend/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: hrms-backend-hpa
  namespace: zopkit-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hrms-backend
  minReplicas: 2
  maxReplicas: 4
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 75
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

### 5.9 Ingress (ALB with Host-Based Routing)

```yaml
# k8s/base/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: zopkit-ingress
  namespace: zopkit-prod
  annotations:
    # AWS Load Balancer Controller annotations
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443},{"HTTP":80}]'
    alb.ingress.kubernetes.io/ssl-redirect: "443"
    alb.ingress.kubernetes.io/certificate-arn: "arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

    # Health check settings
    alb.ingress.kubernetes.io/healthcheck-path: /health/ready
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: "15"
    alb.ingress.kubernetes.io/healthcheck-timeout-seconds: "5"
    alb.ingress.kubernetes.io/healthy-threshold-count: "2"
    alb.ingress.kubernetes.io/unhealthy-threshold-count: "3"

    # Sticky sessions for WebSocket
    alb.ingress.kubernetes.io/target-group-attributes: stickiness.enabled=true,stickiness.lb_cookie.duration_seconds=86400

    # Security
    alb.ingress.kubernetes.io/security-groups: sg-xxxxxxxx
    alb.ingress.kubernetes.io/wafv2-acl-arn: ""  # Optional: add WAF for DDoS protection

    # Group all rules into one ALB (cost savings -- one ALB instead of three)
    alb.ingress.kubernetes.io/group.name: zopkit-prod
    alb.ingress.kubernetes.io/group.order: "1"
spec:
  rules:
    # Rule 1: Wrapper backend API
    - host: api.zopkit.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: wrapper-backend
                port:
                  number: 3000

    # Rule 2: CRM backend API
    - host: crm-api.zopkit.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: crm-backend
                port:
                  number: 4000

    # Rule 3: HRMS backend API
    - host: hrms-api.zopkit.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: hrms-backend
                port:
                  number: 5000

---
# Separate ingress for wildcard tenant subdomains (lower priority in ALB group)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: zopkit-tenant-ingress
  namespace: zopkit-prod
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/certificate-arn: "arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    alb.ingress.kubernetes.io/healthcheck-path: /health/ready
    alb.ingress.kubernetes.io/group.name: zopkit-prod
    alb.ingress.kubernetes.io/group.order: "100"  # Lower priority than fixed subdomains
spec:
  rules:
    # Wildcard rule: all *.zopkit.com that did not match above go to wrapper-backend
    - host: "*.zopkit.com"
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: wrapper-backend
                port:
                  number: 3000
```

### 5.10 CronJob Manifests

#### Credit Expiry (Hourly)

```yaml
# k8s/cronjobs/credit-expiry.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: credit-expiry
  namespace: zopkit-prod
  labels:
    workload-type: cronjob  # Matches Fargate profile
spec:
  schedule: "0 * * * *"  # Every hour at minute 0
  concurrencyPolicy: Forbid  # Never run two instances simultaneously
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  startingDeadlineSeconds: 120  # If missed by > 2 min, skip this run
  jobTemplate:
    spec:
      backoffLimit: 2  # Retry twice on failure
      activeDeadlineSeconds: 300  # Kill job if running > 5 min
      template:
        metadata:
          labels:
            app: credit-expiry
            workload-type: cronjob
        spec:
          restartPolicy: OnFailure
          serviceAccountName: wrapper-backend-sa
          containers:
            - name: credit-expiry
              image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/zopkit/wrapper-backend:sha-PLACEHOLDER
              command:
                - node
                - -e
                - |
                  import('./backend/dist/features/credits/services/credit-expiry-service.js')
                    .then(mod => mod.CreditExpiryService.processExpiredCredits())
                    .then(result => { console.log('Credit expiry completed:', JSON.stringify(result)); process.exit(0); })
                    .catch(err => { console.error('Credit expiry failed:', err); process.exit(1); });
              envFrom:
                - configMapRef:
                    name: zopkit-config
                - secretRef:
                    name: zopkit-secrets
              env:
                - name: SERVICE_NAME
                  value: "credit-expiry-cronjob"
              resources:
                requests:
                  cpu: "100m"
                  memory: "256Mi"
                limits:
                  cpu: "500m"
                  memory: "512Mi"
```

#### Trial Expiry (Every 5 Minutes)

```yaml
# k8s/cronjobs/trial-expiry.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: trial-expiry
  namespace: zopkit-prod
  labels:
    workload-type: cronjob
spec:
  schedule: "*/5 * * * *"  # Every 5 minutes
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  startingDeadlineSeconds: 60
  jobTemplate:
    spec:
      backoffLimit: 1
      activeDeadlineSeconds: 240  # 4 min max
      template:
        metadata:
          labels:
            app: trial-expiry
            workload-type: cronjob
        spec:
          restartPolicy: OnFailure
          serviceAccountName: wrapper-backend-sa
          containers:
            - name: trial-expiry
              image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/zopkit/wrapper-backend:sha-PLACEHOLDER
              command:
                - node
                - -e
                - |
                  import('./backend/dist/utils/trial-manager.js')
                    .then(mod => {
                      const mgr = mod.default || new mod.TrialManager();
                      return mgr.checkExpiredTrials();
                    })
                    .then(() => { console.log('Trial expiry check completed'); process.exit(0); })
                    .catch(err => { console.error('Trial expiry check failed:', err); process.exit(1); });
              envFrom:
                - configMapRef:
                    name: zopkit-config
                - secretRef:
                    name: zopkit-secrets
              env:
                - name: SERVICE_NAME
                  value: "trial-expiry-cronjob"
              resources:
                requests:
                  cpu: "100m"
                  memory: "256Mi"
                limits:
                  cpu: "500m"
                  memory: "512Mi"
```

#### Event Cleanup (Daily)

```yaml
# k8s/cronjobs/event-cleanup.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: event-cleanup
  namespace: zopkit-prod
  labels:
    workload-type: cronjob
spec:
  schedule: "0 2 * * *"  # 2 AM UTC daily
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  startingDeadlineSeconds: 600
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 600  # 10 min max
      template:
        metadata:
          labels:
            app: event-cleanup
            workload-type: cronjob
        spec:
          restartPolicy: OnFailure
          serviceAccountName: wrapper-backend-sa
          containers:
            - name: event-cleanup
              image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/zopkit/wrapper-backend:sha-PLACEHOLDER
              command:
                - node
                - -e
                - |
                  import('./backend/dist/features/messaging/services/event-tracking-service.js')
                    .then(mod => mod.EventTrackingService.cleanupOldEvents(30))
                    .then(deleted => { console.log('Event cleanup completed, deleted:', deleted); process.exit(0); })
                    .catch(err => { console.error('Event cleanup failed:', err); process.exit(1); });
              envFrom:
                - configMapRef:
                    name: zopkit-config
                - secretRef:
                    name: zopkit-secrets
              env:
                - name: SERVICE_NAME
                  value: "event-cleanup-cronjob"
              resources:
                requests:
                  cpu: "100m"
                  memory: "256Mi"
                limits:
                  cpu: "500m"
                  memory: "512Mi"
```

#### Subscription Safety Net (Daily)

```yaml
# k8s/cronjobs/subscription-safety-net.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: subscription-safety-net
  namespace: zopkit-prod
  labels:
    workload-type: cronjob
spec:
  schedule: "30 2 * * *"  # 2:30 AM UTC daily (offset from event cleanup)
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  startingDeadlineSeconds: 600
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 300
      template:
        metadata:
          labels:
            app: subscription-safety-net
            workload-type: cronjob
        spec:
          restartPolicy: OnFailure
          serviceAccountName: wrapper-backend-sa
          containers:
            - name: subscription-safety-net
              image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/zopkit/wrapper-backend:sha-PLACEHOLDER
              command:
                - node
                - -e
                - |
                  // This logic is currently inline in app-fastify.ts.
                  // Extract to a standalone script: backend/src/scripts/subscription-safety-net.ts
                  import('./backend/dist/scripts/subscription-safety-net.js')
                    .then(mod => mod.run())
                    .then(() => { console.log('Subscription safety net completed'); process.exit(0); })
                    .catch(err => { console.error('Subscription safety net failed:', err); process.exit(1); });
              envFrom:
                - configMapRef:
                    name: zopkit-config
                - secretRef:
                    name: zopkit-secrets
              env:
                - name: SERVICE_NAME
                  value: "subscription-safety-net-cronjob"
              resources:
                requests:
                  cpu: "100m"
                  memory: "256Mi"
                limits:
                  cpu: "500m"
                  memory: "512Mi"
```

### 5.11 PodDisruptionBudget

```yaml
# k8s/base/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: wrapper-backend-pdb
  namespace: zopkit-prod
spec:
  minAvailable: 1  # Always keep at least 1 pod running during voluntary disruptions
  selector:
    matchLabels:
      app: wrapper-backend

---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: crm-backend-pdb
  namespace: zopkit-prod
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: crm-backend

---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: hrms-backend-pdb
  namespace: zopkit-prod
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: hrms-backend
```

---

## 6. What Breaks at Scale -- Code Changes Required

### 6.1 In-Memory Auth Cache -> Redis

**Problem**: The auth middleware (`backend/src/middleware/auth/auth.ts`) uses three in-memory `Map` caches:

```typescript
// CURRENT: Lines 134-162 of auth.ts
const userRecordCache = new Map<string, UserRecordCacheEntry>();   // user lookup
const roleCacheByUserId = new Map<string, RoleCacheEntry>();       // role/super-admin
const tenantLookupCache = new Map<string, TenantLookupEntry>();    // org-code -> tenantId
```

With multiple pods, each pod has its own cache. When a user's role changes on pod A, pods B and C still serve stale data for up to 5 minutes. Worse, every new pod starts with a cold cache, causing a burst of DB queries.

**Solution**: Replace all three `Map` caches with ElastiCache Redis.

**Step 1: Install ioredis**

```bash
pnpm --filter wrapper-backend add ioredis
```

**Step 2: Create a shared Redis client** (`backend/src/utils/redis-client.ts`)

```typescript
// backend/src/utils/redis-client.ts
import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const host = process.env.REDIS_HOST;
    const port = Number(process.env.REDIS_PORT || 6379);

    if (!host) {
      throw new Error('REDIS_HOST environment variable is required');
    }

    redis = new Redis({
      host,
      port,
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    redis.connect().catch((err) => {
      console.error('Redis initial connect failed:', err.message);
    });
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
```

**Step 3: Replace in-memory caches in auth.ts**

```typescript
// BEFORE (in-memory):
const userRecordCache = new Map<string, UserRecordCacheEntry>();

export function invalidateUserCache(kindeUserId: string): void {
  userRecordCache.delete(kindeUserId);
}

async function findUserInDatabase(kindeUserId: string): Promise<UserRecord | null> {
  const cached = userRecordCache.get(kindeUserId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }
  // ... DB query ...
  userRecordCache.set(kindeUserId, { value: selectedUser, expiresAt: Date.now() + USER_RECORD_CACHE_TTL_MS });
  return selectedUser;
}

// AFTER (Redis):
import { getRedis } from '../../utils/redis-client.js';

const USER_CACHE_PREFIX = 'auth:user:';
const ROLE_CACHE_PREFIX = 'auth:role:';
const TENANT_CACHE_PREFIX = 'auth:tenant:';
const USER_RECORD_CACHE_TTL_S = 300; // 5 minutes in seconds

export async function invalidateUserCache(kindeUserId: string): Promise<void> {
  try {
    await getRedis().del(`${USER_CACHE_PREFIX}${kindeUserId}`);
  } catch {
    // Fail open -- stale cache is acceptable for 5 min
  }
}

async function findUserInDatabase(kindeUserId: string): Promise<UserRecord | null> {
  // Check Redis cache
  try {
    const cached = await getRedis().get(`${USER_CACHE_PREFIX}${kindeUserId}`);
    if (cached) {
      const entry = JSON.parse(cached) as UserRecord | null;
      // Verify tenant still exists (same logic as before)
      if (entry?.tenantId) {
        const [tenant] = await db
          .select({ tenantId: tenants.tenantId })
          .from(tenants)
          .where(eq(tenants.tenantId, entry.tenantId))
          .limit(1);
        if (!tenant) {
          await getRedis().del(`${USER_CACHE_PREFIX}${kindeUserId}`);
          await getRedis().setex(`${USER_CACHE_PREFIX}${kindeUserId}`, USER_RECORD_CACHE_TTL_S, JSON.stringify(null));
          return null;
        }
      }
      return entry;
    }
  } catch {
    // Redis down -- fall through to DB query
  }

  // ... existing DB query logic ...

  // Cache in Redis
  try {
    await getRedis().setex(
      `${USER_CACHE_PREFIX}${kindeUserId}`,
      USER_RECORD_CACHE_TTL_S,
      JSON.stringify(selectedUser)
    );
  } catch {
    // Fail open
  }

  return selectedUser;
}
```

Apply the same pattern to `roleCacheByUserId` and `tenantLookupCache`.

**Step 4: Add Redis to graceful shutdown** (`app-fastify.ts`)

```typescript
// In the shutdown handler, after closing DB connections:
import { closeRedis } from './utils/redis-client.js';

// Add to shutdown sequence:
await closeRedis();
```

### 6.2 Cron Jobs -> K8s CronJobs

**Problem**: The wrapper backend starts several cron jobs inside the process:

| Cron Job | Location | Schedule |
|----------|----------|----------|
| Credit expiry | `utils/credit-expiry-manager.ts` (node-cron) | Every hour |
| Credit warning emails | `utils/credit-expiry-manager.ts` (node-cron) | Daily 9 AM |
| Trial expiry | `utils/trial-manager.ts` (node-cron) | Every minute |
| Event cleanup | `app-fastify.ts:540` (setInterval) | Every 24h |
| Subscription safety net | `app-fastify.ts:657` (setInterval) | Every 24h |

With multiple pods, every pod runs every cron job. Credit expiry runs 6 times per hour instead of once. This can cause double-processing, duplicate emails, and race conditions.

**Solution A: K8s CronJobs (Recommended)**

Extract each cron job into a standalone script and run it as a K8s CronJob (see Section 5.10 for YAML manifests).

**Step 1: Extract subscription safety net** from `app-fastify.ts` to a standalone script:

```typescript
// backend/src/scripts/subscription-safety-net.ts
import { db } from '../db/index.js';
import { subscriptions } from '../db/schema/index.js';
import { eq, and, lt, isNotNull } from 'drizzle-orm';
import { dbManager } from '../db/connection-manager.js';

const GRACE_PERIOD_DAYS = 3;

export async function run(): Promise<void> {
  await dbManager.initialize();

  const now = new Date();
  const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  // 1. Mark expired active subscriptions as past_due
  const expiredActive = await db
    .select({
      subscriptionId: subscriptions.subscriptionId,
      tenantId: subscriptions.tenantId,
      plan: subscriptions.plan,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, 'active'),
        isNotNull(subscriptions.stripeSubscriptionId),
        lt(subscriptions.currentPeriodEnd, graceCutoff)
      )
    );

  for (const sub of expiredActive) {
    await db
      .update(subscriptions)
      .set({ status: 'past_due', updatedAt: now })
      .where(eq(subscriptions.subscriptionId, sub.subscriptionId));
    console.log(`Marked ${sub.subscriptionId} as past_due`);
  }

  // 2. Cancel subscriptions past their cancelAt date
  const pendingCancellations = await db
    .select({
      subscriptionId: subscriptions.subscriptionId,
      tenantId: subscriptions.tenantId,
      cancelAt: subscriptions.cancelAt,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, 'active'),
        isNotNull(subscriptions.cancelAt),
        lt(subscriptions.cancelAt, now)
      )
    );

  for (const sub of pendingCancellations) {
    await db
      .update(subscriptions)
      .set({ status: 'canceled', canceledAt: now, updatedAt: now })
      .where(eq(subscriptions.subscriptionId, sub.subscriptionId));
    console.log(`Marked ${sub.subscriptionId} as canceled`);
  }

  console.log(`Processed ${expiredActive.length + pendingCancellations.length} subscriptions`);
  await dbManager.close();
}
```

**Step 2: Add env-based toggle** to disable in-process cron jobs when running in K8s:

```typescript
// In app-fastify.ts, wrap the cron job initialization:
const DISABLE_CRON_JOBS = process.env.DISABLE_CRON_JOBS === 'true';

if (!DISABLE_CRON_JOBS) {
  // ... existing cron job setup code ...
  creditExpiryManager.startExpiryMonitoring();
  // ... etc ...
} else {
  console.log('Cron jobs disabled (DISABLE_CRON_JOBS=true). Using K8s CronJobs instead.');
}
```

**Solution B: Redis-Based Leader Election (Alternative)**

If you prefer to keep cron jobs inside the application process (simpler deployment):

```typescript
// backend/src/utils/leader-election.ts
import { getRedis } from './redis-client.js';

const LEADER_KEY = 'zopkit:leader';
const LEADER_TTL_S = 30; // Leader lease duration
const POD_NAME = process.env.POD_NAME || `pod-${process.pid}`;

/**
 * Attempt to become the leader. Returns true if this pod is the leader.
 * Uses Redis SET NX EX for atomic leader election.
 */
export async function tryAcquireLeadership(): Promise<boolean> {
  try {
    const result = await getRedis().set(LEADER_KEY, POD_NAME, 'EX', LEADER_TTL_S, 'NX');
    return result === 'OK';
  } catch {
    return false; // Redis down -> no leader -> no cron runs (safe default)
  }
}

/**
 * Renew leadership. Returns true if still the leader.
 */
export async function renewLeadership(): Promise<boolean> {
  try {
    const currentLeader = await getRedis().get(LEADER_KEY);
    if (currentLeader === POD_NAME) {
      await getRedis().expire(LEADER_KEY, LEADER_TTL_S);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Start leader election loop. Callback runs only on the leader pod.
 */
export function startLeaderElection(onBecomeLeader: () => void, onLoseLeadership: () => void): void {
  let isLeader = false;

  setInterval(async () => {
    if (isLeader) {
      const renewed = await renewLeadership();
      if (!renewed) {
        isLeader = false;
        onLoseLeadership();
      }
    } else {
      const acquired = await tryAcquireLeadership();
      if (acquired) {
        isLeader = true;
        onBecomeLeader();
      }
    }
  }, 10_000); // Check every 10 seconds
}
```

Usage in `app-fastify.ts`:

```typescript
import { startLeaderElection } from './utils/leader-election.js';

startLeaderElection(
  () => {
    console.log('This pod is now the cron leader. Starting cron jobs.');
    creditExpiryManager.startExpiryMonitoring();
    // ... start other cron jobs
  },
  () => {
    console.log('This pod lost leadership. Stopping cron jobs.');
    creditExpiryManager.stopExpiryMonitoring();
    // ... stop other cron jobs
  }
);
```

### 6.3 WebSocket -> Redis Pub/Sub

**Problem**: The WebSocket server (`backend/src/utils/websocket-server.ts`) maintains connection maps in memory:

```typescript
const clientConnections = new Map<string, Set<WebSocket>>(); // userId -> Set<WebSocket>
const tenantUserMap = new Map<string, Set<string>>();         // tenantId -> Set<userId>
```

When an event fires on pod A (e.g., new notification), it calls `sendToUser(userId, message)`. But the user's WebSocket connection might be on pod B. Pod A's in-memory map does not contain pod B's connections.

**Solution**: Use Redis Pub/Sub as a message bus between pods.

```typescript
// backend/src/utils/websocket-redis-bridge.ts
import { getRedis } from './redis-client.js';
import Redis from 'ioredis';

const WS_CHANNEL = 'zopkit:ws:messages';

interface WSMessage {
  type: 'user' | 'tenant' | 'broadcast';
  targetId: string;  // userId or tenantId
  payload: unknown;
}

let subscriber: Redis | null = null;

/**
 * Publish a WebSocket message to all pods via Redis.
 * Each pod's subscriber will check if it holds the connection and deliver locally.
 */
export async function publishWSMessage(message: WSMessage): Promise<void> {
  try {
    await getRedis().publish(WS_CHANNEL, JSON.stringify(message));
  } catch (err) {
    console.error('Failed to publish WS message to Redis:', err);
  }
}

/**
 * Subscribe to WebSocket messages from other pods.
 * Call this once during server startup.
 */
export function subscribeToWSMessages(
  deliverToUser: (userId: string, payload: unknown) => void,
  deliverToTenant: (tenantId: string, payload: unknown) => void,
  deliverBroadcast: (payload: unknown) => void
): void {
  // Create a separate Redis connection for subscribing
  // (ioredis subscriber connections cannot be used for other commands)
  const host = process.env.REDIS_HOST!;
  const port = Number(process.env.REDIS_PORT || 6379);

  subscriber = new Redis({
    host,
    port,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  });

  subscriber.subscribe(WS_CHANNEL);

  subscriber.on('message', (_channel: string, rawMessage: string) => {
    try {
      const message = JSON.parse(rawMessage) as WSMessage;
      switch (message.type) {
        case 'user':
          deliverToUser(message.targetId, message.payload);
          break;
        case 'tenant':
          deliverToTenant(message.targetId, message.payload);
          break;
        case 'broadcast':
          deliverBroadcast(message.payload);
          break;
      }
    } catch (err) {
      console.error('Failed to process WS message from Redis:', err);
    }
  });
}

export async function closeWSSubscriber(): Promise<void> {
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
}
```

**Modify the existing `sendToUser` / `sendToTenant`** functions in `websocket-server.ts`:

```typescript
// BEFORE (local-only delivery):
export function sendToUser(userId: string, message: object): boolean {
  const connections = clientConnections.get(userId);
  if (!connections || connections.size === 0) return false;
  const payload = JSON.stringify(message);
  connections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  });
  return true;
}

// AFTER (Redis pub/sub fan-out):
import { publishWSMessage } from './websocket-redis-bridge.js';

export async function sendToUser(userId: string, message: object): Promise<boolean> {
  // Publish to Redis -- ALL pods receive this and deliver locally
  await publishWSMessage({ type: 'user', targetId: userId, payload: message });
  return true;
}

// Local delivery function (called by the Redis subscriber)
function deliverToUserLocal(userId: string, payload: unknown): void {
  const connections = clientConnections.get(userId);
  if (!connections) return;
  const data = JSON.stringify(payload);
  connections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
}
```

### 6.4 Database Connection Pool Sizing

**Problem**: The current setup uses `DB_POOL_MAX=30` (app) + `DB_SYSTEM_POOL_MAX=15` (system) = 45 connections per process. With 6 wrapper pods + 4 CRM pods + 4 HRMS pods + 4 CronJob pods = 18 potential concurrent processes:

```
18 processes x 45 connections = 810 connections
```

Supabase free tier allows 60 connections. Supabase Pro allows 250-500 connections. This will immediately exhaust the pool.

**Solution**: Reduce pool sizes per pod and/or add PgBouncer.

**Formula:**

```
pool_per_pod = floor(max_db_connections / max_total_pods) - safety_margin

For Supabase Pro (250 connections):
  Total pods: wrapper(6) + crm(4) + hrms(4) + cronjobs(4 concurrent max) = 18
  pool_per_pod = floor(250 / 18) - 2 = 11
  app_pool = 8, system_pool = 3
```

**ConfigMap change** (already reflected in Section 5.2):

```yaml
# In ConfigMap:
DB_POOL_MAX: "5"          # Was 30; now 5 per pod
DB_SYSTEM_POOL_MAX: "2"   # Was 15; now 2 per pod
```

**Alternative: PgBouncer Sidecar**

Deploy PgBouncer as a sidecar container in each pod. The application connects to `localhost:5432` (PgBouncer), and PgBouncer manages a smaller pool to the actual database.

```yaml
# Add to the containers list in deployment.yaml:
- name: pgbouncer
  image: edoburu/pgbouncer:1.22.0
  ports:
    - containerPort: 5432
  env:
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: zopkit-secrets
          key: DATABASE_URL
    - name: POOL_MODE
      value: "transaction"
    - name: DEFAULT_POOL_SIZE
      value: "5"
    - name: MAX_CLIENT_CONN
      value: "50"
    - name: MAX_DB_CONNECTIONS
      value: "5"
  resources:
    requests:
      cpu: "50m"
      memory: "64Mi"
    limits:
      cpu: "200m"
      memory: "128Mi"
```

Then change `DATABASE_URL` in the app container to `postgresql://user:pass@localhost:5432/dbname`.

**Recommendation**: Start with reduced pool sizes (Option 1). Add PgBouncer sidecar only if you hit connection pressure under load.

### 6.5 SNS + SQS Considerations

**Background**: Inter-app messaging uses AWS SNS (fan-out publish) and SQS (per-app inbox + direct job queues). The publisher (`sns-sqs-publisher.ts`) uses the AWS SDK over HTTPS — there are no long-lived broker connections to manage.

**Why this is simpler than a broker**:
- No connection pool to size: every `PublishCommand` / `ReceiveMessageCommand` is an HTTPS call. SDK keep-alive handles socket reuse per process.
- No broker instance to scale: SNS and SQS are fully managed and scale automatically.
- IAM is the only authentication: no usernames, passwords, or AMQPS endpoints in env.

**What to verify before the EKS migration**:

| Item | Why |
|------|-----|
| Pod IAM role has `sns:Publish` on both topic ARNs | Without it, publishes 403 silently into the outbox retry loop |
| Pod IAM role has `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:ChangeMessageVisibility`, `sqs:GetQueueAttributes` on its inbox queue | Required for the consumer to drain messages |
| Pod IAM role has `s3:PutObject` / `s3:GetObject` on `SNS_LARGE_PAYLOAD_BUCKET` | Required for >200 KB payload claim-check |
| Each app's SQS queue has a DLQ + `RedrivePolicy` with `maxReceiveCount: 3` | Caps retries on poison messages |
| SNS subscription on each queue has a filter policy: `{ "targetApplication": ["wrapper"\|"crm"\|"accounting"] }` | Server-side filtering — keeps each app's queue clean |

**Quotas worth knowing**:
- SQS message size: **256 KB hard limit** — that's why we have the S3 claim-check (`large-payload-store.ts`).
- SQS receive throughput: 3,000 receives/sec per queue (much more with batching) — well above anything we generate.
- SNS publish rate: 30,000/sec per topic — non-issue.

Monitor via CloudWatch:
- `NumberOfMessagesPublished` on each SNS topic
- `ApproximateNumberOfMessagesVisible` and `ApproximateNumberOfMessagesNotVisible` on each SQS queue
- `ApproximateNumberOfMessagesVisible` on each DLQ (should be 0; alarms here)

### 6.6 Frontend Serving -> S3 + CloudFront

**Problem**: Currently, Nginx on the EC2 instance serves the React frontend static files. In EKS, static files should not be served from API pods. This wastes compute, prevents CDN caching, and tightly couples frontend deployments to backend deployments.

**Solution**: Deploy each frontend SPA to its own S3 bucket, fronted by CloudFront.

**Step 1: Create S3 buckets**

```bash
for BUCKET in zopkit-wrapper-frontend zopkit-crm-frontend zopkit-hrms-frontend; do
  aws s3 mb s3://${BUCKET} --region us-east-1

  # Enable static website hosting
  aws s3 website s3://${BUCKET} \
    --index-document index.html \
    --error-document index.html  # SPA fallback

  # Block public access (CloudFront uses OAI)
  aws s3api put-public-access-block \
    --bucket ${BUCKET} \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
done
```

**Step 2: S3 bucket structure**

```
s3://zopkit-wrapper-frontend/
  current/              ← symlinked via CloudFront origin path
    index.html
    assets/
      index-abc123.js
      index-def456.css
  versions/
    sha-abc1234/        ← immutable, versioned
      index.html
      assets/
        index-abc123.js
        index-def456.css
```

**Step 3: Create CloudFront distribution**

```bash
# Create Origin Access Identity
aws cloudfront create-cloud-front-origin-access-identity \
  --cloud-front-origin-access-identity-config \
  CallerReference=$(date +%s),Comment="zopkit-wrapper-frontend"

# CloudFront distribution (wrapper frontend)
# Use the AWS Console or this CLI command:
aws cloudfront create-distribution \
  --distribution-config '{
    "CallerReference": "wrapper-frontend-'$(date +%s)'",
    "Comment": "Zopkit Wrapper Frontend",
    "Enabled": true,
    "DefaultRootObject": "index.html",
    "Aliases": {
      "Quantity": 1,
      "Items": ["app.zopkit.com"]
    },
    "ViewerCertificate": {
      "ACMCertificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx",
      "SSLSupportMethod": "sni-only",
      "MinimumProtocolVersion": "TLSv1.2_2021"
    },
    "Origins": {
      "Quantity": 1,
      "Items": [{
        "Id": "S3-wrapper-frontend",
        "DomainName": "zopkit-wrapper-frontend.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": "origin-access-identity/cloudfront/EXXXXXXXXXX"
        }
      }]
    },
    "DefaultCacheBehavior": {
      "TargetOriginId": "S3-wrapper-frontend",
      "ViewerProtocolPolicy": "redirect-to-https",
      "AllowedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]},
      "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]},
      "ForwardedValues": {"QueryString": false, "Cookies": {"Forward": "none"}},
      "MinTTL": 0,
      "DefaultTTL": 86400,
      "MaxTTL": 31536000,
      "Compress": true
    },
    "CustomErrorResponses": {
      "Quantity": 1,
      "Items": [{
        "ErrorCode": 403,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 0
      }]
    }
  }'

# Repeat for crm.zopkit.com and hrms.zopkit.com with their respective S3 buckets.
```

**Step 4: Deploy frontend**

```bash
# Build frontend
pnpm --filter wrapper-frontend build

# Sync to S3
GIT_SHA=$(git rev-parse --short HEAD)

# Upload versioned copy
aws s3 sync frontend/dist/ s3://zopkit-wrapper-frontend/versions/sha-${GIT_SHA}/ \
  --delete --cache-control "public, max-age=31536000, immutable"

# Upload as current (with short cache for index.html)
aws s3 sync frontend/dist/ s3://zopkit-wrapper-frontend/ \
  --delete --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" --exclude "sw.js" --exclude "manifest.webmanifest"

aws s3 cp frontend/dist/index.html s3://zopkit-wrapper-frontend/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

aws s3 cp frontend/dist/sw.js s3://zopkit-wrapper-frontend/sw.js \
  --cache-control "no-cache, no-store, must-revalidate"

# Invalidate CloudFront cache for index.html
aws cloudfront create-invalidation \
  --distribution-id E1234567890 \
  --paths "/index.html" "/sw.js" "/manifest.webmanifest"
```

**Step 5: Update frontend API URL**

In `frontend/.env.production`:

```bash
# BEFORE:
VITE_API_URL=https://api.zopkit.com

# AFTER (unchanged -- frontend already uses a separate API URL):
VITE_API_URL=https://api.zopkit.com
```

---

## 7. CI/CD Pipeline

### 7.1 Complete GitHub Actions Workflow

```yaml
# .github/workflows/deploy-eks.yml
name: Deploy to EKS

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      deploy_target:
        description: 'Deploy target'
        required: true
        default: 'production'
        type: choice
        options:
          - staging
          - production

concurrency:
  group: deploy-${{ github.event.inputs.deploy_target || 'production' }}
  cancel-in-progress: true

env:
  AWS_REGION: us-east-1
  ECR_REGISTRY: 123456789012.dkr.ecr.us-east-1.amazonaws.com
  EKS_CLUSTER: zopkit-prod
  K8S_NAMESPACE: zopkit-prod

jobs:
  # ── 1. Test (blocking gate) ───────────────────────────────────────
  test:
    name: Test & Type-check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Guard committed DB migrations
        run: |
          pnpm --filter wrapper-backend run db:generate
          pnpm --filter wrapper-backend run db:check:registry
          if [ -n "$(git status --porcelain -- backend/src/db/migrations)" ]; then
            echo "::error::Schema changes detected without committed migration files."
            exit 1
          fi

      - name: Type-check backend
        working-directory: backend
        run: pnpm exec tsc --noEmit

      - name: Unit tests (backend)
        working-directory: backend
        run: pnpm test

      - name: Type-check frontend
        working-directory: frontend
        continue-on-error: true
        run: pnpm exec tsc --noEmit

      - name: Unit tests (frontend)
        working-directory: frontend
        continue-on-error: true
        run: pnpm test -- --run

  # ── 2. Build & Push Docker Images ─────────────────────────────────
  build-images:
    name: Build & Push to ECR
    needs: test
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    outputs:
      image_tag: ${{ steps.meta.outputs.tag }}
    steps:
      - uses: actions/checkout@v4

      - name: Set image tag
        id: meta
        run: echo "tag=sha-$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-deploy
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build & push wrapper-backend
        uses: docker/build-push-action@v5
        with:
          context: .
          file: backend/Dockerfile
          push: true
          tags: |
            ${{ env.ECR_REGISTRY }}/zopkit/wrapper-backend:${{ steps.meta.outputs.tag }}
            ${{ env.ECR_REGISTRY }}/zopkit/wrapper-backend:latest
          cache-from: type=registry,ref=${{ env.ECR_REGISTRY }}/zopkit/wrapper-backend:latest
          cache-to: type=inline

      - name: Build & push crm-backend
        uses: docker/build-push-action@v5
        with:
          context: .
          file: crm/Dockerfile
          push: true
          tags: |
            ${{ env.ECR_REGISTRY }}/zopkit/crm-backend:${{ steps.meta.outputs.tag }}
            ${{ env.ECR_REGISTRY }}/zopkit/crm-backend:latest

      - name: Build & push hrms-backend
        uses: docker/build-push-action@v5
        with:
          context: .
          file: hrms/Dockerfile
          push: true
          tags: |
            ${{ env.ECR_REGISTRY }}/zopkit/hrms-backend:${{ steps.meta.outputs.tag }}
            ${{ env.ECR_REGISTRY }}/zopkit/hrms-backend:latest

  # ── 3. Build & Deploy Frontends to S3 + CloudFront ────────────────
  deploy-frontends:
    name: Deploy Frontends
    needs: test
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-deploy
          aws-region: ${{ env.AWS_REGION }}

      - name: Build wrapper frontend
        working-directory: frontend
        run: pnpm build
        env:
          VITE_API_URL: https://api.zopkit.com

      - name: Deploy wrapper frontend to S3
        run: |
          aws s3 sync frontend/dist/ s3://zopkit-wrapper-frontend/ \
            --delete \
            --cache-control "public, max-age=31536000, immutable" \
            --exclude "index.html" --exclude "sw.js" --exclude "manifest.webmanifest"

          aws s3 cp frontend/dist/index.html s3://zopkit-wrapper-frontend/index.html \
            --cache-control "no-cache, no-store, must-revalidate"

          aws s3 cp frontend/dist/sw.js s3://zopkit-wrapper-frontend/sw.js \
            --cache-control "no-cache, no-store, must-revalidate" 2>/dev/null || true

      - name: Invalidate CloudFront (wrapper)
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_WRAPPER_DISTRIBUTION_ID }} \
            --paths "/index.html" "/sw.js" "/manifest.webmanifest"

      # Repeat for CRM and HRMS frontends as needed

  # ── 4. Deploy to EKS ──────────────────────────────────────────────
  deploy-eks:
    name: Deploy to EKS
    needs: [build-images, deploy-frontends]
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-deploy
          aws-region: ${{ env.AWS_REGION }}

      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name ${{ env.EKS_CLUSTER }} --region ${{ env.AWS_REGION }}

      - name: Run database migrations
        run: |
          # Run migration as a one-shot K8s Job
          kubectl run db-migrate-${{ github.run_number }} \
            --namespace ${{ env.K8S_NAMESPACE }} \
            --image ${{ env.ECR_REGISTRY }}/zopkit/wrapper-backend:${{ needs.build-images.outputs.image_tag }} \
            --restart=Never \
            --env="DATABASE_URL=$(kubectl get secret zopkit-secrets -n ${{ env.K8S_NAMESPACE }} -o jsonpath='{.data.DATABASE_URL}' | base64 -d)" \
            --command -- node backend/dist/db/run-migrations.js

          # Wait for migration to complete (timeout 2 min)
          kubectl wait --for=condition=complete \
            --timeout=120s \
            -n ${{ env.K8S_NAMESPACE }} \
            job/db-migrate-${{ github.run_number }} 2>/dev/null || \
          kubectl wait --for=condition=Ready \
            --timeout=120s \
            -n ${{ env.K8S_NAMESPACE }} \
            pod/db-migrate-${{ github.run_number }}

          # Check exit code
          EXIT_CODE=$(kubectl get pod db-migrate-${{ github.run_number }} -n ${{ env.K8S_NAMESPACE }} -o jsonpath='{.status.containerStatuses[0].state.terminated.exitCode}')
          if [ "$EXIT_CODE" != "0" ]; then
            echo "::error::Database migration failed"
            kubectl logs db-migrate-${{ github.run_number }} -n ${{ env.K8S_NAMESPACE }}
            exit 1
          fi

          # Cleanup
          kubectl delete pod db-migrate-${{ github.run_number }} -n ${{ env.K8S_NAMESPACE }} --ignore-not-found

      - name: Deploy wrapper-backend
        run: |
          kubectl set image deployment/wrapper-backend \
            wrapper-backend=${{ env.ECR_REGISTRY }}/zopkit/wrapper-backend:${{ needs.build-images.outputs.image_tag }} \
            -n ${{ env.K8S_NAMESPACE }}

          kubectl rollout status deployment/wrapper-backend \
            -n ${{ env.K8S_NAMESPACE }} \
            --timeout=300s

      - name: Deploy crm-backend
        run: |
          kubectl set image deployment/crm-backend \
            crm-backend=${{ env.ECR_REGISTRY }}/zopkit/crm-backend:${{ needs.build-images.outputs.image_tag }} \
            -n ${{ env.K8S_NAMESPACE }}

          kubectl rollout status deployment/crm-backend \
            -n ${{ env.K8S_NAMESPACE }} \
            --timeout=300s

      - name: Deploy hrms-backend
        run: |
          kubectl set image deployment/hrms-backend \
            hrms-backend=${{ env.ECR_REGISTRY }}/zopkit/hrms-backend:${{ needs.build-images.outputs.image_tag }} \
            -n ${{ env.K8S_NAMESPACE }}

          kubectl rollout status deployment/hrms-backend \
            -n ${{ env.K8S_NAMESPACE }} \
            --timeout=300s

      - name: Update CronJob images
        run: |
          IMAGE_TAG=${{ needs.build-images.outputs.image_tag }}
          for CRONJOB in credit-expiry trial-expiry event-cleanup subscription-safety-net; do
            kubectl set image cronjob/${CRONJOB} \
              ${CRONJOB}=${{ env.ECR_REGISTRY }}/zopkit/wrapper-backend:${IMAGE_TAG} \
              -n ${{ env.K8S_NAMESPACE }}
          done

      - name: Health check
        run: |
          # Wait for pods to be ready, then check health endpoint
          sleep 10
          for i in $(seq 1 5); do
            STATUS=$(kubectl exec -n ${{ env.K8S_NAMESPACE }} \
              $(kubectl get pod -n ${{ env.K8S_NAMESPACE }} -l app=wrapper-backend -o jsonpath='{.items[0].metadata.name}') \
              -- wget -qO- http://localhost:3000/health/ready 2>/dev/null | grep -o '"status":"[^"]*"' || echo 'failed')
            if echo "$STATUS" | grep -q 'healthy'; then
              echo "Health check passed: $STATUS"
              exit 0
            fi
            echo "Health check attempt $i failed, retrying in 10s..."
            sleep 10
          done
          echo "::error::Health checks failed after 5 attempts"
          exit 1

  # ── 5. Integration Tests (advisory) ───────────────────────────────
  integration-test:
    name: Integration Tests
    needs: test
    runs-on: ubuntu-latest
    continue-on-error: true
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Run integration tests
        working-directory: backend
        run: pnpm test:integration
```

### 7.2 Rollback Procedure

```bash
# Rollback to previous deployment revision
kubectl rollout undo deployment/wrapper-backend -n zopkit-prod
kubectl rollout undo deployment/crm-backend -n zopkit-prod
kubectl rollout undo deployment/hrms-backend -n zopkit-prod

# Rollback to a specific revision
kubectl rollout undo deployment/wrapper-backend -n zopkit-prod --to-revision=3

# Check rollout history
kubectl rollout history deployment/wrapper-backend -n zopkit-prod

# Frontend rollback: deploy the previous version from S3
GIT_SHA=<previous-commit-sha>
aws s3 sync s3://zopkit-wrapper-frontend/versions/sha-${GIT_SHA}/ s3://zopkit-wrapper-frontend/ --delete
aws cloudfront create-invalidation --distribution-id E1234567890 --paths "/*"
```

### 7.3 Canary Deployment (Optional)

For high-risk releases, deploy to a canary deployment first:

```bash
# Create canary deployment with 1 replica
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wrapper-backend-canary
  namespace: zopkit-prod
spec:
  replicas: 1
  selector:
    matchLabels:
      app: wrapper-backend
      track: canary
  template:
    metadata:
      labels:
        app: wrapper-backend
        track: canary
    spec:
      containers:
        - name: wrapper-backend
          image: ${ECR_REGISTRY}/zopkit/wrapper-backend:sha-${NEW_SHA}
          # ... same env, resources, probes as main deployment
EOF

# The canary pods share the same service selector (app: wrapper-backend),
# so the ALB will route ~33% of traffic to canary (1 canary / 3 total pods).

# Monitor for errors, then promote or rollback:
# Promote: update the main deployment image, delete canary
# Rollback: delete canary deployment
kubectl delete deployment wrapper-backend-canary -n zopkit-prod
```

---

## 8. Observability

### 8.1 Sentry (Already Integrated)

Sentry works per-pod with no changes needed. Each pod reports errors independently. The `SENTRY_DSN` env var is already injected via Secrets.

Ensure the Sentry SDK has the pod name in context:

```typescript
// In app-fastify.ts or bootstrap.ts:
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  serverName: process.env.POD_NAME || process.env.HOSTNAME,
});
```

### 8.2 CloudWatch Container Insights

```bash
# Enable Container Insights on the EKS cluster
aws eks update-cluster-config \
  --name zopkit-prod \
  --logging '{"clusterLogging":[{"types":["api","audit","authenticator","controllerManager","scheduler"],"enabled":true}]}'

# Install CloudWatch agent as a DaemonSet
kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonSet/container-insights-monitoring/quickstart/cwagent-fluentd-quickstart.yaml

# Alternatively, use the Helm chart:
helm repo add aws-cloudwatch https://aws.github.io/eks-charts
helm install cloudwatch-agent aws-cloudwatch/aws-cloudwatch-observability \
  --namespace amazon-cloudwatch --create-namespace \
  --set clusterName=zopkit-prod \
  --set region=us-east-1
```

This provides:
- Pod CPU/memory/network metrics
- Node-level metrics
- Container restart counts
- Cluster-level dashboards in CloudWatch

### 8.3 Structured Logging

The backend already uses Winston + Elasticsearch. In EKS, also forward logs to CloudWatch Logs:

```bash
# Logs from stdout/stderr are automatically captured by the CloudWatch agent.
# No code changes needed -- Winston already logs to stdout in production.

# View logs:
kubectl logs -n zopkit-prod -l app=wrapper-backend --tail=100 -f

# Or via CloudWatch Logs Insights:
# Log group: /aws/containerinsights/zopkit-prod/application
# Query:
# fields @timestamp, @message
# | filter kubernetes.container_name = "wrapper-backend"
# | sort @timestamp desc
# | limit 50
```

### 8.4 Health Checks

The existing health check endpoints map directly to K8s probes:

| Endpoint | K8s Probe | Purpose |
|----------|-----------|---------|
| `/health/live` | `livenessProbe` | Process is running, not deadlocked |
| `/health/ready` | `readinessProbe` | DB connected, ready to serve traffic |
| `/health/detailed` | Manual check | DB + MQ + outbox status |
| `/health/deployment` | Manual check | Version, env, memory, uptime |

### 8.5 Alerting

```bash
# CloudWatch Alarms

# 1. Pod restart alarm (indicates crash loops)
aws cloudwatch put-metric-alarm \
  --alarm-name "zopkit-pod-restarts" \
  --metric-name "pod_number_of_container_restarts" \
  --namespace "ContainerInsights" \
  --dimensions Name=ClusterName,Value=zopkit-prod \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 3 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions "arn:aws:sns:us-east-1:123456789012:zopkit-alerts"

# 2. High CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "zopkit-high-cpu" \
  --metric-name "node_cpu_utilization" \
  --namespace "ContainerInsights" \
  --dimensions Name=ClusterName,Value=zopkit-prod \
  --statistic Average \
  --period 300 \
  --evaluation-periods 3 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions "arn:aws:sns:us-east-1:123456789012:zopkit-alerts"

# 3. ALB 5xx error rate
aws cloudwatch put-metric-alarm \
  --alarm-name "zopkit-alb-5xx" \
  --metric-name "HTTPCode_Target_5XX_Count" \
  --namespace "AWS/ApplicationELB" \
  --dimensions Name=LoadBalancer,Value=app/k8s-zopkitprod-xxxxxxx/yyyyyyyyyyyy \
  --statistic Sum \
  --period 60 \
  --evaluation-periods 3 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions "arn:aws:sns:us-east-1:123456789012:zopkit-alerts"
```

---

## 9. Security

### 9.1 Secrets Management

**Strategy**: AWS Secrets Manager + External Secrets Operator (ESO)

Secrets are stored in AWS Secrets Manager and synced to K8s Secrets via ESO (see Section 5.3 for YAML).

```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name zopkit/production/database \
  --secret-string '{"url":"postgresql://user:pass@db.supabase.co:5432/postgres"}'

aws secretsmanager create-secret \
  --name zopkit/production/auth \
  --secret-string '{"jwt_secret":"your-jwt-secret","cookie_secret":"your-cookie-secret"}'

aws secretsmanager create-secret \
  --name zopkit/production/kinde \
  --secret-string '{"client_id":"xxx","client_secret":"xxx","m2m_client_id":"xxx","m2m_client_secret":"xxx"}'

aws secretsmanager create-secret \
  --name zopkit/production/stripe \
  --secret-string '{"secret_key":"sk_live_xxx","webhook_secret":"whsec_xxx"}'

aws secretsmanager create-secret \
  --name zopkit/production/brevo \
  --secret-string '{"api_key":"xkeysib-xxx"}'

aws secretsmanager create-secret \
  --name zopkit/production/messaging \
  --secret-string '{"sns_inter_app_topic_arn":"arn:aws:sns:us-east-1:xxx:inter-app-events","sns_broadcast_topic_arn":"arn:aws:sns:us-east-1:xxx:inter-app-broadcast","sqs_wrapper_queue_url":"https://sqs.us-east-1.amazonaws.com/xxx/wrapper-events","sns_large_payload_bucket":"zopkit-messaging-large-payloads"}'

aws secretsmanager create-secret \
  --name zopkit/production/elasticsearch \
  --secret-string '{"url":"https://elasticsearch.zopkit.com:9200"}'

aws secretsmanager create-secret \
  --name zopkit/production/sentry \
  --secret-string '{"dsn":"https://xxx@sentry.io/xxx"}'
```

**Secret rotation**: Secrets Manager supports automatic rotation. For JWT_SECRET rotation, use a dual-validation approach (accept both old and new secret for a grace period).

### 9.2 Network Policies

```yaml
# k8s/base/network-policies.yaml

# Default deny all ingress in the namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: zopkit-prod
spec:
  podSelector: {}
  policyTypes:
    - Ingress

---
# Allow ALB to reach backend pods
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-alb-to-backends
  namespace: zopkit-prod
spec:
  podSelector:
    matchLabels: {}  # All pods in namespace
  policyTypes:
    - Ingress
  ingress:
    - ports:
        - port: 3000
        - port: 4000
        - port: 5000
      # ALB runs in a different namespace/VPC, so we allow from all
      # (ALB is the only thing that can reach the private subnet)
      from: []

---
# Allow backend pods to communicate with Redis
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-egress-redis
  namespace: zopkit-prod
spec:
  podSelector:
    matchLabels: {}
  policyTypes:
    - Egress
  egress:
    - ports:
        - port: 6379
    - ports:
        - port: 443  # HTTPS to external services (Supabase, Kinde, Stripe, Brevo)
        - port: 5671 # AMQPS to Amazon MQ
        - port: 5432 # PostgreSQL
        - port: 9200 # Elasticsearch
    - ports:
        - port: 53   # DNS
          protocol: UDP
        - port: 53
          protocol: TCP
```

### 9.3 IRSA -- No Access Keys in Pods

With IRSA (configured in Section 3.6), pods assume IAM roles via their service account. This eliminates the need for `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in environment variables.

For Route 53 access, the wrapper backend service account already has the `ZopkitRoute53Access` policy attached. The AWS SDK in the pod automatically uses the IRSA credentials.

**Code change**: Remove hardcoded AWS credentials from the Route 53 DNS management code and use the default credential chain:

```typescript
// BEFORE (in features/onboarding/routes/dns-management.ts):
const route53 = new Route53Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// AFTER (IRSA provides credentials automatically):
const route53 = new Route53Client({ region: 'us-east-1' });
// The SDK picks up credentials from the IRSA-injected environment variables
// (AWS_ROLE_ARN, AWS_WEB_IDENTITY_TOKEN_FILE)
```

### 9.4 Container Scanning

```bash
# Enable ECR image scanning on push
for REPO in zopkit/wrapper-backend zopkit/crm-backend zopkit/hrms-backend; do
  aws ecr put-image-scanning-configuration \
    --repository-name "$REPO" \
    --image-scanning-configuration scanOnPush=true \
    --region us-east-1
done

# Check scan results after pushing an image
aws ecr describe-image-scan-findings \
  --repository-name zopkit/wrapper-backend \
  --image-id imageTag=latest \
  --region us-east-1
```

### 9.5 Pod Security Standards

```yaml
# k8s/base/pod-security.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: zopkit-prod
  labels:
    # Enforce restricted pod security standard
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

All Dockerfiles already run as non-root (`USER zopkit`). The pod security standard enforces:
- No privileged containers
- No host networking
- No host PID/IPC
- Read-only root filesystem (add `readOnlyRootFilesystem: true` to container securityContext)
- Non-root user
- No privilege escalation

Add to each container in the deployments:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  runAsGroup: 1001
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
```

If the app writes to `/tmp`, mount a writable emptyDir:

```yaml
volumes:
  - name: tmp
    emptyDir: {}
# In container:
volumeMounts:
  - name: tmp
    mountPath: /tmp
```

---

## 10. Cost Analysis

### 10.1 Monthly Cost Estimate (EKS)

| Service | Spec | Monthly Cost (USD) |
|---------|------|--------------------|
| **EKS Control Plane** | 1 cluster | $73 |
| **EC2 Nodes** (managed node group) | 3x t3.medium (2 vCPU, 4 GB) | $100 (3 x $33.41) |
| **ALB** | 1 ALB + ~500k requests/mo | $25 |
| **ElastiCache Redis** | 1x cache.t3.micro (single node) | $13 |
| **S3** (frontends) | 3 buckets, ~500 MB total | $1 |
| **CloudFront** | 3 distributions, ~50 GB transfer/mo | $5 |
| **ECR** | ~5 GB stored images | $1 |
| **Route 53** | 1 hosted zone + queries | $1 |
| **NAT Gateway** | 1 gateway + data transfer | $35 |
| **Secrets Manager** | ~10 secrets | $4 |
| **CloudWatch** | Container Insights + logs | $15 |
| **Total** | | **~$273/month** |

### 10.2 Fargate Alternative Pricing

Replace EC2 nodes with Fargate for all workloads:

| Service | Spec | Monthly Cost (USD) |
|---------|------|--------------------|
| **EKS Control Plane** | 1 cluster | $73 |
| **Fargate** (wrapper, 2 pods) | 2x (0.5 vCPU, 1 GB) 24/7 | $48 |
| **Fargate** (crm, 2 pods) | 2x (0.25 vCPU, 0.5 GB) 24/7 | $24 |
| **Fargate** (hrms, 2 pods) | 2x (0.25 vCPU, 0.5 GB) 24/7 | $24 |
| **Fargate** (CronJobs) | ~2 hours/day total | $3 |
| Other services (same as above) | ALB, Redis, S3, CF, etc. | $100 |
| **Total** | | **~$272/month** |

Fargate is comparable in cost for this workload but eliminates node management overhead. The trade-off: slightly slower pod startup (30-60s vs 5-10s for EC2 nodes) and no SSH access for debugging.

### 10.3 Current EC2 Cost

| Service | Spec | Monthly Cost (USD) |
|---------|------|--------------------|
| **EC2** | 1x t3.xlarge (4 vCPU, 16 GB) | $121 |
| **EBS** | 100 GB gp3 | $8 |
| **Elastic IP** | 1 IP (35.171.71.112) | $4 |
| **Route 53** | 1 hosted zone | $1 |
| **Total** | | **~$134/month** |

### 10.4 Cost Comparison

| | Current (EC2) | EKS (EC2 nodes) | EKS (Fargate) |
|---|---|---|---|
| **Monthly cost** | $134 | $273 | $272 |
| **Delta** | baseline | +$139 (+104%) | +$138 (+103%) |
| **HA/Redundancy** | None | Multi-AZ, auto-healing | Multi-AZ, auto-healing |
| **Auto-scaling** | No | Yes (HPA) | Yes (HPA) |
| **Zero-downtime deploy** | Partial (PM2 reload) | Yes (rolling update) | Yes (rolling update) |
| **Ops overhead** | Manual SSH, PM2 | K8s management | Minimal (no nodes) |

### 10.5 Cost Optimization Tips

1. **Reserved Instances**: Reserve 3x t3.medium for 1 year, save 30-40% ($70/mo -> $45/mo)
2. **Spot Instances**: Use spot for non-critical workloads (CronJobs). Spot t3.medium: ~$10/mo (70% savings)
3. **Right-size nodes**: Start with t3.small (2 vCPU, 2 GB) if pods use < 1 GB each
4. **Single NAT Gateway**: Use one NAT gateway instead of one per AZ ($35/mo vs $70/mo). Trade-off: single AZ NAT is a partial failure point
5. **ElastiCache**: Use `cache.t3.micro` initially, upgrade only if Redis latency > 1ms
6. **CloudFront**: Use the free tier (1 TB transfer/mo). Most SaaS platforms stay well under this
7. **Karpenter**: Replace Cluster Autoscaler with Karpenter for more aggressive right-sizing and spot optimization

---

## 11. Migration Runbook (Step-by-Step)

### Phase 1: Provision Infrastructure

```bash
# 1.1 Request ACM wildcard certificate
aws acm request-certificate \
  --domain-name "zopkit.com" \
  --subject-alternative-names "*.zopkit.com" \
  --validation-method DNS \
  --region us-east-1

# 1.2 Validate certificate (add CNAME records to Route 53)
#     Note: ACM provides the CNAME records. Add them and wait for validation (5-30 min).

# 1.3 Deploy VPC stack
aws cloudformation create-stack --stack-name zopkit-eks-vpc --template-body file://vpc.yaml --region us-east-1
aws cloudformation wait stack-create-complete --stack-name zopkit-eks-vpc

# 1.4 Create EKS cluster
eksctl create cluster -f cluster.yaml
# Wait 15-20 minutes

# 1.5 Install AWS Load Balancer Controller
helm repo add eks https://aws.github.io/eks-charts && helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system --set clusterName=zopkit-prod --set serviceAccount.create=true

# 1.6 Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets --create-namespace

# 1.7 Create namespaces
kubectl create namespace zopkit-prod
kubectl create namespace zopkit-staging

# 1.8 Create IRSA service accounts
eksctl create iamserviceaccount --cluster zopkit-prod --namespace zopkit-prod \
  --name wrapper-backend-sa --attach-policy-arn arn:aws:iam::123456789012:policy/ZopkitRoute53Access --approve
eksctl create iamserviceaccount --cluster zopkit-prod --namespace zopkit-prod \
  --name zopkit-secrets-sa --attach-policy-arn arn:aws:iam::123456789012:policy/ZopkitSecretsAccess --approve

# 1.9 Create ElastiCache Redis
aws elasticache create-cache-cluster \
  --cache-cluster-id zopkit-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1 \
  --security-group-ids sg-xxxxxxxx \
  --cache-subnet-group-name zopkit-redis-subnet-group \
  --region us-east-1

# 1.10 Create S3 buckets for frontends
for BUCKET in zopkit-wrapper-frontend zopkit-crm-frontend zopkit-hrms-frontend; do
  aws s3 mb s3://${BUCKET} --region us-east-1
done

# 1.11 Create CloudFront distributions (use console or CLI -- see Section 6.6)

# 1.12 Create ECR repositories
aws ecr create-repository --repository-name zopkit/wrapper-backend --region us-east-1
aws ecr create-repository --repository-name zopkit/crm-backend --region us-east-1
aws ecr create-repository --repository-name zopkit/hrms-backend --region us-east-1

# 1.13 Store secrets in AWS Secrets Manager
# (see Section 9.1 for commands)
```

**Rollback**: Delete the CloudFormation stack and EKS cluster. No user-facing impact since EC2 is still running.

### Phase 2: Containerize and Push Images

```bash
# 2.1 Create Dockerfiles for each service (see Section 4.4)

# 2.2 Make code changes for EKS compatibility
#     - Add DISABLE_CRON_JOBS env var check (Section 6.2)
#     - Add Redis client (Section 6.1)
#     - Extract subscription-safety-net.ts script (Section 6.2)
#     - Reduce DB pool sizes (Section 6.4)

# 2.3 Test Docker builds locally
docker build -f backend/Dockerfile -t wrapper-backend:test .
docker run --env-file .env -p 3000:3000 wrapper-backend:test
# Verify: curl http://localhost:3000/health

# 2.4 Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
GIT_SHA=$(git rev-parse --short HEAD)
docker tag wrapper-backend:test 123456789012.dkr.ecr.us-east-1.amazonaws.com/zopkit/wrapper-backend:sha-${GIT_SHA}
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/zopkit/wrapper-backend:sha-${GIT_SHA}
# Repeat for CRM and HRMS
```

**Rollback**: No user-facing impact. Images are just sitting in ECR.

### Phase 3: Deploy to EKS (Staging Namespace)

```bash
# 3.1 Apply base manifests to staging
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/configmap.yaml -n zopkit-staging
kubectl apply -f k8s/base/secret-store.yaml -n zopkit-staging
kubectl apply -f k8s/base/external-secret.yaml -n zopkit-staging

# Wait for secrets to sync
kubectl get secret zopkit-secrets -n zopkit-staging

# 3.2 Deploy services
kubectl apply -f k8s/wrapper-backend/ -n zopkit-staging
kubectl apply -f k8s/crm-backend/ -n zopkit-staging
kubectl apply -f k8s/hrms-backend/ -n zopkit-staging
kubectl apply -f k8s/base/pdb.yaml -n zopkit-staging
kubectl apply -f k8s/base/ingress.yaml -n zopkit-staging

# 3.3 Deploy CronJobs
kubectl apply -f k8s/cronjobs/ -n zopkit-staging

# 3.4 Verify pods are running
kubectl get pods -n zopkit-staging
kubectl logs -n zopkit-staging -l app=wrapper-backend --tail=50

# 3.5 Port-forward for local testing
kubectl port-forward -n zopkit-staging svc/wrapper-backend 3000:3000
curl http://localhost:3000/health/detailed
```

**Rollback**: `kubectl delete namespace zopkit-staging`

### Phase 4: Test Staging Thoroughly

Checklist:

```
[ ] Health endpoints respond: /health, /health/ready, /health/live, /health/detailed
[ ] Auth flow works: login via Kinde, JWT validation, token refresh
[ ] Tenant CRUD: create tenant, update, list
[ ] User management: invite user, accept invitation, role assignment
[ ] Subscription flow: create subscription, Stripe webhook delivery
[ ] Credit system: purchase credits, allocate, check balance
[ ] WebSocket notifications: connect, receive real-time updates
[ ] CRM app: accessible, can read/write data
[ ] HRMS app: accessible, can read/write data
[ ] CronJobs: manually trigger one, verify it completes
[ ] DNS: tenant subdomain resolves to ALB
[ ] SSL: no certificate errors on any subdomain
[ ] Error handling: trigger a 500, verify Sentry receives it
[ ] Performance: response times < 500ms for common operations
[ ] Connection limits: verify DB connections stay within limits
```

**Rollback**: Fix issues in staging. No user-facing impact.

### Phase 5: DNS Cutover

```bash
# 5.1 Lower TTL on existing DNS records (do this 24-48 hours before cutover)
# In Route 53, change TTL on *.zopkit.com from 300 to 60 seconds

# 5.2 Deploy to production namespace
kubectl apply -f k8s/base/ -n zopkit-prod
kubectl apply -f k8s/wrapper-backend/ -n zopkit-prod
kubectl apply -f k8s/crm-backend/ -n zopkit-prod
kubectl apply -f k8s/hrms-backend/ -n zopkit-prod
kubectl apply -f k8s/cronjobs/ -n zopkit-prod

# 5.3 Verify production pods are healthy
kubectl get pods -n zopkit-prod
kubectl logs -n zopkit-prod -l app=wrapper-backend --tail=20

# 5.4 Deploy frontends to S3
pnpm --filter wrapper-frontend build
aws s3 sync frontend/dist/ s3://zopkit-wrapper-frontend/ --delete
# Repeat for CRM and HRMS frontends

# 5.5 Switch DNS records
# In Route 53:
# - Change *.zopkit.com A record from 35.171.71.112 to ALB alias
# - Add app.zopkit.com A record as CloudFront alias
# - Add crm.zopkit.com A record as CloudFront alias
# - Add hrms.zopkit.com A record as CloudFront alias
# - Add api.zopkit.com A record as ALB alias (if not covered by wildcard)

# 5.6 Verify DNS propagation
dig app.zopkit.com
dig api.zopkit.com
dig crm.zopkit.com
dig acme-corp.zopkit.com  # tenant subdomain

# 5.7 Test all endpoints against production
curl https://api.zopkit.com/health
curl https://crm-api.zopkit.com/health
curl https://hrms-api.zopkit.com/health
```

**Rollback**: Switch DNS records back to 35.171.71.112. The EC2 instance is still running and serving traffic. DNS propagation takes up to 60 seconds (due to lowered TTL).

### Phase 6: Monitor and Verify

```bash
# 6.1 Watch pod status
kubectl get pods -n zopkit-prod -w

# 6.2 Check logs for errors
kubectl logs -n zopkit-prod -l app=wrapper-backend --tail=100 -f

# 6.3 Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/xxxxx/yyyyy

# 6.4 Monitor CloudWatch metrics
# - ALB: HTTPCode_Target_5XX_Count, TargetResponseTime
# - EKS: pod_cpu_utilization, pod_memory_utilization
# - Redis: CurrConnections, CacheMisses

# 6.5 Run through the Phase 4 test checklist again against production

# 6.6 Monitor for 24-48 hours before decommissioning EC2
```

### Phase 7: Decommission EC2

```bash
# 7.1 Keep EC2 running for 1 week as a hot standby
# 7.2 Stop PM2 processes on EC2
ssh ec2-user@35.171.71.112 "pm2 stop all"

# 7.3 After 1 week with no issues, terminate the EC2 instance
aws ec2 terminate-instances --instance-ids i-xxxxxxxxxxxxxxxxx

# 7.4 Release the Elastic IP
aws ec2 release-address --allocation-id eipalloc-xxxxxxxxx

# 7.5 Restore DNS TTLs to normal (300 seconds)

# 7.6 Delete the old Let's Encrypt certificates (no longer needed)

# 7.7 Update the deploy-ec2.yml workflow to disable it
#     (rename to deploy-ec2.yml.disabled or remove it)
```

---

## 12. Scaling Playbook

### 12.1 When to Scale

| Metric | Warning Threshold | Action Threshold | Action |
|--------|-------------------|------------------|--------|
| Pod CPU | > 50% sustained 5 min | > 60% sustained 5 min | HPA adds pod |
| Pod Memory | > 65% sustained 5 min | > 75% sustained 5 min | HPA adds pod |
| Request Latency (p95) | > 300ms | > 500ms | Investigate, then scale |
| ALB 5xx Rate | > 0.1% | > 1% | Investigate, then scale |
| DB Connections | > 70% of max | > 85% of max | Increase pool or add PgBouncer |
| Redis Memory | > 70% | > 85% | Upgrade instance type |

### 12.2 HPA Custom Metrics

For scaling based on request latency or queue depth (beyond CPU/memory):

```bash
# Install Prometheus adapter for custom metrics
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
helm install prometheus-adapter prometheus-community/prometheus-adapter -n monitoring

# Then reference custom metrics in HPA:
```

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  metrics:
    - type: Pods
      pods:
        metric:
          name: http_request_duration_seconds_p95
        target:
          type: AverageValue
          averageValue: "500m"  # 500ms
```

### 12.3 Database Scaling

**Connection Pooling Upgrade Path:**
1. Start with reduced pool sizes per pod (`DB_POOL_MAX=5`)
2. If connection pressure increases, add PgBouncer sidecars
3. If query load increases, add Supabase read replicas and split read/write traffic

**Read Replica Setup:**
```typescript
// backend/src/db/connection-manager.ts (future change)
// Create separate connections for read and write
const writeDb = drizzle(postgres(process.env.DATABASE_URL));
const readDb = drizzle(postgres(process.env.DATABASE_READ_REPLICA_URL || process.env.DATABASE_URL));

// Route read queries to replica, writes to primary
export { writeDb as db, readDb as readonlyDb };
```

### 12.4 Amazon MQ Scaling

If message throughput exceeds broker capacity:

1. Upgrade broker instance: `mq.t3.micro` -> `mq.m5.large` -> `mq.m5.xlarge`
2. Enable active/standby mode for HA
3. Consider switching to Amazon SQS if fan-out pattern is dominant (simpler, cheaper, auto-scaling)

### 12.5 Redis Scaling

1. **Vertical**: Upgrade from `cache.t3.micro` to `cache.t3.medium` or `cache.m6g.large`
2. **Cluster mode**: Enable cluster mode for horizontal scaling (sharding across nodes)
3. **Replication**: Add read replicas for read-heavy workloads

```bash
# Upgrade Redis instance
aws elasticache modify-cache-cluster \
  --cache-cluster-id zopkit-redis \
  --cache-node-type cache.t3.medium \
  --apply-immediately
```

### 12.6 Frontend Scaling

CloudFront handles this automatically. There is nothing to scale. If origin requests to S3 spike (cache miss), S3 auto-scales transparently.

For global performance, consider adding CloudFront edge locations or enabling Origin Shield.

---

## 13. Disaster Recovery

### 13.1 Multi-AZ Setup

The EKS cluster is already configured for multi-AZ:
- Nodes spread across `us-east-1a` and `us-east-1b` (node group config)
- Pods spread across AZs via `topologySpreadConstraints`
- ALB routes to healthy pods in any AZ
- NAT Gateway in `us-east-1a` (single point -- consider adding a second NAT in `us-east-1b` for full HA, +$35/mo)

**Single-AZ failure scenario**: If `us-east-1a` goes down, pods on that AZ's nodes die. K8s reschedules them to `us-east-1b` nodes. The ALB stops routing to dead pods within 15 seconds (health check interval). Total downtime: 30-60 seconds for pod rescheduling + startup.

### 13.2 Database Backups

Supabase handles database backups:
- **Daily backups**: Automatic, retained for 7 days (Pro plan)
- **Point-in-time recovery**: Available on Pro plan (pitr to any second in the last 7 days)
- **Cross-region replication**: Not available on Supabase; would require migrating to RDS if needed

**Manual backup for extra safety:**

```bash
# Take a manual pg_dump before migration
pg_dump "postgresql://user:pass@db.supabase.co:5432/postgres" \
  --format=custom \
  --file=zopkit-backup-$(date +%Y%m%d).dump
```

### 13.3 Redis Persistence

ElastiCache Redis supports two persistence modes:

```bash
# Enable AOF + daily snapshots
aws elasticache modify-cache-cluster \
  --cache-cluster-id zopkit-redis \
  --snapshot-retention-limit 3 \
  --apply-immediately
```

**Note**: For the auth cache use case, Redis data loss is not critical. The cache self-heals within 5 minutes (cache TTL). WebSocket connections will need to reconnect. The only impact is a brief increase in DB queries while caches repopulate.

### 13.4 Recovery Time Objectives

| Scenario | RTO (Recovery Time) | RPO (Data Loss) | Action |
|----------|---------------------|------------------|--------|
| Single pod crash | < 30 seconds | 0 | K8s restarts pod automatically |
| Single node failure | < 2 minutes | 0 | K8s reschedules pods to other nodes |
| Single AZ failure | < 2 minutes | 0 | Pods reschedule to surviving AZ |
| Redis failure | < 5 minutes | Auth cache only (repopulates) | ElastiCache auto-recovery |
| Database failure | Supabase SLA | Per Supabase PITR | Contact Supabase support |
| Full cluster failure | < 30 minutes | 0 (stateless) | Recreate cluster from manifests |
| Full region failure | 1-4 hours | Per Supabase backup | Deploy to us-west-2 |

### 13.5 Cluster Recreation Runbook

If the entire EKS cluster is lost:

```bash
# 1. Recreate cluster (15-20 min)
eksctl create cluster -f cluster.yaml

# 2. Install controllers
helm install aws-load-balancer-controller eks/aws-load-balancer-controller -n kube-system --set clusterName=zopkit-prod
helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace

# 3. Create IRSA service accounts
eksctl create iamserviceaccount --cluster zopkit-prod --namespace zopkit-prod \
  --name wrapper-backend-sa --attach-policy-arn arn:aws:iam::123456789012:policy/ZopkitRoute53Access --approve
eksctl create iamserviceaccount --cluster zopkit-prod --namespace zopkit-prod \
  --name zopkit-secrets-sa --attach-policy-arn arn:aws:iam::123456789012:policy/ZopkitSecretsAccess --approve

# 4. Apply all manifests
kubectl apply -f k8s/base/
kubectl apply -f k8s/wrapper-backend/
kubectl apply -f k8s/crm-backend/
kubectl apply -f k8s/hrms-backend/
kubectl apply -f k8s/cronjobs/

# 5. Update ALB DNS alias in Route 53
#    (new cluster = new ALB = new DNS name)

# 6. Verify
kubectl get pods -n zopkit-prod
curl https://api.zopkit.com/health
```

All state is external (Supabase PostgreSQL, Amazon MQ, Secrets Manager), so the cluster can be fully recreated from the K8s manifests and ECR images with zero data loss.

---

## Appendix A: File Inventory of Required Changes

| File | Change | Section |
|------|--------|---------|
| `backend/Dockerfile` | **NEW** -- Multi-stage Docker build | 4.4 |
| `crm/Dockerfile` | **NEW** -- Multi-stage Docker build | 4.4 |
| `hrms/Dockerfile` | **NEW** -- Multi-stage Docker build | 4.4 |
| `backend/src/utils/redis-client.ts` | **NEW** -- Shared ioredis client | 6.1 |
| `backend/src/utils/websocket-redis-bridge.ts` | **NEW** -- WS pub/sub via Redis | 6.3 |
| `backend/src/utils/leader-election.ts` | **NEW** -- Redis leader election (if using Solution B) | 6.2 |
| `backend/src/scripts/subscription-safety-net.ts` | **NEW** -- Extracted from app-fastify.ts | 6.2 |
| `backend/src/middleware/auth/auth.ts` | **MODIFY** -- Replace Map caches with Redis | 6.1 |
| `backend/src/utils/websocket-server.ts` | **MODIFY** -- Use Redis pub/sub for cross-pod delivery | 6.3 |
| `backend/src/app-fastify.ts` | **MODIFY** -- Add DISABLE_CRON_JOBS toggle, Redis shutdown | 6.2 |
| `backend/src/features/onboarding/routes/dns-management.ts` | **MODIFY** -- Remove hardcoded AWS creds | 9.3 |
| `k8s/**/*.yaml` | **NEW** -- All K8s manifests | 5 |
| `.github/workflows/deploy-eks.yml` | **NEW** -- EKS CI/CD pipeline | 7 |

## Appendix B: Environment Variable Reference

| Variable | Where Set | Used By |
|----------|-----------|---------|
| `NODE_ENV` | ConfigMap | All services |
| `PORT` | Deployment env | Each service |
| `HOST` | Deployment env | Each service |
| `DATABASE_URL` | External Secret | All services |
| `DB_POOL_MAX` | ConfigMap | All services |
| `DB_SYSTEM_POOL_MAX` | ConfigMap | All services |
| `JWT_SECRET` | External Secret | wrapper-backend |
| `COOKIE_SECRET` | External Secret | wrapper-backend |
| `KINDE_DOMAIN` | ConfigMap | wrapper-backend |
| `KINDE_CLIENT_ID` | External Secret | wrapper-backend |
| `KINDE_CLIENT_SECRET` | External Secret | wrapper-backend |
| `KINDE_M2M_CLIENT_ID` | External Secret | wrapper-backend |
| `KINDE_M2M_CLIENT_SECRET` | External Secret | wrapper-backend |
| `STRIPE_SECRET_KEY` | External Secret | wrapper-backend |
| `STRIPE_WEBHOOK_SECRET` | External Secret | wrapper-backend |
| `BREVO_API_KEY` | External Secret | wrapper-backend |
| `SNS_INTER_APP_TOPIC_ARN` | External Secret | wrapper-backend |
| `SNS_BROADCAST_TOPIC_ARN` | External Secret | wrapper-backend |
| `SQS_WRAPPER_QUEUE_URL` | External Secret | wrapper-backend |
| `SNS_LARGE_PAYLOAD_BUCKET` | External Secret | wrapper-backend |
| `REDIS_HOST` | ConfigMap | All services |
| `REDIS_PORT` | ConfigMap | All services |
| `REDIS_TLS` | ConfigMap | All services |
| `HOSTED_ZONE_ID` | ConfigMap | wrapper-backend |
| `BASE_DOMAIN` | ConfigMap | wrapper-backend |
| `ELASTICSEARCH_URL` | External Secret | All services |
| `SENTRY_DSN` | External Secret | All services |
| `DISABLE_CRON_JOBS` | Deployment env | wrapper-backend |
| `POD_NAME` | Deployment fieldRef | All services |
| `SERVICE_NAME` | Deployment env | All services |
| `FRONTEND_URL` | ConfigMap | wrapper-backend |
| `BACKEND_URL` | ConfigMap | wrapper-backend |
| `CORS_ORIGINS` | ConfigMap | All services |
