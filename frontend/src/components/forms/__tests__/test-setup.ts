// Test setup file to provide Jest-like globals.
// `var` is required here: only `var` declarations in a `declare global` block
// augment `typeof globalThis`, which the `global.*` assignments below rely on.
interface Matchers {
  toBe: (expected: unknown) => void
  toEqual: (expected: unknown) => void
  toBeDefined: () => void
  toBeUndefined: () => void
  toBeTruthy: () => void
  toBeFalsy: () => void
  toContain: (expected: unknown) => void
  toThrow: (expectedError?: string) => void
}

/* eslint-disable no-var */
declare global {
  var describe: (name: string, fn: () => void) => void
  var it: (name: string, fn: () => void) => void
  var expect: (actual: unknown) => Matchers
  var beforeEach: (fn: () => void) => void
  var afterEach: (fn: () => void) => void
  var beforeAll: (fn: () => void) => void
  var afterAll: (fn: () => void) => void
}
/* eslint-enable no-var */

// Simple test runner implementation
const tests: Array<{ name: string; fn: () => void; describe?: string }> = []
let currentDescribe = ''

function describe(name: string, fn: () => void) {
  const previousDescribe = currentDescribe
  currentDescribe = name
  fn()
  currentDescribe = previousDescribe
}

function it(name: string, fn: () => void) {
  tests.push({ name, fn, describe: currentDescribe })
}

function expect(actual: unknown): Matchers {
  return {
    toBe: (expected: unknown) => {
      if (actual !== expected) {
        throw new Error(`Expected ${actual} to be ${expected}`)
      }
    },
    toEqual: (expected: unknown) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
          `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`
        )
      }
    },
    toBeDefined: () => {
      if (actual === undefined) {
        throw new Error(`Expected ${actual} to be defined`)
      }
    },
    toBeUndefined: () => {
      if (actual !== undefined) {
        throw new Error(`Expected ${actual} to be undefined`)
      }
    },
    toBeTruthy: () => {
      if (!actual) {
        throw new Error(`Expected ${actual} to be truthy`)
      }
    },
    toBeFalsy: () => {
      if (actual) {
        throw new Error(`Expected ${actual} to be falsy`)
      }
    },
    toContain: (expected: unknown) => {
      if (typeof actual === 'string' && typeof expected === 'string') {
        if (!actual.includes(expected)) {
          throw new Error(`Expected "${actual}" to contain "${expected}"`)
        }
      } else {
        throw new Error(`toContain only works with strings`)
      }
    },
    toThrow: (expectedError?: string) => {
      try {
        if (typeof actual === 'function') {
          actual()
        }
        throw new Error('Expected function to throw')
      } catch (error) {
        if (
          expectedError &&
          error instanceof Error &&
          !error.message.includes(expectedError)
        ) {
          throw new Error(
            `Expected error to contain "${expectedError}", but got "${error.message}"`
          )
        }
      }
    },
  }
}

function beforeEach(fn: () => void) {
  // Simple implementation - just run the function
  fn()
}

function afterEach(fn: () => void) {
  // Simple implementation - just run the function
  fn()
}

function beforeAll(fn: () => void) {
  // Simple implementation - just run the function
  fn()
}

function afterAll(fn: () => void) {
  // Simple implementation - just run the function
  fn()
}

// Export the test runner
export function runTests() {
  let passed = 0
  let failed = 0

  for (const test of tests) {
    try {
      test.fn()
      passed++
    } catch (error) {
      failed++
    }
  }

  return { passed, failed }
}

// Make globals available
global.describe = describe
global.it = it
global.expect = expect
global.beforeEach = beforeEach
global.afterEach = afterEach
global.beforeAll = beforeAll
global.afterAll = afterAll
