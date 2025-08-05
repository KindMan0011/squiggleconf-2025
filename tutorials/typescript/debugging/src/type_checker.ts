import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

export function createProgram(
  rootFiles: string[],
  options: ts.CompilerOptions = {}
): ts.Program {
  return ts.createProgram(rootFiles, options);
}

export function analyzeTypes(program: ts.Program, filePath: string): void {
  const sourceFile = program.getSourceFile(filePath);
  
  if (!sourceFile) {
    console.error(`Could not find source file: ${filePath}`);
    return;
  }
  
  const typeChecker = program.getTypeChecker();
  
  // Visit each node and print its type information
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) || 
      ts.isParameter(node) || 
      ts.isPropertyDeclaration(node)
    ) {
      const symbol = typeChecker.getSymbolAtLocation(node.name);
      if (symbol) {
        const type = typeChecker.getTypeOfSymbolAtLocation(symbol, node);
        console.log(`${node.name.getText()}: ${typeChecker.typeToString(type)}`);
      }
    }
    
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);
}

// Example: Create a temporary file to analyze
const sampleCode = `
interface User {
  id: number;
  name: string;
  role: 'admin' | 'user';
}

class UserService {
  private users: User[] = [];
  
  addUser(user: User): void {
    this.users.push(user);
  }
  
  findById(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }
}

const service = new UserService();
`;

const tempFilePath = path.join(__dirname, 'temp-sample.ts');
fs.writeFileSync(tempFilePath, sampleCode);

// Create program and analyze types
const program = createProgram([tempFilePath]);
console.log('Type information:');
analyzeTypes(program, tempFilePath);

// Clean up the temporary file
fs.unlinkSync(tempFilePath);
