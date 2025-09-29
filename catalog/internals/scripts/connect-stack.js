#!/usr/bin/env node

/**
 * Connect to Quilt Stack Script
 *
 * This script connects to a Quilt stack by:
 * 1. Getting the stack URL from quilt3 CLI command (quilt3 config)
 * 2. Extracting and validating stack URL from the config
 * 3. Handling browser-based authentication (automated with Chrome DevTools)
 * 4. Generating a config.json compatible with the catalog Config.ts structure
 * 5. Writing config to static-dev/config.js for webpack dev server
 *
 * Usage:
 *   node connect-stack.js [options]
 *
 * Options:
 *   --stack <url>      Stack URL to connect to (overrides quilt3 config)
 *   --no-auth          Skip authentication flow
 *   --help             Show help
 */

const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const chromeLauncher = require('chrome-launcher');
const CDP = require('chrome-remote-interface');
const minimist = require('minimist');

// Configuration constants
const STATIC_DEV_DIR = path.resolve(__dirname, '../../static-dev');
const CONFIG_OUTPUT_PATH = path.join(STATIC_DEV_DIR, 'config.js');

/**
 * Show help message
 */
function showHelp() {
  console.log(`Connect to Quilt Stack Script

Usage:
  node connect-stack.js [options]

Options:
  --stack <url>      Stack URL to connect to (overrides quilt3 config)
  --no-auth          Skip authentication flow
  --manual-auth      Use manual credential collection (fallback mode)
  --help, -h         Show this help message

Examples:
  node connect-stack.js
  node connect-stack.js --stack https://my-stack.example.com
  node connect-stack.js --no-auth`);
}


/**
 * Get stack URL from quilt3 config CLI
 */
async function getQuilt3StackUrl() {
  console.log('Getting stack URL from quilt3 config...');

  // Try different methods to run quilt3
  const commands = [
    'quilt3 config',
    'PYENV_VERSION=3.9.23 quilt3 config',
    'PYENV_VERSION=3.12.11 quilt3 config',
    'python3 -m quilt3 config',
    'python -m quilt3 config'
  ];

  for (const cmd of commands) {
    try {
      const { stdout } = await exec(cmd);
      const url = stdout.trim();

      // Validate it's a URL
      return validateUrl(url);
    } catch (e) {
      // Try next command
    }
  }

  throw new Error('Failed to get stack URL from quilt3 config. Please install quilt3 or use --stack option.');
}

/**
 * Validate and clean a stack URL
 */
function validateUrl(url) {
  try {
    const parsedUrl = new URL(url);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('URL must use http or https protocol');
    }

    // Remove trailing slash for consistency
    const cleanUrl = url.replace(/\/$/, '');
    console.log(`✅ Validated stack URL: ${cleanUrl}`);
    return cleanUrl;
  } catch (error) {
    throw new Error(`Invalid stack URL "${url}": ${error.message}`);
  }
}

/**
 * Base Credential Collector - Common credential extraction functionality
 */
class CredentialCollector {
  constructor(stackUrl) {
    this.stackUrl = stackUrl;
    this.credentials = null;
  }

  async collect() {
    console.log('🔐 Starting credential collection...');

    try {
      // First check if credentials already exist
      console.log('📍 Checking for existing credentials...');

      if (await this.checkExistingCredentials()) {
        console.log('✅ Using existing valid credentials, skipping collection');
        return;
      }

      // Delegate to subclass implementation
      await this.performCollection();

    } catch (error) {
      throw new Error(`Credential collection failed: ${error.message}`);
    }
  }

  // Abstract method - must be implemented by subclasses
  async performCollection() {
    throw new Error('performCollection must be implemented by subclass');
  }

  parseAndValidateCredentials(tokensInput, userInput) {
    let tokens, user;

    // Parse TOKENS
    try {
      tokens = JSON.parse(tokensInput.trim());
      if (!tokens || typeof tokens !== 'object') {
        throw new Error('TOKENS must be a valid JSON object');
      }
      console.log('✅ TOKENS parsed successfully');
    } catch (error) {
      throw new Error(`Invalid TOKENS format: ${error.message}`);
    }

    // Parse USER
    try {
      user = JSON.parse(userInput.trim());
      if (!user || typeof user !== 'object') {
        throw new Error('USER must be a valid JSON object');
      }
      if (!user.current_user) {
        throw new Error('USER object must contain current_user field');
      }
      console.log('✅ USER parsed successfully');
    } catch (error) {
      throw new Error(`Invalid USER format: ${error.message}`);
    }

    return { tokens, user };
  }

