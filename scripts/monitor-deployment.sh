#!/bin/bash

# HealthConnect+ Production Monitoring Script
# This script continuously monitors the health and performance of your deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default settings
MONITOR_INTERVAL=30  # seconds
LOG_FILE="healthconnect-monitor.log"
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=80
ALERT_THRESHOLD_DISK=90

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

print_metric() {
    echo -e "${CYAN}[METRIC]${NC} $1" | tee -a "$LOG_FILE"
}

print_alert() {
    echo -e "${MAGENTA}[ALERT]${NC} $1" | tee -a "$LOG_FILE"
}

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}🏥 $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Load environment variables
load_env() {
    if [ -f ".env" ]; then
        source .env
        print_info "Environment variables loaded from .env"
    else
        print_warning ".env file not found, using defaults"
        APP_PORT=${APP_PORT:-3017}
    fi
}

# Initialize monitoring
init_monitoring() {
    echo "# HealthConnect+ Monitoring Log" > "$LOG_FILE"
    echo "Started: $(date)" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    
    print_header "HEALTHCONNECT+ PRODUCTION MONITORING"
    print_info "Monitoring started at $(date)"
    print_info "Log file: $LOG_FILE"
    print_info "Check interval: ${MONITOR_INTERVAL}s"
    echo ""
}

# Monitor Docker Compose services
monitor_docker_compose() {
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Check container status
    local containers
    containers=$(docker-compose ps --format table | tail -n +2)
    
    if [ -n "$containers" ]; then
        local unhealthy_count
        unhealthy_count=$(echo "$containers" | grep -v "Up" | wc -l)
        
        if [ "$unhealthy_count" -gt 0 ]; then
            print_error "[$timestamp] $unhealthy_count container(s) are not healthy"
            echo "$containers" | grep -v "Up" | while read -r line; do
                print_error "  Unhealthy: $line"
            done
        else
            print_info "[$timestamp] All Docker Compose containers are healthy"
        fi
        
        # Check resource usage
        local app_container_id
        app_container_id=$(docker-compose ps -q app 2>/dev/null)
        
        if [ -n "$app_container_id" ]; then
            local stats
            stats=$(docker stats "$app_container_id" --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | tail -n 1)
            
            if [ -n "$stats" ]; then
                local cpu_percent
                local mem_usage
                local mem_percent
                
                cpu_percent=$(echo "$stats" | awk '{print $1}' | sed 's/%//')
                mem_usage=$(echo "$stats" | awk '{print $2}')
                mem_percent=$(echo "$stats" | awk '{print $3}' | sed 's/%//')
                
                print_metric "[$timestamp] App Container - CPU: ${cpu_percent}%, Memory: ${mem_usage} (${mem_percent}%)"
                
                # Check thresholds
                if (( $(echo "$cpu_percent > $ALERT_THRESHOLD_CPU" | bc -l) )); then
                    print_alert "[$timestamp] HIGH CPU USAGE: ${cpu_percent}% (threshold: ${ALERT_THRESHOLD_CPU}%)"
                fi
                
                if (( $(echo "$mem_percent > $ALERT_THRESHOLD_MEMORY" | bc -l) )); then
                    print_alert "[$timestamp] HIGH MEMORY USAGE: ${mem_percent}% (threshold: ${ALERT_THRESHOLD_MEMORY}%)"
                fi
            fi
        fi
        
        # Monitor MongoDB
        local mongo_container_id
        mongo_container_id=$(docker-compose ps -q mongo 2>/dev/null)
        
        if [ -n "$mongo_container_id" ]; then
            if docker-compose exec -T mongo mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
                print_info "[$timestamp] MongoDB is responding"
                
                # Get MongoDB stats
                local db_stats
                db_stats=$(docker-compose exec -T mongo mongosh "${MONGO_DB:-healthconnect}" --eval "JSON.stringify(db.stats())" --quiet 2>/dev/null || echo '{}')
                
                if [ "$db_stats" != "{}" ]; then
                    local collections
                    local data_size
                    collections=$(echo "$db_stats" | jq -r '.collections // 0' 2>/dev/null || echo "0")
                    data_size=$(echo "$db_stats" | jq -r '.dataSize // 0' 2>/dev/null || echo "0")
                    
                    print_metric "[$timestamp] MongoDB - Collections: $collections, Data Size: $data_size bytes"
                fi
            else
                print_error "[$timestamp] MongoDB is not responding"
            fi
        fi
        
    else
        print_warning "[$timestamp] No Docker Compose containers found"
    fi
}

