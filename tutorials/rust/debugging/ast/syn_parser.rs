use syn::{parse_file, File, ItemFn, Item, visit::Visit};
use std::fs::File as FsFile;
use std::io::Read;
use std::path::Path;

// Visitor struct for analyzing Rust AST
struct RustCodeVisitor {
    fn_count: usize,
    struct_count: usize,
    enum_count: usize,
    trait_count: usize,
    impl_count: usize,
    macro_count: usize,
}

impl RustCodeVisitor {
    fn new() -> Self {
        RustCodeVisitor {
            fn_count: 0,
            struct_count: 0,
            enum_count: 0,
            trait_count: 0,
            impl_count: 0,
            macro_count: 0,
        }
    }
    
    fn print_stats(&self) {
        println!("=== Rust Code Statistics ===");
        println!("Functions: {}", self.fn_count);
        println!("Structs:   {}", self.struct_count);
        println!("Enums:     {}", self.enum_count);
        println!("Traits:    {}", self.trait_count);
        println!("Impls:     {}", self.impl_count);
        println!("Macros:    {}", self.macro_count);
        println!("===========================");
    }
}

impl<'ast> Visit<'ast> for RustCodeVisitor {
    fn visit_item_fn(&mut self, node: &'ast ItemFn) {
        self.fn_count += 1;
        // Continue visiting the function body
        syn::visit::visit_item_fn(self, node);
    }
    
    fn visit_item_struct(&mut self, node: &'ast syn::ItemStruct) {
        self.struct_count += 1;
        syn::visit::visit_item_struct(self, node);
    }
    
    fn visit_item_enum(&mut self, node: &'ast syn::ItemEnum) {
        self.enum_count += 1;
        syn::visit::visit_item_enum(self, node);
    }
    
    fn visit_item_trait(&mut self, node: &'ast syn::ItemTrait) {
        self.trait_count += 1;
        syn::visit::visit_item_trait(self, node);
    }
    
    fn visit_item_impl(&mut self, node: &'ast syn::ItemImpl) {
        self.impl_count += 1;
        syn::visit::visit_item_impl(self, node);
    }
    
    fn visit_macro(&mut self, node: &'ast syn::Macro) {
        self.macro_count += 1;
        syn::visit::visit_macro(self, node);
    }
}

// Function analyzer that focuses on function details
struct FunctionAnalyzer {
    functions: Vec<FunctionInfo>,
}

struct FunctionInfo {
    name: String,
    args: Vec<(String, String)>, // (name, type)
    return_type: Option<String>,
    is_async: bool,
    is_unsafe: bool,
    is_public: bool,
    line_count: usize,
}

impl FunctionAnalyzer {
    fn new() -> Self {
        FunctionAnalyzer {
            functions: Vec::new(),
        }
    }
    
    fn analyze_function(&mut self, func: &ItemFn) {
        let name = func.sig.ident.to_string();
        
        // Extract arguments
        let mut args = Vec::new();
        for input in &func.sig.inputs {
            if let syn::FnArg::Typed(pat_type) = input {
                let arg_name = match &*pat_type.pat {
                    syn::Pat::Ident(pat_ident) => pat_ident.ident.to_string(),
                    _ => "_".to_string(),
                };
                
                let arg_type = match &*pat_type.ty {
                    syn::Type::Path(type_path) => {
                        format!("{}", quote::quote!(#type_path))
                    },
                    _ => "unknown".to_string(),
                };
                
                args.push((arg_name, arg_type));
            }
        }
        
        // Extract return type
        let return_type = if let syn::ReturnType::Type(_, ty) = &func.sig.output {
            Some(format!("{}", quote::quote!(#ty)))
        } else {
            None
        };
        
        // Function properties
        let is_async = func.sig.asyncness.is_some();
        let is_unsafe = func.sig.unsafety.is_some();
        let is_public = if let Some(vis) = &func.vis {
            matches!(vis, syn::Visibility::Public(_))
        } else {
            false
        };
        
        // Estimate line count from span information
        // This is approximate since we don't have line info without full parsing context
        let line_count = func.block.stmts.len();
        
        self.functions.push(FunctionInfo {
            name,
            args,
            return_type,
            is_async,
            is_unsafe,
            is_public,
            line_count,
        });
    }
    
    fn print_function_analysis(&self) {
        println!("=== Function Analysis ===");
        for func in &self.functions {
            println!("Function: {}", func.name);
            println!("  Public: {}", func.is_public);
            println!("  Async: {}", func.is_async);
            println!("  Unsafe: {}", func.is_unsafe);
            
            println!("  Arguments:");
            for (name, ty) in &func.args {
                println!("    {}: {}", name, ty);
            }
            
            if let Some(ret) = &func.return_type {
                println!("  Return type: {}", ret);
            } else {
                println!("  Return type: ()");
            }
            
            println!("  Approximate size: {} statements", func.line_count);
            println!();
        }
    }
}

fn analyze_rust_file(path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    // Read the file
    let mut file = FsFile::open(path)?;
    let mut content = String::new();
    file.read_to_string(&mut content)?;
    
    // Parse the file into an AST
    let syntax = parse_file(&content)?;
    
    // Analyze the AST
    let mut visitor = RustCodeVisitor::new();
    syn::visit::visit_file(&mut visitor, &syntax);
    visitor.print_stats();
    
    // Analyze functions
    let mut fn_analyzer = FunctionAnalyzer::new();
    
    // Extract functions
    for item in &syntax.items {
        if let Item::Fn(func) = item {
            fn_analyzer.analyze_function(func);
        }
    }
    
    fn_analyzer.print_function_analysis();
    
    Ok(())
}

fn main() {
    // Example usage with this file
    let path = Path::new("ast/syn_parser.rs");
    
    match analyze_rust_file(path) {
        Ok(_) => println!("Analysis complete"),
        Err(e) => eprintln!("Error analyzing file: {}", e),
    }
}
