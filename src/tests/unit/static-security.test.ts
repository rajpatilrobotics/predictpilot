/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  collectRepositoryFiles,
  collectSourceFiles,
  createTsxSourceFile,
  getStringJsxAttribute,
  projectRoot,
  sourceRoot,
} from './static-source-utils';

const forbiddenSourcePatterns = [
  {
    label: 'dangerouslySetInnerHTML',
    pattern: /\bdangerouslySetInnerHTML\b/,
    reason: 'Untrusted HTML should never be injected into the browser UI.',
  },
  {
    label: 'DOM innerHTML writes',
    pattern: /\.innerHTML\b/,
    reason: 'Use React rendering instead of direct HTML injection.',
  },
  {
    label: 'eval',
    pattern: /\beval\s*\(/,
    reason: 'Dynamic code execution is not needed in the client.',
  },
  {
    label: 'new Function',
    pattern: /\bnew\s+Function\b/,
    reason: 'Dynamic code execution is not needed in the client.',
  },
  {
    label: 'document.cookie',
    pattern: /\bdocument\.cookie\b/,
    reason: 'PredictPilot should not read or write browser cookies.',
  },
  {
    label: 'localStorage',
    pattern: /\blocalStorage\b/,
    reason: 'Wallet state and transaction proof should not be persisted in local storage.',
  },
  {
    label: 'sessionStorage',
    pattern: /\bsessionStorage\b/,
    reason: 'Wallet state and transaction proof should not be persisted in session storage.',
  },
  {
    label: 'Playwright auth state',
    pattern: /storageState\.json|playwright[/.]auth/i,
    reason: 'Browser auth state must never become app source.',
  },
] as const;

const forbiddenArtifactNames = [
  '.env.local',
  '.env.test',
  'storageState.json',
  'wallet-backup',
  'wallet_backup',
  'keystore',
  'mnemonic',
  'private-key',
  'private_key',
  'cookies',
] as const;

describe('static security regression checks', () => {
  it('keeps high-risk browser APIs out of non-test source files', () => {
    const violations = collectSourceFiles(sourceRoot)
      .flatMap((filePath) => {
        const source = readFileSync(filePath, 'utf8');
        const displayPath = relative(projectRoot, filePath);

        return forbiddenSourcePatterns
          .filter(({ pattern }) => pattern.test(source))
          .map(({ label, reason }) => `${displayPath}: ${label} - ${reason}`);
      })
      .sort();

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('keeps local secret and wallet artifacts out of the repository tree', () => {
    const violations = collectRepositoryFiles(projectRoot)
      .filter((filePath) => {
        const normalizedPath = relative(projectRoot, filePath).split(sep).join('/');
        const normalizedName = normalizedPath.toLowerCase();

        return forbiddenArtifactNames.some((artifactName) =>
          normalizedName.includes(artifactName.toLowerCase()),
        );
      })
      .map((filePath) => relative(projectRoot, filePath))
      .sort();

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('requires explicit button types for JSX button controls', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap(collectUntypedButtonControls)
      .sort();

    expect(violations, violations.join('\n')).toEqual([]);
  });
});

function collectUntypedButtonControls(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(sourceFile) === 'button') {
      const hasExplicitType = getStringJsxAttribute(node, 'type', sourceFile) !== undefined;

      if (!hasExplicitType) {
        const { character, line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        const displayPath = relative(projectRoot, filePath);
        violations.push(
          `${displayPath}:${line + 1}:${character + 1} - JSX button needs an explicit type`,
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}
