use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{CreateEntity, EntityResponse, TagInfo, UpdateEntity};
use crate::utils::Claims;
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct EntityQuery {
    #[serde(rename = "type")]
    entity_type: Option<String>,
    search: Option<String>,
}

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

async fn resolve_tags(
    db: &sqlx::PgPool,
    investigation_id: Uuid,
    tag_names: Vec<String>,
) -> Result<Vec<Uuid>, AppError> {
    let mut tag_ids = Vec::new();
    
    for name in tag_names {
        let name = name.trim();
        if name.is_empty() {
            continue;
        }
        
        // Try to find existing tag (case-insensitive)
        let existing = sqlx::query!(
            "SELECT id FROM investigation_tag WHERE investigation_id = $1 AND LOWER(name) = LOWER($2)",
            investigation_id,
            name
        )
        .fetch_optional(db)
        .await?;
        
        let tag_id = if let Some(tag) = existing {
            tag.id
        } else {
            // Create new tag
            let new_tag = sqlx::query!(
                "INSERT INTO investigation_tag (id, investigation_id, name, created_at) VALUES (gen_random_uuid(), $1, $2, NOW()) RETURNING id",
                investigation_id,
                name
            )
            .fetch_one(db)
            .await?;
            new_tag.id
        };
        
        tag_ids.push(tag_id);
    }
    
    Ok(tag_ids)
}

pub async fn list_entities(
    State(state): State<AppState>,
    Path(investigation_id): Path<Uuid>,
    Query(query): Query<EntityQuery>,
    claims: Claims,
) -> Result<Json<serde_json::Value>, AppError> {
    check_member_access(&state.db, investigation_id, claims.sub).await?;

    let mut query_str = r#"
        SELECT e.id, e.entity_type, e.title, e.description, e.role, e.location, e.address,
               e.event_date, e.event_end_date, e.is_timeslot, e.evidence_type, e.photo,
               e.created_at, e.updated_at, u.username as created_by,
               COUNT(DISTINCT c.id) as comments_count,
               COUNT(DISTINCT a.id) as attachments_count
        FROM investigation_entity e
        JOIN investigation_user u ON e.created_by_id = u.id
        LEFT JOIN investigation_comment c ON e.id = c.entity_id
        LEFT JOIN investigation_attachment a ON e.id = a.entity_id
        WHERE e.investigation_id = $1
    "#.to_string();

    let mut param_count = 1;
    let mut conditions = Vec::new();

    if query.entity_type.is_some() {
        param_count += 1;
        conditions.push(format!("e.entity_type = ${}", param_count));
    }

    if query.search.is_some() {
        param_count += 1;
        conditions.push(format!("(e.title ILIKE ${} OR e.description ILIKE ${})", param_count, param_count));
    }

    if !conditions.is_empty() {
        query_str.push_str(" AND ");
        query_str.push_str(&conditions.join(" AND "));
    }

    query_str.push_str(" GROUP BY e.id, u.username ORDER BY e.created_at DESC");

    let mut query_builder = sqlx::query(&query_str).bind(investigation_id);

    if let Some(ref entity_type) = query.entity_type {
        query_builder = query_builder.bind(entity_type);
    }

    if let Some(ref search) = query.search {
        let search_pattern = format!("%{}%", search);
        query_builder = query_builder.bind(&search_pattern);
    }

    let entities = query_builder.fetch_all(&state.db).await?;

    let mut results = Vec::new();
    
    for row in entities {
        let entity_id: Uuid = row.try_get("id")?;
        
        // Get tags for this entity
        let tags = sqlx::query!(
            r#"
            SELECT t.id, t.name, t.color
            FROM investigation_tag t
            JOIN investigation_entity_tags et ON t.id = et.tag_id
            WHERE et.entity_id = $1
            "#,
            entity_id
        )
        .fetch_all(&state.db)
        .await?;

        let tag_infos: Vec<TagInfo> = tags
            .into_iter()
            .map(|t| TagInfo {
                id: t.id,
                name: t.name,
                color: t.color,
            })
            .collect();

        let event_date: Option<time::OffsetDateTime> = row.try_get("event_date").ok().flatten().map(|dt: time::PrimitiveDateTime| dt.assume_utc());
        let event_end_date: Option<time::OffsetDateTime> = row.try_get("event_end_date").ok().flatten().map(|dt: time::PrimitiveDateTime| dt.assume_utc());

        results.push(EntityResponse {
            id: entity_id,
            entity_type: row.try_get("entity_type")?,
            title: row.try_get("title")?,
            description: row.try_get("description")?,
            role: row.try_get("role")?,
            location: row.try_get("location")?,
            address: row.try_get("address")?,
            event_date: event_date.map(|dt| dt.to_string()),
            event_end_date: event_end_date.map(|dt| dt.to_string()),
            is_timeslot: row.try_get("is_timeslot")?,
            evidence_type: row.try_get("evidence_type")?,
            created_at: row.try_get::<time::PrimitiveDateTime, _>("created_at")?.assume_utc().to_string(),
            updated_at: row.try_get::<time::PrimitiveDateTime, _>("updated_at")?.assume_utc().to_string(),
            created_by: row.try_get("created_by")?,
            photo_url: row.try_get("photo")?,
            tags: tag_infos,
            comments_count: row.try_get::<i64, _>("comments_count")?,
            attachments_count: row.try_get::<i64, _>("attachments_count")?,
        });
    }

    Ok(Json(json!({ "entities": results })))
}

