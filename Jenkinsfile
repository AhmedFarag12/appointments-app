pipeline {
    agent any

    parameters {
        string(name: 'IMAGE_NAME', defaultValue: 'appointments-app',
               description: 'Image name, including registry/namespace if pushing (e.g. docker.io/me/appointments-app)')
        string(name: 'REGISTRY_URL', defaultValue: '',
               description: 'Registry to log in to before pushing (empty = Docker Hub)')
        booleanParam(name: 'PUSH_IMAGE', defaultValue: false,
                     description: 'Push the image even when not on main')
    }

    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    environment {
        IMAGE_NAME           = "${params.IMAGE_NAME ?: 'appointments-app'}"
        REGISTRY_URL         = "${params.REGISTRY_URL ?: ''}"
        IMAGE_TAG            = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'local'}"
        COMPOSE_PROJECT_NAME = "appointments-ci-${env.BUILD_NUMBER}"
        PORT                 = "${13000 + (env.BUILD_NUMBER as int) % 1000}"
        JWT_SECRET           = 'ci-only-secret'
    }

    stages {
        stage('Install, Lint, Test & Build') {
            agent {
                docker {
                    image 'node:24-alpine'
                    reuseNode true
                    args '-e npm_config_cache=/tmp/.npm'
                }
            }
            stages {
                stage('Install') {
                    steps {
                        sh 'npm ci'
                    }
                }
                stage('Lint') {
                    steps {
                        sh 'npm run lint'
                    }
                }
                stage('Unit tests') {
                    steps {
                        sh 'npm test -- --ci --passWithNoTests'
                    }
                }
                stage('Build') {
                    steps {
                        sh 'npm run build'
                    }
                }
            }
        }

        stage('Docker image') {
            steps {
                sh 'docker build -t "$IMAGE_NAME:$IMAGE_TAG" -t "$IMAGE_NAME:latest" .'
            }
        }

        stage('Smoke test') {
            steps {
                sh 'docker compose up -d --build'
                sh 'bash scripts/smoke-test.sh "http://localhost:$PORT"'
            }
            post {
                failure {
                    sh 'docker compose logs --no-color app || true'
                }
                always {
                    sh 'docker compose down -v --remove-orphans || true'
                }
            }
        }

        stage('Push') {
            when {
                anyOf {
                    branch 'main'
                    expression { params.PUSH_IMAGE }
                }
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'docker-registry-creds',
                                                  usernameVariable: 'REG_USER',
                                                  passwordVariable: 'REG_PASS')]) {
                    sh '''
                        echo "$REG_PASS" | docker login $REGISTRY_URL -u "$REG_USER" --password-stdin
                        docker push "$IMAGE_NAME:$IMAGE_TAG"
                        docker push "$IMAGE_NAME:latest"
                    '''
                }
            }
            post {
                always {
                    sh 'docker logout $REGISTRY_URL || true'
                }
            }
        }
    }

    post {
        always {
            sh 'docker image rm "$IMAGE_NAME:$IMAGE_TAG" || true'
            cleanWs()
        }
        success {
            echo "Built ${params.IMAGE_NAME}:${env.IMAGE_TAG}"
        }
    }
}
