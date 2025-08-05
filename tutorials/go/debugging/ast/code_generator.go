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
	"strings"
	"text/template"
)

// Command line flags
var (
	inputFile  = flag.String("input", "", "Input Go file containing struct definitions")
	outputFile = flag.String("output", "", "Output file for generated code")
	packageName = flag.String("package", "", "Package name for generated code (defaults to input package)")
	genMethods = flag.Bool("methods", true, "Generate CRUD methods")
	genJSON    = flag.Bool("json", true, "Generate JSON marshal/unmarshal methods")
	genSQLite  = flag.Bool("sqlite", false, "Generate SQLite helpers")
)

// StructInfo holds information about a struct
type StructInfo struct {
	Name    string
	Fields  []FieldInfo
	Methods []MethodInfo
	Comments []string
}

// FieldInfo holds information about a struct field
type FieldInfo struct {
	Name     string
	Type     string
	Tag      string
	JSONName string
	DBName   string
	Comments []string
}

// MethodInfo holds information about a method
type MethodInfo struct {
	Name       string
	Receiver   string
	Params     []ParamInfo
	Results    []ParamInfo
	Comments   []string
}

// ParamInfo holds information about a parameter
type ParamInfo struct {
	Name string
	Type string
}

// ExtractStructs extracts struct information from a Go file
func ExtractStructs(filename string) ([]StructInfo, string, error) {
	// Create a file set for position information
	fset := token.NewFileSet()
	
	// Parse the Go file
	file, err := parser.ParseFile(fset, filename, nil, parser.ParseComments)
	if err != nil {
		return nil, "", fmt.Errorf("failed to parse file: %v", err)
	}
	
	// Extract the package name
	pkgName := file.Name.Name
	
	// Find all struct declarations
	var structs []StructInfo
	
	for _, decl := range file.Decls {
		// Check if it's a GenDecl (type, var, const, import)
		if genDecl, ok := decl.(*ast.GenDecl); ok && genDecl.Tok == token.TYPE {
			for _, spec := range genDecl.Specs {
				if typeSpec, ok := spec.(*ast.TypeSpec); ok {
					// Check if it's a struct
					if structType, ok := typeSpec.Type.(*ast.StructType); ok {
						// Create a new StructInfo
						structInfo := StructInfo{
							Name:   typeSpec.Name.Name,
							Fields: make([]FieldInfo, 0),
						}
						
						// Get comments for the struct
						if genDecl.Doc != nil {
							for _, comment := range genDecl.Doc.List {
								structInfo.Comments = append(structInfo.Comments, comment.Text)
							}
						}
						
						// Process struct fields
						for _, field := range structType.Fields.List {
							// Skip fields without names (embedded types)
							if len(field.Names) == 0 {
								continue
							}
							
							fieldName := field.Names[0].Name
							fieldType := FormatNode(fset, field.Type)
							
							// Process field tags
							var tag, jsonName, dbName string
							if field.Tag != nil {
								tag = field.Tag.Value
								
								// Extract JSON name
								jsonName = extractTagValue(tag, "json")
								if jsonName == "" {
									jsonName = strings.ToLower(fieldName)
								}
								
								// Extract DB name
								dbName = extractTagValue(tag, "db")
								if dbName == "" {
									dbName = strings.ToLower(fieldName)
								}
							} else {
								jsonName = strings.ToLower(fieldName)
								dbName = strings.ToLower(fieldName)
							}
							
							// Get comments for the field
							var comments []string
							if field.Doc != nil {
								for _, comment := range field.Doc.List {
									comments = append(comments, comment.Text)
								}
							}
							if field.Comment != nil {
								for _, comment := range field.Comment.List {
									comments = append(comments, comment.Text)
								}
							}
							
							// Add field to struct
							structInfo.Fields = append(structInfo.Fields, FieldInfo{
								Name:     fieldName,
								Type:     fieldType,
								Tag:      tag,
								JSONName: jsonName,
								DBName:   dbName,
								Comments: comments,
							})
						}
						
						// Add struct to the list
						structs = append(structs, structInfo)
					}
				}
			}
		}
		
		// Check for methods associated with the structs
		if funcDecl, ok := decl.(*ast.FuncDecl); ok && funcDecl.Recv != nil {
			// This is a method, get the receiver type
			recv := funcDecl.Recv.List[0]
			var recvType string
			
			// Handle pointer and non-pointer receivers
			switch t := recv.Type.(type) {
			case *ast.StarExpr:
				if ident, ok := t.X.(*ast.Ident); ok {
					recvType = ident.Name
				}
			case *ast.Ident:
				recvType = t.Name
			}
			
			if recvType != "" {
				// Find the struct this method belongs to
				for i, s := range structs {
					if s.Name == recvType {
						// Process method parameters
						var params []ParamInfo
						if funcDecl.Type.Params != nil {
							for _, param := range funcDecl.Type.Params.List {
								paramType := FormatNode(fset, param.Type)
								
								// Handle multiple names for the same type
								for _, name := range param.Names {
									params = append(params, ParamInfo{
										Name: name.Name,
										Type: paramType,
									})
								}
							}
						}
						
						// Process method results
						var results []ParamInfo
						if funcDecl.Type.Results != nil {
							for _, result := range funcDecl.Type.Results.List {
								resultType := FormatNode(fset, result.Type)
								
								// Handle named and unnamed results
								if len(result.Names) > 0 {
									for _, name := range result.Names {
										results = append(results, ParamInfo{
											Name: name.Name,
											Type: resultType,
										})
									}
								} else {
									results = append(results, ParamInfo{
										Name: "",
										Type: resultType,
									})
								}
							}
						}
						
						// Get comments for the method
						var comments []string
						if funcDecl.Doc != nil {
							for _, comment := range funcDecl.Doc.List {
								comments = append(comments, comment.Text)
							}
						}
						
						// Add method to the struct
						structs[i].Methods = append(structs[i].Methods, MethodInfo{
							Name:     funcDecl.Name.Name,
							Receiver: FormatNode(fset, recv.Type),
							Params:   params,
							Results:  results,
							Comments: comments,
						})
					}
				}
			}
		}
	}
	
	return structs, pkgName, nil
}

