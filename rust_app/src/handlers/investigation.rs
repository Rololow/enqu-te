use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{CreateInvestigation, InvestigationResponse, JoinInvestigation, MemberResponse};
use crate::utils::{generate_investigation_code, Claims};
use crate::AppState;

pub async fn list_investigations(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<serde_json::Value>, AppError> {
    let investigations = sqlx::query!(
        r#"
        SELECT i.id, i.code, i.title, i.description, i.created_at, i.updated_at, i.is_active,
               u.username as created_by, COUNT(DISTINCT im.user_id) as member_count
        FROM investigation_investigation i
        JOIN investigation_user u ON i.created_by_id = u.id
        JOIN investigation_investigationmember im ON i.id = im.investigation_id
        WHERE im.user_id = $1
        GROUP BY i.id, u.username
        ORDER BY i.updated_at DESC
        "#,
        claims.sub
    )
    .fetch_all(&state.db)
    .await?;

    let results: Vec<_> = investigations
        .into_iter()
        .map(|inv| InvestigationResponse {
            id: inv.id,
            code: inv.code,
            title: inv.title,
            description: inv.description,
            created_at: inv.created_at.assume_utc(),
            updated_at: inv.updated_at.assume_utc(),
            is_active: inv.is_active,
            created_by: inv.created_by.unwrap_or_default(),
            member_count: inv.member_count.unwrap_or(0),
        })
        .collect();

    Ok(Json(json!({ "investigations": results })))
}

pub async fn get_investigation(
    State(state): State<AppState>,
    Path(investigation_id): Path<Uuid>,
    claims: Claims,
) -> Result<Json<InvestigationResponse>, AppError> {
    // Check if user is a member
    let is_member = sqlx::query!(
        "SELECT id FROM investigation_investigationmember WHERE investigation_id = $1 AND user_id = $2",
        investigation_id,
        claims.sub
    )
    .fetch_optional(&state.db)
    .await?;

    if is_member.is_none() {
        return Err(AppError::Unauthorized("Not a member of this investigation".to_string()));
    }

    let inv = sqlx::query!(
        r#"
        SELECT i.id, i.code, i.title, i.description, i.created_at, i.updated_at, i.is_active,
               u.username as created_by, COUNT(DISTINCT im.user_id) as member_count
        FROM investigation_investigation i
        JOIN investigation_user u ON i.created_by_id = u.id
        LEFT JOIN investigation_investigationmember im ON i.id = im.investigation_id
        WHERE i.id = $1
        GROUP BY i.id, u.username
        "#,
        investigation_id
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(InvestigationResponse {
        id: inv.id,
        code: inv.code,
        title: inv.title,
        description: inv.description,
        created_at: inv.created_at.assume_utc(),
        updated_at: inv.updated_at.assume_utc(),
        is_active: inv.is_active,
        created_by: inv.created_by.unwrap_or_default(),
        member_count: inv.member_count.unwrap_or(0),
    }))
}

pub async fn create_investigation(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateInvestigation>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    // Generate unique code
    let mut code = generate_investigation_code();
    let mut attempts = 0;
    
    loop {
        let exists = sqlx::query!("SELECT id FROM investigation_investigation WHERE code = $1", code)
            .fetch_optional(&state.db)
            .await?;
        
        if exists.is_none() {
            break;
        }
        
        attempts += 1;
        if attempts > 10 {
            return Err(AppError::InternalError("Failed to generate unique code".to_string()));
        }
        
        code = generate_investigation_code();
    }

    // Create investigation
    let investigation = sqlx::query!(
        r#"
        INSERT INTO investigation_investigation (id, code, title, description, created_at, updated_at, created_by_id, is_active)
        VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW(), $4, true)
        RETURNING id, code, title, description, created_at, updated_at
        "#,
        code,
        payload.title,
        payload.description,
        claims.sub
    )
    .fetch_one(&state.db)
    .await?;

    // Add creator as owner
    sqlx::query!(
        r#"
        INSERT INTO investigation_investigationmember (investigation_id, user_id, role, joined_at)
        VALUES ($1, $2, 'owner', NOW())
        "#,
        investigation.id,
        claims.sub
    )
    .execute(&state.db)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "Investigation created successfully",
            "id": investigation.id,
            "code": investigation.code
        })),
    ))
}

