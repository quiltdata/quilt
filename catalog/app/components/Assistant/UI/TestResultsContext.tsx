/**
 * Test Results Context
 *
 * Provides a centralized way to collect and access test results from all test components
 * in the Developer Tools section.
 */

import * as React from 'react'

export interface TestResult {
  testName: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  message: string
  details?: any
  duration?: number
  timestamp?: string
}

export interface TestSuite {
  suiteName: string
  tests: TestResult[]
  overallStatus: 'pending' | 'running' | 'passed' | 'failed'
  startTime?: number
  endTime?: number
}

interface TestResultsContextValue {
  testSuites: TestSuite[]
  registerTestSuite: (suite: TestSuite) => void
  updateTestSuite: (suiteName: string, updates: Partial<TestSuite>) => void
  clearAllResults: () => void
  getAllResults: () => TestSuite[]
}

const TestResultsContext = React.createContext<TestResultsContextValue | null>(null)

export function TestResultsProvider({ children }: { children: React.ReactNode }) {
  const [testSuites, setTestSuites] = React.useState<TestSuite[]>([])

  const registerTestSuite = React.useCallback((suite: TestSuite) => {
    setTestSuites((prev) => {
      // Replace if exists, otherwise add
      const existingIndex = prev.findIndex((s) => s.suiteName === suite.suiteName)
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = suite
        return updated
      }
      return [...prev, suite]
    })
  }, [])

  const updateTestSuite = React.useCallback(
    (suiteName: string, updates: Partial<TestSuite>) => {
      setTestSuites((prev) =>
        prev.map((suite) =>
          suite.suiteName === suiteName ? { ...suite, ...updates } : suite,
        ),
      )
    },
    [],
  )

  const clearAllResults = React.useCallback(() => {
    setTestSuites([])
  }, [])

  const getAllResults = React.useCallback(() => testSuites, [testSuites])

  const value = React.useMemo(
    () => ({
      testSuites,
      registerTestSuite,
      updateTestSuite,
      clearAllResults,
      getAllResults,
    }),
    [testSuites, registerTestSuite, updateTestSuite, clearAllResults, getAllResults],
  )

  return (
    <TestResultsContext.Provider value={value}>{children}</TestResultsContext.Provider>
  )
}

export function useTestResults() {
  const context = React.useContext(TestResultsContext)
  if (!context) {
    throw new Error('useTestResults must be used within TestResultsProvider')
  }
  return context
}
