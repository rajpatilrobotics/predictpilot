/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  collectSourceFiles,
  createTsxSourceFile,
  getStringJsxAttribute,
  projectRoot,
  sourceRoot,
} from './static-source-utils';

describe('global stylesheet accessibility safeguards', () => {
  it('honors reduced-motion preferences for global animation and transition effects', () => {
    const stylesheet = readFileSync(join(process.cwd(), 'src/styles/index.css'), 'utf8');

    expect(stylesheet).toContain('@media (prefers-reduced-motion: reduce)');
    expect(stylesheet).toContain('animation-duration: 0.01ms !important');
    expect(stylesheet).toContain('animation-iteration-count: 1 !important');
    expect(stylesheet).toContain('transition-duration: 0.01ms !important');
    expect(stylesheet).toContain('scroll-behavior: auto !important');
  });

  it('keeps JSX form controls accessible by name', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap(collectUnnamedFormControls)
      .sort();

    expect(violations, violations.join('\n')).toEqual([]);
  });
});

function collectUnnamedFormControls(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const referencedLabelIds = collectLabelControlIds(sourceFile);
  const violations: string[] = [];

  function visit(node: ts.Node, ancestorTags: readonly string[]): void {
    if (ts.isJsxElement(node)) {
      const tagName = node.openingElement.tagName.getText(sourceFile);
      const nextAncestorTags = [...ancestorTags, tagName];

      if (
        isFormControlTag(tagName) &&
        !hasAccessibleName(node.openingElement, ancestorTags, referencedLabelIds, sourceFile)
      ) {
        const { character, line } = sourceFile.getLineAndCharacterOfPosition(
          node.openingElement.getStart(sourceFile),
        );
        violations.push(
          `${relative(projectRoot, filePath)}:${line + 1}:${character + 1} - ${tagName} needs an accessible name`,
        );
      }

      node.children.forEach((child) => visit(child, nextAncestorTags));
      return;
    }

    if (ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);

      if (
        isFormControlTag(tagName) &&
        !hasAccessibleName(node, ancestorTags, referencedLabelIds, sourceFile)
      ) {
        const { character, line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        violations.push(
          `${relative(projectRoot, filePath)}:${line + 1}:${character + 1} - ${tagName} needs an accessible name`,
        );
      }
    }

    ts.forEachChild(node, (child) => visit(child, ancestorTags));
  }

  visit(sourceFile, []);

  return violations;
}

function collectLabelControlIds(sourceFile: ts.SourceFile): ReadonlySet<string> {
  const controlIds = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningLikeElement(node) && node.tagName.getText(sourceFile) === 'label') {
      const htmlFor = getStringJsxAttribute(node, 'htmlFor', sourceFile);

      if (htmlFor !== undefined) {
        controlIds.add(htmlFor);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return controlIds;
}

function hasAccessibleName(
  node: ts.JsxOpeningLikeElement,
  ancestorTags: readonly string[],
  referencedLabelIds: ReadonlySet<string>,
  sourceFile: ts.SourceFile,
): boolean {
  if (ancestorTags.includes('label')) {
    return true;
  }

  if (
    getStringJsxAttribute(node, 'aria-label', sourceFile) !== undefined ||
    getStringJsxAttribute(node, 'aria-labelledby', sourceFile) !== undefined ||
    getStringJsxAttribute(node, 'title', sourceFile) !== undefined
  ) {
    return true;
  }

  const controlId = getStringJsxAttribute(node, 'id', sourceFile);

  return controlId !== undefined && referencedLabelIds.has(controlId);
}

function isFormControlTag(tagName: string): boolean {
  return tagName === 'input' || tagName === 'select' || tagName === 'textarea';
}
