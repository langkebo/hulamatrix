// 桌面端依赖
#[cfg(desktop)]
mod desktops;
use crate::common::files_meta::get_files_meta;
#[cfg(desktop)]
use common::init::CustomInit;
#[cfg(target_os = "windows")]
use common_cmd::get_windows_scale_info;
#[cfg(desktop)]
use common_cmd::{audio, default_window_icon, screenshot, set_height};
#[cfg(target_os = "macos")]
use common_cmd::{
    hide_title_bar_buttons, set_window_level_above_menubar, set_window_movable,
    show_title_bar_buttons,
};
#[cfg(target_os = "macos")]
use desktops::app_event;
#[cfg(desktop)]
use desktops::window_payload::{get_window_payload, push_window_payload};
#[cfg(desktop)]
use desktops::{common_cmd, directory_scanner, init, tray, video_thumbnail::get_video_thumbnail};
#[cfg(desktop)]
use directory_scanner::{cancel_directory_scan, get_directory_usage_info_with_progress};
#[cfg(desktop)]
use init::DesktopCustomInit;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri_plugin_fs::FsExt;
pub mod command;
pub mod common;
pub mod configuration;
pub mod error;
pub mod pojo;
pub mod state;
pub mod utils;
mod vo;
#[cfg(target_os = "ios")]
mod webview_helper;

use crate::command::app_state_command::is_app_state_ready;
use crate::command::setting_command::{get_settings, update_settings};
use crate::configuration::{Settings, get_configuration};
use crate::error::CommonError;
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};

// 移动端依赖
#[cfg(mobile)]
use common::init::CustomInit;
#[cfg(mobile)]
mod mobiles;
#[cfg(mobile)]
use mobiles::splash;

#[derive(Debug)]
pub struct AppData {
    db_conn: Arc<DatabaseConnection>,
    user_info: Arc<Mutex<UserInfo>>,
    pub config: Arc<Mutex<Settings>>,
    frontend_task: Mutex<bool>,
    backend_task: Mutex<bool>,
}

pub(crate) static APP_STATE_READY: AtomicBool = AtomicBool::new(false);

use crate::command::media::{
    clear_media_cache, delete_cached_media, download_media, get_media_cache_stats, preload_media,
};
use crate::state::AppState;

#[cfg(desktop)]
use tauri::Listener;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

pub fn run() {
    #[cfg(desktop)]
    {
        if let Err(e) = setup_desktop() {
            tracing::error!("Failed to setup desktop application: {}", e);
            std::process::exit(1);
        }
    }
    #[cfg(mobile)]
    {
        setup_mobile();
    }
}

#[cfg(desktop)]
fn setup_desktop() -> Result<(), CommonError> {
    // 创建一个缓存实例
    // let cache: Cache<String, String> = Cache::builder()
    //     // Time to idle (TTI):  30 minutes
    //     .time_to_idle(Duration::from_secs(30 * 60))
    //     // Create the cache.
    //     .build();
    tauri::Builder::default()
        .init_plugin()
        .init_webwindow_event()
        .init_window_event()
        .setup(move |app| {
            common_setup(app.handle().clone())?;
            Ok(())
        })
        .invoke_handler(get_invoke_handlers())
        .build(tauri::generate_context!())
        .map_err(|e| CommonError::RequestError(format!("Failed to build tauri application: {e}")))?
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            app_event::handle_app_event(app_handle, event);
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app_handle, event);
            }
        });
    Ok(())
}

// 异步初始化应用数据
async fn initialize_app_data(
    app_handle: tauri::AppHandle,
) -> Result<
    (
        Arc<DatabaseConnection>,
        Arc<Mutex<UserInfo>>,
        Arc<Mutex<Settings>>,
    ),
    CommonError,
