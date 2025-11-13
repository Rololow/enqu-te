use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use uuid::Uuid;

/// File attachments for entities
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Attachment {
    pub id: Uuid,
    pub entity_id: Uuid,
    pub file_path: String,
    pub filename: String,
    pub file_type: Option<String>,
    pub uploaded_by_id: i32,
    #[sqlx(try_from = "time::OffsetDateTime")]
    pub uploaded_at: OffsetDateTime,
}

#[derive(Debug, Serialize)]
pub struct AttachmentResponse {
    pub id: Uuid,
    pub filename: String,
    pub file_type: Option<String>,
    pub uploaded_by: String,
    pub uploaded_at: String,
    pub file_url: String,
}
