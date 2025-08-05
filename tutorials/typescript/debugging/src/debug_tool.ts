import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

export class TypeScriptDebugTool {
  private program: ts.Program;
  private typeChecker: ts.TypeChecker;
  
  constructor(rootFiles: string[], options: ts.CompilerOptions = {}) {
    this.program = ts.createProgram(rootFiles, options);
    this.typeChecker = this.program.getTypeChecker();
  }
  
  public analyzeDependencies(filePath: string): void {
    const sourceFile = this.program.getSourceFile(filePath);
    if (!sourceFile) {
      console.error(`File not found: ${filePath}`);
      return;
    }
    
    console.log(`Analyzing dependencies for ${path.basename(filePath)}:`);
    
    // Find all imports
    this.findImports(sourceFile);
  }
  
  public findUnusedVariables(filePath: string): void {
    const sourceFile = this.program.getSourceFile(filePath);
    if (!sourceFile) {
      console.error(`File not found: ${filePath}`);
      return;
    }
    
    console.log(`Finding unused variables in ${path.basename(filePath)}:`);
    
    const usedIdentifiers = new Set<string>();
    const declaredVariables = new Map<string, ts.Node>();
    
    // First pass: collect all declared variables
    const collectDeclarations = (node: ts.Node) => {
      // Variable declarations
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        declaredVariables.set(node.name.text, node);
      }
      // Parameters
      else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
        declaredVariables.set(node.name.text, node);
      }
      // Function declarations
      else if (ts.isFunctionDeclaration(node) && node.name) {
        declaredVariables.set(node.name.text, node);
      }
      
      ts.forEachChild(node, collectDeclarations);
    };
    
    // Second pass: collect all used identifiers
    const collectUsages = (node: ts.Node) => {
      if (ts.isIdentifier(node)) {
        // Skip property accesses (obj.prop)
        const parent = node.parent;
        if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
          // Do nothing, it's a property name, not a variable reference
        } else {
          usedIdentifiers.add(node.text);
        }
      }
      
      ts.forEachChild(node, collectUsages);
    };
    
    collectDeclarations(sourceFile);
    collectUsages(sourceFile);
    
    // Find unused variables
    declaredVariables.forEach((node, name) => {
      if (!usedIdentifiers.has(name) || 
          (ts.isVariableDeclaration(node) && usedIdentifiers.has(name) && 
           node.name.getText() === name)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        console.log(`Unused variable: ${name} at line ${line + 1}, column ${character + 1}`);
      }
    });
  }
  
  public findComplexFunctions(filePath: string, threshold: number = 10): void {
    const sourceFile = this.program.getSourceFile(filePath);
    if (!sourceFile) {
      console.error(`File not found: ${filePath}`);
      return;
    }
    
    console.log(`Finding complex functions in ${path.basename(filePath)}:`);
    
    // Visit all function-like declarations
    const visitNode = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) || 
          ts.isMethodDeclaration(node) || 
          ts.isFunctionExpression(node) || 
          ts.isArrowFunction(node)) {
        
        // Get function name (if available)
        let functionName = 'anonymous';
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
          functionName = node.name ? node.name.getText() : 'anonymous';
        }
        
        // Calculate cyclomatic complexity
        const complexity = this.calculateComplexity(node);
        
        if (complexity > threshold) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          console.log(`Complex function: ${functionName} at line ${line + 1} with complexity ${complexity}`);
        }
      }
      
      ts.forEachChild(node, visitNode);
    };
    
    visitNode(sourceFile);
  }
  
  public instrumentCode(filePath: string, outputPath: string): void {
    const sourceFile = this.program.getSourceFile(filePath);
    if (!sourceFile) {
      console.error(`File not found: ${filePath}`);
      return;
    }
    
    console.log(`Instrumenting code in ${path.basename(filePath)}:`);
    
    // Create a transformer to add performance measuring code
    const transformer = this.createInstrumentingTransformer();
    
    // Apply the transformation
    const result = ts.transform(sourceFile, [transformer]);
    const transformedSourceFile = result.transformed[0];
    
    // Print the transformed code
    const printer = ts.createPrinter();
    const instrumentedCode = printer.printFile(transformedSourceFile);
    
    // Write to output file
    fs.writeFileSync(outputPath, instrumentedCode);
    console.log(`Instrumented code written to ${outputPath}`);
  }
  
  private findImports(sourceFile: ts.SourceFile): void {
    ts.forEachChild(sourceFile, node => {
      if (ts.isImportDeclaration(node)) {
        const importPath = node.moduleSpecifier.getText().replace(/['"]/g, '');
        console.log(`- Import: ${importPath}`);
        
        // Get imported symbols
        if (node.importClause) {
          if (node.importClause.name) {
            console.log(`  - Default import: ${node.importClause.name.getText()}`);
          }
          
          if (node.importClause.namedBindings) {
            if (ts.isNamedImports(node.importClause.namedBindings)) {
              node.importClause.namedBindings.elements.forEach(element => {
                const importedAs = element.name.getText();
                const originalName = element.propertyName ? element.propertyName.getText() : importedAs;
                
                if (element.propertyName) {
                  console.log(`  - Named import: ${originalName} as ${importedAs}`);
                } else {
                  console.log(`  - Named import: ${importedAs}`);
                }
              });
            } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
              console.log(`  - Namespace import: ${node.importClause.namedBindings.name.getText()}`);
            }
          }
        }
      }
    });
  }
  
  private calculateComplexity(node: ts.Node): number {
    let complexity = 1; // Base complexity
    
    const visit = (node: ts.Node) => {
      // Conditional statements increase complexity
      if (ts.isIfStatement(node) || 
          ts.isSwitchStatement(node) || 
          ts.isConditionalExpression(node)) {
        complexity++;
      }
      
      // Loops increase complexity
      if (ts.isForStatement(node) || 
          ts.isWhileStatement(node) || 
          ts.isDoStatement(node) || 
          ts.isForInStatement(node) || 
          ts.isForOfStatement(node)) {
        complexity++;
      }
      
      // Logical operators in expressions increase complexity
      if (ts.isBinaryExpression(node)) {
        if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || 
            node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
          complexity++;
        }
      }
      
      // Catch clauses increase complexity
      if (ts.isCatchClause(node)) {
        complexity++;
      }
      
      ts.forEachChild(node, visit);
    };
    
    visit(node);
    return complexity;
  }
  
  private createInstrumentingTransformer(): ts.TransformerFactory<ts.SourceFile> {
    return context => {
      const visit: ts.Visitor = node => {
        // Add performance measurement to functions
        if (ts.isFunctionDeclaration(node) && node.name) {
          const functionName = node.name.getText();
          const newBody = this.wrapWithPerformanceMeasurement(node.body, functionName);
          
          return ts.factory.updateFunctionDeclaration(
            node,
            node.decorators,
            node.modifiers,
            node.asteriskToken,
            node.name,
            node.typeParameters,
            node.parameters,
            node.type,
            newBody
          );
        }
        
        // Add performance measurement to methods
        if (ts.isMethodDeclaration(node) && node.name) {
          const methodName = node.name.getText();
          const newBody = this.wrapWithPerformanceMeasurement(node.body, methodName);
          
          return ts.factory.updateMethodDeclaration(
            node,
            node.decorators,
            node.modifiers,
            node.asteriskToken,
            node.name,
            node.questionToken,
            node.typeParameters,
            node.parameters,
            node.type,
            newBody
          );
        }
        
        return ts.visitEachChild(node, visit, context);
      };
      
      return sourceFile => ts.visitNode(sourceFile, visit) as ts.SourceFile;
    };
  }
  
  private wrapWithPerformanceMeasurement(
    body: ts.Block | undefined,
    functionName: string
  ): ts.Block | undefined {
    if (!body) return undefined;
    
    // Create performance measurement statements
    const startMeasurement = ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
        [ts.factory.createVariableDeclaration(
          ts.factory.createIdentifier('_start'),
          undefined,
          undefined,
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier('performance'),
              ts.factory.createIdentifier('now')
            ),
            undefined,
            []
          )
        )],
        ts.NodeFlags.Const
      )
    );
    
    const endMeasurement = ts.factory.createExpressionStatement(
      ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier('console'),
          ts.factory.createIdentifier('log')
        ),
        undefined,
        [
          ts.factory.createTemplateExpression(
            ts.factory.createTemplateHead(`Function ${functionName} took `),
            [
              ts.factory.createTemplateSpan(
                ts.factory.createBinaryExpression(
                  ts.factory.createCallExpression(
                    ts.factory.createPropertyAccessExpression(
                      ts.factory.createIdentifier('performance'),
                      ts.factory.createIdentifier('now')
                    ),
                    undefined,
                    []
                  ),
                  ts.factory.createToken(ts.SyntaxKind.MinusToken),
                  ts.factory.createIdentifier('_start')
                ),
                ts.factory.createTemplateTail(' ms to execute')
              )
            ]
          )
        ]
      )
    );
    
    // Wrap the original body statements with measurements
    return ts.factory.createBlock(
      [
        startMeasurement,
        ...body.statements,
        endMeasurement
      ],
      true
    );
  }
}

