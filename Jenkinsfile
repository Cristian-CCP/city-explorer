// Jenkinsfile declarativo - City Explorer
//
// Requisitos del agente Jenkins:
//   - Docker y el plugin "docker compose" (v2) instalados y accesibles por el usuario jenkins.
//   - Plugin "NodeJS" con una instalación llamada "node-20"
//     (Manage Jenkins > Tools > NodeJS installations).
//   - curl disponible en el agente.

pipeline {
    agent any

    tools {
        nodejs 'node-20'
    }

    options {
        timestamps()
        timeout(time: 20, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    environment {
        COMPOSE_PROJECT_NAME = 'city-explorer'
        BACKEND_URL  = 'http://localhost:3000'
        FRONTEND_URL = 'http://localhost:8080'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git log -1 --oneline'
            }
        }

        stage('Install') {
            steps {
                dir('backend') {
                    sh 'node --version && npm --version'
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

        stage('Build Docker images') {
            steps {
                sh 'docker --version && docker compose version'
                sh 'docker compose build'
                sh 'docker image ls | grep city-explorer'
            }
        }

        stage('Deploy') {
            steps {
                sh 'docker compose down --remove-orphans || true'
                sh 'docker compose up -d'
                sh 'docker compose ps'
            }
        }

        stage('Smoke test') {
            steps {
                // Espera hasta 60 s a que el backend responda
                sh '''
                    for i in $(seq 1 30); do
                        if curl -fsS "$BACKEND_URL/health"; then
                            echo ""
                            echo "Backend OK"
                            break
                        fi
                        echo "Esperando al backend ($i/30)..."
                        sleep 2
                    done
                    curl -fsS "$BACKEND_URL/health"
                '''
                // Verifica la comunicación frontend (nginx) -> backend por la red ci-network
                sh '''
                    for i in $(seq 1 15); do
                        if curl -fsS "$FRONTEND_URL/api/cities" > /dev/null; then
                            break
                        fi
                        echo "Esperando al frontend ($i/15)..."
                        sleep 2
                    done
                    curl -fsS "$FRONTEND_URL/health"
                    echo ""
                    curl -fsS "$FRONTEND_URL/api/cities?q=colombia"
                    echo ""
                '''
            }
        }
    }

    post {
        success {
            echo 'Pipeline OK: City Explorer desplegado en http://localhost:8080'
        }
        failure {
            sh 'docker compose logs --no-color --tail=100 || true'
            sh 'docker compose down --remove-orphans || true'
        }
    }
}
