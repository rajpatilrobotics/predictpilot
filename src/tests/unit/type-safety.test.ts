/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  collectSourceFiles,
  createTsxSourceFile,
  projectRoot,
  sourceRoot,
} from './static-source-utils';

const tsSuppressionPatterns = [
  {
    label: '@ts-ignore',
    pattern: /@ts-ignore\b/,
  },
  {
    label: '@ts-expect-error',
    pattern: /@ts-expect-error\b/,
  },
  {
    label: '@ts-nocheck',
    pattern: /@ts-nocheck\b/,
  },
] as const;

const compareText = (left: string, right: string) => left.localeCompare(right);

describe('static TypeScript safety regression checks', () => {
  it('prevents app source from using explicit any escape hatches', () => {
    const violations = collectSourceFiles(sourceRoot)
      .flatMap(collectExplicitAnyUsages)
      .sort(compareText);

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('prevents TypeScript suppression comments in app source', () => {
    const violations = collectSourceFiles(sourceRoot)
      .flatMap(collectTypeScriptSuppressionComments)
      .sort(compareText);

    expect(violations, violations.join('\n')).toEqual([]);
  });
});

function collectExplicitAnyUsages(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (isExplicitAnyKeyword(node)) {
      const { character, line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      violations.push(
        `${relative(projectRoot, filePath)}:${line + 1}:${character + 1} - explicit any weakens typed protocol and UI safety`,
      );
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function isExplicitAnyKeyword(node: ts.Node): boolean {
  return node.kind === ts.SyntaxKind.AnyKeyword;
}

function collectTypeScriptSuppressionComments(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8');
  const displayPath = relative(projectRoot, filePath);
  const violations: string[] = [];

  source.split(/\r?\n/).forEach((lineText, index) => {
    tsSuppressionPatterns.forEach(({ label, pattern }) => {
      if (pattern.test(lineText)) {
        violations.push(
          `${displayPath}:${index + 1} - ${label} hides type errors instead of fixing them`,
        );
      }
    });
  });

  return violations;
}
