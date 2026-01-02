#!/usr/bin/env node
/**
 * Fix common `any` type patterns in the codebase
 *
 * This script fixes common patterns of `any` usage:
 * 1. `(...args: any[])` → `(...args: unknown[])` for event handlers
 * 2. `data: any` → `data: unknown` for generic data
 * 3. `(event: any)` → `(event: Event | MatrixEvent)` for events
 * 4. `content: any` → `content: MatrixEventContent` for Matrix events
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { globSync } from 'glob'

const FIXES = [
  // Fix 1: Event handler args: any[] -> unknown[]
  {
    pattern: /\(\.\.\.args:\s*any\[\]\)/g,
    replacement: '(...args: unknown[])',
    description: 'Event handler args any[] -> unknown[]'
  },
  // Fix 2: Generic data: any -> unknown (but be careful with data properties)
  {
    pattern: /:\s*any(?=[,\)])/g,
    replacement: ': unknown',
    description: 'Standalone any -> unknown'
  },
  // Fix 3: content: any -> content: Record<string, unknown> or MatrixEventContent
  {
    pattern: /content:\s*any/g,
    replacement: 'content: Record<string, unknown>',
    description: 'content: any -> Record<string, unknown>'
  },
]

const SKIP_PATTERNS = [
  'node_modules',
  '.test.',
  '.spec.',
  'dist/',
  'coverage/',
]

function shouldSkipFile(file) {
  return SKIP_PATTERNS.some(pattern => file.includes(pattern))
}

function applyFixes(content, file) {
  let newContent = content
  let fixesApplied = 0

  for (const fix of FIXES) {
    const matches = content.match(fix.pattern)
    if (matches) {
      const before = newContent
      newContent = newContent.replace(fix.pattern, fix.replacement)
      if (before !== newContent) {
        fixesApplied += matches.length
        console.log(`  [${fix.description}] Fixed ${matches.length} occurrence(s)`)
      }
    }
  }

  return { content: newContent, fixesApplied }
}

function main() {
  console.log('🔧 Starting any type fixes...\n')

  const files = globSync('src/**/*.{ts,tsx,vue}', {
    ignore: ['**/node_modules/**', '**/dist/**'],
  })

  let totalFiles = 0
  let totalFixes = 0

  for (const file of files) {
    if (shouldSkipFile(file)) continue

    try {
      const content = readFileSync(file, 'utf-8')
      const { content: newContent, fixesApplied } = applyFixes(content, file)

      if (fixesApplied > 0) {
        writeFileSync(file, newContent)
        totalFiles++
        totalFixes += fixesApplied
        console.log(`✓ ${file} (${fixesApplied} fixes)`)
      }
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error.message)
    }
  }

  console.log(`\n✅ Done! Fixed ${totalFixes} any types in ${totalFiles} files.`)
}

main()
