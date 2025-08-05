use syn::{parse_file, parse_str, visit_mut::VisitMut, File, Item, ItemFn, Expr, Stmt};
use quote::quote;
use proc_macro2::TokenStream;

// AST Transformer for modifying Rust code
struct RustTransformer {
    // Transformation settings
    add_logging: bool,
    make_async: bool,
    rename_functions: bool,
}

impl RustTransformer {
    fn new() -> Self {
        RustTransformer {
            add_logging: true,
            make_async: false,
            rename_functions: false,
        }
    }
    
    // Generate a log statement for function entry
    fn create_log_statement(&self, fn_name: &str) -> Stmt {
        let log_msg = format!("Entering function: {}", fn_name);
        let log_expr: Expr = parse_str(&format!("println!(\"{}\")", log_msg)).unwrap();
        parse_str::<Stmt>(&format!("println!(\"{}\")", log_msg)).unwrap()
    }
}

impl VisitMut for RustTransformer {
    // Transform functions
    fn visit_item_fn_mut(&mut self, node: &mut ItemFn) {
        // Add logging at the beginning of each function
        if self.add_logging {
            let fn_name = node.sig.ident.to_string();
            let log_stmt = self.create_log_statement(&fn_name);
            node.block.stmts.insert(0, log_stmt);
        }
        
        // Make functions async if requested
        if self.make_async && node.sig.asyncness.is_none() {
            node.sig.asyncness = Some(syn::token::Async::default());
        }
        
        // Rename functions if requested (adding a prefix)
        if self.rename_functions {
            let old_name = node.sig.ident.to_string();
            let new_name = format!("transformed_{}", old_name);
            node.sig.ident = syn::Ident::new(&new_name, proc_macro2::Span::call_site());
        }
        
        // Continue visiting child nodes
        syn::visit_mut::visit_item_fn_mut(self, node);
    }
}

fn transform_rust_code(code: &str) -> String {
    // Parse the code into an AST
    let mut syntax: File = parse_str(code).expect("Failed to parse Rust code");
    
    // Create and apply the transformer
    let mut transformer = RustTransformer::new();
    transformer.visit_file_mut(&mut syntax);
    
    // Convert the modified AST back to code
    let ts = quote!(#syntax);
    ts.to_string()
}

fn main() {
    // Example Rust code to transform
    let original_code = r#"
    fn calculate_sum(a: i32, b: i32) -> i32 {
        a + b
    }
    
    fn greet(name: &str) -> String {
        format!("Hello, {}!", name)
    }
    "#;
    
    println!("Original Code:\n{}", original_code);
    
    let transformed = transform_rust_code(original_code);
    println!("\nTransformed Code:\n{}", transformed);
}
