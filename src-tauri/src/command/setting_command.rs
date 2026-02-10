use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{AppData, configuration::Settings};

#[tauri::command]
pub async fn get_settings(state: State<'_, AppData>) -> Result<Settings, String> {
    Ok(state.config.lock().await.clone())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsParams {
    // Placeholder for settings update - to be implemented
}

#[tauri::command]
pub async fn update_settings(
    _state: State<'_, AppData>,
    _settings: UpdateSettingsParams,
) -> Result<(), String> {
    // TODO: Implement settings update when needed
    Ok(())
}
