#!/bin/bash
# Quilt Package Search UAT Test Runner
# Runs comprehensive tests for quilt3.search_packages() API functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DEBUG_MODE=false
SPECIFIC_TEST=""
CONFIG_FILE="test_config.yaml"
ENABLE_LOGGING=false

# Available tests
AVAILABLE_TESTS=(
    "parameter_coverage:Test all search_packages parameters and combinations"
    "pagination:Test search_more_packages functionality and workflow"
    "error_handling:Test exception handling and parameter validation"
    "python_integration:Test Python-specific functionality and imports"
    "result_structure:Test return object structure and properties"
)

# Show available tests
show_tests() {
    echo "Available tests:"
    for test_info in "${AVAILABLE_TESTS[@]}"; do
        test_name="${test_info%%:*}"
        test_desc="${test_info#*:}"
        printf "  %-18s - %s\n" "$test_name" "$test_desc"
    done
}

# Help function
show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

Run comprehensive UAT tests for quilt3.search_packages() API

OPTIONS:
    -h, --help          Show this help message
    -d, --debug         Enable debug mode (enables API logging)
    -t, --test TEST     Run specific test only
    -c, --config FILE   Use specific config file (default: test_config.yaml)
    -l, --logging       Enable search_packages API logging
    --list              List available tests
    -v, --verbose       Enable verbose output

EOF

    show_tests

    cat << EOF

Special test names:
    all                 - Run all tests (default)

EXAMPLES:
    $0                                    # Run all tests
    $0 --list                            # Show available tests
    $0 --debug --test parameter_coverage  # Debug specific test with logging
    $0 --config staging_config.yaml      # Use staging environment config
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        --list)
            show_tests
            exit 0
            ;;
        -d|--debug)
            DEBUG_MODE=true
            ENABLE_LOGGING=true
            shift
            ;;
        -t|--test)
            SPECIFIC_TEST="$2"
            shift 2
            ;;
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -l|--logging)
            ENABLE_LOGGING=true
            shift
            ;;
        -v|--verbose)
            set -x
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Check if config file exists
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo -e "${RED}Error: Config file '$CONFIG_FILE' not found${NC}"
    echo "Create a config file or use --config to specify a different one"
    exit 1
fi

echo -e "${BLUE}=== Quilt Package Search UAT Tests ===${NC}"
echo "Config: $CONFIG_FILE"
echo "Debug mode: $DEBUG_MODE"
echo "Logging enabled: $ENABLE_LOGGING"
echo "Specific test: ${SPECIFIC_TEST:-all}"
echo ""

# Set up environment variables for Python scripts
export UAT_CONFIG_FILE="$CONFIG_FILE"
export UAT_DEBUG_MODE="$DEBUG_MODE"
export UAT_ENABLE_LOGGING="$ENABLE_LOGGING"

# Test execution function
run_test() {
    local test_name="$1"
    local test_script="$2"
    local description="$3"
    
    if [[ -n "$SPECIFIC_TEST" && "$SPECIFIC_TEST" != "$test_name" ]]; then
        return 0  # Skip this test, don't count it
    fi
    
    echo -e "${YELLOW}Running $test_name: $description${NC}"
    echo "----------------------------------------"
    
    # Capture output to parse test case statistics
    local test_output
    test_output=$(python3 "$test_script" 2>&1)
    local exit_code=$?
    
    # Display the output
    echo "$test_output"
    
    # Parse test case statistics from structured output
    if echo "$test_output" | grep -q "========== TEST_CASE_SUMMARY =========="; then
        local test_summary
        test_summary=$(echo "$test_output" | sed -n '/========== TEST_CASE_SUMMARY ==========/,/========== END_TEST_CASE_SUMMARY ==========/p')
        
        local passed_cases=$(echo "$test_summary" | grep "PASSED_TEST_CASES=" | cut -d'=' -f2)
        local failed_cases=$(echo "$test_summary" | grep "FAILED_TEST_CASES=" | cut -d'=' -f2)
        local total_cases=$(echo "$test_summary" | grep "TOTAL_TEST_CASES=" | cut -d'=' -f2)
        local warnings=$(echo "$test_summary" | grep "TOTAL_WARNINGS=" | cut -d'=' -f2)
        
        # Aggregate test case counts
        ((PASSED_TEST_CASES += passed_cases))
        ((FAILED_TEST_CASES += failed_cases))
        ((TOTAL_TEST_CASES += total_cases))
        ((TOTAL_WARNINGS += warnings))
    fi
    
    # Count this test suite
    ((TOTAL_TESTS++))
    
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}✓ $test_name PASSED${NC}"
        echo ""
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}✗ $test_name FAILED${NC}"
        echo ""
        ((FAILED_TESTS++))
        return 1
    fi
}

# Initialize test results
# Test suites counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Individual test cases counters (aggregated from all suites)
TOTAL_TEST_CASES=0
PASSED_TEST_CASES=0
FAILED_TEST_CASES=0
TOTAL_WARNINGS=0

# Run tests based on selection
if [[ -z "$SPECIFIC_TEST" || "$SPECIFIC_TEST" == "all" ]]; then
    echo "Running all tests..."
    echo ""
fi

# Test 1: Parameter Coverage
run_test "parameter_coverage" "test_parameter_coverage.py" "All API parameters and combinations"

# Test 2: Pagination  
run_test "pagination" "test_pagination.py" "search_more_packages() functionality"

# Test 3: Error Handling
run_test "error_handling" "test_error_handling.py" "Exception handling and validation"

# Test 4: Python Integration
run_test "python_integration" "test_python_integration.py" "Python-specific functionality"

# Test 5: Result Structure
run_test "result_structure" "test_result_structure.py" "Return object validation"

# Summary
echo "========================================"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo "Test Suites:"
echo "  Total: $TOTAL_TESTS"
echo -e "  Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "  Failed: ${RED}$FAILED_TESTS${NC}"
echo ""
echo "Individual Test Cases:"
echo "  Total: $TOTAL_TEST_CASES"
echo -e "  Passed: ${GREEN}$PASSED_TEST_CASES${NC}"
echo -e "  Failed: ${RED}$FAILED_TEST_CASES${NC}"
if [[ $TOTAL_WARNINGS -gt 0 ]]; then
    echo -e "  Warnings: ${YELLOW}$TOTAL_WARNINGS${NC}"
fi

if [[ $FAILED_TESTS -eq 0 ]]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed! ✗${NC}"
    exit 1
fi