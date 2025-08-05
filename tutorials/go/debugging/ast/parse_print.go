package main

import (
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"strings"
)

const sampleCode = `
package sample

import (
	"fmt"
	"strings"
)

// SampleStruct demonstrates struct features
type SampleStruct struct {
	Name    string
	Value   int
	Enabled bool
}

// Process is a sample function
func Process(input string, count int) (string, error) {
	if count <= 0 {
		return "", fmt.Errorf("invalid count: %d", count)
	}
	
	result := strings.Repeat(input, count)
	return result, nil
}

func main() {
	s := SampleStruct{
		Name:    "Example",
		Value:   42,
		Enabled: true,
	}
	
	result, err := Process(s.Name, s.Value)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	
	fmt.Println("Result:", result)
}
`

func main() {
	// Create a file set for position information
	fset := token.NewFileSet()
	
	// Parse the sample code
	file, err := parser.ParseFile(fset, "sample.go", sampleCode, parser.ParseComments)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to parse file: %v\n", err)
		os.Exit(1)
	}
	
	fmt.Println("=== Parsed Go File Structure ===")
	fmt.Printf("Package: %s\n", file.Name)
	
	// Print imports
	fmt.Println("\nImports:")
	for _, imp := range file.Imports {
		path := strings.Trim(imp.Path.Value, "\"")
		if imp.Name != nil {
			fmt.Printf("  %s %s\n", imp.Name, path)
		} else {
			fmt.Printf("  %s\n", path)
		}
	}
	
	// Print declarations
	fmt.Println("\nDeclarations:")
	for _, decl := range file.Decls {
		switch d := decl.(type) {
		case *ast.GenDecl:
			// Print types, vars, consts
			for _, spec := range d.Specs {
				switch s := spec.(type) {
				case *ast.TypeSpec:
					fmt.Printf("  Type: %s\n", s.Name)
				case *ast.ValueSpec:
					for _, name := range s.Names {
						fmt.Printf("  Value: %s\n", name)
					}
				}
			}
		case *ast.FuncDecl:
			// Print function declarations
			if d.Recv != nil {
				// This is a method
				fmt.Printf("  Method: %s\n", d.Name)
			} else {
				fmt.Printf("  Function: %s\n", d.Name)
			}
		}
	}
	
	// Print the AST (abbreviated)
	fmt.Println("\n=== AST Structure (Abbreviated) ===")
	ast.Inspect(file, func(n ast.Node) bool {
		if n == nil {
			return false
		}
		
		// Print node type and position
		fmt.Printf("%T at %v\n", n, fset.Position(n.Pos()))
		
		// Special handling for some node types
		switch x := n.(type) {
		case *ast.Ident:
			fmt.Printf("  Identifier: %s\n", x.Name)
		case *ast.BasicLit:
			fmt.Printf("  Literal: %s (%s)\n", x.Value, x.Kind)
		case *ast.CallExpr:
			fmt.Println("  Function Call")
		}
		
		return true
	})
	
	// Format and print the code
	fmt.Println("\n=== Formatted Code ===")
	err = format.Node(os.Stdout, fset, file)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to format file: %v\n", err)
		os.Exit(1)
	}
}
