#[derive(thiserror::Error, Debug)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(String),
    #[error("Network error: {0}")]
    Network(String),
    #[error("Invalid URI: {0}")]
    InvalidUri(String),
    #[error("File too large: {0}")]
    FileTooLarge(String),
    #[error("Database error: {0}")]
    Database(String),
    #[error("Request error: {0}")]
    Request(String),
    #[error("Token expired")]
    TokenExpired,
    #[error("Unexpected error: {0}")]
    Unexpected(String),
}

// Implement Serialize for AppError for Tauri IPC
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::Network(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}

impl From<sea_orm::DbErr> for AppError {
    fn from(err: sea_orm::DbErr) -> Self {
        AppError::Database(err.to_string())
    }
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Unexpected(err.to_string())
    }
}

#[derive(thiserror::Error)]
pub enum CommonError {
    #[error(transparent)]
    UnexpectedError(#[from] anyhow::Error),
    #[error("Database error: {0}")]
    DatabaseError(#[from] sea_orm::DbErr),
    #[error("Request error: {0}")]
    RequestError(String),
    #[error("Token expired")]
    TokenExpired,
}

impl From<CommonError> for String {
    fn from(err: CommonError) -> String {
        err.to_string()
    }
}

impl std::fmt::Debug for CommonError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

pub fn error_chain_fmt(
    e: &impl std::error::Error,
    f: &mut std::fmt::Formatter<'_>,
) -> std::fmt::Result {
    writeln!(f, "{e}\n")?;
    let mut current = e.source();
    while let Some(cause) = current {
        writeln!(f, "Caused by:\n\t{cause}")?;
        current = cause.source();
    }
    Ok(())
}
