import * as ts from 'typescript';

export function transform(
  sourceCode: string,
  transformers: ts.TransformerFactory<ts.SourceFile>[]
): string {
  const sourceFile = ts.createSourceFile(
    'sample.ts',
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );
  
  const result = ts.transform(sourceFile, transformers);
  const transformedSourceFile = result.transformed[0];
  
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  return printer.printFile(transformedSourceFile);
}

// Example: Transformer that converts var declarations to let
export function createVarToLetTransformer(): ts.TransformerFactory<ts.SourceFile> {
  return context => {
    const visit: ts.Visitor = node => {
      // Check if node is a var declaration
      if (ts.isVariableDeclaration(node) && 
          node.parent && 
          ts.isVariableDeclarationList(node.parent) && 
          node.parent.flags & ts.NodeFlags.Const) {
        // Already const, no change needed
        return node;
      } else if (ts.isVariableDeclarationList(node) && 
                node.flags & ts.NodeFlags.Let) {
        // Already let, no change needed
        return node;
      } else if (ts.isVariableDeclarationList(node) && 
                node.flags & ts.NodeFlags.Var) {
        // Create a new variable declaration list with let instead of var
        return ts.factory.updateVariableDeclarationList(
          node,
          node.declarations,
          node.flags & ~ts.NodeFlags.Var | ts.NodeFlags.Let
        );
      }
      
      return ts.visitEachChild(node, visit, context);
    };
    
    return sourceFile => ts.visitNode(sourceFile, visit) as ts.SourceFile;
  };
}

// Example: Add console log statements before function calls
export function createAddLoggingTransformer(): ts.TransformerFactory<ts.SourceFile> {
  return context => {
    const visit: ts.Visitor = node => {
      // If it's a function call...
      if (ts.isCallExpression(node) && 
          !ts.isPropertyAccessExpression(node.expression) && // Skip method calls
          ts.isIdentifier(node.expression)) {
        
        const functionName = node.expression.text;
        // Skip if it's already a console.log call
        if (functionName === 'console.log') {
          return node;
        }
        
        // Create a console.log statement to log the function call
        const logStatement = ts.factory.createExpressionStatement(
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier('console'),
              ts.factory.createIdentifier('log')
            ),
            undefined,
            [ts.factory.createStringLiteral(`Calling function: ${functionName}`)]
          )
        );
        
        // Return both statements
        return [logStatement, node];
      }
      
      return ts.visitEachChild(node, visit, context);
    };
    
    return sourceFile => ts.visitNode(sourceFile, visit) as ts.SourceFile;
  };
}

// Example usage
const sourceCode = `
var x = 10;
var y = 20;
const z = 30;

function add(a, b) {
  return a + b;
}

const result = add(x, y);
`;

console.log('Original code:');
console.log(sourceCode);

console.log('\nTransformed var to let:');
const varToLetResult = transform(sourceCode, [createVarToLetTransformer()]);
console.log(varToLetResult);

console.log('\nAdded logging:');
const loggingResult = transform(sourceCode, [createAddLoggingTransformer()]);
console.log(loggingResult);

console.log('\nCombined transformers:');
const combinedResult = transform(
  sourceCode, 
  [createVarToLetTransformer(), createAddLoggingTransformer()]
);
console.log(combinedResult);