// Example usage (commented out to avoid creating files when tangled)
/*
const exampleCode = `
import { Component } from '@angular/core';
import * as _ from 'lodash';

function complexFunction(a: number, b: number): number {
  let result = 0;
  
  if (a > b) {
    if (a > 10) {
      result = a * 2;
    } else {
      result = a;
    }
  } else if (b > a) {
    if (b > 20) {
      result = b * 2;
    } else {
      result = b;
    }
  } else {
    result = a + b;
  }
  
  for (let i = 0; i < result; i++) {
    if (i % 2 === 0) {
      result += 1;
    }
  }
  
  return result;
}

const unused = 'This variable is never used';
const used = 'This one is used';

console.log(used);
console.log(complexFunction(5, 10));
`;

const tempFilePath = path.join(__dirname, 'debug-example.ts');
fs.writeFileSync(tempFilePath, exampleCode);

const debugTool = new TypeScriptDebugTool([tempFilePath]);
debugTool.analyzeDependencies(tempFilePath);
debugTool.findUnusedVariables(tempFilePath);
debugTool.findComplexFunctions(tempFilePath, 5);
debugTool.instrumentCode(tempFilePath, path.join(__dirname, 'instrumented.ts'));

// Clean up
fs.unlinkSync(tempFilePath);
*/

// For the tutorial, let's show what the tool would do
console.log(`
TypeScript Debug Tool capabilities:

1. Dependency Analysis
   - Identifies all imports and their usage
   - Maps dependency relationships

2. Unused Variable Detection
   - Finds declared but unused variables
   - Reports their locations for cleanup

3. Complexity Analysis
   - Calculates cyclomatic complexity of functions
   - Identifies functions that may need refactoring

4. Code Instrumentation
   - Adds performance measurement to functions
   - Helps identify bottlenecks in execution

To use this tool on your codebase, initialize it with:
const debugTool = new TypeScriptDebugTool(['path/to/your/file.ts']);

Then run the specific analysis methods as needed.
`);
