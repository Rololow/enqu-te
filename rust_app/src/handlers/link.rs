use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{CreateLink, EntityInfo, LinkResponse};
use crate::utils::Claims;
use crate::AppState;

async fn check_member_access(
    db: &sqlx::PgPool,
    investigation_id: Uuid,
    user_id: i32,
) -> Result<(), AppError> {
    let is_member = sqlx::query!(
        "SELECT id FROM investigation_investigationmember WHERE investigation_id = $1 AND user_id = $2",
        investigation_id,
        user_id
    )
    .fetch_optional(db)
    .await?;

    if is_member.is_none() {
        return Err(AppError::Unauthorized("Not a member of this investigation".to_string()));
    }

    Ok(())
}

pub async fn list_links(
    State(state): State<AppState>,
    Path(investigation_id): Path<Uuid>,
    claims: Claims,
) -> Result<Json<serde_json::Value>, AppError> {
    check_member_access(&state.db, investigation_id, claims.sub).await?;

    let links = sqlx::query!(
        r#"
        SELECT l.id, l.title, l.description, l.created_at,
               fe.id as from_id, fe.title as from_title, fe.entity_type as from_type,
               te.id as to_id, te.title as to_title, te.entity_type as to_type,
               u.username as created_by
        FROM investigation_link l
        JOIN investigation_entity fe ON l.from_entity_id = fe.id
        JOIN investigation_entity te ON l.to_entity_id = te.id
        JOIN investigation_user u ON l.created_by_id = u.id
        WHERE l.investigation_id = $1
        ORDER BY l.created_at DESC
        "#,
        investigation_id
    )
    .fetch_all(&state.db)
    .await?;

    let results: Vec<LinkResponse> = links
        .into_iter()
        .map(|l| LinkResponse {
            id: l.id,
            from_entity: EntityInfo {
                id: l.from_id,
                title: l.from_title,
                entity_type: l.from_type,
            },
            to_entity: EntityInfo {
                id: l.to_id,
                title: l.to_title,
                entity_type: l.to_type,
            },
            title: l.title,
            description: l.description,
            created_at: l.created_at.assume_utc().to_string(),
            created_by: l.created_by,
        })
        .collect();

    Ok(Json(json!({ "links": results })))
}

pub async fn create_link(
    State(state): State<AppState>,
    Path(investigation_id): Path<Uuid>,
    claims: Claims,
    Json(payload): Json<CreateLink>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    check_member_access(&state.db, investigation_id, claims.sub).await?;

    let from_entity_id = Uuid::parse_str(&payload.from_entity_id)
        .map_err(|_| AppError::BadRequest("Invalid from_entity_id".to_string()))?;
    let to_entity_id = Uuid::parse_str(&payload.to_entity_id)
        .map_err(|_| AppError::BadRequest("Invalid to_entity_id".to_string()))?;

    // Verify both entities exist and belong to this investigation
    let from_exists = sqlx::query!(
        "SELECT id FROM investigation_entity WHERE id = $1 AND investigation_id = $2",
        from_entity_id,
        investigation_id
    )
    .fetch_optional(&state.db)
    .await?;

    let to_exists = sqlx::query!(
        "SELECT id FROM investigation_entity WHERE id = $1 AND investigation_id = $2",
        to_entity_id,
        investigation_id
    )
    .fetch_optional(&state.db)
    .await?;

    if from_exists.is_none() || to_exists.is_none() {
        return Err(AppError::BadRequest("One or both entities not found".to_string()));
    }

    // Check if reverse link exists
    let reverse_exists = sqlx::query!(
        "SELECT id FROM investigation_link WHERE investigation_id = $1 AND from_entity_id = $2 AND to_entity_id = $3",
        investigation_id,
        to_entity_id,
        from_entity_id
    )
    .fetch_optional(&state.db)
    .await?;

    if reverse_exists.is_some() {
        return Err(AppError::BadRequest("Un lien inverse existe déjà".to_string()));
    }

    // Create link
    let link = sqlx::query!(
        r#"
        INSERT INTO investigation_link (id, investigation_id, from_entity_id, to_entity_id, title, description, created_at, created_by_id)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), $6)
        RETURNING id
        "#,
        investigation_id,
        from_entity_id,
        to_entity_id,
        payload.title,
        payload.description,
        claims.sub
    )
    .fetch_one(&state.db)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": link.id,
            "message": "Link created successfully"
        })),
    ))
}

pub async fn delete_link(
    State(state): State<AppState>,
    Path((investigation_id, link_id)): Path<(Uuid, Uuid)>,
    claims: Claims,
) -> Result<Json<serde_json::Value>, AppError> {
    check_member_access(&state.db, investigation_id, claims.sub).await?;

    let result = sqlx::query!(
        "DELETE FROM investigation_link WHERE id = $1 AND investigation_id = $2",
        link_id,
        investigation_id
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Link not found".to_string()));
    }

    Ok(Json(json!({ "message": "Link deleted successfully" })))
}