  async checkExistingCredentials() {
    try {
      const configPath = path.join(STATIC_DEV_DIR, 'config.js');

      // Check if config file exists
      if (!await fs.access(configPath).then(() => true).catch(() => false)) {
        console.log('📍 No existing config file found');
        return false;
      }

      // Read and parse the config file
      const configContent = await fs.readFile(configPath, 'utf8');

      // Extract credentials from the config file
      const credentialsMatch = configContent.match(/window\.QUILT_AUTH_CREDENTIALS = ({[\s\S]*?});/);
      if (!credentialsMatch) {
        console.log('📍 No credentials found in existing config');
        return false;
      }

      // Use JSON.parse to safely parse the credentials object
      let credentialsData;
      try {
        credentialsData = JSON.parse(credentialsMatch[1]);
      } catch (parseError) {
        console.log(`📍 Could not parse existing credentials: ${parseError.message}`);
        return false;
      }

      // Check if token is still valid (not expired)
      if (credentialsData.tokens && credentialsData.tokens.exp) {
        const now = Math.floor(Date.now() / 1000);
        const exp = credentialsData.tokens.exp;

        if (exp > now + 300) { // Token valid for at least 5 more minutes
          console.log('✅ Found valid existing credentials');
          console.log(`   Token expires: ${new Date(exp * 1000).toLocaleString()}`);

          // Store the credentials for reuse
          this.credentials = {
            tokens: credentialsData.tokens,
            user: credentialsData.user
          };

          return true;
        } else {
          console.log('⏰ Existing credentials are expired or expiring soon');
          return false;
        }
      }

      console.log('📍 Existing credentials format not recognized');
      return false;

    } catch (error) {
      console.log(`📍 Could not check existing credentials: ${error.message}`);
      return false;
    }
  }

  getStoredCredentials() {
    return this.credentials;
  }

  static create(stackUrl, useInteractive = false) {
    if (useInteractive) {
      return new InteractiveCredentialCollector(stackUrl);
    } else {
      return new ChromeCredentialCollector(stackUrl);
    }
  }
}

/**
 * Chrome DevTools Credential Collector - Automated credential extraction via Chrome
 */
class ChromeCredentialCollector extends CredentialCollector {
  async performCollection() {
    console.log(`
${'='.repeat(80)}
🤖 AUTOMATED AUTHENTICATION WITH CHROME DEVTOOLS
${'='.repeat(80)}

✨ This script will now automatically:
   • Launch Chrome browser with the login page
   • Monitor localStorage for authentication credentials
   • Extract credentials automatically once you log in

📍 You only need to complete the login process!`);

    try {
      this.credentials = await this.getCredentialsFromUser();
      console.log('✅ Authentication credentials received and validated');
    } catch (error) {
      console.log(`❌ Automated credential collection failed: ${error.message}

💡 Fallback: You can try the following options:
   1. Run the script again (Chrome might not have launched properly)
   2. Use --manual-auth flag for manual credential collection
   3. Use --no-auth flag to skip authentication
   4. Ensure Chrome is installed and accessible
   5. Check if the stack URL is correct and accessible`);
      throw error;
    }
  }

  async getCredentialsFromUser() {
    console.log('🚀 Starting automated credential collection with Chrome DevTools...');

    let chrome = null;
    let client = null;

    try {
      // Launch Chrome with DevTools enabled
      console.log('🌐 Launching Chrome browser...');
      chrome = await chromeLauncher.launch({
        chromeFlags: [
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--no-first-run',
          '--no-default-browser-check'
        ],
        startingUrl: `${this.stackUrl}/login`
      });

      console.log(`✅ Chrome launched on port ${chrome.port}`);

      // Connect to Chrome DevTools Protocol
      client = await CDP({ port: chrome.port });
      const { Page, Runtime } = client;

      // Enable necessary domains
      await Page.enable();
      await Runtime.enable();

      console.log(`⏳ Waiting for user to complete authentication...
   Please complete the login process in the browser window that opened.
   This script will automatically detect when credentials are available.`);

      // Wait for authentication and extract credentials
      const credentials = await this.waitForCredentials(Page, Runtime);

      console.log('✅ Credentials automatically extracted!');
      return credentials;

    } catch (error) {
      throw new Error(`Automated credential collection failed: ${error.message}`);
    } finally {
      // Clean up - ensure proper shutdown sequence
      console.log('🧹 Cleaning up Chrome processes...');

      if (client) {
        try {
          await client.close();
          console.log('✅ Chrome DevTools connection closed');
        } catch (error) {
          console.log(`⚠️  Error closing Chrome DevTools: ${error.message}`);
        }
      }

      if (chrome) {
        try {
          await chrome.kill();
          console.log('✅ Chrome process terminated');

          // Wait a bit to ensure Chrome fully shuts down
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('✅ Chrome cleanup completed');
        } catch (error) {
          console.log(`⚠️  Error killing Chrome: ${error.message}`);
        }
      }
    }
  }

