//! Media commands for handling file uploads, downloads, and caching

use crate::{error::AppError, state::AppState};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{Manager, State, command};
use tokio::fs;
use tracing::info;

/// Media download options
#[derive(Debug, Deserialize)]
pub struct DownloadMediaOptions {
    /// Matrix content URI (mxc://)
    pub mxc_uri: String,
    /// Force re-download even if cached
    pub force: bool,
    /// Maximum file size in bytes
    pub max_size: Option<usize>,
}

/// Media download result
#[derive(Debug, Serialize)]
pub struct DownloadMediaResult {
    /// Local file path
    pub local_path: String,
    /// File size in bytes
    pub size: u64,
    /// MIME type
    pub mime_type: String,
}

/// Cache statistics
#[derive(Debug, Serialize)]
pub struct CacheStats {
    /// Number of cached files
    pub count: usize,
    /// Total cache size in bytes
    pub total_size: u64,
    /// Oldest entry timestamp
    pub oldest_entry: Option<u64>,
    /// Newest entry timestamp
    pub newest_entry: Option<u64>,
}

/// Parse MXC URI to extract server name and media ID
fn parse_mxc_uri(mxc_uri: &str) -> Result<(String, String), AppError> {
    if !mxc_uri.starts_with("mxc://") {
        return Err(AppError::InvalidUri("Invalid MXC URI format".to_string()));
    }

    let parts = mxc_uri
        .strip_prefix("mxc://")
        .ok_or_else(|| AppError::InvalidUri("Invalid MXC URI prefix".to_string()))?;

    let mut split = parts.splitn(2, '/');

    let server_name = split
        .next()
        .ok_or_else(|| AppError::InvalidUri("Missing server name in MXC URI".to_string()))?
        .to_string();

    let media_id = split
        .next()
        .ok_or_else(|| AppError::InvalidUri("Missing media ID in MXC URI".to_string()))?
        .to_string();

    Ok((server_name, media_id))
}

/// Get media cache directory
async fn get_cache_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;

    let cache_dir = app_dir.join("media_cache");

    if !cache_dir.exists() {
        fs::create_dir_all(&cache_dir)
            .await
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    Ok(cache_dir)
}

/// Get local file path for cached media
fn get_cache_path(cache_dir: &Path, server_name: &str, media_id: &str) -> PathBuf {
    // Use a safe filename format
    let safe_server = server_name.replace(['/', ':', '\\'], "_");
    let safe_media = media_id.replace(['/', ':', '\\'], "_");
    cache_dir.join(format!("{safe_server}_{safe_media}"))
}

