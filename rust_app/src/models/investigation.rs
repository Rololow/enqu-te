use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use uuid::Uuid;

/// Investigation model
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Investigation {
    pub id: Uuid,
    pub code: String,
    pub title: String,
    pub description: Option<String>,
    #[sqlx(try_from = "time::OffsetDateTime")]
    pub created_at: OffsetDateTime,
    #[sqlx(try_from = "time::OffsetDateTime")]
    pub updated_at: OffsetDateTime,
    pub created_by_id: i32,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateInvestigation {
    pub title: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInvestigation {
    pub title: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct JoinInvestigation {
    pub code: String,
}

/// Membership model for investigation participants
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct InvestigationMember {
    pub id: i32,
    pub investigation_id: Uuid,
    pub user_id: i32,
    pub role: String,
    #[sqlx(try_from = "time::OffsetDateTime")]
    pub joined_at: OffsetDateTime,
    #[sqlx(try_from = "Option<time::OffsetDateTime>")]
    pub last_seen: Option<OffsetDateTime>,
}

#[derive(Debug, Serialize)]
pub struct MemberResponse {
    pub id: i32,
    pub username: String,
    pub email: String,
    pub avatar: Option<String>,
    pub role: String,
    pub joined_at: OffsetDateTime,
    pub last_seen: Option<OffsetDateTime>,
    pub online: bool,
}

#[derive(Debug, Serialize)]
pub struct InvestigationResponse {
    pub id: Uuid,
    pub code: String,
    pub title: String,
    pub description: Option<String>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
    pub is_active: bool,
    pub created_by: String,
    pub member_count: i64,
}
