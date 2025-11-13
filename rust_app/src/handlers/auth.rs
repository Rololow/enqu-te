use axum::{extract::State, http::StatusCode, Json};
use serde_json::json;

use crate::error::AppError;
use crate::models::{UserLogin, UserRegistration, UserResponse};
use crate::utils::{create_jwt, hash_password, verify_password};
use crate::AppState;

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<UserRegistration>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    // Check if username or email already exists
    let existing = sqlx::query!(
        "SELECT id FROM investigation_user WHERE username = $1 OR email = $2",
        payload.username,
        payload.email
    )
    .fetch_optional(&state.db)
    .await?;

    if existing.is_some() {
        return Err(AppError::BadRequest(
            "Username or email already exists".to_string(),
        ));
    }

    // Hash password
    let password_hash = hash_password(&payload.password)?;

    // Insert user
    let user = sqlx::query!(
        r#"
        INSERT INTO investigation_user (username, email, password, first_name, last_name, is_active, is_staff, is_superuser, date_joined, created_at)
        VALUES ($1, $2, $3, $4, $5, true, false, false, NOW(), NOW())
        RETURNING id, username, email, first_name, last_name, avatar, created_at
        "#,
        payload.username,
        payload.email,
        password_hash,
        payload.first_name,
        payload.last_name
    )
    .fetch_one(&state.db)
    .await?;

    // Create JWT token
    let token = create_jwt(user.id, user.username.clone(), &state.jwt_secret)?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "User created successfully",
            "token": token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name
            }
        })),
    ))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<UserLogin>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Find user by username
    let user = sqlx::query!(
        "SELECT id, username, email, password FROM investigation_user WHERE username = $1 AND is_active = true",
        payload.username
    )
    .fetch_optional(&state.db)
    .await?;

    let user = user.ok_or_else(|| AppError::Unauthorized("Invalid credentials".to_string()))?;

    // Verify password
    if !verify_password(&payload.password, &user.password)? {
        return Err(AppError::Unauthorized("Invalid credentials".to_string()));
    }

    // Create JWT token
    let token = create_jwt(user.id, user.username.clone(), &state.jwt_secret)?;

    Ok(Json(json!({
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    })))
}

pub async fn me(
    State(state): State<AppState>,
    claims: crate::utils::Claims,
) -> Result<Json<UserResponse>, AppError> {
    let user = sqlx::query!(
        r#"
        SELECT id, username, email, first_name, last_name, avatar, created_at
        FROM investigation_user WHERE id = $1
        "#,
        claims.sub
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(UserResponse {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar: user.avatar,
        created_at: user.created_at.assume_utc(),
    }))
}