// FormatNode formats an AST node into a string
func FormatNode(fset *token.FileSet, node ast.Node) string {
	var buf bytes.Buffer
	if err := format.Node(&buf, fset, node); err != nil {
		return fmt.Sprintf("error formatting node: %v", err)
	}
	return buf.String()
}

// Extract a value from a struct tag
func extractTagValue(tag, key string) string {
	tag = strings.Trim(tag, "`")
	
	// Find the key in the tag
	keyPrefix := key + ":"
	for _, part := range strings.Split(tag, " ") {
		if strings.HasPrefix(part, keyPrefix) {
			value := part[len(keyPrefix):]
			// Remove quotes
			value = strings.Trim(value, "\"")
			// Handle options like `json:"name,omitempty"`
			parts := strings.Split(value, ",")
			return parts[0]
		}
	}
	
	return ""
}

// Generate code for the structs
func GenerateCode(structs []StructInfo, pkgName string) (string, error) {
	// Use the package name from the flag if provided
	if *packageName != "" {
		pkgName = *packageName
	}
	
	// Create a template for code generation
	tmpl := template.New("code")
	
	// Helper functions for the template
	tmpl = tmpl.Funcs(template.FuncMap{
		"ToLower": strings.ToLower,
		"Title":   strings.Title,
		"Add":     func(a, b int) int { return a + b },
	})
	
	// Define the template
	tmplText := `// Code generated by code_generator.go; DO NOT EDIT.

package {{ . }}

{{range .}}
{{range .}}
{{if .Comments}}
{{range .Comments}}{{.}}
{{end}}
{{end}}
{{if and (eq $.GenJSON true) (ne .Name "") }}
// Marshal{{.Name}} converts {{.Name}} to JSON
func (s {{.Name}}) Marshal{{.Name}}() ([]byte, error) {
	return json.Marshal(s)
}

// Unmarshal{{.Name}} parses JSON into {{.Name}}
func Unmarshal{{.Name}}(data []byte) ({{.Name}}, error) {
	var s {{.Name}}
	err := json.Unmarshal(data, &s)
	return s, err
}
{{end}}

{{if and (eq $.GenMethods true) (ne .Name "") }}
// New{{.Name}} creates a new instance of {{.Name}}
func New{{.Name}}({{range $i, $f := .Fields}}{{if $i}}, {{end}}{{$f.Name}} {{$f.Type}}{{end}}) *{{.Name}} {
	return &{{.Name}}{
		{{range .Fields}}{{.Name}}: {{.Name}},
		{{end}}
	}
}

// String returns a string representation of {{.Name}}
func (s {{.Name}}) String() string {
	return fmt.Sprintf("{{.Name}}{ {{range $i, $f := .Fields}}{{if $i}}, {{end}}{{$f.Name}}: %v{{end}} }", {{range $i, $f := .Fields}}{{if $i}}, {{end}}s.{{$f.Name}}{{end}})
}

// Clone creates a deep copy of {{.Name}}
func (s {{.Name}}) Clone() {{.Name}} {
	return {{.Name}}{
		{{range .Fields}}{{.Name}}: s.{{.Name}},
		{{end}}
	}
}
{{end}}

{{if and (eq $.GenSQLite true) (ne .Name "") }}
// Schema{{.Name}} returns the SQLite schema for {{.Name}}
func Schema{{.Name}}() string {
	return `CREATE TABLE IF NOT EXISTS {{ToLower .Name}} (
		{{range $i, $f := .Fields}}{{if $i}},
		{{end}}{{$f.DBName}} {{GetSQLType $f.Type}}{{end}}
	);`
}

// Insert{{.Name}} inserts a {{.Name}} into the database
func Insert{{.Name}}(db *sql.DB, s {{.Name}}) (int64, error) {
	stmt, err := db.Prepare(`INSERT INTO {{ToLower .Name}} ({{range $i, $f := .Fields}}{{if $i}}, {{end}}{{$f.DBName}}{{end}})
		VALUES ({{range $i, $f := .Fields}}{{if $i}}, {{end}}?{{end}})`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()
	
	res, err := stmt.Exec({{range $i, $f := .Fields}}{{if $i}}, {{end}}s.{{$f.Name}}{{end}})
	if err != nil {
		return 0, err
	}
	
	return res.LastInsertId()
}

// Get{{.Name}} retrieves a {{.Name}} by ID
func Get{{.Name}}(db *sql.DB, id int64) ({{.Name}}, error) {
	var s {{.Name}}
	err := db.QueryRow(`SELECT {{range $i, $f := .Fields}}{{if $i}}, {{end}}{{$f.DBName}}{{end}}
		FROM {{ToLower .Name}} WHERE id = ?`, id).Scan({{range $i, $f := .Fields}}{{if $i}}, {{end}}&s.{{$f.Name}}{{end}})
	return s, err
}

// Update{{.Name}} updates a {{.Name}} in the database
func Update{{.Name}}(db *sql.DB, s {{.Name}}, id int64) error {
	stmt, err := db.Prepare(`UPDATE {{ToLower .Name}} SET {{range $i, $f := .Fields}}{{if $i}}, {{end}}{{$f.DBName}} = ?{{end}}
		WHERE id = ?`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	
	_, err = stmt.Exec({{range $i, $f := .Fields}}{{if $i}}, {{end}}s.{{$f.Name}}{{end}}, id)
	return err
}

// Delete{{.Name}} deletes a {{.Name}} from the database
func Delete{{.Name}}(db *sql.DB, id int64) error {
	_, err := db.Exec(`DELETE FROM {{ToLower .Name}} WHERE id = ?`, id)
	return err
}
{{end}}
{{end}}
{{end}}
`

	// Parse the template
	tmpl, err := tmpl.Parse(tmplText)
	if err != nil {
		return "", fmt.Errorf("failed to parse template: %v", err)
	}
	
	// Prepare template data
	type TemplateData struct {
		PackageName string
		Structs     []StructInfo
		GenMethods  bool
		GenJSON     bool
		GenSQLite   bool
	}
	
	data := TemplateData{
		PackageName: pkgName,
		Structs:     structs,
		GenMethods:  *genMethods,
		GenJSON:     *genJSON,
		GenSQLite:   *genSQLite,
	}
	
	// Execute the template
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute template: %v", err)
	}
	
	// Format the generated code
	formattedCode, err := format.Source(buf.Bytes())
	if err != nil {
		// Return unformatted code if formatting fails
		return buf.String(), fmt.Errorf("failed to format code: %v", err)
	}
	
	return string(formattedCode), nil
}

func main() {
	// Parse command line flags
	flag.Parse()
	
	// Check required flags
	if *inputFile == "" {
		fmt.Println("Error: Input file is required")
		flag.Usage()
		os.Exit(1)
	}
	
	// Extract structs from the input file
	structs, pkgName, err := ExtractStructs(*inputFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error extracting structs: %v\n", err)
		os.Exit(1)
	}
	
	// Generate code
	code, err := GenerateCode(structs, pkgName)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error generating code: %v\n", err)
		os.Exit(1)
	}
	
	// Write the generated code to the output file or stdout
	if *outputFile != "" {
		err = os.WriteFile(*outputFile, []byte(code), 0644)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error writing output file: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Generated code written to %s\n", *outputFile)
	} else {
		fmt.Println(code)
	}
}