pub async fn create_entity(
    State(state): State<AppState>,
    Path(investigation_id): Path<Uuid>,
    claims: Claims,
    Json(payload): Json<CreateEntity>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    check_member_access(&state.db, investigation_id, claims.sub).await?;

    // Parse dates if provided
    let event_date = payload.event_date.as_ref().and_then(|d| {
        time::OffsetDateTime::parse(d, &time::format_description::well_known::Rfc3339).ok()
    });
    
    let event_end_date = payload.event_end_date.as_ref().and_then(|d| {
        time::OffsetDateTime::parse(d, &time::format_description::well_known::Rfc3339).ok()
    });

    let entity = sqlx::query!(
        r#"
        INSERT INTO investigation_entity 
        (id, investigation_id, entity_type, title, description, role, location, address,
         event_date, event_end_date, is_timeslot, evidence_type, created_at, updated_at, created_by_id)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), $12)
        RETURNING id
        "#,
        investigation_id,
        payload.entity_type,
        payload.title,
        payload.description,
        payload.role,
        payload.location,
        payload.address,
        event_date,
        event_end_date,
        payload.is_timeslot.unwrap_or(false),
        payload.evidence_type,
        claims.sub
    )
    .fetch_one(&state.db)
    .await?;

    // Handle tags
    if let Some(tags) = payload.tags {
        let tag_ids = resolve_tags(&state.db, investigation_id, tags).await?;
        
        for tag_id in tag_ids {
            sqlx::query!(
                "INSERT INTO investigation_entity_tags (entity_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                entity.id,
                tag_id
            )
            .execute(&state.db)
            .await?;
        }
    }

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": entity.id,
            "message": "Entity created successfully"
        })),
    ))
}

