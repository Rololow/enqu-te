use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use uuid::Uuid;

/// Bidirectional link between entities
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Link {
    pub id: Uuid,
    pub investigation_id: Uuid,
    pub from_entity_id: Uuid,
    pub to_entity_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    #[sqlx(try_from = "time::OffsetDateTime")]
    pub created_at: OffsetDateTime,
    pub created_by_id: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateLink {
    pub from_entity_id: String,
    pub to_entity_id: String,
    pub title: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LinkResponse {
    pub id: Uuid,
    pub from_entity: EntityInfo,
    pub to_entity: EntityInfo,
    pub title: String,
    pub description: Option<String>,
    pub created_at: String,
    pub created_by: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EntityInfo {
    pub id: Uuid,
    pub title: String,
    #[serde(rename = "type")]
    pub entity_type: String,
}
