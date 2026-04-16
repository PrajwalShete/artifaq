use serde::{Serialize, Serializer};

/// Single error type for all Tauri commands. Serializes to a JSON object that
/// the frontend can pattern-match on.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    #[error("dialog cancelled")]
    DialogCancelled,

    #[error("not found: {0}")]
    NotFound(String),

    #[error("path not allowed: {0}")]
    PathNotAllowed(String),

    #[error("watcher: {0}")]
    Watcher(String),

    #[error("payload too large: {bytes} > {limit}")]
    TooLarge { bytes: u64, limit: u64 },

    #[error("{0}")]
    Other(String),
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(self.to_string().as_ref())
    }
}

pub type AppResult<T> = Result<T, AppError>;
