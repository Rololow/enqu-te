mod db;
mod error;
mod extractors;
mod handlers;
mod middleware;
mod models;
mod utils;

use axum::{
    middleware as axum_middleware,
    routing::{delete, get, post, put},
    Router,
};
use sqlx::PgPool;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Clone)]
pub struct AppState {
    db: PgPool,
    jwt_secret: String,
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "enquete_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment variables
    dotenvy::dotenv().ok();
    
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "your-secret-key-change-in-production".to_string());
    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());

    // Create database pool
    let db = db::create_pool(&database_url)
        .await
        .expect("Failed to create database pool");

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .expect("Failed to run migrations");

    let state = AppState {
        db,
        jwt_secret,
    };

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build protected routes (require authentication)
    let protected_routes = Router::new()
        .route("/api/auth/me", get(handlers::me))
        .route("/api/investigations", get(handlers::list_investigations))
        .route("/api/investigations", post(handlers::create_investigation))
        .route("/api/investigations/:id", get(handlers::get_investigation))
        .route("/api/investigations/join", post(handlers::join_investigation))
        .route("/api/investigations/:id/members", get(handlers::get_members))
        .route("/api/investigations/:id/presence", post(handlers::update_presence))
        .route("/api/investigations/:id/entities", get(handlers::list_entities))
        .route("/api/investigations/:id/entities", post(handlers::create_entity))
        .route("/api/investigations/:id/entities/:entity_id", put(handlers::update_entity))
        .route("/api/investigations/:id/entities/:entity_id", delete(handlers::delete_entity))
        .route("/api/investigations/:id/links", get(handlers::list_links))
        .route("/api/investigations/:id/links", post(handlers::create_link))
        .route("/api/investigations/:id/links/:link_id", delete(handlers::delete_link))
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            middleware::auth_middleware,
        ));

    // Build public routes
    let public_routes = Router::new()
        .route("/api/auth/register", post(handlers::register))
        .route("/api/auth/login", post(handlers::login))
        .route("/health", get(|| async { "OK" }));

    // Combine routes
    let app = Router::new()
        .merge(protected_routes)
        .merge(public_routes)
        .layer(cors)
        .with_state(state);

    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind to address");

    tracing::info!("Server listening on {}", addr);

    axum::serve(listener, app)
        .await
        .expect("Failed to start server");
}
