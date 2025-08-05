// Note: This would typically be in a separate proc-macro crate
use proc_macro2::TokenStream;
use quote::{quote, ToTokens};
use syn::{parse_macro_input, ItemFn, AttributeArgs, NestedMeta, Lit, Meta};

// Procedural macro for adding retry logic to functions
fn retry_macro(args: AttributeArgs, input: ItemFn) -> TokenStream {
    // Parse macro arguments
    let mut max_retries = 3; // Default
    let mut delay_ms = 100;  // Default
    
    for arg in args {
        match arg {
            NestedMeta::Meta(Meta::NameValue(nv)) if nv.path.is_ident("retries") => {
                if let Lit::Int(lit) = nv.lit {
                    max_retries = lit.base10_parse().unwrap_or(3);
                }
            },
            NestedMeta::Meta(Meta::NameValue(nv)) if nv.path.is_ident("delay") => {
                if let Lit::Int(lit) = nv.lit {
                    delay_ms = lit.base10_parse().unwrap_or(100);
                }
            },
            _ => {},
        }
    }
    
    // Get function details
    let fn_vis = &input.vis;
    let fn_sig = &input.sig;
    let fn_block = &input.block;
    let fn_name = &fn_sig.ident;
    let fn_generics = &fn_sig.generics;
    let fn_inputs = &fn_sig.inputs;
    let fn_output = &fn_sig.output;
    
    // Extract argument names for the function call
    let args = fn_inputs.iter().map(|arg| {
        match arg {
            syn::FnArg::Typed(pat_type) => {
                if let syn::Pat::Ident(pat_ident) = &*pat_type.pat {
                    let ident = &pat_ident.ident;
                    quote! { #ident }
                } else {
                    quote! { /* unable to extract argument name */ }
                }
            },
            syn::FnArg::Receiver(_) => quote! { self },
        }
    });
    
    // Generate the wrapped function
    let is_async = fn_sig.asyncness.is_some();
    
    let function_call = if is_async {
        quote! { #fn_name(#(#args),*).await }
    } else {
        quote! { #fn_name(#(#args),*) }
    };
    
    // Original function with renamed
    let original_fn_name = syn::Ident::new(
        &format!("__original_{}", fn_name),
        proc_macro2::Span::call_site()
    );
    
    let original_fn = quote! {
        #fn_vis fn #original_fn_name #fn_generics(#fn_inputs) #fn_output #fn_block
    };
    
    // Generate retry wrapper function
    let wrapper_fn = if is_async {
        quote! {
            #fn_vis async fn #fn_name #fn_generics(#fn_inputs) #fn_output {
                use std::time::Duration;
                let mut attempts = 0;
                loop {
                    attempts += 1;
                    match #original_fn_name(#(#args),*).await {
                        Ok(result) => return Ok(result),
                        Err(e) => {
                            if attempts >= #max_retries {
                                return Err(e);
                            }
                            eprintln!("Attempt {} failed, retrying in {} ms: {:?}", 
                                     attempts, #delay_ms, e);
                            tokio::time::sleep(Duration::from_millis(#delay_ms)).await;
                        }
                    }
                }
            }
        }
    } else {
        quote! {
            #fn_vis fn #fn_name #fn_generics(#fn_inputs) #fn_output {
                use std::thread::sleep;
                use std::time::Duration;
                let mut attempts = 0;
                loop {
                    attempts += 1;
                    match #original_fn_name(#(#args),*) {
                        Ok(result) => return Ok(result),
                        Err(e) => {
                            if attempts >= #max_retries {
                                return Err(e);
                            }
                            eprintln!("Attempt {} failed, retrying in {} ms: {:?}", 
                                     attempts, #delay_ms, e);
                            sleep(Duration::from_millis(#delay_ms));
                        }
                    }
                }
            }
        }
    };
    
    // Combine original and wrapper functions
    quote! {
        #original_fn
        
        #wrapper_fn
    }
}

// This would be the actual proc macro in a real macro crate
// #[proc_macro_attribute]
// pub fn retry(args: proc_macro::TokenStream, input: proc_macro::TokenStream) 
//     -> proc_macro::TokenStream {
//     let args = parse_macro_input!(args as AttributeArgs);
//     let input = parse_macro_input!(input as ItemFn);
//     retry_macro(args, input).into()
// }

fn main() {
    // Example function to transform
    let input_code = r#"
    #[retry(retries = 5, delay = 200)]
    async fn fetch_data(url: &str) -> Result<String, reqwest::Error> {
        let response = reqwest::get(url).await?;
        let text = response.text().await?;
        Ok(text)
    }
    "#;
    
    // In a real proc macro, we'd parse the input_code and transform it
    // For demonstration, we'll just show what we're generating
    println!("A proc macro that would transform:\n{}", input_code);
    
    // Mock the transformation process
    let mock_fn = syn::parse_str::<ItemFn>(r#"
    async fn fetch_data(url: &str) -> Result<String, reqwest::Error> {
        let response = reqwest::get(url).await?;
        let text = response.text().await?;
        Ok(text)
    }
    "#).unwrap();
    
    let mock_args = syn::parse_str::<AttributeArgs>("retries = 5, delay = 200").unwrap_or_default();
    
    let transformed = retry_macro(mock_args, mock_fn);
    println!("\nInto:\n{}", transformed);
}
