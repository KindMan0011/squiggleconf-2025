package main

import (
	"flag"
	"fmt"
	"go/ast"
	"go/token"
	"go/types"
	"os"
	
	"golang.org/x/tools/go/analysis"
	"golang.org/x/tools/go/analysis/passes/inspect"
	"golang.org/x/tools/go/analysis/singlechecker"
	"golang.org/x/tools/go/ast/inspector"
)

// Define a custom analysis pass
var Analyzer = &analysis.Analyzer{
	Name: "debugcheck",
	Doc:  "checks for debugging-related issues in code",
	Run:  run,
	Requires: []*analysis.Analyzer{
		inspect.Analyzer,
	},
}

// Command line flags
var (
	checkDebugPrints = flag.Bool("debug-prints", true, "Check for debug print statements")
	checkTodos       = flag.Bool("todos", true, "Check for TODO comments")
	checkAsserts     = flag.Bool("asserts", true, "Check for assertions in production code")
	verboseOutput    = flag.Bool("verbose", false, "Enable verbose output")
)

func run(pass *analysis.Pass) (interface{}, error) {
	// Get the inspector from the pass
	inspect := pass.ResultOf[inspect.Analyzer].(*inspector.Inspector)
	
	// Node filter for the inspector
	nodeFilter := []ast.Node{
		(*ast.CallExpr)(nil),    // For debug prints and assertions
		(*ast.Comment)(nil),     // For TODO comments
		(*ast.CommentGroup)(nil), // For TODO comments
	}
	
	// Visit the AST nodes
	inspect.Preorder(nodeFilter, func(n ast.Node) {
		switch node := n.(type) {
		case *ast.CallExpr:
			if *checkDebugPrints {
				checkDebugPrint(pass, node)
			}
			if *checkAsserts {
				checkAssertion(pass, node)
			}
		case *ast.Comment:
			if *checkTodos {
				checkTodoComment(pass, node)
			}
		}
	})
	
	return nil, nil
}

// Check for debug print statements
func checkDebugPrint(pass *analysis.Pass, call *ast.CallExpr) {
	// Check if it's a function call
	fun, ok := call.Fun.(*ast.SelectorExpr)
	if !ok {
		return
	}
	
	// Get the package and function name
	pkgIdent, ok := fun.X.(*ast.Ident)
	if !ok {
		return
	}
	
	// Check for common debug print functions
	pkgName := pkgIdent.Name
	funcName := fun.Sel.Name
	
	debugFuncs := map[string]map[string]bool{
		"fmt": {
			"Print":   true,
			"Printf":  true,
			"Println": true,
		},
		"log": {
			"Print":   true,
			"Printf":  true,
			"Println": true,
		},
	}
	
	if funcs, ok := debugFuncs[pkgName]; ok && funcs[funcName] {
		// This is a potential debug print
		// Check if it's in a function with "debug" in the name
		inDebugFunc := false
		
		// Walk up the AST to find the enclosing function
		path, _ := astPath(pass.Files, call)
		for _, p := range path {
			if fn, ok := p.(*ast.FuncDecl); ok {
				if strings.Contains(strings.ToLower(fn.Name.Name), "debug") {
					inDebugFunc = true
					break
				}
			}
		}
		
		// Report if it's not in a debug function
		if !inDebugFunc {
			pass.Reportf(call.Pos(), "potentially unused debug print statement: %s.%s", pkgName, funcName)
		}
	}
}

// Check for TODO comments
func checkTodoComment(pass *analysis.Pass, comment *ast.Comment) {
	text := comment.Text
	
	// Check for TODO/FIXME comments
	if strings.Contains(strings.ToUpper(text), "TODO") || strings.Contains(strings.ToUpper(text), "FIXME") {
		// Report all TODOs and FIXMEs
		pass.Reportf(comment.Pos(), "found TODO/FIXME comment: %s", text)
	}
}

// Check for assertions in production code
func checkAssertion(pass *analysis.Pass, call *ast.CallExpr) {
	// Check if it's a function call
	fun, ok := call.Fun.(*ast.Ident)
	if !ok {
		return
	}
	
	// Check for common assertion functions
	assertFuncs := map[string]bool{
		"assert":     true,
		"assertThat": true,
		"require":    true,
		"check":      true,
	}
	
	if assertFuncs[fun.Name] {
		// This is a potential assertion
		pass.Reportf(call.Pos(), "assertion found in production code: %s", fun.Name)
	}
}

// Helper function to find the path to a node in the AST
func astPath(files []*ast.File, target ast.Node) ([]ast.Node, bool) {
	for _, f := range files {
		path, found := findPath(f, target, nil)
		if found {
			return path, true
		}
	}
	return nil, false
}

func findPath(root, target ast.Node, path []ast.Node) ([]ast.Node, bool) {
	if root == target {
		return append(path, root), true
	}
	
	// Recursively search children
	path = append(path, root)
	
	switch node := root.(type) {
	case *ast.File:
		for _, decl := range node.Decls {
			if p, found := findPath(decl, target, path); found {
				return p, true
			}
		}
	case *ast.GenDecl:
		for _, spec := range node.Specs {
			if p, found := findPath(spec, target, path); found {
				return p, true
			}
		}
	case *ast.FuncDecl:
		if node.Recv != nil {
			if p, found := findPath(node.Recv, target, path); found {
				return p, true
			}
		}
		if node.Type != nil {
			if p, found := findPath(node.Type, target, path); found {
				return p, true
			}
		}
		if node.Body != nil {
			if p, found := findPath(node.Body, target, path); found {
				return p, true
			}
		}
	case *ast.BlockStmt:
		for _, stmt := range node.List {
			if p, found := findPath(stmt, target, path); found {
				return p, true
			}
		}
	case *ast.IfStmt:
		if node.Init != nil {
			if p, found := findPath(node.Init, target, path); found {
				return p, true
			}
		}
		if node.Cond != nil {
			if p, found := findPath(node.Cond, target, path); found {
				return p, true
			}
		}
		if node.Body != nil {
			if p, found := findPath(node.Body, target, path); found {
				return p, true
			}
		}
		if node.Else != nil {
			if p, found := findPath(node.Else, target, path); found {
				return p, true
			}
		}
	case *ast.ForStmt:
		if node.Init != nil {
			if p, found := findPath(node.Init, target, path); found {
				return p, true
			}
		}
		if node.Cond != nil {
			if p, found := findPath(node.Cond, target, path); found {
				return p, true
			}
		}
		if node.Post != nil {
			if p, found := findPath(node.Post, target, path); found {
				return p, true
			}
		}
		if node.Body != nil {
			if p, found := findPath(node.Body, target, path); found {
				return p, true
			}
		}
	case *ast.RangeStmt:
		if node.Key != nil {
			if p, found := findPath(node.Key, target, path); found {
				return p, true
			}
		}
		if node.Value != nil {
			if p, found := findPath(node.Value, target, path); found {
				return p, true
			}
		}
		if node.X != nil {
			if p, found := findPath(node.X, target, path); found {
				return p, true
			}
		}
		if node.Body != nil {
			if p, found := findPath(node.Body, target, path); found {
				return p, true
			}
		}
	case *ast.ExprStmt:
		if p, found := findPath(node.X, target, path); found {
			return p, true
		}
	case *ast.CallExpr:
		if p, found := findPath(node.Fun, target, path); found {
			return p, true
		}
		for _, arg := range node.Args {
			if p, found := findPath(arg, target, path); found {
				return p, true
			}
		}
	}
	
	return nil, false
}

func main() {
	// Run the analyzer
	singlechecker.Main(Analyzer)
}