pub async fn update_entity(
    State(state): State<AppState>,
    Path((investigation_id, entity_id)): Path<(Uuid, Uuid)>,
    claims: Claims,
    Json(payload): Json<UpdateEntity>,
) -> Result<Json<serde_json::Value>, AppError> {
    check_member_access(&state.db, investigation_id, claims.sub).await?;

    // Verify entity belongs to investigation
    let entity = sqlx::query!(
        "SELECT id FROM investigation_entity WHERE id = $1 AND investigation_id = $2",
        entity_id,
        investigation_id
    )
    .fetch_optional(&state.db)
    .await?;

    if entity.is_none() {
        return Err(AppError::NotFound("Entity not found".to_string()));
    }

    // Parse dates if provided
    let event_date = payload.event_date.as_ref().and_then(|d| {
        time::OffsetDateTime::parse(d, &time::format_description::well_known::Rfc3339).ok()
    });
    
    let event_end_date = payload.event_end_date.as_ref().and_then(|d| {
        time::OffsetDateTime::parse(d, &time::format_description::well_known::Rfc3339).ok()
    });

    // Build update query dynamically
    let mut updates = Vec::new();
    let mut param_count = 0;

    if payload.title.is_some() {
        param_count += 1;
        updates.push(format!("title = ${}", param_count));
    }
    if payload.description.is_some() {
        param_count += 1;
        updates.push(format!("description = ${}", param_count));
    }
    if payload.role.is_some() {
        param_count += 1;
        updates.push(format!("role = ${}", param_count));
    }
    if payload.location.is_some() {
        param_count += 1;
        updates.push(format!("location = ${}", param_count));
    }
    if payload.address.is_some() {
        param_count += 1;
        updates.push(format!("address = ${}", param_count));
    }
    if event_date.is_some() {
        param_count += 1;
        updates.push(format!("event_date = ${}", param_count));
    }
    if event_end_date.is_some() {
        param_count += 1;
        updates.push(format!("event_end_date = ${}", param_count));
    }
    if payload.is_timeslot.is_some() {
        param_count += 1;
        updates.push(format!("is_timeslot = ${}", param_count));
    }
    if payload.evidence_type.is_some() {
        param_count += 1;
        updates.push(format!("evidence_type = ${}", param_count));
    }

    if !updates.is_empty() {
        updates.push("updated_at = NOW()".to_string());
        
        let query_str = format!(
            "UPDATE investigation_entity SET {} WHERE id = ${}",
            updates.join(", "),
            param_count + 1
        );

        let mut query_builder = sqlx::query(&query_str);

        if let Some(ref title) = payload.title {
            query_builder = query_builder.bind(title);
        }
        if let Some(ref description) = payload.description {
            query_builder = query_builder.bind(description);
        }
        if let Some(ref role) = payload.role {
            query_builder = query_builder.bind(role);
        }
        if let Some(ref location) = payload.location {
            query_builder = query_builder.bind(location);
        }
        if let Some(ref address) = payload.address {
            query_builder = query_builder.bind(address);
        }
        if let Some(date) = event_date {
            query_builder = query_builder.bind(date);
        }
        if let Some(date) = event_end_date {
            query_builder = query_builder.bind(date);
        }
        if let Some(is_timeslot) = payload.is_timeslot {
            query_builder = query_builder.bind(is_timeslot);
        }
        if let Some(ref evidence_type) = payload.evidence_type {
            query_builder = query_builder.bind(evidence_type);
        }

        query_builder = query_builder.bind(entity_id);
        query_builder.execute(&state.db).await?;
    }

    // Handle tags update
    if let Some(tags) = payload.tags {
        // Remove existing tags
        sqlx::query!("DELETE FROM investigation_entity_tags WHERE entity_id = $1", entity_id)
            .execute(&state.db)
            .await?;
        
        // Add new tags
        let tag_ids = resolve_tags(&state.db, investigation_id, tags).await?;
        
        for tag_id in tag_ids {
            sqlx::query!(
                "INSERT INTO investigation_entity_tags (entity_id, tag_id) VALUES ($1, $2)",
                entity_id,
                tag_id
            )
            .execute(&state.db)
            .await?;
        }
    }

    Ok(Json(json!({ "message": "Entity updated successfully" })))
}

pub async fn delete_entity(
    State(state): State<AppState>,
    Path((investigation_id, entity_id)): Path<(Uuid, Uuid)>,
    claims: Claims,
) -> Result<Json<serde_json::Value>, AppError> {
    check_member_access(&state.db, investigation_id, claims.sub).await?;

    let result = sqlx::query!(
        "DELETE FROM investigation_entity WHERE id = $1 AND investigation_id = $2",
        entity_id,
        investigation_id
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Entity not found".to_string()));
    }

    Ok(Json(json!({ "message": "Entity deleted successfully" })))
}
