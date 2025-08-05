import * as ts from 'typescript';

export function formatCode(sourceCode: string): string {
  // Parse the source code
  const sourceFile = ts.createSourceFile(
    'sample.ts',
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );
  
  // Create a printer with specific formatting options
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
    omitTrailingSemicolon: false,
    noEmitHelpers: true
  });
  
  // Print the file with formatting applied
  return printer.printFile(sourceFile);
}

// Custom formatter with more specialized rules
export function customFormat(sourceCode: string): string {
  // First, parse the code into an AST
  const sourceFile = ts.createSourceFile(
    'sample.ts',
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );
  
  // Apply transformations to enforce specific formatting rules
  const result = ts.transform(
    sourceFile,
    [
      // Remove extra blank lines
      context => {
        return sourceFile => {
          // In a real implementation, you would identify and remove
          // excessive blank lines between statements
          return sourceFile;
        };
      },
      
      // Standardize import statements
      context => {
        return sourceFile => {
          // In a real implementation, you would sort and organize imports
          return sourceFile;
        };
      }
    ]
  );
  
  // Print the transformed AST
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false
  });
  
  return printer.printFile(result.transformed[0]);
}

// Example usage
const messyCode = `
import   {   Component  }   from   '@angular/core'  ;
import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';



@Injectable()
export  class  MyService {
    constructor(private  http:  HttpClient) {}
    
    getData(  ) {
        return this.http.get('api/data');
    }
}
`;

console.log('Original messy code:');
console.log(messyCode);

console.log('\nFormatted code:');
console.log(formatCode(messyCode));