pub async fn join_investigation(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<JoinInvestigation>,
) -> Result<Json<serde_json::Value>, AppError> {
    let code = payload.code.to_uppercase();
    
    // Find investigation by code
    let investigation = sqlx::query!(
        "SELECT id FROM investigation_investigation WHERE code = $1 AND is_active = true",
        code
    )
    .fetch_optional(&state.db)
    .await?;

    let investigation = investigation
        .ok_or_else(|| AppError::NotFound("Investigation not found".to_string()))?;

    // Check if already a member
    let existing = sqlx::query!(
        "SELECT id FROM investigation_investigationmember WHERE investigation_id = $1 AND user_id = $2",
        investigation.id,
        claims.sub
    )
    .fetch_optional(&state.db)
    .await?;

    if existing.is_some() {
        return Err(AppError::BadRequest("Already a member".to_string()));
    }

    // Add as member
    sqlx::query!(
        r#"
        INSERT INTO investigation_investigationmember (investigation_id, user_id, role, joined_at)
        VALUES ($1, $2, 'member', NOW())
        "#,
        investigation.id,
        claims.sub
    )
    .execute(&state.db)
    .await?;

    Ok(Json(json!({
        "message": "Joined investigation successfully",
        "investigation_id": investigation.id
    })))
}

pub async fn get_members(
    State(state): State<AppState>,
    Path(investigation_id): Path<Uuid>,
    claims: Claims,
) -> Result<Json<serde_json::Value>, AppError> {
    // Check if user is a member
    let is_member = sqlx::query!(
        "SELECT id FROM investigation_investigationmember WHERE investigation_id = $1 AND user_id = $2",
        investigation_id,
        claims.sub
    )
    .fetch_optional(&state.db)
    .await?;

    if is_member.is_none() {
        return Err(AppError::Unauthorized("Not a member of this investigation".to_string()));
    }

    let members = sqlx::query!(
        r#"
        SELECT u.id, u.username, u.email, u.avatar, im.role, im.joined_at, im.last_seen
        FROM investigation_investigationmember im
        JOIN investigation_user u ON im.user_id = u.id
        WHERE im.investigation_id = $1
        ORDER BY im.joined_at
        "#,
        investigation_id
    )
    .fetch_all(&state.db)
    .await?;

    let now = time::OffsetDateTime::now_utc();
    let presence_threshold = time::Duration::seconds(30);

    let results: Vec<_> = members
        .into_iter()
        .map(|m| {
            let last_seen_time = m.last_seen.map(|dt| dt.assume_utc());
            let online = last_seen_time
                .map(|dt| now - dt <= presence_threshold)
                .unwrap_or(false);

            MemberResponse {
                id: m.id,
                username: m.username,
                email: m.email,
                avatar: m.avatar,
                role: m.role,
                joined_at: m.joined_at.assume_utc(),
                last_seen: last_seen_time,
                online,
            }
        })
        .collect();

    Ok(Json(json!({ "members": results })))
}

pub async fn update_presence(
    State(state): State<AppState>,
    Path(investigation_id): Path<Uuid>,
    claims: Claims,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = sqlx::query!(
        r#"
        UPDATE investigation_investigationmember
        SET last_seen = NOW()
        WHERE investigation_id = $1 AND user_id = $2
        RETURNING last_seen
        "#,
        investigation_id,
        claims.sub
    )
    .fetch_optional(&state.db)
    .await?;

    let result = result.ok_or_else(|| AppError::NotFound("Not a member".to_string()))?;

    Ok(Json(json!({
        "status": "ok",
        "last_seen": result.last_seen.assume_utc().to_string()
    })))
}
