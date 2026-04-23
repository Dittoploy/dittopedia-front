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
    // Backend IP — retrieve backend ip before project build
    // ──────────────────────────────────────────────

    stage('Fetch Backend IP') {
        steps {
            script {
                // On utilise usernamePassword, c'est universel
                withCredentials([usernamePassword(credentialsId: "${AWS_CREDENTIALS_ID}", 
                                                usernameVariable: 'AWS_ACCESS_KEY_ID', 
                                                passwordVariable: 'AWS_SECRET_ACCESS_KEY')]) {
                    
                    def getIpCmd = "aws ec2 describe-instances " +
                                  "--region ${AWS_REGION} " +
                                  "--filters 'Name=tag:Name,Values=dittopedia-backend-staging' 'Name=instance-state-name,Values=running' " +
                                  "--query 'Reservations[*].Instances[*].PublicIpAddress' " +
                                  "--output text"

                    // On exécute la commande et on nettoie le résultat
                    def output = sh(script: getIpCmd, returnStdout: true).trim()
                    
                    if (!output) {
                        error "❌ Impossible de trouver l'IP du Backend. Vérifie le nom du tag sur AWS."
                    }
                    
                    env.BACKEND_IP = output
                    echo "✅ Backend IP trouvée : ${env.BACKEND_IP}"
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
        sh 'rm -rf .next'
        sh "NEXT_PUBLIC_API_URL=http://${env.BACKEND_IP}:3000 bun run build"
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

      // On passe l'IP du backend au build Docker
      sh "docker build --no-cache --build-arg NEXT_PUBLIC_API_URL=http://${env.BACKEND_IP}:3000 -t ${DOCKER_IMAGE}:${env.IMAGE_TAG} ."
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
              export BACKEND_IP="${BACKEND_IP}"

              SSH_INGRESS_CIDR_EFFECTIVE="$(tr -d '\\r\\n' < "${WORKSPACE}/.ssh_ingress_cidr")"
              
              DEPLOY_SSH_KEY_FILE="$WORKER_DEPLOY_KEY_PATH"
              PUBKEY_FILE="$(mktemp)"
              KNOWN_HOSTS_FILE="$(mktemp)"
              trap 'rm -f "${PUBKEY_FILE}" "${KNOWN_HOSTS_FILE}"' EXIT

              if [ ! -f "${DEPLOY_SSH_KEY_FILE}" ]; then
                echo "❌ Missing SSH key: ${DEPLOY_SSH_KEY_FILE}" >&2
                exit 1
              fi

              chmod 600 "${DEPLOY_SSH_KEY_FILE}"
              
              # Extraction des clés pour Terraform
              SSH_PUBLIC_KEY="$(ssh-keygen -y -f "${DEPLOY_SSH_KEY_FILE}")"
              SSH_PRIVATE_KEY_CONTENT="$(cat "${DEPLOY_SSH_KEY_FILE}")"

              echo "🔐 Authenticating with Docker Hub..."
              echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin

              # ====== Step 2: Clone/Update Infra Repo ======
              echo "📦 Step 2: Cloning infrastructure repository..."
              if [ -d "infra-workdir/.git" ]; then
                cd infra-workdir && git fetch origin "$INFRA_REPO_BRANCH" && git checkout -B "$INFRA_REPO_BRANCH" "origin/$INFRA_REPO_BRANCH" && cd ..
              else
                git clone --depth 1 --branch "$INFRA_REPO_BRANCH" "$INFRA_REPO_URL" infra-workdir
              fi

              TERRAFORM_DIR="infra-workdir/apps/frontend-aws/terraform"
              ANSIBLE_DIR="infra-workdir/apps/frontend-aws/ansible"
              cd "$TERRAFORM_DIR"

              # ====== Step 3: Terraform Plan avec injections des variables manquantes ======
              echo "🏗️  Step 3: Planning Terraform configuration..."
              terraform init -input=false

              # Note: Les IDs VPC/Subnet/AMI doivent correspondre à ton infra AWS
              terraform plan -out=tfplan -input=false \
                -var="aws_region=$AWS_REGION" \
                -var="environment=staging" \
                -var="instance_name=dittopedia-frontend-staging" \
                -var="ssh_ingress_cidr=$SSH_INGRESS_CIDR_EFFECTIVE" \
                -var="public_key=$SSH_PUBLIC_KEY" \
                -var="private_key=$SSH_PRIVATE_KEY_CONTENT"

              # Safety Check (Python)
              PLAN_SUMMARY="$(terraform show -json tfplan | python3 -c "
import sys, json
plan = json.load(sys.stdin)
changes = plan.get('resource_changes', [])
destroys = [c['address'] for c in changes if 'delete' in c.get('change', {}).get('actions', [])]
print('DESTROY_DETECTED:' + ','.join(destroys)) if destroys else print('SAFE')
" 2>/dev/null || echo 'SAFE')"

              if echo "$PLAN_SUMMARY" | grep -q "DESTROY_DETECTED"; then
                echo "❌ ERREUR : Terraform planifie une destruction de ressources." >&2
                exit 1
              fi

              echo "🏗️  Step 3b: Applying Terraform configuration..."
              terraform apply -auto-approve -input=false tfplan

              # ====== Step 4: Retrieve Terraform Outputs ======
              echo "📊 Step 4: Retrieving deployment outputs..."
              FRONTEND_PUBLIC_IP="$(terraform output -raw frontend_public_ip 2>/dev/null || echo '')"
              FRONTEND_INSTANCE_ID="$(terraform output -raw frontend_instance_id 2>/dev/null || echo '')"

              if [ -z "${FRONTEND_PUBLIC_IP}" ]; then
                echo "❌ Failed to retrieve frontend public IP" >&2
                exit 1
              fi

              # ====== Step 5: SSH Health Check ======
              echo "🔍 Step 5: Checking SSH connectivity..."
              MAX_RETRIES=12
              RETRY_COUNT=0
              while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
                if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" \
                       -i "${DEPLOY_SSH_KEY_FILE}" ubuntu@"${FRONTEND_PUBLIC_IP}" "echo 'SSH OK'" >/dev/null 2>&1; then
                  echo "✓ SSH verified"
                  break
                fi
                RETRY_COUNT=$((RETRY_COUNT + 1))
                sleep 10
              done

              # ====== Step 6: Generate Ansible Inventory ======
              echo "📝 Step 6: Generating Ansible inventory..."
              cd "${WORKSPACE}/${ANSIBLE_DIR}"

              cat > hosts.ini <<EOF
[frontend]
${FRONTEND_PUBLIC_IP} ansible_user=ubuntu ansible_ssh_private_key_file=${DEPLOY_SSH_KEY_FILE} ansible_ssh_common_args="-o StrictHostKeyChecking=no"
EOF

              cat > extra_vars.json <<EOF
{
  "frontend_image": "$FRONTEND_IMAGE",
  "dockerhub_user": "$DOCKERHUB_USERNAME",
  "dockerhub_password": "$DOCKERHUB_TOKEN",
  "host_port": 80,
  "container_port": 3000,
  "backend_url": "http://$BACKEND_IP:3000"
}
EOF

              # ====== Step 7: Run Ansible Playbook ======
              echo "🤖 Step 7: Running Ansible deployment..."
              ansible-playbook -i hosts.ini site.yml --extra-vars "@extra_vars.json" -v

              echo "✅ Deployment Complete"
              docker logout || true
            '''
          }
        }
      }
    }
  }

  post {
    always {
      // Nettoyage des fichiers temporaires
      sh 'rm -f .ssh_ingress_cidr 2>/dev/null || true'
      
      // Déconnexion de Docker Hub pour la sécurité
      sh 'docker logout 2>/dev/null || true'
      
      // NETTOYAGE DISQUE : Supprime les images intermédiaires (dangling) 
      // qui n'ont plus de tag (souvent créées par le build précédent)
      sh 'docker image prune -f'
    }
    
    failure {
      // Optionnel : En cas d'échec, on peut faire un nettoyage plus profond
      // pour s'assurer que le prochain build démarre sur une base saine
      echo "Build failed, performing deep cleanup..."
      sh 'docker system prune -f --volumes'
    }
  }
}