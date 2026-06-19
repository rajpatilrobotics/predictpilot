/// <reference types="node" />

import { relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  collectSourceFiles,
  createTsxSourceFile,
  projectRoot,
  sourceRoot,
} from './static-source-utils';

const indexKeyNames = new Set(['i', 'idx', 'index']);

describe('static React quality regression checks', () => {
  it('prevents obvious array index values from being used as React keys', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap(collectIndexKeyAttributes)
      .sort();

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('prevents unstable generated values from being used as React keys', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap(collectUnstableGeneratedKeyAttributes)
      .sort();

    expect(violations, violations.join('\n')).toEqual([]);
  });
});

function collectIndexKeyAttributes(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const keyExpression = getJsxExpressionAttribute(node, 'key', sourceFile);

      if (keyExpression !== undefined && isIndexIdentifier(keyExpression)) {
        const { character, line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        violations.push(
          `${relative(projectRoot, filePath)}:${line + 1}:${character + 1} - React key must use a stable item identifier, not an array index`,
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function collectUnstableGeneratedKeyAttributes(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const keyExpression = getJsxExpressionAttribute(node, 'key', sourceFile);

      if (keyExpression !== undefined && isUnstableGeneratedKeyExpression(keyExpression)) {
        const { character, line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        violations.push(
          `${relative(projectRoot, filePath)}:${line + 1}:${character + 1} - React key must come from stable data, not a generated runtime value`,
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function getJsxExpressionAttribute(
  node: ts.JsxOpeningLikeElement,
  name: string,
  sourceFile: ts.SourceFile,
): ts.Expression | undefined {
  const attribute = node.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.getText(sourceFile) === name,
  );

  if (attribute === undefined || !ts.isJsxAttribute(attribute)) {
    return undefined;
  }

  const initializer = attribute.initializer;

  if (
    initializer === undefined ||
    !ts.isJsxExpression(initializer) ||
    initializer.expression === undefined
  ) {
    return undefined;
  }

  return initializer.expression;
}

function isIndexIdentifier(expression: ts.Expression): boolean {
  return ts.isIdentifier(expression) && indexKeyNames.has(expression.text);
}

function isUnstableGeneratedKeyExpression(expression: ts.Expression): boolean {
  if (!ts.isCallExpression(expression)) {
    return false;
  }

  return isUnstableGeneratedKeyCallee(expression.expression);
}

function isUnstableGeneratedKeyCallee(expression: ts.Expression): boolean {
  if (ts.isIdentifier(expression)) {
    return (
      expression.text === 'randomUUID' || expression.text === 'nanoid' || expression.text === 'uuid'
    );
  }

  if (!ts.isPropertyAccessExpression(expression)) {
    return false;
  }

  const owner = expression.expression.getText();
  const method = expression.name.text;

  return (
    (owner === 'Math' && method === 'random') ||
    (owner === 'Date' && method === 'now') ||
    (owner === 'crypto' && method === 'randomUUID')
  );
}
