pipeline {
    agent any

    environment {
        APP_NAME        = 'healthconnect-app'
        DOCKERHUB_USER  = 'ridhima14'
        DOCKER_REPO     = "${DOCKERHUB_USER}/${APP_NAME}"
        AWS_ACCOUNT_ID  = '822687512925'
        AWS_REGION      = 'ap-south-1'
        ECR_REPO        = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}"
        NAMESPACE       = 'healthconnect'
    }

        stage('Build Docker Image') {
            steps {
                echo '🐳 Building Docker image...'
                sh """
                    docker build -t ${DOCKER_REPO}:${BUILD_NUMBER} .
                    docker tag ${DOCKER_REPO}:${BUILD_NUMBER} ${DOCKER_REPO}:latest
                """
            }
        }

        stage('Push Images') {
            parallel {
                stage('Push to DockerHub') {
                    steps {
                        withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', usernameVariable: 'USER', passwordVariable: 'PASS')]) {
                            sh """
                                echo $PASS | docker login -u $USER --password-stdin
                                docker push ${DOCKER_REPO}:${BUILD_NUMBER}
                                docker push ${DOCKER_REPO}:latest
                            """
                        }
                    }
                }
                stage('Push to AWS ECR') {
                    steps {
                        sh """
                            aws ecr get-login-password --region ${AWS_REGION} | \
                            docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
                            docker tag ${DOCKER_REPO}:${BUILD_NUMBER} ${ECR_REPO}:${BUILD_NUMBER}
                            docker tag ${DOCKER_REPO}:${BUILD_NUMBER} ${ECR_REPO}:latest
                            docker push ${ECR_REPO}:${BUILD_NUMBER}
                            docker push ${ECR_REPO}:latest
                        """
                    }
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                withKubeConfig([credentialsId: 'eks-kubeconfig']) {
                    sh """
                        kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
                        kubectl set image deployment/${APP_NAME} ${APP_NAME}=${ECR_REPO}:${BUILD_NUMBER} -n ${NAMESPACE} || \
                        kubectl apply -f k8s/ -n ${NAMESPACE}
                        kubectl rollout status deployment/${APP_NAME} -n ${NAMESPACE} --timeout=300s
                    """
                }
            }
        }
    }

    post {
        always {
            echo '🧹 Cleaning up...'
            sh 'docker system prune -f || true'
        }
        success {
            echo "🎉 SUCCESS: ${APP_NAME} deployed!"
        }
        failure {
            echo "❌ FAILED: Pipeline failed. Check logs."
        }
    }
}
