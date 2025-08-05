use proc_macro2::{Span, TokenStream};
use quote::{quote, format_ident};
use syn::{parse_str, ItemStruct, Fields, FieldsNamed, Field, Type, Visibility, Ident};

// Generate a simple DTO (Data Transfer Object) struct
fn generate_dto(name: &str, fields: Vec<(&str, &str)>) -> TokenStream {
    // Create struct identifier
    let struct_ident = Ident::new(name, Span::call_site());
    
    // Create fields
    let fields = fields.iter().map(|(name, ty)| {
        let field_ident = Ident::new(name, Span::call_site());
        let field_type = parse_str::<Type>(ty).unwrap();
        
        quote! {
            pub #field_ident: #field_type
        }
    });
    
    // Generate the struct
    quote! {
        #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
        pub struct #struct_ident {
            #(#fields),*
        }
    }
}

// Generate From implementation between two structs
fn generate_from_impl(from_type: &str, to_type: &str, field_mappings: Vec<(&str, &str)>) -> TokenStream {
    let from_ident = Ident::new(from_type, Span::call_site());
    let to_ident = Ident::new(to_type, Span::call_site());
    
    let field_conversions = field_mappings.iter().map(|(from_field, to_field)| {
        let from_field_ident = Ident::new(from_field, Span::call_site());
        let to_field_ident = Ident::new(to_field, Span::call_site());
        
        quote! {
            #to_field_ident: from.#from_field_ident
        }
    });
    
    quote! {
        impl From<#from_ident> for #to_ident {
            fn from(from: #from_ident) -> Self {
                Self {
                    #(#field_conversions),*
                }
            }
        }
    }
}

// Generate a CRUD service for a type
fn generate_service(entity_type: &str) -> TokenStream {
    let entity_ident = Ident::new(entity_type, Span::call_site());
    let service_ident = format_ident!("{}{}", entity_type, "Service");
    let repository_ident = format_ident!("{}{}", entity_type, "Repository");
    
    quote! {
        pub struct #service_ident {
            repository: #repository_ident,
        }
        
        impl #service_ident {
            pub fn new(repository: #repository_ident) -> Self {
                Self { repository }
            }
            
            pub async fn find_all(&self) -> Result<Vec<#entity_ident>, Error> {
                self.repository.find_all().await
            }
            
            pub async fn find_by_id(&self, id: uuid::Uuid) -> Result<Option<#entity_ident>, Error> {
                self.repository.find_by_id(id).await
            }
            
            pub async fn create(&self, entity: #entity_ident) -> Result<#entity_ident, Error> {
                self.repository.save(entity).await
            }
            
            pub async fn update(&self, entity: #entity_ident) -> Result<#entity_ident, Error> {
                self.repository.save(entity).await
            }
            
            pub async fn delete(&self, id: uuid::Uuid) -> Result<(), Error> {
                self.repository.delete(id).await
            }
        }
    }
}

