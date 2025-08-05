import * as ts from 'typescript';
import * as fs from 'fs';

export function createAST(sourceText: string): ts.SourceFile {
  return ts.createSourceFile(
    'sample.ts',
    sourceText,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true
  );
}

export function printAST(node: ts.Node, indent: string = ''): void {
  console.log(`${indent}${ts.SyntaxKind[node.kind]} - ${node.getText()}`);
  
  node.forEachChild(child => {
    printAST(child, indent + '  ');
  });
}

// Example usage
const sourceCode = `
function greeting(name: string): string {
  return \`Hello, \${name}!\`;
}

const result = greeting("TypeScript");
`;

const ast = createAST(sourceCode);
console.log("AST Structure:");
printAST(ast);
