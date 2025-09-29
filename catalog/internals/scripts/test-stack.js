#!/usr/bin/env node

/**
 * Test Stack Script
 *
 * This script automates testing of the catalog by:
 * 1. Starting the webpack dev server (npm run start)
 * 2. Launching a browser with Chrome DevTools
 * 3. Capturing HTML, console logs, and network errors
 * 4. Reporting any issues found
 *
 * Usage:
 *   node test-stack.js [options]
 *
 * Options:
 *   --port <port>          Port for dev server (default: 3000)
 *   --timeout <seconds>    Test timeout in seconds (default: 30)
 *   --headless             Run browser in headless mode
 *   --no-server            Skip starting server (assume already running)
 *   --url <url>            Test a specific URL (default: http://localhost:PORT)
 *   --help                 Show help
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const chromeLauncher = require('chrome-launcher');
const CDP = require('chrome-remote-interface');

// Configuration
const DEFAULT_PORT = 3000;
const DEFAULT_TIMEOUT = 30;
const OUTPUT_DIR = path.resolve(__dirname, '../../build/test-results');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    port: DEFAULT_PORT,
    timeout: DEFAULT_TIMEOUT,
    headless: false,
    noServer: false,
    url: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--port':
        if (i + 1 >= args.length) throw new Error('--port requires a port number');
        options.port = parseInt(args[++i], 10);
        if (isNaN(options.port) || options.port <= 0 || options.port > 65535) {
          throw new Error('Invalid port number');
        }
        break;

      case '--timeout':
        if (i + 1 >= args.length) throw new Error('--timeout requires a number');
        options.timeout = parseInt(args[++i], 10);
        if (isNaN(options.timeout) || options.timeout <= 0) {
          throw new Error('Invalid timeout value');
        }
        break;

      case '--headless':
        options.headless = true;
        break;

      case '--no-server':
        options.noServer = true;
        break;

      case '--url':
        if (i + 1 >= args.length) throw new Error('--url requires a URL');
        options.url = args[++i];
        break;

      case '--help':
      case '-h':
        options.help = true;
        break;

      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.url) {
    options.url = `http://localhost:${options.port}`;
  }

  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Test Stack Script

Usage:
  node test-stack.js [options]

Options:
  --port <port>          Port for dev server (default: 3000)
  --timeout <seconds>    Test timeout in seconds (default: 30)
  --headless             Run browser in headless mode
  --no-server            Skip starting server (assume already running)
  --url <url>            Test a specific URL (default: http://localhost:PORT)
  --help                 Show this help message

Examples:
  node test-stack.js                           # Test with default settings
  node test-stack.js --headless --timeout 60  # Headless mode with 60s timeout
  node test-stack.js --no-server --port 8080  # Test existing server on port 8080
`);
}

/**
 * Server Manager - Handle webpack dev server lifecycle
 */
class ServerManager {
  constructor(port) {
    this.port = port;
    this.process = null;
    this.ready = false;
  }

