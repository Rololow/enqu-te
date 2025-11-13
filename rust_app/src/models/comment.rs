use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use uuid::Uuid;

/// Comments on entities
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Comment {
    pub id: Uuid,
    pub entity_id: Uuid,
    pub author_id: i32,
    pub content: String,
    #[sqlx(try_from = "time::OffsetDateTime")]
    pub created_at: OffsetDateTime,
    #[sqlx(try_from = "time::OffsetDateTime")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateComment {
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct CommentResponse {
    pub id: Uuid,
    pub author: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}
