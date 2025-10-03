/* eslint-disable no-console */
/**
 * JWTConfigValidator
 *
 * Legacy helper retained for tooling compatibility. The validator now confirms
 * that the application is configured with an MCP endpoint and no longer checks
 * for frontend signing secrets.
 */

import cfg from 'constants/config'

class JWTConfigValidator {
  constructor() {
    this.configChecked = false
    this.validationResult = null
  }

  validateConfig() {
    if (this.configChecked) return this.validationResult

    const issues = []
    const warnings = []
    const info = []

    if (!cfg.mcpEndpoint) {
      issues.push({
        severity: 'error',
        message: 'MCP endpoint (mcpEndpoint) is not configured',
        fix: 'Set MCP_ENDPOINT environment variable or add mcpEndpoint to catalog config',
        impact: 'MCP server connections will fail',
      })
    } else {
      info.push({
        severity: 'info',
        message: `MCP endpoint configured: ${cfg.mcpEndpoint}`,
      })
    }

    this.validationResult = {
      valid: issues.length === 0,
      hasWarnings: warnings.length > 0,
      issues,
      warnings,
      info,
      summary: issues.length
        ? `❌ Configuration has ${issues.length} critical issue(s) that must be fixed`
        : '✅ MCP configuration is valid',
    }

    this.configChecked = true
    return this.validationResult
  }

  printValidationResults() {
    const result = this.validateConfig()

    console.log('='.repeat(80))
    console.log('🔐 MCP CONFIGURATION VALIDATION')
    console.log('='.repeat(80))
    console.log(result.summary)
    console.log('')

    if (result.issues.length > 0) {
      console.log('❌ CRITICAL ISSUES:')
      result.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.message}`)
        console.log(`   Fix: ${issue.fix}`)
        console.log(`   Impact: ${issue.impact}`)
        console.log('')
      })
    }

    if (result.info.length > 0 && process.env.NODE_ENV === 'development') {
      console.log('ℹ️  INFORMATION:')
      result.info.forEach((item) => console.log(`   ${item.message}`))
      console.log('')
    }

    console.log('='.repeat(80))
    return result
  }
}

const jwtConfigValidator = new JWTConfigValidator()

export { JWTConfigValidator, jwtConfigValidator }
