import * as ts from 'typescript';
import * as path from 'path';

export function reportDiagnostics(diagnostics: readonly ts.Diagnostic[]): void {
  diagnostics.forEach(diagnostic => {
    let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    
    if (diagnostic.file && diagnostic.start !== undefined) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      const fileName = path.basename(diagnostic.file.fileName);
      console.log(`${fileName} (${line + 1},${character + 1}): ${message}`);
    } else {
      console.log(message);
    }
  });
}

export function getCompilerDiagnostics(filePath: string, options: ts.CompilerOptions = {}): ts.Diagnostic[] {
  const program = ts.createProgram([filePath], options);
  const emitResult = program.emit();
  
  return [
    ...ts.getPreEmitDiagnostics(program),
    ...emitResult.diagnostics
  ];
}

// Example usage with code containing errors
import * as fs from 'fs';

const errorCode = `
// Type error: assigning number to string
let name: string = 42;

// Using undefined variable
console.log(undefinedVar);

// Function call with wrong parameter types
function add(a: number, b: number): number {
  return a + b;
}
add("hello", "world");
`;

const tempFilePath = path.join(__dirname, 'error-sample.ts');
fs.writeFileSync(tempFilePath, errorCode);

const diagnostics = getCompilerDiagnostics(tempFilePath);
console.log('Compiler diagnostics:');
reportDiagnostics(diagnostics);

// Clean up
fs.unlinkSync(tempFilePath);
