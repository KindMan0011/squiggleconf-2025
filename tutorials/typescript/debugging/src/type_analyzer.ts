import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

export class TypeAnalyzer {
  private program: ts.Program;
  private typeChecker: ts.TypeChecker;
  
  constructor(rootFiles: string[], options: ts.CompilerOptions = {}) {
    const defaultOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      ...options
    };
    
    this.program = ts.createProgram(rootFiles, defaultOptions);
    this.typeChecker = this.program.getTypeChecker();
  }
  
  public analyzeTypes(filePath: string): { 
    complexTypes: Array<{ name: string; location: string; complexity: number }>;
    typeHierarchy: Record<string, string[]>;
    potentialIssues: Array<{ message: string; location: string }>;
  } {
    const sourceFile = this.program.getSourceFile(filePath);
    if (!sourceFile) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const result = {
      complexTypes: [] as Array<{ name: string; location: string; complexity: number }>,
      typeHierarchy: {} as Record<string, string[]>,
      potentialIssues: [] as Array<{ message: string; location: string }>
    };
    
    // Visit all nodes to find type declarations and expressions
    const visit = (node: ts.Node) => {
      // Find interfaces and type aliases
      if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
        const name = node.name.text;
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const location = `${path.basename(filePath)}:${line + 1}:${character + 1}`;
        
        // Calculate type complexity
        const complexity = this.calculateTypeComplexity(node);
        
        if (complexity > 5) {
          result.complexTypes.push({ name, location, complexity });
        }
        
        // Find type hierarchy for interfaces
        if (ts.isInterfaceDeclaration(node) && node.heritageClauses) {
          const parents: string[] = [];
          
          node.heritageClauses.forEach(clause => {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
              clause.types.forEach(type => {
                parents.push(type.expression.getText());
              });
            }
          });
          
          if (parents.length > 0) {
            result.typeHierarchy[name] = parents;
          }
        }
      }
      
      // Find potential type issues
      if (ts.isPropertyDeclaration(node) || ts.isParameterDeclaration(node) || ts.isVariableDeclaration(node)) {
        // Check for any type
        if (node.type && node.type.kind === ts.SyntaxKind.AnyKeyword) {
          const name = ts.isIdentifier(node.name) ? node.name.text : 'unknown';
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          const location = `${path.basename(filePath)}:${line + 1}:${character + 1}`;
          
          result.potentialIssues.push({
            message: `'${name}' is declared with type 'any'`,
            location
          });
        }
      }
      
      // Find type assertions that might be unsafe
      if (ts.isAsExpression(node)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const location = `${path.basename(filePath)}:${line + 1}:${character + 1}`;
        
        result.potentialIssues.push({
          message: `Type assertion found: ${node.getText()}`,
          location
        });
      }
      
      ts.forEachChild(node, visit);
    };
    
    visit(sourceFile);
    return result;
  }
  
  public findTypeUsages(filePath: string, typeName: string): Array<{
    usage: string;
    location: string;
  }> {
    const sourceFile = this.program.getSourceFile(filePath);
    if (!sourceFile) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const usages: Array<{ usage: string; location: string }> = [];
    
    const visit = (node: ts.Node) => {
      // Check if this node references the type we're looking for
      if (ts.isTypeReferenceNode(node) && 
          ts.isIdentifier(node.typeName) && 
          node.typeName.text === typeName) {
        
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const location = `${path.basename(filePath)}:${line + 1}:${character + 1}`;
        
        usages.push({
          usage: node.parent.getText(),
          location
        });
      }
      
      // Check variable declarations with explicit type
      if (ts.isVariableDeclaration(node) && 
          node.type && 
          ts.isTypeReferenceNode(node.type) && 
          ts.isIdentifier(node.type.typeName) && 
          node.type.typeName.text === typeName) {
        
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const location = `${path.basename(filePath)}:${line + 1}:${character + 1}`;
        
        usages.push({
          usage: node.getText(),
          location
        });
      }
      
      // Check function parameters with explicit type
      if (ts.isParameter(node) && 
          node.type && 
          ts.isTypeReferenceNode(node.type) && 
          ts.isIdentifier(node.type.typeName) && 
          node.type.typeName.text === typeName) {
        
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const location = `${path.basename(filePath)}:${line + 1}:${character + 1}`;
        
        usages.push({
          usage: node.getText(),
          location
        });
      }
      
      ts.forEachChild(node, visit);
    };
    
    visit(sourceFile);
    return usages;
  }
  
  public generateTypeGraph(filePaths: string[]): Record<string, string[]> {
    const typeGraph: Record<string, string[]> = {};
    
    // Process each file
    for (const filePath of filePaths) {
      const sourceFile = this.program.getSourceFile(filePath);
      if (!sourceFile) continue;
      
      const visit = (node: ts.Node) => {
        // Find interfaces and their relationships
        if (ts.isInterfaceDeclaration(node)) {
          const interfaceName = node.name.text;
          typeGraph[interfaceName] = [];
          
          // Add heritage clauses (extends)
          if (node.heritageClauses) {
            node.heritageClauses.forEach(clause => {
              if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
                clause.types.forEach(type => {
                  typeGraph[interfaceName].push(type.expression.getText());
                });
              }
            });
          }
          
          // Add property types
          node.members.forEach(member => {
            if (ts.isPropertySignature(member) && member.type) {
              if (ts.isTypeReferenceNode(member.type) && ts.isIdentifier(member.type.typeName)) {
                typeGraph[interfaceName].push(member.type.typeName.text);
              }
            }
          });
        }
        
        // Find type aliases and their relationships
        if (ts.isTypeAliasDeclaration(node)) {
          const typeName = node.name.text;
          typeGraph[typeName] = [];
          
          const collectTypeReferences = (typeNode: ts.TypeNode) => {
            if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
              typeGraph[typeName].push(typeNode.typeName.text);
            } else if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
              typeNode.types.forEach(collectTypeReferences);
            }
          };
          
          collectTypeReferences(node.type);
        }
        
        ts.forEachChild(node, visit);
      };
      
      visit(sourceFile);
    }
    
    return typeGraph;
  }
  
  private calculateTypeComplexity(node: ts.Node): number {
    let complexity = 1; // Base complexity
    
    // For interface declarations
    if (ts.isInterfaceDeclaration(node)) {
      // Add complexity for each member
      complexity += node.members.length;
      
      // Add complexity for each heritage clause
      if (node.heritageClauses) {
        node.heritageClauses.forEach(clause => {
          complexity += clause.types.length;
        });
      }
      
      // Add complexity for nested objects or arrays
      node.members.forEach(member => {
        if (ts.isPropertySignature(member) && member.type) {
          if (ts.isTypeLiteralNode(member.type)) {
            complexity += member.type.members.length;
          } else if (ts.isArrayTypeNode(member.type)) {
            complexity += 1;
          }
        }
      });
    }
    
    // For type aliases
    if (ts.isTypeAliasDeclaration(node)) {
      const addTypeComplexity = (typeNode: ts.TypeNode): number => {
        let typeComplexity = 0;
        
        if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
          typeComplexity += typeNode.types.length;
          typeNode.types.forEach(type => {
            typeComplexity += addTypeComplexity(type);
          });
        } else if (ts.isTypeLiteralNode(typeNode)) {
          typeComplexity += typeNode.members.length;
        } else if (ts.isMappedTypeNode(typeNode)) {
          typeComplexity += 3; // Mapped types are inherently complex
        } else if (ts.isConditionalTypeNode(typeNode)) {
          typeComplexity += 3; // Conditional types are inherently complex
        }
        
        return typeComplexity;
      };
      
      complexity += addTypeComplexity(node.type);
    }
    
    return complexity;
  }
}

