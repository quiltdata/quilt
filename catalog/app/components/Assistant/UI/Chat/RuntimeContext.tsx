/**
 * Runtime Context Configuration
 *
 * Allows customization of system prompts, rules, and instructions
 * that are injected into Qurator's context at runtime.
 */

import * as React from 'react'
import * as M from '@material-ui/core'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Refresh as ResetIcon,
} from '@material-ui/icons'

const useStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(2, 0),
    padding: t.spacing(0, 2),
  },
  section: {
    marginBottom: t.spacing(3),
  },
  sectionTitle: {
    ...t.typography.subtitle1,
    fontWeight: 600,
    marginBottom: t.spacing(1),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textarea: {
    fontFamily: 'monospace',
    fontSize: '13px',
  },
  rulesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(1),
  },
  rule: {
    display: 'flex',
    alignItems: 'center',
    gap: t.spacing(1),
    padding: t.spacing(1),
    background: t.palette.background.default,
    borderRadius: t.spacing(0.5),
    border: `1px solid ${t.palette.divider}`,
  },
  ruleText: {
    flexGrow: 1,
    ...t.typography.body2,
    fontFamily: 'monospace',
  },
  addButton: {
    marginTop: t.spacing(1),
  },
  actions: {
    display: 'flex',
    gap: t.spacing(1),
    marginTop: t.spacing(2),
  },
  preview: {
    marginTop: t.spacing(2),
    padding: t.spacing(2),
    background: t.palette.background.default,
    borderRadius: t.spacing(1),
    border: `1px solid ${t.palette.divider}`,
    fontFamily: 'monospace',
    fontSize: '12px',
    whiteSpace: 'pre-wrap',
    maxHeight: '300px',
    overflow: 'auto',
  },
}))

const DEFAULT_SYSTEM_PROMPT = `You are Qurator, an AI assistant for Quilt data management.
You help users work with S3 buckets, packages, and data operations.
Be helpful, concise, and accurate.`

const DEFAULT_RULES = [
  'Always verify bucket names before operations',
  'Suggest best practices for data organization',
  'Warn about potentially destructive operations',
]

export function RuntimeContext() {
  const classes = useStyles()

  const [systemPrompt, setSystemPrompt] = React.useState(
    localStorage.getItem('qurator-system-prompt') || DEFAULT_SYSTEM_PROMPT,
  )
  const [rules, setRules] = React.useState<string[]>(() => {
    const saved = localStorage.getItem('qurator-rules')
    return saved ? JSON.parse(saved) : DEFAULT_RULES
  })
  const [newRule, setNewRule] = React.useState('')
  const [customInstructions, setCustomInstructions] = React.useState(
    localStorage.getItem('qurator-custom-instructions') || '',
  )

  const handleSave = React.useCallback(() => {
    localStorage.setItem('qurator-system-prompt', systemPrompt)
    localStorage.setItem('qurator-rules', JSON.stringify(rules))
    localStorage.setItem('qurator-custom-instructions', customInstructions)
    alert('Runtime context saved! Restart conversation for changes to take effect.')
  }, [systemPrompt, rules, customInstructions])

  const handleReset = React.useCallback(() => {
    if (confirm('Reset to default configuration?')) {
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT)
      setRules(DEFAULT_RULES)
      setCustomInstructions('')
      localStorage.removeItem('qurator-system-prompt')
      localStorage.removeItem('qurator-rules')
      localStorage.removeItem('qurator-custom-instructions')
    }
  }, [])

  const handleAddRule = React.useCallback(() => {
    if (newRule.trim()) {
      setRules((prev) => [...prev, newRule.trim()])
      setNewRule('')
    }
  }, [newRule])

  const handleDeleteRule = React.useCallback((index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const compiledContext = React.useMemo(() => {
    const parts = [systemPrompt]

    if (rules.length > 0) {
      parts.push('\nRules:')
      rules.forEach((rule, i) => {
        parts.push(`${i + 1}. ${rule}`)
      })
    }

    if (customInstructions.trim()) {
      parts.push('\nCustom Instructions:')
      parts.push(customInstructions)
    }

    return parts.join('\n')
  }, [systemPrompt, rules, customInstructions])

  return (
    <div className={classes.root}>
      <M.Typography variant="h6" gutterBottom>
        Runtime Context Configuration
      </M.Typography>
      <M.Typography variant="body2" color="textSecondary" gutterBottom>
        Customize Qurator's behavior by modifying the system prompt and rules
      </M.Typography>

      {/* System Prompt */}
      <div className={classes.section}>
        <div className={classes.sectionTitle}>System Prompt</div>
        <M.TextField
          multiline
          rows={4}
          fullWidth
          variant="outlined"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Enter system prompt..."
          InputProps={{ classes: { input: classes.textarea } }}
        />
      </div>

      {/* Rules */}
      <div className={classes.section}>
        <div className={classes.sectionTitle}>
          Rules
          <M.Typography variant="caption" color="textSecondary">
            {rules.length} rule{rules.length !== 1 ? 's' : ''}
          </M.Typography>
        </div>
        <div className={classes.rulesList}>
          {rules.map((rule, index) => (
            <div key={index} className={classes.rule}>
              <span className={classes.ruleText}>
                {index + 1}. {rule}
              </span>
              <M.IconButton size="small" onClick={() => handleDeleteRule(index)}>
                <DeleteIcon fontSize="small" />
              </M.IconButton>
            </div>
          ))}
        </div>
        <M.TextField
          fullWidth
          size="small"
          variant="outlined"
          placeholder="Add new rule..."
          value={newRule}
          onChange={(e) => setNewRule(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddRule()}
          className={classes.addButton}
          InputProps={{
            endAdornment: (
              <M.IconButton
                size="small"
                onClick={handleAddRule}
                disabled={!newRule.trim()}
              >
                <AddIcon />
              </M.IconButton>
            ),
          }}
        />
      </div>

      {/* Custom Instructions */}
      <div className={classes.section}>
        <div className={classes.sectionTitle}>Custom Instructions</div>
        <M.TextField
          multiline
          rows={6}
          fullWidth
          variant="outlined"
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder="Additional instructions, constraints, or preferences..."
          helperText="Freeform text that will be appended to the system context"
          InputProps={{ classes: { input: classes.textarea } }}
        />
      </div>

      {/* Actions */}
      <div className={classes.actions}>
        <M.Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSave}
        >
          Save Configuration
        </M.Button>
        <M.Button variant="outlined" startIcon={<ResetIcon />} onClick={handleReset}>
          Reset to Defaults
        </M.Button>
      </div>

      {/* Preview */}
      <div className={classes.section}>
        <div className={classes.sectionTitle} style={{ marginTop: 16 }}>
          Compiled Context Preview
        </div>
        <div className={classes.preview}>{compiledContext}</div>
      </div>
    </div>
  )
}
