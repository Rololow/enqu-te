use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use uuid::Uuid;

/// Base entity model for people, evidence, and events
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Entity {
    pub id: Uuid,
    pub investigation_id: Uuid,
    pub entity_type: String,
    pub title: String,
    pub description: Option<String>,
    #[sqlx(try_from = "time::OffsetDateTime")]
    pub created_at: OffsetDateTime,
    #[sqlx(try_from = "time::OffsetDateTime")]
    pub updated_at: OffsetDateTime,
    pub created_by_id: i32,
    
    // Common fields
    pub role: Option<String>,
    pub location: Option<String>,
    pub address: Option<String>,
    #[sqlx(try_from = "Option<time::OffsetDateTime>")]
    pub event_date: Option<OffsetDateTime>,
    #[sqlx(try_from = "Option<time::OffsetDateTime>")]
    pub event_end_date: Option<OffsetDateTime>,
    pub is_timeslot: bool,
    pub evidence_type: Option<String>,
    pub photo: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEntity {
    pub entity_type: String,
    pub title: String,
    pub description: Option<String>,
    pub role: Option<String>,
    pub location: Option<String>,
    pub address: Option<String>,
    pub event_date: Option<String>,
    pub event_end_date: Option<String>,
    pub is_timeslot: Option<bool>,
    pub evidence_type: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEntity {
    pub title: Option<String>,
    pub description: Option<String>,
    pub role: Option<String>,
    pub location: Option<String>,
    pub address: Option<String>,
    pub event_date: Option<String>,
    pub event_end_date: Option<String>,
    pub is_timeslot: Option<bool>,
    pub evidence_type: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct EntityResponse {
    pub id: Uuid,
    #[serde(rename = "type")]
    pub entity_type: String,
    pub title: String,
    pub description: Option<String>,
    pub role: Option<String>,
    pub location: Option<String>,
    pub address: Option<String>,
    pub event_date: Option<String>,
    pub event_end_date: Option<String>,
    pub is_timeslot: bool,
    pub evidence_type: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub created_by: String,
    pub photo_url: Option<String>,
    pub tags: Vec<TagInfo>,
    pub comments_count: i64,
    pub attachments_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TagInfo {
    pub id: Uuid,
    pub name: String,
    pub color: Option<String>,
}
