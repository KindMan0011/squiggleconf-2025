use syn::{parse_file, Item, ItemFn, Expr, ExprMatch, Pat, Arm};
use syn::visit::{self, Visit};
use std::fs::File;
use std::io::Read;
use std::path::Path;

// Linting rule struct
struct LintRule {
    name: String,
    description: String,
    check_fn: fn(&syn::File) -> Vec<LintError>,
}

// Error reported by a lint rule
struct LintError {
    message: String,
    line: usize,
    column: usize,
    rule_name: String,
}

impl LintError {
    fn new(message: String, rule_name: &str) -> Self {
        LintError {
            message,
            line: 0,  // Would be populated from span in a real implementation
            column: 0, // Would be populated from span in a real implementation
            rule_name: rule_name.to_string(),
        }
    }
}

// Custom linter implementation
struct RustLinter {
    rules: Vec<LintRule>,
}

impl RustLinter {
    fn new() -> Self {
        // Create a linter with default rules
        let mut linter = RustLinter {
            rules: Vec::new(),
        };
        
        // Add default rules
        linter.add_rule(LintRule {
            name: "exhaustive_match".to_string(),
            description: "Checks for non-exhaustive match expressions".to_string(),
            check_fn: check_exhaustive_match,
        });
        
        linter.add_rule(LintRule {
            name: "unwrap_used".to_string(),
            description: "Detects usage of unwrap() which might panic".to_string(),
            check_fn: check_unwrap_usage,
        });
        
        linter.add_rule(LintRule {
            name: "complex_function".to_string(),
            description: "Identifies functions that are too large or complex".to_string(),
            check_fn: check_complex_functions,
        });
        
        linter
    }
    
    fn add_rule(&mut self, rule: LintRule) {
        self.rules.push(rule);
    }
    
    fn lint_file(&self, path: &Path) -> Result<Vec<LintError>, Box<dyn std::error::Error>> {
        // Read the file
        let mut file = File::open(path)?;
        let mut content = String::new();
        file.read_to_string(&mut content)?;
        
        // Parse the file
        let syntax = parse_file(&content)?;
        
        // Apply all rules
        let mut errors = Vec::new();
        for rule in &self.rules {
            let rule_errors = (rule.check_fn)(&syntax);
            errors.extend(rule_errors);
        }
        
        Ok(errors)
    }
}

// Rule implementation: Check for non-exhaustive match expressions
fn check_exhaustive_match(file: &syn::File) -> Vec<LintError> {
    struct MatchVisitor {
        errors: Vec<LintError>,
    }
    
    impl<'ast> Visit<'ast> for MatchVisitor {
        fn visit_expr_match(&mut self, node: &'ast ExprMatch) {
            // Check if the match has a wildcard pattern
            let has_wildcard = node.arms.iter().any(|arm| {
                matches!(arm.pat, Pat::Wild(_))
            });
            
            // If it doesn't have a wildcard, it might not be exhaustive
            if !has_wildcard {
                self.errors.push(LintError::new(
                    "Match expression might not be exhaustive. Consider adding a wildcard '_' pattern".to_string(),
                    "exhaustive_match"
                ));
            }
            
            // Continue visiting
            visit::visit_expr_match(self, node);
        }
    }
    
    let mut visitor = MatchVisitor { errors: Vec::new() };
    visitor.visit_file(file);
    visitor.errors
}

// Rule implementation: Check for unwrap() usage
fn check_unwrap_usage(file: &syn::File) -> Vec<LintError> {
    struct UnwrapVisitor {
        errors: Vec<LintError>,
    }
    
    impl<'ast> Visit<'ast> for UnwrapVisitor {
        fn visit_expr(&mut self, node: &'ast Expr) {
            // Look for method calls
            if let Expr::MethodCall(method_call) = node {
                // Check if method name is unwrap
                if method_call.method == "unwrap" {
                    self.errors.push(LintError::new(
                        "Use of unwrap() detected. Consider using ? or match/if let for error handling".to_string(),
                        "unwrap_used"
                    ));
                }
            }
            
            // Continue visiting
            visit::visit_expr(self, node);
        }
    }
    
    let mut visitor = UnwrapVisitor { errors: Vec::new() };
    visitor.visit_file(file);
    visitor.errors
}

// Rule implementation: Check for complex functions
fn check_complex_functions(file: &syn::File) -> Vec<LintError> {
    struct ComplexityVisitor {
        errors: Vec<LintError>,
    }
    
    impl<'ast> Visit<'ast> for ComplexityVisitor {
        fn visit_item_fn(&mut self, node: &'ast ItemFn) {
            // Simple complexity metric: count statements
            let stmt_count = node.block.stmts.len();
            
            // If function has too many statements, report it
            if stmt_count > 20 {  // Arbitrary threshold
                self.errors.push(LintError::new(
                    format!("Function '{}' has {} statements, which exceeds the recommended maximum of 20", 
                            node.sig.ident, stmt_count),
                    "complex_function"
                ));
            }
            
            // Continue visiting
            visit::visit_item_fn(self, node);
        }
    }
    
    let mut visitor = ComplexityVisitor { errors: Vec::new() };
    visitor.visit_file(file);
    visitor.errors
}

fn main() {
    // Example Rust code to lint
    let example_code = r#"
    fn process_data(data: Option<String>) -> String {
        // Using unwrap which might panic
        let value = data.unwrap();
        
        // Non-exhaustive match
        let result = match value.as_str() {
            "hello" => "world",
            "goodbye" => "friend",
            // Missing wildcard case
        };
        
        result.to_string()
    }
    
    fn very_complex_function() {
        let mut sum = 0;
        
        // Lots of statements to trigger complexity warning
        for i in 0..100 {
            sum += i;
        }
        println!("Step 1");
        println!("Step 2");
        println!("Step 3");
        println!("Step 4");
        println!("Step 5");
        println!("Step 6");
        println!("Step 7");
        println!("Step 8");
        println!("Step 9");
        println!("Step 10");
        println!("Step 11");
        println!("Step 12");
        println!("Step 13");
        println!("Step 14");
        println!("Step 15");
        println!("Final sum: {}", sum);
    }
    "#;
    
    // Write to a temporary file for linting
    let temp_file = "temp_lint_example.rs";
    std::fs::write(temp_file, example_code).expect("Failed to write temporary file");
    
    // Create a linter and run it
    let linter = RustLinter::new();
    let path = Path::new(temp_file);
    
    match linter.lint_file(path) {
        Ok(errors) => {
            println!("Found {} lint issues:", errors.len());
            for error in errors {
                println!("[{}] {}", error.rule_name, error.message);
            }
        },
        Err(e) => eprintln!("Error linting file: {}", e),
    }
    
    // Clean up
    std::fs::remove_file(temp_file).expect("Failed to remove temporary file");
}