# Monitor Kubernetes deployment
monitor_kubernetes() {
    if ! kubectl cluster-info >/dev/null 2>&1; then
        return 0
    fi
    
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local namespace="${K8S_NAMESPACE:-healthconnect}"
    
    # Check if namespace exists
    if ! kubectl get namespace "$namespace" >/dev/null 2>&1; then
        return 0
    fi
    
    print_info "[$timestamp] Monitoring Kubernetes namespace: $namespace"
    
    # Check pod status
    local pods_status
    pods_status=$(kubectl get pods -n "$namespace" --no-headers 2>/dev/null || echo "")
    
    if [ -n "$pods_status" ]; then
        local total_pods
        local running_pods
        local failed_pods
        
        total_pods=$(echo "$pods_status" | wc -l)
        running_pods=$(echo "$pods_status" | grep "Running" | wc -l)
        failed_pods=$(echo "$pods_status" | grep -E "(Failed|Error|CrashLoopBackOff)" | wc -l)
        
        print_metric "[$timestamp] K8s Pods - Total: $total_pods, Running: $running_pods, Failed: $failed_pods"
        
        if [ "$failed_pods" -gt 0 ]; then
            print_error "[$timestamp] $failed_pods pod(s) are in failed state"
            echo "$pods_status" | grep -E "(Failed|Error|CrashLoopBackOff)" | while read -r line; do
                print_error "  Failed Pod: $line"
            done
        fi
        
        # Check deployments
        local deployments
        deployments=$(kubectl get deployments -n "$namespace" --no-headers 2>/dev/null || echo "")
        
        if [ -n "$deployments" ]; then
            echo "$deployments" | while read -r deployment_line; do
                local deployment_name
                local ready_replicas
                local desired_replicas
                
                deployment_name=$(echo "$deployment_line" | awk '{print $1}')
                ready_replicas=$(echo "$deployment_line" | awk '{print $2}' | cut -d'/' -f1)
                desired_replicas=$(echo "$deployment_line" | awk '{print $2}' | cut -d'/' -f2)
                
                if [ "$ready_replicas" != "$desired_replicas" ]; then
                    print_warning "[$timestamp] Deployment $deployment_name: $ready_replicas/$desired_replicas replicas ready"
                else
                    print_info "[$timestamp] Deployment $deployment_name: All $ready_replicas replicas healthy"
                fi
            done
        fi
        
        # Check services
        local services
        services=$(kubectl get services -n "$namespace" --no-headers 2>/dev/null || echo "")
        
        if [ -n "$services" ]; then
            local service_count
            service_count=$(echo "$services" | wc -l)
            print_metric "[$timestamp] K8s Services: $service_count active"
            
            # Check LoadBalancer status
            local lb_services
            lb_services=$(echo "$services" | grep "LoadBalancer")
            
            if [ -n "$lb_services" ]; then
                echo "$lb_services" | while read -r lb_line; do
                    local service_name
                    local external_ip
                    
                    service_name=$(echo "$lb_line" | awk '{print $1}')
                    external_ip=$(echo "$lb_line" | awk '{print $4}')
                    
                    if [ "$external_ip" = "<pending>" ]; then
                        print_warning "[$timestamp] LoadBalancer $service_name: External IP pending"
                    else
                        print_info "[$timestamp] LoadBalancer $service_name: $external_ip"
                        
                        # Test LoadBalancer connectivity
                        if curl -f -s --connect-timeout 5 "http://$external_ip" >/dev/null 2>&1; then
                            print_info "[$timestamp] LoadBalancer $service_name is responding"
                        else
                            print_warning "[$timestamp] LoadBalancer $service_name is not responding"
                        fi
                    fi
                done
            fi
        fi
    else
        print_info "[$timestamp] No Kubernetes pods found in namespace $namespace"
    fi
}

# Monitor application health
monitor_application() {
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local app_url="http://localhost:${APP_PORT:-3017}"
    
    # Test main application
    if curl -f -s --connect-timeout 10 "$app_url" >/dev/null; then
        print_info "[$timestamp] Application is responding at $app_url"
        
        # Test response time
        local response_time
        response_time=$(curl -w "%{time_total}" -s -o /dev/null "$app_url")
        print_metric "[$timestamp] Application response time: ${response_time}s"
        
        # Alert if response time is too high
        if (( $(echo "$response_time > 5" | bc -l) )); then
            print_alert "[$timestamp] SLOW RESPONSE: ${response_time}s (threshold: 5s)"
        fi
        
        # Test critical endpoints
        local endpoints=(
            "/doctors.html"
            "/book.html"
            "/consultation.html"
        )
        
        local failed_endpoints=0
        for endpoint in "${endpoints[@]}"; do
            if ! curl -f -s --connect-timeout 5 "${app_url}${endpoint}" >/dev/null; then
                print_warning "[$timestamp] Endpoint $endpoint is not accessible"
                ((failed_endpoints++))
            fi
        done
        
        if [ $failed_endpoints -eq 0 ]; then
            print_info "[$timestamp] All critical endpoints are accessible"
        else
            print_alert "[$timestamp] $failed_endpoints critical endpoint(s) are not accessible"
        fi
        
    else
        print_error "[$timestamp] Application is not responding at $app_url"
        
        # Get container logs if available
        if docker-compose ps app >/dev/null 2>&1; then
            print_info "[$timestamp] Recent application logs:"
            docker-compose logs --tail=10 app | sed "s/^/  /" | tee -a "$LOG_FILE"
        fi
    fi
}

