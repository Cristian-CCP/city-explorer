pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 15, unit: 'MINUTES')
    }

    environment {
        BACKEND_IMAGE  = 'city-explorer-backend'
        FRONTEND_IMAGE = 'city-explorer-frontend'
        IMAGE_TAG      = "${env.BUILD_NUMBER ?: 'latest'}"
        HEALTH_URL     = 'http://localhost:8080/health'
        CITIES_URL     = 'http://localhost:8080/api/cities'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install') {
            steps {
                dir('backend') {
                    sh 'npm ci --no-audit --no-fund'
                }
            }
        }

        stage('Test') {
            steps {
                dir('backend') {
                    sh 'npm test -- --ci'
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                sh '''
                    docker build --target runtime -t ${BACKEND_IMAGE}:${IMAGE_TAG} -t ${BACKEND_IMAGE}:latest ./backend
                    docker build --target runtime -t ${FRONTEND_IMAGE}:${IMAGE_TAG} -t ${FRONTEND_IMAGE}:latest ./frontend
                '''
            }
        }

        stage('Deploy with Compose') {
            steps {
                sh 'docker compose up -d --remove-orphans'
            }
        }

        stage('Smoke Test') {
            steps {
                sh '''
                    attempt=0
                    until curl -fsS "${HEALTH_URL}" | grep -q '"status":"ok"'; do
                        attempt=$((attempt + 1))
                        if [ "$attempt" -ge 15 ]; then
                            docker compose ps
                            docker compose logs --tail=50
                            exit 1
                        fi
                        sleep 2
                    done
                    curl -fsS "${CITIES_URL}" | grep -q '"count":'
                '''
            }
        }
    }

    post {
        failure {
            sh 'docker compose logs --tail=100 || true'
        }
    }
}