// Generate a complete application structure
fn generate_app_structure(entity_types: Vec<&str>) -> TokenStream {
    let entity_modules = entity_types.iter().map(|entity| {
        let entity_ident = Ident::new(&entity.to_lowercase(), Span::call_site());
        let entity_type_ident = Ident::new(entity, Span::call_site());
        let service_ident = format_ident!("{}{}", entity, "Service");
        let repository_ident = format_ident!("{}{}", entity, "Repository");
        let controller_ident = format_ident!("{}{}", entity, "Controller");
        
        quote! {
            pub mod #entity_ident {
                use super::*;
                
                pub mod model {
                    use serde::{Serialize, Deserialize};
                    
                    #[derive(Debug, Clone, Serialize, Deserialize)]
                    pub struct #entity_type_ident {
                        pub id: uuid::Uuid,
                        pub created_at: chrono::DateTime<chrono::Utc>,
                        pub updated_at: chrono::DateTime<chrono::Utc>,
                        // Other fields would be here
                    }
                }
                
                pub mod repository {
                    use super::model::#entity_type_ident;
                    use async_trait::async_trait;
                    
                    #[async_trait]
                    pub trait #repository_ident {
                        async fn find_all(&self) -> Result<Vec<#entity_type_ident>, Error>;
                        async fn find_by_id(&self, id: uuid::Uuid) -> Result<Option<#entity_type_ident>, Error>;
                        async fn save(&self, entity: #entity_type_ident) -> Result<#entity_type_ident, Error>;
                        async fn delete(&self, id: uuid::Uuid) -> Result<(), Error>;
                    }
                }
                
                pub mod service {
                    use super::model::#entity_type_ident;
                    use super::repository::#repository_ident;
                    
                    pub struct #service_ident {
                        repository: Box<dyn #repository_ident + Send + Sync>,
                    }
                    
                    impl #service_ident {
                        pub fn new(repository: Box<dyn #repository_ident + Send + Sync>) -> Self {
                            Self { repository }
                        }
                        
                        pub async fn find_all(&self) -> Result<Vec<#entity_type_ident>, Error> {
                            self.repository.find_all().await
                        }
                        
                        // Other methods would be here
                    }
                }
                
                pub mod controller {
                    use super::model::#entity_type_ident;
                    use super::service::#service_ident;
                    use actix_web::{web, HttpResponse, Responder};
                    
                    pub struct #controller_ident {
                        service: #service_ident,
                    }
                    
                    impl #controller_ident {
                        pub fn new(service: #service_ident) -> Self {
                            Self { service }
                        }
                        
                        pub async fn get_all(&self) -> impl Responder {
                            match self.service.find_all().await {
                                Ok(entities) => HttpResponse::Ok().json(entities),
                                Err(_) => HttpResponse::InternalServerError().finish(),
                            }
                        }
                        
                        // Other handler methods would be here
                    }
                    
                    pub fn configure(cfg: &mut web::ServiceConfig, controller: #controller_ident) {
                        cfg.service(
                            web::resource(concat!("/", stringify!(#entity_ident), "s"))
                                .route(web::get().to(move || controller.get_all()))
                        );
                    }
                }
            }
        }
    });
    
    let app_config = entity_types.iter().map(|entity| {
        let entity_ident = Ident::new(&entity.to_lowercase(), Span::call_site());
        let controller_ident = format_ident!("{}{}", entity, "Controller");
        
        quote! {
            #entity_ident::controller::configure(cfg, #entity_ident::controller::#controller_ident::new(
                #entity_ident::service::#entity_type_ident::new(
                    Box::new(/* repository implementation */)
                )
            ));
        }
    });
    
    quote! {
        use std::error::Error;
        use uuid::Uuid;
        use chrono::{DateTime, Utc};
        use serde::{Serialize, Deserialize};
        
        #(#entity_modules)*
        
        pub fn configure_app(cfg: &mut actix_web::web::ServiceConfig) {
            #(#app_config)*
        }
    }
}

fn main() {
    // Example 1: Generate a DTO
    let user_dto = generate_dto("UserDto", vec![
        ("id", "uuid::Uuid"),
        ("username", "String"),
        ("email", "String"),
        ("created_at", "chrono::DateTime<chrono::Utc>"),
    ]);
    
    println!("=== Generated DTO ===\n{}", user_dto);
    
    // Example 2: Generate From implementation
    let from_impl = generate_from_impl("User", "UserDto", vec![
        ("id", "id"),
        ("username", "username"),
        ("email", "email"),
        ("created_at", "created_at"),
    ]);
    
    println!("\n=== Generated From Implementation ===\n{}", from_impl);
    
    // Example 3: Generate a service
    let user_service = generate_service("User");
    
    println!("\n=== Generated Service ===\n{}", user_service);
    
    // Example 4: Generate a complete app structure
    let app_structure = generate_app_structure(vec!["User", "Product", "Order"]);
    
    println!("\n=== Generated App Structure ===\n{}", app_structure);
}
