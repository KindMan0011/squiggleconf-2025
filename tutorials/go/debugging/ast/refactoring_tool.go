package main

import (
	"bytes"
	"flag"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

// Refactoring options
var (
	inputDir      = flag.String("dir", ".", "Directory to process")
	recursive     = flag.Bool("recursive", false, "Process subdirectories recursively")
	renameFn      = flag.String("rename-fn", "", "Rename function (old:new)")
	renameType    = flag.String("rename-type", "", "Rename type (old:new)")
	renameVar     = flag.String("rename-var", "", "Rename variable (old:new)")
	extractMethod = flag.String("extract-method", "", "Extract method (file:line:name)")
	addParam      = flag.String("add-param", "", "Add parameter (function:name:type)")
	write         = flag.Bool("write", false, "Write changes to files")
)

// Refactoring interface
type Refactoring interface {
	Apply(fset *token.FileSet, file *ast.File) (bool, error)
	Description() string
}

// RenameFunction refactoring
type RenameFunction struct {
	OldName string
	NewName string
}

func (r RenameFunction) Description() string {
	return fmt.Sprintf("Rename function from '%s' to '%s'", r.OldName, r.NewName)
}

func (r RenameFunction) Apply(fset *token.FileSet, file *ast.File) (bool, error) {
	changed := false
	
	// Visit all identifiers
	ast.Inspect(file, func(n ast.Node) bool {
		if ident, ok := n.(*ast.Ident); ok && ident.Name == r.OldName {
			// Check if this is a function declaration or a function call
			if isFunctionIdent(ident) {
				ident.Name = r.NewName
				changed = true
			}
		}
		return true
	})
	
	return changed, nil
}

// RenameType refactoring
type RenameType struct {
	OldName string
	NewName string
}

func (r RenameType) Description() string {
	return fmt.Sprintf("Rename type from '%s' to '%s'", r.OldName, r.NewName)
}

func (r RenameType) Apply(fset *token.FileSet, file *ast.File) (bool, error) {
	changed := false
	
	// Visit all identifiers
	ast.Inspect(file, func(n ast.Node) bool {
		if ident, ok := n.(*ast.Ident); ok && ident.Name == r.OldName {
			// Check if this is a type identifier
			if isTypeIdent(ident) {
				ident.Name = r.NewName
				changed = true
			}
		}
		return true
	})
	
	return changed, nil
}

// RenameVariable refactoring
type RenameVariable struct {
	OldName string
	NewName string
}

func (r RenameVariable) Description() string {
	return fmt.Sprintf("Rename variable from '%s' to '%s'", r.OldName, r.NewName)
}

func (r RenameVariable) Apply(fset *token.FileSet, file *ast.File) (bool, error) {
	changed := false
	
	// Visit all identifiers
	ast.Inspect(file, func(n ast.Node) bool {
		if ident, ok := n.(*ast.Ident); ok && ident.Name == r.OldName {
			// Check if this is a variable identifier
			if isVarIdent(ident) {
				ident.Name = r.NewName
				changed = true
			}
		}
		return true
	})
	
	return changed, nil
}

// AddParameter refactoring
type AddParameter struct {
	FunctionName string
	ParamName    string
	ParamType    string
}

func (r AddParameter) Description() string {
	return fmt.Sprintf("Add parameter '%s %s' to function '%s'", r.ParamName, r.ParamType, r.FunctionName)
}

func (r AddParameter) Apply(fset *token.FileSet, file *ast.File) (bool, error) {
	changed := false
	
	// Visit all function declarations
	ast.Inspect(file, func(n ast.Node) bool {
		if funcDecl, ok := n.(*ast.FuncDecl); ok && funcDecl.Name.Name == r.FunctionName {
			// Add parameter to the function declaration
			newParam := &ast.Field{
				Names: []*ast.Ident{ast.NewIdent(r.ParamName)},
				Type:  ast.NewIdent(r.ParamType),
			}
			
			if funcDecl.Type.Params == nil {
				funcDecl.Type.Params = &ast.FieldList{}
			}
			
			funcDecl.Type.Params.List = append(funcDecl.Type.Params.List, newParam)
			changed = true
			
			// Now we should also update all calls to this function, but that's more complex
			// and would require type checking to be done properly
		}
		return true
	})
	
	return changed, nil
}

// Helper functions to check identifier types
func isFunctionIdent(ident *ast.Ident) bool {
	// Check if the identifier is a function name
	if ident.Obj == nil {
		return false
	}
	
	switch ident.Obj.Kind {
	case ast.Fun:
		return true
	default:
		// Check parent node
		switch parent := ident.Obj.Decl.(type) {
		case *ast.FuncDecl:
			return ident == parent.Name
		case *ast.CallExpr:
			switch fun := parent.Fun.(type) {
			case *ast.Ident:
				return ident == fun
			case *ast.SelectorExpr:
				return ident == fun.Sel
			}
		}
	}
	
	return false
}

func isTypeIdent(ident *ast.Ident) bool {
	// Check if the identifier is a type name
	if ident.Obj == nil {
		return false
	}
	
	switch ident.Obj.Kind {
	case ast.Typ:
		return true
	default:
		// Check parent node
		switch parent := ident.Obj.Decl.(type) {
		case *ast.TypeSpec:
			return ident == parent.Name
		}
	}
	
	return false
}

func isVarIdent(ident *ast.Ident) bool {
	// Check if the identifier is a variable name
	if ident.Obj == nil {
		return false
	}
	
	switch ident.Obj.Kind {
	case ast.Var:
		return true
	default:
		// Check parent node
		switch ident.Obj.Decl.(type) {
		case *ast.AssignStmt, *ast.ValueSpec, *ast.Field:
			return true
		}
	}
	
	return false
}

// Apply refactorings to a file
func applyRefactorings(filename string, refactorings []Refactoring) error {
	// Create a file set for position information
	fset := token.NewFileSet()
	
	// Parse the file
	file, err := parser.ParseFile(fset, filename, nil, parser.ParseComments)
	if err != nil {
		return fmt.Errorf("failed to parse file: %v", err)
	}
	
	// Apply each refactoring
	changed := false
	for _, r := range refactorings {
		refChanged, err := r.Apply(fset, file)
		if err != nil {
			return fmt.Errorf("failed to apply refactoring: %v", err)
		}
		if refChanged {
			changed = true
			fmt.Printf("Applied '%s' to %s\n", r.Description(), filename)
		}
	}
	
	// If the file was changed and we should write the changes
	if changed && *write {
		// Format the file
		var buf bytes.Buffer
		if err := format.Node(&buf, fset, file); err != nil {
			return fmt.Errorf("failed to format file: %v", err)
		}
		
		// Write the changes back to the file
		if err := os.WriteFile(filename, buf.Bytes(), 0644); err != nil {
			return fmt.Errorf("failed to write file: %v", err)
		}
		
		fmt.Printf("Wrote changes to %s\n", filename)
	} else if changed {
		fmt.Printf("Changes not written (use -write to save changes)\n")
	} else {
		fmt.Printf("No changes made to %s\n", filename)
	}
	
	return nil
}

func main() {
	// Parse command line flags
	flag.Parse()
	
	// Create refactorings based on flags
	var refactorings []Refactoring
	
	if *renameFn != "" {
		parts := strings.Split(*renameFn, ":")
		if len(parts) != 2 {
			fmt.Fprintf(os.Stderr, "Invalid format for -rename-fn, expected 'old:new'\n")
			os.Exit(1)
		}
		refactorings = append(refactorings, RenameFunction{
			OldName: parts[0],
			NewName: parts[1],
		})
	}
	
	if *renameType != "" {
		parts := strings.Split(*renameType, ":")
		if len(parts) != 2 {
			fmt.Fprintf(os.Stderr, "Invalid format for -rename-type, expected 'old:new'\n")
			os.Exit(1)
		}
		refactorings = append(refactorings, RenameType{
			OldName: parts[0],
			NewName: parts[1],
		})
	}
	
	if *renameVar != "" {
		parts := strings.Split(*renameVar, ":")
		if len(parts) != 2 {
			fmt.Fprintf(os.Stderr, "Invalid format for -rename-var, expected 'old:new'\n")
			os.Exit(1)
		}
		refactorings = append(refactorings, RenameVariable{
			OldName: parts[0],
			NewName: parts[1],
		})
	}
	
	if *addParam != "" {
		parts := strings.Split(*addParam, ":")
		if len(parts) != 3 {
			fmt.Fprintf(os.Stderr, "Invalid format for -add-param, expected 'function:name:type'\n")
			os.Exit(1)
		}
		refactorings = append(refactorings, AddParameter{
			FunctionName: parts[0],
			ParamName:    parts[1],
			ParamType:    parts[2],
		})
	}
	
	// Check if we have any refactorings to apply
	if len(refactorings) == 0 {
		fmt.Println("No refactorings specified")
		flag.Usage()
		os.Exit(1)
	}
	
	// Find Go files to process
	var filesToProcess []string
	
	err := filepath.Walk(*inputDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		// Skip directories unless recursive is enabled
		if info.IsDir() && path != *inputDir && !*recursive {
			return filepath.SkipDir
		}
		
		// Process Go files
		if !info.IsDir() && strings.HasSuffix(path, ".go") {
			filesToProcess = append(filesToProcess, path)
		}
		
		return nil
	})
	
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error walking directory: %v\n", err)
		os.Exit(1)
	}
	
	// Apply refactorings to each file
	for _, filename := range filesToProcess {
		if err := applyRefactorings(filename, refactorings); err != nil {
			fmt.Fprintf(os.Stderr, "Error processing %s: %v\n", filename, err)
		}
	}
}