// Example usage
const exampleCode = `
interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

interface User extends BaseEntity {
  username: string;
  email: string;
  profile: {
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  roles: string[];
}

interface Product extends BaseEntity {
  name: string;
  price: number;
  category: ProductCategory;
}

interface ProductCategory {
  id: string;
  name: string;
  parentCategory?: ProductCategory;
}

type ProductResponse = {
  product: Product;
  relatedProducts: Product[];
  category: ProductCategory;
};

type EntityMap<T extends BaseEntity> = {
  [id: string]: T;
};

// Some examples of usage
function processUser(user: User): void {
  console.log(user.username);
  const name = \`\${user.profile.firstName} \${user.profile.lastName}\`;
  console.log(name);
}

const productMap: EntityMap<Product> = {};

function addProduct(product: Product): void {
  productMap[product.id] = product;
}

// Some potential issues
const anyValue: any = { prop: 'value' };
const forcedProduct = anyValue as Product;
`;

const tempFilePath = path.join(__dirname, 'type-analyzer-example.ts');
fs.writeFileSync(tempFilePath, exampleCode);

const analyzer = new TypeAnalyzer([tempFilePath]);

console.log('Type Analysis Results:');
const analysis = analyzer.analyzeTypes(tempFilePath);

console.log('\nComplex Types:');
analysis.complexTypes.forEach(type => {
  console.log(`- ${type.name} (complexity: ${type.complexity}) at ${type.location}`);
});

console.log('\nType Hierarchy:');
Object.entries(analysis.typeHierarchy).forEach(([type, parents]) => {
  console.log(`- ${type} extends ${parents.join(', ')}`);
});

console.log('\nPotential Issues:');
analysis.potentialIssues.forEach(issue => {
  console.log(`- ${issue.message} at ${issue.location}`);
});

console.log('\nType Usages (Product):');
const usages = analyzer.findTypeUsages(tempFilePath, 'Product');
usages.forEach(usage => {
  console.log(`- ${usage.usage} at ${usage.location}`);
});

console.log('\nType Graph:');
const graph = analyzer.generateTypeGraph([tempFilePath]);
Object.entries(graph).forEach(([type, dependencies]) => {
  if (dependencies.length > 0) {
    console.log(`- ${type} depends on: ${dependencies.join(', ')}`);
  } else {
    console.log(`- ${type} (no dependencies)`);
  }
});

// Clean up
fs.unlinkSync(tempFilePath);
