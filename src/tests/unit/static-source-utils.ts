/// <reference types="node" />

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

export const projectRoot = process.cwd();
export const sourceRoot = join(projectRoot, 'src');

const ignoredRepoDirectories = new Set([
  '.git',
  '.vercel',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);

export function collectSourceFiles(directoryPath = sourceRoot): string[] {
  if (!existsSync(directoryPath)) {
    return [];
  }

  return readdirSync(directoryPath).flatMap((entry) => {
    const entryPath = join(directoryPath, entry);
    const entryStats = statSync(entryPath);

    if (entryStats.isDirectory()) {
      return entry === 'tests' ? [] : collectSourceFiles(entryPath);
    }

    return entryStats.isFile() && /\.(ts|tsx)$/.test(entry) ? [entryPath] : [];
  });
}

export function collectRepositoryFiles(directoryPath = projectRoot): string[] {
  return readdirSync(directoryPath).flatMap((entry) => {
    if (ignoredRepoDirectories.has(entry)) {
      return [];
    }

    const entryPath = join(directoryPath, entry);
    const entryStats = statSync(entryPath);

    if (entryStats.isDirectory()) {
      return collectRepositoryFiles(entryPath);
    }

    return entryStats.isFile() ? [entryPath] : [];
  });
}

export function createTsxSourceFile(filePath: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

export function getStringJsxAttribute(
  node: ts.JsxOpeningLikeElement,
  name: string,
  sourceFile: ts.SourceFile,
): string | undefined {
  const attribute = node.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.getText(sourceFile) === name,
  );

  if (attribute === undefined || !ts.isJsxAttribute(attribute)) {
    return undefined;
  }

  if (attribute.initializer === undefined) {
    return undefined;
  }

  return ts.isStringLiteral(attribute.initializer) ? attribute.initializer.text : undefined;
}