> {
    use migration::{Migrator, MigratorTrait};
    use tracing::info;

    // 加载配置
    let configuration =
        Arc::new(Mutex::new(get_configuration(&app_handle).map_err(|e| {
            anyhow::anyhow!("Failed to load configuration: {e}")
        })?));

    // 初始化数据库连接
    let db: Arc<DatabaseConnection> = Arc::new(
        configuration
            .lock()
            .await
            .database
            .connection_string(&app_handle)
            .await?,
    );

    // 数据库迁移
    match Migrator::up(db.as_ref(), None).await {
        Ok(()) => {
            info!("Database migration completed");
        }
        Err(e) => {
            eprintln!("Warning: Database migration failed: {e}");
        }
    }

    // 创建用户信息
    let user_info = UserInfo {
        token: Default::default(),
        refresh_token: Default::default(),
        uid: Default::default(),
    };
    let user_info = Arc::new(Mutex::new(user_info));

    Ok((db, user_info, configuration))
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UserInfo {
    pub token: String,
    pub refresh_token: String,
    pub uid: String,
}

pub async fn build_request_client() -> Result<reqwest::Client, CommonError> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| anyhow::anyhow!("Reqwest client error: {e}"))?;
    Ok(client)
}

/// 处理退出登录时的窗口管理逻辑
///
/// 该函数会：
/// - 关闭除 login/tray 外的大部分窗口
/// - 隐藏但保留 capture/checkupdate 窗口
/// - 优雅地处理窗口关闭过程中的错误
#[cfg(desktop)]
pub async fn handle_logout_windows(app_handle: &tauri::AppHandle) {
    tracing::info!("[LOGOUT] Starting to close windows and preserve capture/checkupdate windows");

    let all_windows = app_handle.webview_windows();
    tracing::info!("[LOGOUT] Found {} windows", all_windows.len());

    // 收集需要关闭的窗口和需要隐藏的窗口
    let mut windows_to_close = Vec::new();
    let mut windows_to_hide = Vec::new();

    for (label, window) in all_windows {
        match label.as_str() {
            // 这些窗口完全不处理
            "login" | "tray" => {
                tracing::info!("[LOGOUT] Skipping window: {}", label);
            }
            // 这些窗口只隐藏，不销毁
            "capture" | "checkupdate" => {
                tracing::info!("[LOGOUT] Marking window for preservation: {}", label);
                windows_to_hide.push((label, window));
            }
            // 其他窗口需要关闭
            _ => {
                tracing::info!("[LOGOUT] Marking window for closure: {}", label);
                windows_to_close.push((label, window));
            }
        }
    }

    // 先隐藏需要保持的窗口
    for (label, window) in windows_to_hide {
        tracing::info!("[LOGOUT] Hiding window (preserving): {}", label);
        if let Err(e) = window.hide() {
            tracing::warn!("[LOGOUT] Failed to hide window {}: {}", label, e);
        }
    }

    // 逐个关闭窗口，添加小延迟以避免并发关闭导致的错误
    for (label, window) in windows_to_close {
        tracing::info!("[LOGOUT] Closing window: {}", label);

        // 先隐藏窗口，减少用户感知的延迟
        let _ = window.hide();

        // 添加小延迟，让窗口有时间处理正在进行的操作
        // tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

        match window.destroy() {
            Ok(()) => {
                tracing::info!("[LOGOUT] Successfully closed window: {}", label);
            }
            Err(error) => {
                // 检查窗口是否还存在
                if app_handle.get_webview_window(&label).is_none() {
                    tracing::info!(
                        "[LOGOUT] Window {} no longer exists, skipping closure",
                        label
                    );
                } else {
                    tracing::warn!(
                        "[LOGOUT] Warning when closing window {}: {} (this is usually normal)",
                        label,
                        error
                    );
                }
            }
        }
    }

    tracing::info!(
        "[LOGOUT] Logout completed - windows closed and capture/checkupdate windows preserved"
    );
}

// 设置登出事件监听器
#[cfg(desktop)]
fn setup_logout_listener(app_handle: tauri::AppHandle) {
    let app_handle_clone = app_handle.clone();
    app_handle.listen("logout", move |_event| {
        let app_handle = app_handle_clone.clone();
        tauri::async_runtime::spawn(async move {
            handle_logout_windows(&app_handle).await;
        });
    });
}

