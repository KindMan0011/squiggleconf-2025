package main

import (
	"flag"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

// Issue represents a linting issue
type Issue struct {
	Pos      token.Position
	Message  string
	Severity string
}

// LintRule defines a rule for linting
type LintRule interface {
	Check(fset *token.FileSet, file *ast.File) []Issue
	Name() string
	Description() string
}

// UnusedImportRule checks for unused imports
type UnusedImportRule struct{}

func (r UnusedImportRule) Name() string {
	return "unused-import"
}

func (r UnusedImportRule) Description() string {
	return "Detects unused imports in the code"
}

func (r UnusedImportRule) Check(fset *token.FileSet, file *ast.File) []Issue {
	var issues []Issue
	
	// Get all imports
	imports := make(map[string]token.Position)
	for _, imp := range file.Imports {
		name := ""
		if imp.Name != nil {
			// Named import
			name = imp.Name.Name
			if name == "_" {
				// Blank import is used for side effects
				continue
			}
			if name == "." {
				// Dot import is hard to track, skip for now
				continue
			}
		} else {
			// Regular import, extract the package name
			path := strings.Trim(imp.Path.Value, "\"")
			parts := strings.Split(path, "/")
			name = parts[len(parts)-1]
		}
		imports[name] = fset.Position(imp.Pos())
	}
	
	// Find all identifiers in the file
	ast.Inspect(file, func(n ast.Node) bool {
		if ident, ok := n.(*ast.Ident); ok {
			// Skip checking package selectors (e.g., fmt.Printf)
			if _, ok := imports[ident.Name]; ok {
				// This identifier matches an import name, remove it from the map
				delete(imports, ident.Name)
			}
		}
		
		// For SelectorExpr (e.g., fmt.Printf), check the package part
		if sel, ok := n.(*ast.SelectorExpr); ok {
			if x, ok := sel.X.(*ast.Ident); ok {
				if _, ok := imports[x.Name]; ok {
					// Used import, remove it from the map
					delete(imports, x.Name)
				}
			}
		}
		
		return true
	})
	
	// Remaining imports in the map are unused
	for name, pos := range imports {
		issues = append(issues, Issue{
			Pos:      pos,
			Message:  fmt.Sprintf("Unused import: %s", name),
			Severity: "warning",
		})
	}
	
	return issues
}

// ErrorReturnRule checks if errors are being checked
type ErrorReturnRule struct{}

func (r ErrorReturnRule) Name() string {
	return "error-check"
}

func (r ErrorReturnRule) Description() string {
	return "Ensures that errors returned from function calls are checked"
}

func (r ErrorReturnRule) Check(fset *token.FileSet, file *ast.File) []Issue {
	var issues []Issue
	
	// Find all assignments
	ast.Inspect(file, func(n ast.Node) bool {
		switch stmt := n.(type) {
		case *ast.AssignStmt:
			// Check if right side is a function call that might return an error
			for _, rhs := range stmt.Rhs {
				if call, ok := rhs.(*ast.CallExpr); ok {
					// If the assignment has multiple left-hand values and more than one right-hand value,
					// we need to check if the last one might be an error
					if len(stmt.Lhs) > 1 && len(stmt.Rhs) == 1 {
						// Check if the last left-hand value is being assigned to _
						if len(stmt.Lhs) >= 2 {
							lastLhs := stmt.Lhs[len(stmt.Lhs)-1]
							if ident, ok := lastLhs.(*ast.Ident); ok && ident.Name == "_" {
								// Error is being explicitly ignored
								issues = append(issues, Issue{
									Pos:      fset.Position(ident.Pos()),
									Message:  "Error is explicitly ignored with _",
									Severity: "warning",
								})
							}
						}
					}
				}
			}
		case *ast.ExprStmt:
			// Check for function calls whose return values are completely ignored
			if call, ok := stmt.X.(*ast.CallExpr); ok {
				// Try to determine if the function might return an error
				// This is a simplistic approach - in a real linter, we would use type information
				if funcName, ok := getFunctionName(call); ok {
					if strings.HasPrefix(funcName, "Create") ||
					   strings.HasPrefix(funcName, "New") ||
					   strings.HasPrefix(funcName, "Open") ||
					   strings.HasPrefix(funcName, "Read") ||
					   strings.HasPrefix(funcName, "Write") {
						issues = append(issues, Issue{
							Pos:      fset.Position(call.Pos()),
							Message:  fmt.Sprintf("Result of %s is ignored, but it might return an error", funcName),
							Severity: "warning",
						})
					}
				}
			}
		}
		return true
	})
	
	return issues
}

// Helper function to get the function name from a CallExpr
func getFunctionName(call *ast.CallExpr) (string, bool) {
	switch fun := call.Fun.(type) {
	case *ast.Ident:
		// Direct function call, e.g., doSomething()
		return fun.Name, true
	case *ast.SelectorExpr:
		// Package or method call, e.g., pkg.Function() or obj.Method()
		if ident, ok := fun.X.(*ast.Ident); ok {
			return ident.Name + "." + fun.Sel.Name, true
		}
		return fun.Sel.Name, true
	default:
		return "", false
	}
}

// Run the linter on a file
func lintFile(filename string, rules []LintRule) ([]Issue, error) {
	// Create file set for position information
	fset := token.NewFileSet()
	
	// Parse the file
	file, err := parser.ParseFile(fset, filename, nil, parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("failed to parse file: %v", err)
	}
	
	// Apply all rules
	var allIssues []Issue
	for _, rule := range rules {
		issues := rule.Check(fset, file)
		allIssues = append(allIssues, issues...)
	}
	
	return allIssues, nil
}

func main() {
	// Parse command line flags
	dir := flag.String("dir", ".", "Directory to lint")
	recursive := flag.Bool("recursive", false, "Recursively lint subdirectories")
	flag.Parse()
	
	// Create lint rules
	rules := []LintRule{
		UnusedImportRule{},
		ErrorReturnRule{},
	}
	
	// Process files
	var filesToLint []string
	
	walkFn := func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			if !*recursive && path != *dir {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasSuffix(path, ".go") && !strings.HasSuffix(path, "_test.go") {
			filesToLint = append(filesToLint, path)
		}
		return nil
	}
	
	if err := filepath.Walk(*dir, walkFn); err != nil {
		fmt.Fprintf(os.Stderr, "Error walking directory: %v\n", err)
		os.Exit(1)
	}
	
	// Lint each file
	issueCount := 0
	for _, file := range filesToLint {
		issues, err := lintFile(file, rules)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error linting %s: %v\n", file, err)
			continue
		}
		
		for _, issue := range issues {
			fmt.Printf("%s:%d:%d: %s: %s\n",
				issue.Pos.Filename,
				issue.Pos.Line,
				issue.Pos.Column,
				issue.Severity,
				issue.Message)
			issueCount++
		}
	}
	
	// Print summary
	fmt.Printf("\nLinted %d files, found %d issues\n", len(filesToLint), issueCount)
	
	// Return non-zero exit code if issues were found
	if issueCount > 0 {
		os.Exit(1)
	}
}
