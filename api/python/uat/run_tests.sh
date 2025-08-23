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

# Help function
show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

Run comprehensive UAT tests for quilt3.search_packages() API

OPTIONS:
    -h, --help          Show this help message
    -d, --debug         Enable debug mode (enables API logging)
    -t, --test TEST     Run specific test only (e.g., 'parameter_coverage', 'pagination', 'error_handling')
    -c, --config FILE   Use specific config file (default: test_config.yaml)
    -l, --logging       Enable search_packages API logging
    -v, --verbose       Enable verbose output

AVAILABLE TESTS:
    parameter_coverage  - Test all search_packages parameters
    pagination         - Test search_more_packages functionality  
    error_handling     - Test exception handling
    python_integration - Test Python-specific functionality
    result_structure   - Test return object structure
    all               - Run all tests (default)

EXAMPLES:
    $0                                    # Run all tests
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
        return 0
    fi
    
    echo -e "${YELLOW}Running $test_name: $description${NC}"
    echo "----------------------------------------"
    
    if python3 "$test_script"; then
        echo -e "${GREEN}✓ $test_name PASSED${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}✗ $test_name FAILED${NC}"
        echo ""
        return 1
    fi
}

# Initialize test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Run tests based on selection
if [[ -z "$SPECIFIC_TEST" || "$SPECIFIC_TEST" == "all" ]]; then
    echo "Running all tests..."
    echo ""
fi

# Test 1: Parameter Coverage
if run_test "parameter_coverage" "test_parameter_coverage.py" "All API parameters and combinations"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Test 2: Pagination  
if run_test "pagination" "test_pagination.py" "search_more_packages() functionality"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Test 3: Error Handling
if run_test "error_handling" "test_error_handling.py" "Exception handling and validation"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Test 4: Python Integration
if run_test "python_integration" "test_python_integration.py" "Python-specific functionality"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Test 5: Result Structure
if run_test "result_structure" "test_result_structure.py" "Return object validation"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Summary
echo "========================================"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo "Total tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [[ $FAILED_TESTS -eq 0 ]]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed! ✗${NC}"
    exit 1
fi