/// Download media from Matrix server
#[command]
pub async fn download_media(
    options: DownloadMediaOptions,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<DownloadMediaResult, AppError> {
    info!("Downloading media: {}", options.mxc_uri);

    // Parse MXC URI
    let (server_name, media_id) = parse_mxc_uri(&options.mxc_uri)?;

    // Get cache directory
    let cache_dir = get_cache_dir(&app_handle).await?;
    let local_path = get_cache_path(&cache_dir, &server_name, &media_id);

    // Check if file exists in cache
    if !options.force && local_path.exists() {
        let metadata = fs::metadata(&local_path)
            .await
            .map_err(|e| AppError::Io(e.to_string()))?;

        let size = metadata.len();

        // Try to determine MIME type
        let mime_type = mime_guess::from_path(&local_path)
            .first_or_octet_stream()
            .to_string();

        return Ok(DownloadMediaResult {
            local_path: local_path.to_string_lossy().to_string(),
            size,
            mime_type,
        });
    }

    // Construct download URL
    let homeserver = state.config.lock().await.homeserver.clone();
    let download_url = format!(
        "{}/_matrix/media/r0/download/{}/{}",
        homeserver.trim_end_matches('/'),
        server_name,
        media_id
    );

    // Download file
    let response = state
        .http_client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;

    // Check content length
    if let Some(content_length) = response.content_length()
        && let Some(max_size) = options.max_size
        && content_length > max_size as u64
    {
        return Err(AppError::FileTooLarge(format!(
            "File size {content_length} exceeds maximum {max_size}"
        )));
    }

    // Get MIME type from response
    let mime_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    // Download content
    let bytes = response
        .bytes()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;

    // Check file size
    if let Some(max_size) = options.max_size
        && bytes.len() > max_size
    {
        return Err(AppError::FileTooLarge(format!(
            "File size {} exceeds maximum {max_size}",
            bytes.len()
        )));
    }

    // Save to cache
    fs::write(&local_path, &bytes)
        .await
        .map_err(|e| AppError::Io(e.to_string()))?;

    info!(
        "Media downloaded successfully: {} -> {} ({} bytes)",
        options.mxc_uri,
        local_path.display(),
        bytes.len()
    );

    Ok(DownloadMediaResult {
        local_path: local_path.to_string_lossy().to_string(),
        size: bytes.len() as u64,
        mime_type,
    })
}

/// Delete cached media
#[command]
pub async fn delete_cached_media(
    mxc_uri: String,
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    info!("Deleting cached media: {}", mxc_uri);

    let (server_name, media_id) = parse_mxc_uri(&mxc_uri)?;
    let cache_dir = get_cache_dir(&app_handle).await?;
    let local_path = get_cache_path(&cache_dir, &server_name, &media_id);

    if local_path.exists() {
        fs::remove_file(&local_path)
            .await
            .map_err(|e| AppError::Io(e.to_string()))?;

        info!("Deleted cached media: {}", local_path.display());
    }

    Ok(())
}

/// Clear all media cache
#[command]
pub async fn clear_media_cache(app_handle: tauri::AppHandle) -> Result<CacheStats, AppError> {
    info!("Clearing media cache");

    let cache_dir = get_cache_dir(&app_handle).await?;
    let mut stats = CacheStats {
        count: 0,
        total_size: 0,
        oldest_entry: None,
        newest_entry: None,
    };

    if cache_dir.exists() {
        let mut entries = fs::read_dir(&cache_dir)
            .await
            .map_err(|e| AppError::Io(e.to_string()))?;

        let mut oldest_ts = u64::MAX;
        let mut newest_ts = 0;

        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|e| AppError::Io(e.to_string()))?
        {
            let metadata = entry
                .metadata()
                .await
                .map_err(|e| AppError::Io(e.to_string()))?;

            if metadata.is_file() {
                stats.count += 1;
                stats.total_size += metadata.len();

                let modified = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs());

                if let Some(ts) = modified {
                    oldest_ts = oldest_ts.min(ts);
                    newest_ts = newest_ts.max(ts);
                }

                // Delete the file
                fs::remove_file(entry.path())
                    .await
                    .map_err(|e| AppError::Io(e.to_string()))?;
            }
        }

        if oldest_ts != u64::MAX {
            stats.oldest_entry = Some(oldest_ts);
        }
        if newest_ts != 0 {
            stats.newest_entry = Some(newest_ts);
        }
    }

    info!(
        "Media cache cleared: {} files, {} bytes",
        stats.count, stats.total_size
    );

    Ok(stats)
}

/// Get media cache statistics
#[command]
pub async fn get_media_cache_stats(app_handle: tauri::AppHandle) -> Result<CacheStats, AppError> {
    let cache_dir = get_cache_dir(&app_handle).await?;
    let mut stats = CacheStats {
        count: 0,
        total_size: 0,
        oldest_entry: None,
        newest_entry: None,
    };

    if cache_dir.exists() {
        let mut entries = fs::read_dir(&cache_dir)
            .await
            .map_err(|e| AppError::Io(e.to_string()))?;

        let mut oldest_ts = u64::MAX;
        let mut newest_ts = 0;

        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|e| AppError::Io(e.to_string()))?
        {
            let metadata = entry
                .metadata()
                .await
                .map_err(|e| AppError::Io(e.to_string()))?;

            if metadata.is_file() {
                stats.count += 1;
                stats.total_size += metadata.len();

                let modified = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs());

                if let Some(ts) = modified {
                    oldest_ts = oldest_ts.min(ts);
                    newest_ts = newest_ts.max(ts);
                }
            }
        }

        if oldest_ts != u64::MAX {
            stats.oldest_entry = Some(oldest_ts);
        }
        if newest_ts != 0 {
            stats.newest_entry = Some(newest_ts);
        }
    }

    Ok(stats)
}

/// Preload media files
#[command]
pub async fn preload_media(
    mxc_uris: Vec<String>,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<usize, AppError> {
    info!("Preloading {} media files", mxc_uris.len());

    let mut success_count = 0;

    for uri in &mxc_uris {
        let options = DownloadMediaOptions {
            mxc_uri: uri.clone(),
            force: false,
            max_size: Some(50 * 1024 * 1024), // 50MB limit for preload
        };

        if download_media(options, app_handle.clone(), state.clone())
            .await
            .is_ok()
        {
            success_count += 1;
        }
    }

    info!(
        "Media preload completed: {}/{} files",
        success_count,
        mxc_uris.len()
    );

    Ok(success_count)
}
