pipeline {
  agent {
    label 'worker1'
  }

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  environment {
    DOCKER_IMAGE = 'dvnpn/dittopedia-front'
    DOCKER_CREDENTIALS_ID = 'dockerhub-creds'
    AWS_CREDENTIALS_ID = 'aws-deploy-creds'
    SSH_INGRESS_CIDR_CREDENTIALS_ID = 'ssh-ingress-cidr-default'
    INFRA_REPO_URL = 'https://github.com/Dittoploy/dittopedia-infra.git'
    INFRA_REPO_BRANCH = 'staging-aws-1'
    AWS_REGION = 'eu-west-3'
    WORKER_DEPLOY_KEY_PATH = '/var/jenkins/.ssh/dittopedia_deploy_key.pem'
    SSH_INGRESS_CIDR_EFFECTIVE = ''
    // SonarQube — disabled until plugin is installed
    SONARQUBE_ENV = 'sonarqube'
    SONAR_PROJECT_KEY = 'dittopedia-front'
    SONAR_PROJECT_NAME = 'dittopedia-front'
  }

  stages {

    // ──────────────────────────────────────────────
    // SSH CIDR — required before Terraform opens port 22
    // ──────────────────────────────────────────────

    stage('Resolve SSH ingress CIDR') {
      when {
        expression {
          def branchName = env.BRANCH_NAME ?: ''
          def gitBranch  = env.GIT_BRANCH  ?: ''
          return branchName == 'staging-aws-1' || gitBranch == 'staging-aws-1' ||
                 gitBranch == 'origin/staging-aws-1' ||
                 gitBranch == 'refs/remotes/origin/staging-aws-1' ||
                 gitBranch.endsWith('/staging-aws-1')
        }
      }
      steps {
        script {
          def resolvedCidr = ''

          withCredentials([string(credentialsId: "${SSH_INGRESS_CIDR_CREDENTIALS_ID}", variable: 'SSH_INGRESS_CIDR_DEFAULT')]) {
            def defaultCidr = env.SSH_INGRESS_CIDR_DEFAULT?.trim()
            resolvedCidr = defaultCidr ?: ''
            echo "Credential default CIDR present: ${defaultCidr ? 'yes' : 'no'}"
          }

          if (!resolvedCidr) {
            error('Credential ssh-ingress-cidr-default is empty or unavailable. Set a valid CIDR (for example x.x.x.x/32).')
          }

          writeFile file: '.ssh_ingress_cidr', text: "${resolvedCidr}\n"
          env.SSH_INGRESS_CIDR_EFFECTIVE = resolvedCidr

          echo 'SSH ingress CIDR resolved from Jenkins credential default.'
        }
      }
    }

    stage('Validate SSH ingress CIDR') {
      when {
        expression {
          def branchName = env.BRANCH_NAME ?: ''
          def gitBranch  = env.GIT_BRANCH  ?: ''
          return branchName == 'staging-aws-1' || gitBranch == 'staging-aws-1' ||
                 gitBranch == 'origin/staging-aws-1' ||
                 gitBranch == 'refs/remotes/origin/staging-aws-1' ||
                 gitBranch.endsWith('/staging-aws-1')
        }
      }
      steps {
        script {
          def cidr = readFile('.ssh_ingress_cidr').trim()
          if (cidr == '0.0.0.0/0') {
            error('SSH_INGRESS_CIDR must not be 0.0.0.0/0. Restrict SSH access to a trusted source CIDR.')
          }
        }
      }
    }

    // ──────────────────────────────────────────────
    // CI — install / lint / build
    // ──────────────────────────────────────────────

    stage('Install') {
      steps {
        sh 'bun install --frozen-lockfile'
      }
    }

    stage('Lint') {
      steps {
        sh 'bun run lint'
      }
    }

    stage('Build') {
      steps {
        sh 'bun run build'
      }
    }

    // ──────────────────────────────────────────────
    // SonarQube — disabled until plugin is installed
    // ──────────────────────────────────────────────

    stage('SonarQube Analysis') {
      // TODO: Enable when SonarQube plugin is installed on Jenkins
      when {
        expression { return false }
      }
      steps {
        echo "ℹ️  SonarQube Analysis is disabled. To enable, install the SonarQube plugin in Jenkins."
      }
    }

    stage('Quality Gate') {
      // TODO: Enable when SonarQube plugin is installed on Jenkins
      when {
        expression { return false }
      }
      steps {
        echo "ℹ️  Quality Gate is disabled. To enable, install the SonarQube plugin in Jenkins."
      }
    }

    // ──────────────────────────────────────────────
    // Docker
    // ──────────────────────────────────────────────

    stage('Docker Build') {
      steps {
        script {
          def branchName = env.BRANCH_NAME ?: ''
          def gitBranch  = env.GIT_BRANCH  ?: ''

          if (branchName == 'main' || gitBranch == 'origin/main') {
            env.IMAGE_TAG = 'latest'
          } else if (
            branchName == 'staging-aws-1' || gitBranch == 'staging-aws-1' ||
            gitBranch == 'origin/staging-aws-1' ||
            gitBranch == 'refs/remotes/origin/staging-aws-1' ||
            gitBranch.endsWith('/staging-aws-1')
          ) {
            env.IMAGE_TAG = 'staging-aws-1'
          } else {
            env.IMAGE_TAG = env.BUILD_NUMBER
          }
        }
        sh "docker build -t ${DOCKER_IMAGE}:${env.IMAGE_TAG} ."
      }
    }

    stage('Docker Push') {
      when {
        expression {
          def branchName = env.BRANCH_NAME ?: ''
          def gitBranch  = env.GIT_BRANCH  ?: ''
          return branchName == 'main' || branchName == 'staging-aws-1' ||
                 gitBranch == 'origin/main' || gitBranch == 'staging-aws-1' ||
                 gitBranch == 'origin/staging-aws-1' ||
                 gitBranch == 'refs/remotes/origin/staging-aws-1' ||
                 gitBranch.endsWith('/staging-aws-1')
        }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: "${DOCKER_CREDENTIALS_ID}", usernameVariable: 'DOCKERHUB_USERNAME', passwordVariable: 'DOCKERHUB_TOKEN')]) {
          sh '''
            FULL_IMAGE="${DOCKER_IMAGE}:${IMAGE_TAG}"
            echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin
            docker tag ${DOCKER_IMAGE}:${IMAGE_TAG} "$FULL_IMAGE"
            docker push "$FULL_IMAGE"
            echo "✓ Pushed: $FULL_IMAGE"
            docker logout
          '''
        }
      }
    }

    // ──────────────────────────────────────────────
    // AWS Deploy
    // ──────────────────────────────────────────────

    stage('AWS Deploy to Staging') {
      when {
        expression {
          def branchName = env.BRANCH_NAME ?: ''
          def gitBranch  = env.GIT_BRANCH  ?: ''
          return branchName == 'staging-aws-1' || gitBranch == 'staging-aws-1' ||
                 gitBranch == 'origin/staging-aws-1' ||
                 gitBranch == 'refs/remotes/origin/staging-aws-1' ||
                 gitBranch.endsWith('/staging-aws-1')
        }
      }
      steps {
        script {
          echo "🚀 Starting AWS deployment to staging (frontend)..."

          withCredentials([
            usernamePassword(credentialsId: "${DOCKER_CREDENTIALS_ID}",  usernameVariable: 'DOCKERHUB_USERNAME',   passwordVariable: 'DOCKERHUB_TOKEN'),
            usernamePassword(credentialsId: 'aws-deploy-creds',           usernameVariable: 'AWS_ACCESS_KEY_ID',    passwordVariable: 'AWS_SECRET_ACCESS_KEY'),
            string(credentialsId: 'ssh-ingress-cidr-default',             variable: 'SSH_INGRESS_CIDR')
          ]) {
            sh '''
              set -eu

              # ====== Step 1: Prepare Environment ======
              echo "📋 Step 1: Preparing environment..."
              export AWS_REGION="$AWS_REGION"
              export FRONTEND_IMAGE="$DOCKER_IMAGE:$IMAGE_TAG"

              SSH_INGRESS_CIDR_EFFECTIVE="$(tr -d '\\r\\n' < "${WORKSPACE}/.ssh_ingress_cidr")"
              if [ -z "${SSH_INGRESS_CIDR_EFFECTIVE}" ]; then
                echo "❌ Missing resolved SSH ingress CIDR in ${WORKSPACE}/.ssh_ingress_cidr" >&2
                exit 1
              fi

              DEPLOY_SSH_KEY_FILE="$WORKER_DEPLOY_KEY_PATH"
              PUBKEY_FILE="$(mktemp)"
              KNOWN_HOSTS_FILE="$(mktemp)"
              ANSIBLE_EXTRA_VARS_FILE=""
              trap 'rm -f "${PUBKEY_FILE}" "${KNOWN_HOSTS_FILE}" "${ANSIBLE_EXTRA_VARS_FILE:-}"' EXIT

              if [ ! -f "${DEPLOY_SSH_KEY_FILE}" ]; then
                echo "❌ Missing SSH key: ${DEPLOY_SSH_KEY_FILE}" >&2
                exit 1
              fi

              chmod 600 "${DEPLOY_SSH_KEY_FILE}" || true
              if ! ssh-keygen -y -f "${DEPLOY_SSH_KEY_FILE}" > "${PUBKEY_FILE}" 2>/dev/null; then
                echo "❌ Invalid SSH key at ${DEPLOY_SSH_KEY_FILE}" >&2
                exit 1
              fi

              SSH_PUBLIC_KEY="$(cat ${PUBKEY_FILE})"
              if [ -z "${SSH_PUBLIC_KEY}" ]; then
                echo "❌ Failed to extract SSH public key" >&2
                exit 1
              fi
              echo "✅ SSH public key extracted from ${DEPLOY_SSH_KEY_FILE}"

              echo "🔐 Authenticating with Docker Hub..."
              echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin

              # ====== Step 2: Clone Infra Repo ======
              echo "📦 Step 2: Cloning infrastructure repository..."
              if [ -d "infra-workdir/.git" ]; then
                cd infra-workdir
                git fetch origin "$INFRA_REPO_BRANCH"
                git checkout -B "$INFRA_REPO_BRANCH" "origin/$INFRA_REPO_BRANCH"
                cd ..
              else
                rm -rf infra-workdir
                git clone --depth 1 --branch "$INFRA_REPO_BRANCH" "$INFRA_REPO_URL" infra-workdir
              fi

              # ── Frontend uses apps/frontend-aws, not backend-aws ──
              TERRAFORM_DIR="infra-workdir/apps/frontend-aws/terraform"
              ANSIBLE_DIR="infra-workdir/apps/frontend-aws/ansible"

              if [ ! -d "$TERRAFORM_DIR" ] || [ ! -d "$ANSIBLE_DIR" ]; then
                echo "❌ Missing expected frontend-aws deploy directories in infra repository." >&2
                echo "Expected: $TERRAFORM_DIR and $ANSIBLE_DIR" >&2
                echo "Available directories:" >&2
                find infra-workdir -maxdepth 4 -type d | sed -n '1,120p' >&2
                exit 1
              fi

              cd "$TERRAFORM_DIR"

              # ====== Step 3: Terraform Plan + Safety Check ======
              echo "🏗️  Step 3: Planning Terraform configuration..."
              terraform init -input=false

              terraform plan -out=tfplan -input=false \
                -var="aws_region=$AWS_REGION" \
                -var="ssh_ingress_cidr=$SSH_INGRESS_CIDR_EFFECTIVE" \
                -var="public_key=$SSH_PUBLIC_KEY"

              # Safety check — abort if any existing resource would be destroyed
              PLAN_SUMMARY="$(terraform show -json tfplan | python3 -c "
import sys, json
plan = json.load(sys.stdin)
changes = plan.get('resource_changes', [])
destroys = [
  c['address'] for c in changes
  if 'delete' in c.get('change', {}).get('actions', [])
]
if destroys:
    print('DESTROY_DETECTED:' + ','.join(destroys))
else:
    print('SAFE')
" 2>/dev/null || echo 'PARSE_ERROR')"

              if echo "$PLAN_SUMMARY" | grep -q "DESTROY_DETECTED"; then
                DESTROYED_RESOURCES="$(echo "$PLAN_SUMMARY" | sed 's/DESTROY_DETECTED://')"
                echo ""
                echo "❌ ERREUR : Terraform planifie la destruction de ressources existantes :"
                echo "   $DESTROYED_RESOURCES"
                echo ""
                echo "Sur un re-déploiement, aucune ressource ne devrait être détruite."
                echo "Vérifiez les blocs 'count' conditionnels dans le code Terraform."
                echo ""
                exit 1
              fi

              if echo "$PLAN_SUMMARY" | grep -q "PARSE_ERROR"; then
                echo "⚠️  Safety check ignoré (python3 indisponible), apply en cours..."
              else
                echo "✅ Plan validé — aucune destruction planifiée"
              fi

              echo "🏗️  Step 3b: Applying Terraform configuration..."
              terraform apply -auto-approve -input=false tfplan

              # ====== Step 4: Retrieve Terraform Outputs ======
              echo "📊 Step 4: Retrieving deployment outputs..."
              FRONTEND_PUBLIC_IP="$(terraform output -raw frontend_public_ip 2>/dev/null || echo '')"
              FRONTEND_INSTANCE_ID="$(terraform output -raw frontend_instance_id 2>/dev/null || echo '')"

              if [ -z "${FRONTEND_PUBLIC_IP}" ]; then
                echo "❌ Failed to retrieve frontend public IP from Terraform" >&2
                exit 1
              fi

              echo "✓ Frontend Instance ID: ${FRONTEND_INSTANCE_ID}"
              echo "✓ Frontend Public IP:   ${FRONTEND_PUBLIC_IP}"

              # ====== Step 5: SSH Health Check ======
              echo "🔍 Step 5: Checking SSH connectivity..."
              SSH_KEY_PATH="$DEPLOY_SSH_KEY_FILE"
              MAX_RETRIES=12
              RETRY_DELAY=10
              RETRY_COUNT=0

              while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
                if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new \
                       -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" \
                       -i "${SSH_KEY_PATH}" ubuntu@"${FRONTEND_PUBLIC_IP}" \
                       "echo 'SSH OK'" >/dev/null 2>&1; then
                  echo "✓ SSH connectivity verified"
                  break
                fi
                RETRY_COUNT=$((RETRY_COUNT + 1))
                echo "⏳ SSH retry ${RETRY_COUNT}/${MAX_RETRIES}... (waiting ${RETRY_DELAY}s)"
                sleep ${RETRY_DELAY}
              done

              if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
                echo "❌ SSH connectivity timeout after ${MAX_RETRIES} retries" >&2
                exit 1
              fi

              # ====== Step 6: Generate Ansible Inventory ======
              echo "📝 Step 6: Generating Ansible inventory..."
              cd "${WORKSPACE}/${ANSIBLE_DIR}"

              cat > hosts.ini <<EOF
[frontend]
${FRONTEND_PUBLIC_IP} ansible_user=ubuntu ansible_ssh_private_key_file=${SSH_KEY_PATH} ansible_ssh_common_args="-o StrictHostKeyChecking=no"
EOF

              umask 077
              ANSIBLE_EXTRA_VARS_FILE="$(mktemp)"
              cat > "$ANSIBLE_EXTRA_VARS_FILE" <<EOF
frontend_image: "$FRONTEND_IMAGE"
dockerhub_user: "$DOCKERHUB_USERNAME"
dockerhub_password: "$DOCKERHUB_TOKEN"
EOF

              echo "✓ Ansible inventory created"
              cat hosts.ini

              # ====== Step 7: Run Ansible Playbook ======
              echo "🤖 Step 7: Running Ansible deployment..."
              ansible-playbook -i hosts.ini site.yml \
                --extra-vars "@$ANSIBLE_EXTRA_VARS_FILE" \
                -v

              # ====== Step 8: Post-Deployment Validation ======
              echo "✅ Step 8: Validating deployment..."

              HEALTH_CHECK_RETRIES=10
              HEALTH_CHECK_DELAY=3
              HEALTH_COUNT=0

              while [ $HEALTH_COUNT -lt $HEALTH_CHECK_RETRIES ]; do
                if curl -f -s http://"${FRONTEND_PUBLIC_IP}":3000 >/dev/null 2>&1; then
                  echo "✓ Frontend health check passed"
                  break
                fi
                HEALTH_COUNT=$((HEALTH_COUNT + 1))
                echo "⏳ Health check retry ${HEALTH_COUNT}/${HEALTH_CHECK_RETRIES}... (waiting ${HEALTH_CHECK_DELAY}s)"
                sleep ${HEALTH_CHECK_DELAY}
              done

              if [ $HEALTH_COUNT -eq $HEALTH_CHECK_RETRIES ]; then
                echo "⚠️  Frontend health check timeout (may still be starting)"
              else
                echo "✓ Frontend responding on http://${FRONTEND_PUBLIC_IP}:3000"
              fi

              echo ""
              echo "╔════════════════════════════════════════╗"
              echo "║ ✅ Frontend Deployment Complete       ║"
              echo "╠════════════════════════════════════════╣"
              echo "║ URL:      http://${FRONTEND_PUBLIC_IP}:3000"
              echo "║ Instance: ${FRONTEND_INSTANCE_ID}"
              echo "╚════════════════════════════════════════╝"
              echo ""
              echo "📝 Next steps:"
              echo "  1. Verify: curl http://${FRONTEND_PUBLIC_IP}:3000"
              echo "  2. Logs:   ssh -i ${SSH_KEY_PATH} ubuntu@${FRONTEND_PUBLIC_IP}"
              echo "  3. Container: docker logs dittopedia-frontend"

              docker logout || true
            '''
          }
        }
      }
      post {
        failure {
          echo "❌ AWS frontend deployment failed. Check logs above for details."
        }
      }
    }
  }

  post {
    always {
      sh 'rm -f .ssh_ingress_cidr 2>/dev/null || true'
      sh 'docker logout 2>/dev/null || true'
    }
    failure {
      echo "❌ Pipeline failed. Review logs above for details."
      echo "📝 Common issues:"
      echo "  - Bun not found: Ensure Bun is installed on agent at /usr/local/bin/bun"
      echo "  - Docker build failed: Check Dockerfile and dependencies"
      echo "  - AWS deployment: Verify aws-deploy-creds, dockerhub-creds and ssh-ingress-cidr-default are configured"
      echo "  - SSH timeout: Check security group rules and EC2 instance status"
      echo "  - Terraform destroy detected: Check for unstable 'count' in security group / key pair resources"
      echo "  - Missing infra dirs: Create infra-workdir/apps/frontend-aws/terraform and /ansible in dittopedia-infra"
    }
    success {
      echo "✅ Pipeline completed successfully"
      script {
        def branchName = env.BRANCH_NAME ?: ''
        def gitBranch  = env.GIT_BRANCH  ?: ''
        if (
          branchName == 'staging-aws-1' || gitBranch == 'staging-aws-1' ||
          gitBranch == 'origin/staging-aws-1' ||
          gitBranch == 'refs/remotes/origin/staging-aws-1' ||
          gitBranch.endsWith('/staging-aws-1')
        ) {
          echo "🚀 Frontend deployed to staging. Check AWS console for EC2 instances."
        }
      }
    }
  }
}