  async waitForCredentials(Page, Runtime, maxAttempts = 60, intervalMs = 2000) {
    console.log('🔍 Monitoring localStorage for authentication credentials...');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Execute script to check localStorage
        const result = await Runtime.evaluate({
          expression: `
            (() => {
              try {
                const tokens = localStorage.getItem('TOKENS');
                const user = localStorage.getItem('USER');

                if (tokens && user) {
                  return {
                    success: true,
                    tokens: JSON.parse(tokens),
                    user: JSON.parse(user)
                  };
                }
                return { success: false, message: 'Credentials not yet available' };
              } catch (e) {
                return { success: false, message: e.message };
              }
            })()
          `,
          returnByValue: true
        });

        if (result.result && result.result.value) {
          const data = result.result.value;

          if (data.success) {
            console.log(`✅ Credentials detected after ${attempt} attempts`);

            // Validate the credentials
            return this.parseAndValidateCredentials(
              JSON.stringify(data.tokens),
              JSON.stringify(data.user)
            );
          }
        }

        // Show progress every 10 attempts
        if (attempt % 10 === 0) {
          console.log(`   Still waiting... (attempt ${attempt}/${maxAttempts})`);
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, intervalMs));

      } catch (error) {
        console.log(`   Attempt ${attempt} failed: ${error.message}`);
      }
    }

    throw new Error(`Timeout: Credentials not detected after ${maxAttempts} attempts (${(maxAttempts * intervalMs) / 1000} seconds)`);
  }

}

/**
 * Interactive Credential Collector - Manual credential extraction via user input
 */
class InteractiveCredentialCollector extends CredentialCollector {
  async performCollection() {
    console.log('📋 Using interactive credential collection mode...');
    this.credentials = await this.getCredentialsFromUser();
  }

  async getCredentialsFromUser() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise((resolve) => {
      rl.question(prompt, resolve);
    });

    try {
      // Open browser manually
      const { exec } = require('child_process');
      const loginUrl = `${this.stackUrl}/login`;
      const openCommand = process.platform === 'darwin' ? 'open' :
                          process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${openCommand} ${JSON.stringify(loginUrl)}`);

      console.log(`🔑 Manual credential collection mode
📋 INSTRUCTIONS TO GET CREDENTIALS:
   1. Complete the login in your browser
   2. Open Developer Tools (F12 or Cmd+Option+I on Mac)
   3. Go to the "Application" or "Storage" tab
   4. Expand "Local Storage" on the left
   5. Click on "${this.stackUrl}"
   6. Look for these keys: TOKENS and USER
   7. Copy the VALUES (not the keys) for both
`);

      // Get TOKENS
      console.log('Step 1: Paste the value of the TOKENS key:');
      const tokensInput = await question('TOKENS value: ');

      // Get USER
      console.log('\nStep 2: Paste the value of the USER key:');
      const userInput = await question('USER value: ');

      rl.close();

      // Parse and validate the credentials
      const credentials = this.parseAndValidateCredentials(tokensInput, userInput);

      return credentials;
    } catch (error) {
      rl.close();
      throw error;
    }
  }

}

/**
 * Config Generator - Create ConfigJson-compatible configuration
 */
class ConfigGenerator {
  constructor(stackUrl, auth = true, credentials = null) {
    this.stackUrl = stackUrl;
    this.auth = auth;
    this.credentials = credentials;
  }

  async generateConfig() {
    console.log('⚙️  Generating catalog configuration...');

    // Try to fetch stack information
    let stackInfo = null;
    try {
      stackInfo = await this.fetchStackInfo();
      console.log('✅ Successfully fetched stack information');
    } catch (error) {
      console.log(`⚠️  Could not fetch stack info: ${error.message}`);
      console.log('   Using default configuration values');
    }

    // Build configuration matching ConfigJson interface
    // Use server config as base, but override for local development
    const config = {
      // Required fields from server config
      region: stackInfo?.region || 'us-east-1',
      mode: 'LOCAL', // Override to LOCAL for development mode
      alwaysRequiresAuth: this.auth,
      serviceBucket: stackInfo?.serviceBucket || 'quilt-example',

      // CRITICAL: Use server's actual endpoints, not derived ones
      apiGatewayEndpoint: stackInfo?.apiGatewayEndpoint || `${this.stackUrl}/api`,
      registryUrl: stackInfo?.registryUrl || this.stackUrl,
      s3Proxy: stackInfo?.s3Proxy || `${this.stackUrl}/proxy`,

      // Use empty for local dev to avoid tracking
      mixpanelToken: '',

      // Auth settings from server
      passwordAuth: stackInfo?.passwordAuth || 'ENABLED',
      ssoAuth: stackInfo?.ssoAuth || 'DISABLED',
      ssoProviders: stackInfo?.ssoProviders || '',
      stackVersion: stackInfo?.stackVersion || '1.0.0',

      // Optional fields for development
      noDownload: false,
      noOverviewImages: false,
      chunkedChecksums: stackInfo?.chunkedChecksums !== undefined ? stackInfo.chunkedChecksums : true,
      qurator: stackInfo?.qurator || false
    };

    console.log(`✅ Generated catalog configuration
   📍 Registry URL: ${config.registryUrl}
   📍 API Gateway: ${config.apiGatewayEndpoint}
   📍 S3 Proxy: ${config.s3Proxy}
   📍 GraphQL will be: ${config.registryUrl}/graphql`);
    return { config, credentials: this.credentials };
  }

  async fetchStackInfo() {
    const https = require('https');
    const http = require('http');

    return new Promise((resolve, reject) => {
      const configUrl = `${this.stackUrl}/config.json`;
      console.log(`🔍 Fetching stack config from: ${configUrl}`);

      const client = this.stackUrl.startsWith('https:') ? https : http;
      const request = client.get(configUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Quilt-Catalog-Connect-Script/1.0.0'
        }
      }, (response) => {
        if (response.statusCode === 200) {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try {
              const config = JSON.parse(data);
              resolve(config);
            } catch (error) {
              reject(new Error('Invalid JSON response from stack'));
            }
          });
        } else {
          reject(new Error(`Stack returned status ${response.statusCode}`));
        }
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });

      request.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });
    });
  }

  async writeConfigFile(config, outputPath) {
    console.log(`📝 Writing config to: ${outputPath}`);

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Generate JavaScript file that sets window config and credentials
    let configJs = `// Auto-generated by connect-stack.js
// Do not edit this file directly
window.QUILT_CATALOG_CONFIG = ${JSON.stringify(config, null, 2)};
`;

    // If credentials are provided, add them to localStorage simulation
    if (this.credentials) {
      configJs += `
// Authentication credentials from Stack
// These would normally be in localStorage, but we're injecting them here for dev
window.QUILT_AUTH_CREDENTIALS = {
  tokens: ${JSON.stringify(this.credentials.tokens, null, 2)},
  user: ${JSON.stringify(this.credentials.user, null, 2)}
};

// Inject credentials into localStorage when the page loads
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    localStorage.setItem('TOKENS', JSON.stringify(window.QUILT_AUTH_CREDENTIALS.tokens));
    localStorage.setItem('USER', JSON.stringify(window.QUILT_AUTH_CREDENTIALS.user));
    console.log('✅ Authentication credentials loaded from connect-stack.js');
  } catch (e) {
    console.error('Failed to set auth credentials in localStorage:', e);
  }
}
`;
    }

    configJs += `console.log('📦 Quilt catalog config loaded from connect-stack.js');
