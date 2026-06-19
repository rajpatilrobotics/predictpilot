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

const compareText = (left: string, right: string) => left.localeCompare(right);

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
      .sort(compareText);

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('keeps image-like JSX elements named or intentionally hidden', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap(collectUnnamedImageLikeElements)
      .sort(compareText);

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('keeps interactive buttons and links accessible by name', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap(collectUnnamedInteractiveControls)
      .sort(compareText);

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('keeps static aria-labelledby references connected to local heading IDs', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap((filePath) =>
        collectBrokenStaticAriaIdReferences({
          attributeName: 'aria-labelledby',
          filePath,
          purpose: 'label',
        }),
      )
      .sort(compareText);

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('keeps static aria-describedby references connected to local description IDs', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap((filePath) =>
        collectBrokenStaticAriaIdReferences({
          attributeName: 'aria-describedby',
          filePath,
          purpose: 'description',
        }),
      )
      .sort(compareText);

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('keeps click handlers on keyboard-accessible intrinsic elements', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap(collectNonInteractiveClickHandlers)
      .sort(compareText);

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('prefers native button elements over intrinsic role="button" shims', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap(collectIntrinsicButtonRoleShims)
      .sort(compareText);

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('prevents positive tabIndex values that create a custom tab order', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap(collectPositiveTabIndexValues)
      .sort(compareText);

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('prevents JSX autoFocus from stealing keyboard or screen-reader focus', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap(collectAutoFocusAttributes)
      .sort(compareText);

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('prevents aria-hidden from hiding focusable JSX elements', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap(collectFocusableAriaHiddenElements)
      .sort(compareText);

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('requires intrinsic buttons to declare an explicit type', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => filePath.endsWith('.tsx'))
      .flatMap(collectButtonsWithoutExplicitType)
      .sort(compareText);

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

function collectUnnamedImageLikeElements(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxElement(node)) {
      const openingElement = node.openingElement;
      const tagName = openingElement.tagName.getText(sourceFile);

      if (
        requiresImageAccessibilityCheck(openingElement, tagName, sourceFile) &&
        !hasImageAccessibility(openingElement, node.children, tagName, sourceFile)
      ) {
        violations.push(
          createAccessibilityViolation(filePath, sourceFile, openingElement, tagName),
        );
      }

      node.children.forEach(visit);
      return;
    }

    if (ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);

      if (
        requiresImageAccessibilityCheck(node, tagName, sourceFile) &&
        !hasImageAccessibility(node, [], tagName, sourceFile)
      ) {
        violations.push(createAccessibilityViolation(filePath, sourceFile, node, tagName));
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function requiresImageAccessibilityCheck(
  node: ts.JsxOpeningLikeElement,
  tagName: string,
  sourceFile: ts.SourceFile,
): boolean {
  if (!isIntrinsicElement(tagName) || isIntentionallyHiddenImage(node, sourceFile)) {
    return false;
  }

  return (
    tagName === 'img' ||
    tagName === 'svg' ||
    getStringJsxAttribute(node, 'role', sourceFile) === 'img'
  );
}

function isIntentionallyHiddenImage(
  node: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
): boolean {
  const ariaHidden = getStringJsxAttribute(node, 'aria-hidden', sourceFile);
  const role = getStringJsxAttribute(node, 'role', sourceFile);

  return ariaHidden === 'true' || role === 'none' || role === 'presentation';
}

function hasImageAccessibility(
  node: ts.JsxOpeningLikeElement,
  children: readonly ts.JsxChild[],
  tagName: string,
  sourceFile: ts.SourceFile,
): boolean {
  if (tagName === 'img') {
    return hasJsxAttribute(node, 'alt', sourceFile);
  }

  return (
    hasJsxAttribute(node, 'aria-label', sourceFile) ||
    hasJsxAttribute(node, 'aria-labelledby', sourceFile) ||
    hasJsxAttribute(node, 'title', sourceFile) ||
    hasSvgTitleChild(children, sourceFile)
  );
}

function hasSvgTitleChild(children: readonly ts.JsxChild[], sourceFile: ts.SourceFile): boolean {
  return children.some((child) => {
    if (!ts.isJsxElement(child)) {
      return false;
    }

    return child.openingElement.tagName.getText(sourceFile) === 'title';
  });
}

function createAccessibilityViolation(
  filePath: string,
  sourceFile: ts.SourceFile,
  node: ts.JsxOpeningLikeElement,
  tagName: string,
): string {
  const { character, line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

  return `${relative(projectRoot, filePath)}:${line + 1}:${character + 1} - ${tagName} needs an accessible image name or aria-hidden="true"`;
}

function collectUnnamedInteractiveControls(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxElement(node)) {
      const openingElement = node.openingElement;
      const tagName = openingElement.tagName.getText(sourceFile);

      if (
        requiresInteractiveNameCheck(openingElement, tagName, sourceFile) &&
        !hasInteractiveAccessibleName(openingElement, node.children, sourceFile)
      ) {
        violations.push(
          createInteractiveNameViolation(filePath, sourceFile, openingElement, tagName),
        );
      }

      node.children.forEach(visit);
      return;
    }

    if (ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);

      if (
        requiresInteractiveNameCheck(node, tagName, sourceFile) &&
        !hasInteractiveAccessibleName(node, [], sourceFile)
      ) {
        violations.push(createInteractiveNameViolation(filePath, sourceFile, node, tagName));
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function requiresInteractiveNameCheck(
  node: ts.JsxOpeningLikeElement,
  tagName: string,
  sourceFile: ts.SourceFile,
): boolean {
  if (!isIntrinsicElement(tagName)) {
    return false;
  }

  return tagName === 'button' || (tagName === 'a' && hasJsxAttribute(node, 'href', sourceFile));
}

function hasInteractiveAccessibleName(
  node: ts.JsxOpeningLikeElement,
  children: readonly ts.JsxChild[],
  sourceFile: ts.SourceFile,
): boolean {
  return (
    hasJsxAttribute(node, 'aria-label', sourceFile) ||
    hasJsxAttribute(node, 'aria-labelledby', sourceFile) ||
    hasJsxAttribute(node, 'title', sourceFile) ||
    hasVisibleAccessibleText(children, sourceFile)
  );
}

function hasVisibleAccessibleText(
  children: readonly ts.JsxChild[],
  sourceFile: ts.SourceFile,
): boolean {
  return children.some((child) => {
    if (ts.isJsxText(child)) {
      return child.getText(sourceFile).trim().length > 0;
    }

    if (ts.isJsxExpression(child)) {
      return child.expression !== undefined;
    }

    if (ts.isJsxElement(child)) {
      if (isIntentionallyHiddenImage(child.openingElement, sourceFile)) {
        return false;
      }

      return hasVisibleAccessibleText(child.children, sourceFile);
    }

    if (ts.isJsxSelfClosingElement(child)) {
      return hasJsxAttribute(child, 'aria-label', sourceFile);
    }

    return false;
  });
}

function createInteractiveNameViolation(
  filePath: string,
  sourceFile: ts.SourceFile,
  node: ts.JsxOpeningLikeElement,
  tagName: string,
): string {
  const { character, line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

  return `${relative(projectRoot, filePath)}:${line + 1}:${character + 1} - ${tagName} needs visible text or an accessible name`;
}

interface StaticAriaIdReferenceCheck {
  attributeName: 'aria-describedby' | 'aria-labelledby';
  filePath: string;
  purpose: 'description' | 'label';
}

function collectBrokenStaticAriaIdReferences({
  attributeName,
  filePath,
  purpose,
}: StaticAriaIdReferenceCheck): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const localLabelIds = collectLocalLabelIds(sourceFile);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const ariaReference = getStringJsxAttribute(node, attributeName, sourceFile);

      if (ariaReference !== undefined) {
        const missingIds = ariaReference
          .split(/\s+/)
          .filter((referencedId) => referencedId.length > 0 && !localLabelIds.has(referencedId));

        if (missingIds.length > 0) {
          const { character, line } = sourceFile.getLineAndCharacterOfPosition(
            node.getStart(sourceFile),
          );
          violations.push(
            `${relative(projectRoot, filePath)}:${line + 1}:${character + 1} - ${attributeName} references missing local ${purpose} id(s): ${missingIds.join(', ')}`,
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function collectLocalLabelIds(sourceFile: ts.SourceFile): ReadonlySet<string> {
  const ids = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningLikeElement(node)) {
      const id = getStringJsxAttribute(node, 'id', sourceFile);
      const titleId = getStringJsxAttribute(node, 'titleId', sourceFile);

      if (id !== undefined && id.trim() !== '') {
        ids.add(id);
      }

      if (titleId !== undefined && titleId.trim() !== '') {
        ids.add(titleId);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return ids;
}

function collectNonInteractiveClickHandlers(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);

      if (
        isIntrinsicElement(tagName) &&
        hasJsxAttribute(node, 'onClick', sourceFile) &&
        !isKeyboardAccessibleClickTarget(node, tagName, sourceFile)
      ) {
        const { character, line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        violations.push(
          `${relative(projectRoot, filePath)}:${line + 1}:${character + 1} - ${tagName} with onClick must be a keyboard-accessible control`,
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function collectIntrinsicButtonRoleShims(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      const role = getStringJsxAttribute(node, 'role', sourceFile);

      if (isIntrinsicElement(tagName) && role === 'button') {
        const { character, line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        violations.push(
          `${relative(projectRoot, filePath)}:${line + 1}:${character + 1} - use a native button instead of role="button"`,
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function isKeyboardAccessibleClickTarget(
  node: ts.JsxOpeningLikeElement,
  tagName: string,
  sourceFile: ts.SourceFile,
): boolean {
  if (tagName === 'a') {
    return hasJsxAttribute(node, 'href', sourceFile);
  }

  return ['button', 'input', 'label', 'option', 'select', 'summary', 'textarea'].includes(tagName);
}

function isIntrinsicElement(tagName: string): boolean {
  return tagName === tagName.toLowerCase();
}

function hasJsxAttribute(
  node: ts.JsxOpeningLikeElement,
  name: string,
  sourceFile: ts.SourceFile,
): boolean {
  return node.attributes.properties.some(
    (property) => ts.isJsxAttribute(property) && property.name.getText(sourceFile) === name,
  );
}

function collectPositiveTabIndexValues(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tabIndex = getNumericJsxAttribute(node, 'tabIndex', sourceFile);

      if (tabIndex !== undefined && tabIndex > 0) {
        const { character, line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        violations.push(
          `${relative(projectRoot, filePath)}:${line + 1}:${character + 1} - tabIndex must not be positive`,
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function collectAutoFocusAttributes(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      hasJsxAttribute(node, 'autoFocus', sourceFile)
    ) {
      const { character, line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      violations.push(
        `${relative(projectRoot, filePath)}:${line + 1}:${character + 1} - autoFocus must not steal focus on route load`,
      );
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function collectFocusableAriaHiddenElements(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);

      if (
        getStringJsxAttribute(node, 'aria-hidden', sourceFile) === 'true' &&
        isFocusableElement(node, tagName, sourceFile)
      ) {
        const { character, line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        violations.push(
          `${relative(projectRoot, filePath)}:${line + 1}:${character + 1} - focusable ${tagName} must not be aria-hidden`,
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function collectButtonsWithoutExplicitType(filePath: string): string[] {
  const sourceFile = createTsxSourceFile(filePath);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(sourceFile) === 'button' &&
      !hasJsxAttribute(node, 'type', sourceFile)
    ) {
      const { character, line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      violations.push(
        `${relative(projectRoot, filePath)}:${line + 1}:${character + 1} - button needs explicit type`,
      );
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function isFocusableElement(
  node: ts.JsxOpeningLikeElement,
  tagName: string,
  sourceFile: ts.SourceFile,
): boolean {
  if (getNumericJsxAttribute(node, 'tabIndex', sourceFile) !== undefined) {
    return true;
  }

  if (['button', 'input', 'select', 'summary', 'textarea'].includes(tagName)) {
    return true;
  }

  return tagName === 'a' && hasJsxAttribute(node, 'href', sourceFile);
}

function getNumericJsxAttribute(
  node: ts.JsxOpeningLikeElement,
  name: string,
  sourceFile: ts.SourceFile,
): number | undefined {
  const attribute = node.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.getText(sourceFile) === name,
  );

  if (attribute === undefined || !ts.isJsxAttribute(attribute)) {
    return undefined;
  }

  const initializer = attribute.initializer;

  if (initializer === undefined) {
    return undefined;
  }

  if (ts.isStringLiteral(initializer)) {
    return Number(initializer.text);
  }

  if (
    ts.isJsxExpression(initializer) &&
    initializer.expression !== undefined &&
    ts.isNumericLiteral(initializer.expression)
  ) {
    return Number(initializer.expression.text);
  }

  if (
    ts.isJsxExpression(initializer) &&
    initializer.expression !== undefined &&
    ts.isPrefixUnaryExpression(initializer.expression) &&
    initializer.expression.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(initializer.expression.operand)
  ) {
    return -Number(initializer.expression.operand.text);
  }

  return undefined;
}