  async start() {
    console.log('🚀 Starting webpack dev server...');

    return new Promise((resolve, reject) => {
      // Start the webpack dev server using npm run start
      this.process = spawn('npm', ['run', 'start'], {
        cwd: path.resolve(__dirname, '../..'),
        env: { ...process.env, PORT: this.port.toString() },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let serverOutput = '';
      let errorOutput = '';

      // Capture stdout
      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        serverOutput += output;
        console.log(`📟 Server: ${output.trim()}`);

        // Check if server is ready
        if (output.includes('webpack compiled') ||
            output.includes('compiled successfully') ||
            output.includes(`Local:`) ||
            output.includes(`localhost:${this.port}`)) {
          this.ready = true;
          resolve();
        }
      });

      // Capture stderr
      this.process.stderr.on('data', (data) => {
        const output = data.toString();
        errorOutput += output;
        console.error(`📟 Server Error: ${output.trim()}`);

        // Check for port already in use error
        if (output.includes('EADDRINUSE') || output.includes('address already in use')) {
          console.log('🛑 Port already in use, attempting to kill existing process...');
          this.killPortProcess().then(() => {
            console.log('🔄 Retrying server start...');
            // Retry starting the server
            setTimeout(() => {
              this.retryStart().then(resolve).catch(reject);
            }, 2000);
          }).catch(() => {
            reject(new Error(`Port ${this.port} is already in use and could not be freed. Error: ${errorOutput}`));
          });
        }
      });

      // Handle process exit
      this.process.on('exit', (code) => {
        if (code !== 0 && !this.ready) {
          // Check if it's a port conflict
          if (errorOutput.includes('EADDRINUSE') || errorOutput.includes('address already in use')) {
            console.log('🛑 Port conflict detected, attempting to kill existing process...');
            this.killPortProcess().then(() => {
              console.log('🔄 Retrying server start...');
              // Retry starting the server
              setTimeout(() => {
                this.retryStart().then(resolve).catch(reject);
              }, 2000);
            }).catch(() => {
              reject(new Error(`Port ${this.port} is already in use and could not be freed. Error: ${errorOutput}`));
            });
          } else {
            reject(new Error(`Server exited with code ${code}. Error: ${errorOutput}`));
          }
        }
      });

      // Handle process errors
      this.process.on('error', (error) => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });

      // Timeout if server doesn't start
      setTimeout(() => {
        if (!this.ready) {
          reject(new Error('Server startup timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  async killPortProcess() {
    console.log(`🧹 Killing process on port ${this.port}...`);

    return new Promise((resolve, reject) => {
      const killProcess = spawn('npm', ['run', 'stop'], {
        cwd: path.resolve(__dirname, '../..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';

      killProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      killProcess.stderr.on('data', (data) => {
        output += data.toString();
      });

      killProcess.on('exit', (code) => {
        console.log(`📟 Kill command output: ${output.trim()}`);
        if (code === 0 || output.includes('No process found')) {
          console.log('✅ Port cleanup completed');
          resolve();
        } else {
          reject(new Error(`Failed to kill process on port ${this.port}`));
        }
      });

      killProcess.on('error', (error) => {
        reject(new Error(`Failed to run stop command: ${error.message}`));
      });
    });
  }

  async retryStart() {
    console.log('🔄 Attempting to restart server...');
    this.ready = false;
    this.process = null;

    return new Promise((resolve, reject) => {
      // Start the webpack dev server using npm run start
      this.process = spawn('npm', ['run', 'start'], {
        cwd: path.resolve(__dirname, '../..'),
        env: { ...process.env, PORT: this.port.toString() },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let serverOutput = '';
      let errorOutput = '';

      // Capture stdout
      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        serverOutput += output;
        console.log(`📟 Server: ${output.trim()}`);

        // Check if server is ready
        if (output.includes('webpack compiled') ||
            output.includes('compiled successfully') ||
            output.includes(`Local:`) ||
            output.includes(`localhost:${this.port}`)) {
          this.ready = true;
          resolve();
        }
      });

      // Capture stderr
      this.process.stderr.on('data', (data) => {
        const output = data.toString();
        errorOutput += output;
        console.error(`📟 Server Error: ${output.trim()}`);
      });

      // Handle process exit
      this.process.on('exit', (code) => {
        if (code !== 0 && !this.ready) {
          reject(new Error(`Server retry failed with code ${code}. Error: ${errorOutput}`));
        }
      });

      // Handle process errors
      this.process.on('error', (error) => {
        reject(new Error(`Failed to restart server: ${error.message}`));
      });

      // Timeout if server doesn't start on retry
      setTimeout(() => {
        if (!this.ready) {
          reject(new Error('Server restart timeout'));
        }
      }, 15000); // 15 second timeout for retry
    });
  }

  async stop() {
    if (this.process) {
      console.log('🛑 Stopping webpack dev server...');
      this.process.kill('SIGTERM');

      // Give it 5 seconds to gracefully shutdown
      await new Promise(resolve => {
        const timeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }
}

/**
 * Browser Test Manager - Handle browser automation and error capture
 */
class BrowserTestManager {
  constructor(options) {
    this.options = options;
    this.chrome = null;
    this.client = null;
    this.results = {
      url: options.url,
      timestamp: new Date().toISOString(),
      success: false,
      html: '',
      consoleLogs: [],
      networkErrors: [],
      jsErrors: [],
      performanceMetrics: {},
      screenshots: []
    };
  }

  async runTest() {
    console.log('🌐 Launching Chrome browser...');

    try {
      // Launch Chrome
      const chromeFlags = [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-web-security', // Allow CORS for testing
        '--disable-features=VizDisplayCompositor'
      ];

      if (this.options.headless) {
        chromeFlags.push('--headless');
      }

      this.chrome = await chromeLauncher.launch({
        chromeFlags,
        startingUrl: 'about:blank'
      });

      console.log(`✅ Chrome launched on port ${this.chrome.port}`);

      // Connect to Chrome DevTools Protocol
      this.client = await CDP({ port: this.chrome.port });
      const { Page, Runtime, Network, Console, Performance } = this.client;

      // Enable domains
      await Page.enable();
      await Runtime.enable();
      await Network.enable();
      await Console.enable();
      await Performance.enable();

      // Set up event listeners
      this.setupEventListeners(Page, Runtime, Network, Console);

      console.log(`🔍 Navigating to: ${this.options.url}`);

      // Navigate to the page
      await Page.navigate({ url: this.options.url });

      // Wait for page load with timeout
      await this.waitForPageLoad(Page);

      // Give the app time to initialize
      console.log('⏳ Waiting for application to initialize...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Capture final state
      await this.capturePageState(Page, Runtime, Performance);

      this.results.success = this.results.jsErrors.length === 0 && this.results.networkErrors.length === 0;

      console.log('✅ Browser test completed');
      return this.results;

    } catch (error) {
      this.results.jsErrors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  setupEventListeners(Page, Runtime, Network, Console) {
    // Capture console logs
    Console.messageAdded((params) => {
      this.results.consoleLogs.push({
        level: params.message.level,
        text: params.message.text,
        timestamp: new Date().toISOString(),
        source: params.message.source
      });
    });

    // Capture JavaScript errors
    Runtime.exceptionThrown((params) => {
      this.results.jsErrors.push({
        message: params.exceptionDetails.text || 'Unknown error',
        stack: params.exceptionDetails.exception?.description || '',
        line: params.exceptionDetails.lineNumber,
        column: params.exceptionDetails.columnNumber,
        url: params.exceptionDetails.url,
        timestamp: new Date().toISOString()
      });
    });

    // Capture network errors
    Network.loadingFailed((params) => {
      this.results.networkErrors.push({
        url: params.request?.url || 'Unknown URL',
        errorText: params.errorText,
        timestamp: new Date().toISOString(),
        requestId: params.requestId
      });
    });

    // Capture failed responses
    Network.responseReceived((params) => {
      if (params.response.status >= 400) {
        this.results.networkErrors.push({
          url: params.response.url,
          status: params.response.status,
          statusText: params.response.statusText,
          timestamp: new Date().toISOString(),
          requestId: params.requestId
        });
      }
    });
  }

  async waitForPageLoad(Page) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Page load timeout after ${this.options.timeout} seconds`));
      }, this.options.timeout * 1000);

      Page.loadEventFired(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  async capturePageState(Page, Runtime, Performance) {
    try {
      // Capture HTML
      const htmlResult = await Runtime.evaluate({
        expression: 'document.documentElement.outerHTML',
        returnByValue: true
      });
      this.results.html = htmlResult.result.value;

      // Capture performance metrics
      const performanceResult = await Performance.getMetrics();
      this.results.performanceMetrics = performanceResult.metrics.reduce((acc, metric) => {
        acc[metric.name] = metric.value;
        return acc;
      }, {});

      // Take screenshot if not headless
      if (!this.options.headless) {
        const screenshot = await Page.captureScreenshot({ format: 'png' });
        this.results.screenshots.push({
          name: 'final-state',
          data: screenshot.data,
          timestamp: new Date().toISOString()
        });
      }

      console.log('✅ Page state captured');
    } catch (error) {
      console.warn(`⚠️  Failed to capture some page state: ${error.message}`);
    }
  }

  async cleanup() {
    if (this.client) {
      await this.client.close();
    }
    if (this.chrome) {
      await this.chrome.kill();
    }
  }
}

/**
 * Test Reporter - Generate test reports
 */
class TestReporter {
  static async generateReport(results, outputDir) {
    console.log('📊 Generating test report...');

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Write detailed JSON report
    const reportPath = path.join(outputDir, `test-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));

    // Write HTML report
    const htmlReportPath = path.join(outputDir, `test-report-${Date.now()}.html`);
    await this.writeHtmlReport(results, htmlReportPath);

    // Save screenshots
    for (const screenshot of results.screenshots) {
      const screenshotPath = path.join(outputDir, `${screenshot.name}-${Date.now()}.png`);
      await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    }

    console.log(`✅ Test report generated: ${reportPath}`);
    console.log(`✅ HTML report generated: ${htmlReportPath}`);

    return { reportPath, htmlReportPath };
  }

  static async writeHtmlReport(results, filePath) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quilt Catalog Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
        .header { background: ${results.success ? '#d4edda' : '#f8d7da'}; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .success { color: #155724; }
        .error { color: #721c24; }
        .section { margin-bottom: 30px; }
        .log-entry { background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 3px; font-family: monospace; }
        .error-entry { background: #f8d7da; color: #721c24; }
        .warning-entry { background: #fff3cd; color: #856404; }
        .info-entry { background: #d1ecf1; color: #0c5460; }
        pre { white-space: pre-wrap; word-break: break-all; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="${results.success ? 'success' : 'error'}">
            ${results.success ? '✅ Test Passed' : '❌ Test Failed'}
        </h1>
        <p><strong>URL:</strong> ${results.url}</p>
        <p><strong>Timestamp:</strong> ${results.timestamp}</p>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <ul>
            <li><strong>JavaScript Errors:</strong> ${results.jsErrors.length}</li>
            <li><strong>Network Errors:</strong> ${results.networkErrors.length}</li>
            <li><strong>Console Logs:</strong> ${results.consoleLogs.length}</li>
        </ul>
    </div>

    ${results.jsErrors.length > 0 ? `
    <div class="section">
        <h2>❌ JavaScript Errors</h2>
        ${results.jsErrors.map(error => `
        <div class="log-entry error-entry">
            <strong>${error.message}</strong><br>
            <small>${error.url}:${error.line}:${error.column}</small>
            ${error.stack ? `<pre>${error.stack}</pre>` : ''}
        </div>
        `).join('')}
    </div>
    ` : ''}

    ${results.networkErrors.length > 0 ? `
    <div class="section">
        <h2>🌐 Network Errors</h2>
        ${results.networkErrors.map(error => `
        <div class="log-entry error-entry">
            <strong>${error.url}</strong><br>
            ${error.status ? `Status: ${error.status} ${error.statusText}` : `Error: ${error.errorText}`}
        </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="section">
        <h2>📝 Console Logs</h2>
        ${results.consoleLogs.slice(-50).map(log => `
        <div class="log-entry ${log.level === 'error' ? 'error-entry' : log.level === 'warning' ? 'warning-entry' : 'info-entry'}">
            <strong>[${log.level.toUpperCase()}]</strong> ${log.text}
        </div>
        `).join('')}
    </div>

    ${Object.keys(results.performanceMetrics).length > 0 ? `
    <div class="section">
        <h2>⚡ Performance Metrics</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            ${Object.entries(results.performanceMetrics).map(([name, value]) => `
            <tr><td>${name}</td><td>${typeof value === 'number' ? value.toFixed(3) : value}</td></tr>
            `).join('')}
        </table>
    </div>
    ` : ''}
</body>
</html>
    `;

    await fs.writeFile(filePath, html);
  }

  static printSummary(results) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));

    if (results.success) {
      console.log('✅ Overall Status: PASSED');
    } else {
      console.log('❌ Overall Status: FAILED');
    }

    console.log(`🌐 URL Tested: ${results.url}`);
    console.log(`🕐 Timestamp: ${results.timestamp}`);
    console.log(`🚨 JavaScript Errors: ${results.jsErrors.length}`);
    console.log(`📡 Network Errors: ${results.networkErrors.length}`);
    console.log(`📝 Console Messages: ${results.consoleLogs.length}`);

    if (results.jsErrors.length > 0) {
      console.log('\n❌ JavaScript Errors:');
      results.jsErrors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error.message} (${error.url}:${error.line})`);
      });
    }

    if (results.networkErrors.length > 0) {
      console.log('\n🌐 Network Errors:');
      results.networkErrors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error.url} - ${error.status || error.errorText}`);
      });
    }

    console.log('='.repeat(60));
  }
}

/**
 * Main execution function
 */
async function main() {
  let serverManager = null;

  try {
    // Parse arguments
    const options = parseArgs();

    if (options.help) {
      showHelp();
      return;
    }

    console.log('🧪 Quilt Catalog Test Script');
    console.log('============================');
    console.log(`URL: ${options.url}`);
    console.log(`Timeout: ${options.timeout}s`);
    console.log(`Headless: ${options.headless}`);

    // Start server if needed
    if (!options.noServer) {
      serverManager = new ServerManager(options.port);
      await serverManager.start();
      console.log('✅ Server is ready');
    } else {
      console.log('⏭️  Skipping server startup (--no-server specified)');
    }

    // Run browser test
    const testManager = new BrowserTestManager(options);
    const results = await testManager.runTest();

    // Generate report
    const { reportPath, htmlReportPath } = await TestReporter.generateReport(results, OUTPUT_DIR);

    // Print summary
    TestReporter.printSummary(results);

    console.log(`\n📁 Full reports saved to: ${OUTPUT_DIR}`);
    console.log(`🌐 Open HTML report: ${htmlReportPath}`);

    // Exit with appropriate code
    process.exit(results.success ? 0 : 1);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\n💡 Troubleshooting tips:');
    console.error('   • Make sure Chrome is installed');
    console.error('   • Check if the port is already in use');
    console.error('   • Verify the catalog config is correct');
    console.error('   • Try running with --headless for CI environments');

    process.exit(1);
  } finally {
    // Clean up server
    if (serverManager) {
      await serverManager.stop();
    }
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  ServerManager,
  BrowserTestManager,
  TestReporter
};