`;

    await fs.writeFile(outputPath, configJs, 'utf8');
    console.log('✅ Config file written successfully');
    if (this.credentials) {
      console.log('✅ Authentication credentials included');
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Check platform compatibility
    if (process.platform === 'win32') {
      console.error('❌ Windows is not supported for connect-stack.js. Please run this script from macOS or Linux.');
      process.exit(1);
    }

    // Parse command line arguments
    const options = minimist(process.argv.slice(2), {
      boolean: ['no-auth', 'manual-auth', 'help'],
      string: ['stack'],
      alias: { h: 'help' }
    });

    if (options.help) {
      showHelp();
      return;
    }

    console.log('🚀 Quilt Stack Connection Script');
    console.log('================================');

    // Get stack URL
    const stackUrl = options.stack
      ? validateUrl(options.stack)
      : await getQuilt3StackUrl();

    // Step 3: Handle authentication
    let credentials = null;
    if (!options['no-auth']) {
      const credentialCollector = CredentialCollector.create(stackUrl, options['manual-auth']);
      await credentialCollector.collect();
      credentials = credentialCollector.getStoredCredentials();
    } else {
      console.log('⏭️  Skipping authentication (--no-auth specified)');
    }

    // Step 4: Generate and write config
    const configGenerator = new ConfigGenerator(stackUrl, !options['no-auth'], credentials);
    const { config: catalogConfig } = await configGenerator.generateConfig();
    await configGenerator.writeConfigFile(catalogConfig, CONFIG_OUTPUT_PATH);

    console.log('');
    console.log('🎉 Successfully connected to Quilt stack!');
    console.log(`   Stack URL: ${stackUrl}`);
    console.log(`   Config written to: ${CONFIG_OUTPUT_PATH}`);
    console.log('');
    console.log('💡 Next steps:');
    console.log('   Run "npm run start" to launch the development server');
    console.log('   Or run "npm run start:connected" to connect and start in one command');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('💡 Try running with --help for usage information');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  getQuilt3StackUrl,
  validateUrl,
  CredentialCollector,
  ChromeCredentialCollector,
  InteractiveCredentialCollector,
  ConfigGenerator
};
