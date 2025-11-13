use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

use crate::utils::verify_jwt;
use crate::AppState;

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, Response> {
    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    if let Some(auth_header) = auth_header {
        if let Some(token) = auth_header.strip_prefix("Bearer ") {
            match verify_jwt(token, &state.jwt_secret) {
                Ok(claims) => {
                    req.extensions_mut().insert(claims);
                    return Ok(next.run(req).await);
                }
                Err(_) => {
                    return Err((
                        StatusCode::UNAUTHORIZED,
                        Json(json!({ "error": "Invalid token" })),
                    )
                        .into_response());
                }
            }
        }
    }

    Err((
        StatusCode::UNAUTHORIZED,
        Json(json!({ "error": "Missing or invalid authorization header" })),
    )
        .into_response())
}