# Monitor system resources
monitor_system() {
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Check disk usage
    local disk_usage
    disk_usage=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    
    print_metric "[$timestamp] Disk usage: ${disk_usage}%"
    
    if [ "$disk_usage" -gt "$ALERT_THRESHOLD_DISK" ]; then
        print_alert "[$timestamp] HIGH DISK USAGE: ${disk_usage}% (threshold: ${ALERT_THRESHOLD_DISK}%)"
    fi
    
    # Check memory usage (if available)
    if command -v free >/dev/null 2>&1; then
        local mem_usage
        mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
        print_metric "[$timestamp] System memory usage: ${mem_usage}%"
        
        if [ "$mem_usage" -gt "$ALERT_THRESHOLD_MEMORY" ]; then
            print_alert "[$timestamp] HIGH SYSTEM MEMORY USAGE: ${mem_usage}% (threshold: ${ALERT_THRESHOLD_MEMORY}%)"
        fi
    fi
    
    # Check load average (if available)
    if command -v uptime >/dev/null 2>&1; then
        local load_avg
        load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
        print_metric "[$timestamp] System load average: $load_avg"
    fi
}

# Generate alerts summary
generate_alerts_summary() {
    local alert_count
    alert_count=$(grep -c "\[ALERT\]" "$LOG_FILE" 2>/dev/null || echo "0")
    
    if [ "$alert_count" -gt 0 ]; then
        print_header "RECENT ALERTS ($alert_count)"
        tail -50 "$LOG_FILE" | grep "\[ALERT\]" | tail -10
        echo ""
    fi
}

# Monitor network connectivity
monitor_network() {
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Test external connectivity
    if curl -s --connect-timeout 5 https://www.google.com >/dev/null; then
        print_info "[$timestamp] External network connectivity OK"
    else
        print_error "[$timestamp] External network connectivity issues"
    fi
    
    # Test Docker Hub
    if curl -s --connect-timeout 5 https://hub.docker.com >/dev/null; then
        print_info "[$timestamp] Docker Hub connectivity OK"
    else
        print_warning "[$timestamp] Docker Hub connectivity issues"
    fi
}

# Main monitoring loop
run_monitoring() {
    init_monitoring
    
    print_info "Starting continuous monitoring (Press Ctrl+C to stop)"
    print_info "Alert thresholds - CPU: ${ALERT_THRESHOLD_CPU}%, Memory: ${ALERT_THRESHOLD_MEMORY}%, Disk: ${ALERT_THRESHOLD_DISK}%"
    echo ""
    
    # Trap SIGINT (Ctrl+C) to cleanup
    trap 'print_info "Monitoring stopped at $(date)"; exit 0' SIGINT
    
    while true; do
        {
            monitor_system
            monitor_application
            monitor_docker_compose
            monitor_kubernetes
            monitor_network
            generate_alerts_summary
            
            echo "----------------------------------------" >> "$LOG_FILE"
        } 2>&1
        
        sleep "$MONITOR_INTERVAL"
    done
}

# Show help
show_help() {
    echo "HealthConnect+ Production Monitoring Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "OPTIONS:"
    echo "  -i, --interval SECONDS    Monitoring interval (default: 30)"
    echo "  -l, --log-file FILE      Log file path (default: healthconnect-monitor.log)"
    echo "  -c, --cpu-threshold NUM   CPU alert threshold % (default: 80)"
    echo "  -m, --mem-threshold NUM   Memory alert threshold % (default: 80)"
    echo "  -d, --disk-threshold NUM  Disk alert threshold % (default: 90)"
    echo "  -h, --help               Show this help"
    echo ""
    echo "Examples:"
    echo "  $0                       # Start monitoring with defaults"
    echo "  $0 -i 60 -l monitor.log  # Monitor every 60 seconds, log to monitor.log"
    echo "  $0 -c 90 -m 85           # Set higher alert thresholds"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--interval)
            MONITOR_INTERVAL="$2"
            shift 2
            ;;
        -l|--log-file)
            LOG_FILE="$2"
            shift 2
            ;;
        -c|--cpu-threshold)
            ALERT_THRESHOLD_CPU="$2"
            shift 2
            ;;
        -m|--mem-threshold)
            ALERT_THRESHOLD_MEMORY="$2"
            shift 2
            ;;
        -d|--disk-threshold)
            ALERT_THRESHOLD_DISK="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
load_env
run_monitoring