#[cfg(mobile)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn setup_mobile() {
    splash::show();
    // 创建一个缓存实例
    // let cache: Cache<String, String> = Cache::builder()
    //     // Time to idle (TTI):  30 minutes
    //     .time_to_idle(Duration::from_secs(30 * 60))
    //     // Create the cache.
    //     .build();

    if let Err(e) = tauri::Builder::default()
        .init_plugin()
        .setup(move |app| {
            let app_handle = app.handle().clone();
            #[cfg(target_os = "ios")]
            {
                if let Some(webview_window) = app_handle.get_webview_window("mobile-home") {
                    webview_helper::initialize_keyboard_adjustment(&webview_window);
                } else {
                    tracing::warn!("Mobile home webview window not found during setup");
                }
            }
            common_setup(app_handle)?;
            tracing::info!("Mobile application setup completed successfully");
            Ok(())
        })
        .invoke_handler(get_invoke_handlers())
        .run(tauri::generate_context!())
    {
        tracing::log::error!("Failed to run mobile application: {}", e);
        std::process::exit(1);
    }
}

// 公共的 setup 函数
fn common_setup(app_handle: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let scope = app_handle.fs_scope();
    if let Err(e) = scope.allow_directory("configuration", false) {
        eprintln!("Warning: Failed to allow configuration directory access: {e}");
        // Continue anyway - this might not be critical
    }

    #[cfg(desktop)]
    setup_logout_listener(app_handle.clone());

    // 异步初始化应用数据，避免阻塞主线程
    match tauri::async_runtime::block_on(initialize_app_data(app_handle.clone())) {
        Ok((db, user_info, settings)) => {
            // 使用 manage 方法在运行时添加状态
            app_handle.manage(AppData {
                db_conn: db.clone(),
                user_info: user_info.clone(),
                config: settings,
                frontend_task: Mutex::new(false),
                // 后端任务默认完成
                backend_task: Mutex::new(true),
            });

            // 添加应用状态
            app_handle.manage(AppState::new());

            APP_STATE_READY.store(true, Ordering::SeqCst);
            if let Err(e) = app_handle.emit("app-state-ready", ()) {
                tracing::warn!("Failed to emit app-state-ready event: {}", e);
            }
        }
        Err(e) => {
            tracing::error!("Failed to initialize application data: {}", e);
            return Err(format!("Failed to initialize app data: {e}").into());
        }
    }

    #[cfg(desktop)]
    tray::create_tray(&app_handle)?;
    Ok(())
}

// 公共的命令处理器函数
fn get_invoke_handlers() -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static
{
    #[cfg(mobile)]
    use crate::command::set_complete;
    #[cfg(desktop)]
    use crate::desktops::common_cmd::set_badge_count;
    #[cfg(target_os = "ios")]
    use crate::mobiles::keyboard::set_webview_keyboard_adjustment;
    #[cfg(mobile)]
    use crate::mobiles::splash::hide_splash_screen;

    tauri::generate_handler![
        // 桌面端特定命令
        #[cfg(desktop)]
        default_window_icon,
        #[cfg(desktop)]
        screenshot,
        #[cfg(desktop)]
        audio,
        #[cfg(desktop)]
        set_height,
        #[cfg(desktop)]
        get_video_thumbnail,
        #[cfg(target_os = "macos")]
        hide_title_bar_buttons,
        #[cfg(target_os = "macos")]
        show_title_bar_buttons,
        #[cfg(target_os = "macos")]
        set_window_level_above_menubar,
        #[cfg(target_os = "macos")]
        set_window_movable,
        #[cfg(desktop)]
        push_window_payload,
        #[cfg(desktop)]
        get_window_payload,
        get_files_meta,
        #[cfg(desktop)]
        get_directory_usage_info_with_progress,
        #[cfg(desktop)]
        cancel_directory_scan,
        #[cfg(desktop)]
        set_badge_count,
        #[cfg(target_os = "windows")]
        get_windows_scale_info,
        // 设置相关命令
        get_settings,
        update_settings,
        // 媒体相关命令
        download_media,
        delete_cached_media,
        clear_media_cache,
        get_media_cache_stats,
        preload_media,
        #[cfg(mobile)]
        set_complete,
        #[cfg(mobile)]
        hide_splash_screen,
        #[cfg(target_os = "ios")]
        set_webview_keyboard_adjustment,
        is_app_state_ready,
    ]
}
