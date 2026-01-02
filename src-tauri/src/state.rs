//! Application state management

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Matrix homeserver URL
    pub homeserver: String,
    /// WebSocket URL
    pub websocket_url: String,
    /// Application version
    pub version: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            homeserver: "https://matrix.org".to_string(),
            websocket_url: "ws://localhost:8080".to_string(),
            version: "1.0.0".to_string(),
        }
    }
}

/// Application state
pub struct AppState {
    /// HTTP client for making requests
    pub http_client: reqwest::Client,
    /// Application configuration
    pub config: Arc<Mutex<AppConfig>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

impl AppState {
    /// Create a new application state
    #[must_use] 
    pub fn new() -> Self {
        Self {
            http_client: reqwest::Client::new(),
            config: Arc::new(Mutex::new(AppConfig::default())),
        }
    }

    /// Get the current homeserver URL
    pub async fn homeserver(&self) -> String {
        self.config.lock().await.homeserver.clone()
    }
}