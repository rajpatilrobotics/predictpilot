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
    label: 'DOM outerHTML writes',
    pattern: /\.outerHTML\b/,
    reason: 'Use React rendering instead of direct HTML replacement.',
  },
  {
    label: 'DOM insertAdjacentHTML writes',
    pattern: /\.insertAdjacentHTML\b/,
    reason: 'Use React rendering instead of direct HTML insertion.',
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
    label: 'alert',
    pattern: /\balert\s*\(/,
    reason: 'Use PredictPilot state panels or modals instead of blocking browser dialogs.',
  },
  {
    label: 'confirm',
    pattern: /\bconfirm\s*\(/,
    reason: 'Use PredictPilot state panels or modals instead of blocking browser dialogs.',
  },
  {
    label: 'prompt',
    pattern: /\bprompt\s*\(/,
    reason: 'Use controlled form inputs instead of blocking browser prompts.',
  },
  {
    label: 'document.cookie',
    pattern: /\bdocument\.cookie\b/,
    reason: 'PredictPilot should not read or write browser cookies.',
  },
  {
    label: 'window.open',
    pattern: /\bwindow\.open\b/,
    reason: 'Use explicit anchor links with noopener/noreferrer instead of imperative popups.',
  },
  {
    label: 'XMLHttpRequest',
    pattern: /\bXMLHttpRequest\b/,
    reason: 'Use the centralized typed HTTP client for browser network reads.',
  },
  {
    label: 'WebSocket',
    pattern: /\bWebSocket\b/,
    reason: 'Streaming transports must be introduced through a reviewed integration boundary.',
  },
  {
    label: 'EventSource',
    pattern: /\bEventSource\b/,
    reason: 'Streaming transports must be introduced through a reviewed integration boundary.',
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

const browserCleanupApiPairs = [
  {
    createLabel: 'addEventListener',
    createPattern: /\baddEventListener\s*\(/,
    cleanupLabel: 'removeEventListener',
    cleanupPattern: /\bremoveEventListener\s*\(/,
    reason: 'event listeners need matching cleanup to avoid stale route or wallet handlers.',
  },
  {
    createLabel: 'setInterval',
    createPattern: /\bsetInterval\s*\(/,
    cleanupLabel: 'clearInterval',
    cleanupPattern: /\bclearInterval\s*\(/,
    reason: 'interval polling must be cancellable when a component or request stops.',
  },
  {
    createLabel: 'setTimeout',
    createPattern: /\bsetTimeout\s*\(/,
    cleanupLabel: 'clearTimeout',
    cleanupPattern: /\bclearTimeout\s*\(/,
    reason: 'timeouts should be cleared when the guarded work exits.',
  },
  {
    createLabel: 'requestAnimationFrame',
    createPattern: /\brequestAnimationFrame\s*\(/,
    cleanupLabel: 'cancelAnimationFrame',
    cleanupPattern: /\bcancelAnimationFrame\s*\(/,
    reason: 'animation frames need matching cleanup to avoid background UI work.',
  },
] as const;

const forbiddenUiProtocolPatterns = [
  {
    label: 'Sui object or package ID',
    pattern: /\b0x[a-fA-F0-9]{20,}\b/,
  },
  {
    label: 'public URL',
    pattern: /\bhttps?:\/\//,
  },
  {
    label: 'concrete Move type',
    pattern: /\b0x[a-fA-F0-9]+::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*\b/,
  },
] as const;

const uiSourceRoots = ['src/app/', 'src/components/', 'src/features/'] as const;

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

  it('keeps protocol IDs, URLs, and coin types out of UI source files', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter(isUiSourceFile)
      .flatMap(collectHardcodedProtocolIdentifiers)
      .sort();

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('keeps direct fetch calls behind the centralized HTTP client', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => !isCentralHttpClient(filePath))
      .flatMap(collectDirectFetchCalls)
      .sort();

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('keeps direct console calls behind the telemetry-safe logger', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => !isCentralLogger(filePath))
      .flatMap(collectDirectConsoleCalls)
      .sort();

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('keeps browser lifecycle APIs paired with local cleanup', () => {
    const violations = collectSourceFiles(sourceRoot)
      .flatMap(collectUnpairedBrowserCleanupApis)
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

  it('requires accessible labels for JSX form controls', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap(collectUnlabeledFormControls)
      .sort();

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('requires safe rel attributes for external blank-target links', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap(collectUnsafeBlankTargetLinks)
      .sort();

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('prevents unsafe placeholder or script-like anchor hrefs', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap(collectUnsafeAnchorHrefs)
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

function collectUnlabeledFormControls(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);

      if (isFormControlTag(tagName) && !hasAccessibleFormControlLabel(node, sourceFile)) {
        const { character, line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        const displayPath = relative(projectRoot, filePath);
        violations.push(
          `${displayPath}:${line + 1}:${character + 1} - ${tagName} control needs a label wrapper, aria-label, or aria-labelledby`,
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function isUiSourceFile(filePath: string): boolean {
  const displayPath = relative(projectRoot, filePath).split(sep).join('/');

  return uiSourceRoots.some((sourceRootPath) => displayPath.startsWith(sourceRootPath));
}

function isCentralHttpClient(filePath: string): boolean {
  return relative(projectRoot, filePath).split(sep).join('/') === 'src/lib/http.ts';
}

function isCentralLogger(filePath: string): boolean {
  return relative(projectRoot, filePath).split(sep).join('/') === 'src/lib/logger.ts';
}

function collectDirectFetchCalls(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'fetch'
    ) {
      const { character, line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      const displayPath = relative(projectRoot, filePath);
      violations.push(
        `${displayPath}:${line + 1}:${character + 1} - use src/lib/http.ts so network responses stay timeout/retry/schema validated`,
      );
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function collectDirectConsoleCalls(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(sourceFile) === 'console'
    ) {
      const { character, line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      const displayPath = relative(projectRoot, filePath);
      violations.push(
        `${displayPath}:${line + 1}:${character + 1} - use appLogger so logs stay sanitized and disabled in production`,
      );
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function collectHardcodedProtocolIdentifiers(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8');
  const displayPath = relative(projectRoot, filePath);
  const violations: string[] = [];

  source.split(/\r?\n/).forEach((lineText, index) => {
    forbiddenUiProtocolPatterns.forEach(({ label, pattern }) => {
      if (pattern.test(lineText)) {
        violations.push(
          `${displayPath}:${index + 1} - ${label} must come from config or integration modules`,
        );
      }
    });
  });

  return violations;
}

function collectUnpairedBrowserCleanupApis(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8');
  const displayPath = relative(projectRoot, filePath);

  return browserCleanupApiPairs
    .filter(
      ({ cleanupPattern, createPattern }) =>
        createPattern.test(source) && !cleanupPattern.test(source),
    )
    .map(
      ({ cleanupLabel, createLabel, reason }) =>
        `${displayPath}: ${createLabel} requires ${cleanupLabel} - ${reason}`,
    );
}

function collectUnsafeBlankTargetLinks(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(sourceFile) === 'a') {
      const target = getStringJsxAttribute(node, 'target', sourceFile);

      if (target === '_blank' && !hasSafeBlankTargetRel(node, sourceFile)) {
        const { character, line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        const displayPath = relative(projectRoot, filePath);
        violations.push(
          `${displayPath}:${line + 1}:${character + 1} - target="_blank" links need rel="noopener noreferrer"`,
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function collectUnsafeAnchorHrefs(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(sourceFile) === 'a'
    ) {
      const href = getStringJsxAttribute(node, 'href', sourceFile);

      if (href !== undefined && isUnsafeAnchorHref(href)) {
        const { character, line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        const displayPath = relative(projectRoot, filePath);
        violations.push(
          `${displayPath}:${line + 1}:${character + 1} - anchor href must not be empty, placeholder-only, or script-like`,
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function isUnsafeAnchorHref(href: string): boolean {
  const normalizedHref = href.trim().toLowerCase();

  return (
    normalizedHref === '' ||
    normalizedHref === '#' ||
    normalizedHref.startsWith('javascript:') ||
    normalizedHref.startsWith('data:')
  );
}

function isFormControlTag(tagName: string): boolean {
  return tagName === 'input' || tagName === 'select' || tagName === 'textarea';
}

function hasAccessibleFormControlLabel(
  node: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
): boolean {
  return (
    hasStringJsxAttribute(node, 'aria-label', sourceFile) ||
    hasStringJsxAttribute(node, 'aria-labelledby', sourceFile) ||
    hasLabelAncestor(node, sourceFile)
  );
}

function hasStringJsxAttribute(
  node: ts.JsxOpeningLikeElement,
  name: string,
  sourceFile: ts.SourceFile,
): boolean {
  const value = getStringJsxAttribute(node, name, sourceFile);

  return value !== undefined && value.trim() !== '';
}

function hasLabelAncestor(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  let current: ts.Node | undefined = node.parent;

  while (current !== undefined) {
    if (
      ts.isJsxElement(current) &&
      current.openingElement.tagName.getText(sourceFile) === 'label'
    ) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

function hasSafeBlankTargetRel(node: ts.JsxOpeningLikeElement, sourceFile: ts.SourceFile): boolean {
  const rel = getStringJsxAttribute(node, 'rel', sourceFile);

  if (rel === undefined) {
    return false;
  }

  const relTokens = new Set(rel.split(/\s+/).filter(Boolean));

  return relTokens.has('noopener') && relTokens.has('noreferrer');
}
