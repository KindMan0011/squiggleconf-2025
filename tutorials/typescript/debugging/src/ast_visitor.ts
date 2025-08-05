import * as ts from 'typescript';

export function visitNode(node: ts.Node, visitor: (node: ts.Node) => void): void {
  visitor(node);
  node.forEachChild(child => visitNode(child, visitor));
}

export function findFunctionDeclarations(sourceFile: ts.SourceFile): ts.FunctionDeclaration[] {
  const functions: ts.FunctionDeclaration[] = [];
  
  visitNode(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.push(node);
    }
  });
  
  return functions;
}

// Example of collecting information during traversal
export function analyzeFunction(func: ts.FunctionDeclaration): {
  name: string;
  parameters: { name: string; type: string }[];
  returnType: string;
} {
  const name = func.name?.getText() || 'anonymous';
  const parameters = func.parameters.map(param => ({
    name: param.name.getText(),
    type: param.type ? param.type.getText() : 'any'
  }));
  
  const returnType = func.type ? func.type.getText() : 'void';
  
  return { name, parameters, returnType };
}

// Example usage
import { createAST } from './ast_parser';

const sourceCode = `
function add(a: number, b: number): number {
  return a + b;
}

function greet(name: string): string {
  return \`Hello \${name}!\`;
}
`;

const ast = createAST(sourceCode);
const functions = findFunctionDeclarations(ast);

functions.forEach(func => {
  const analysis = analyzeFunction(func);
  console.log(`Function: ${analysis.name}`);
  console.log(`Parameters: ${JSON.stringify(analysis.parameters)}`);
  console.log(`Return type: ${analysis.returnType}`);
  console.log('---');
});
