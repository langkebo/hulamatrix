use crate::AppData;
use crate::error::CommonError;
use crate::im_request_client::ImUrl;
// REMOVED: save_contact_batch - Contact list now uses Matrix friend store
use crate::repository::im_contact_repository::update_contact_hide;

use entity::im_contact;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::{error, info, warn};

#[tauri::command]
pub async fn list_contacts_command(
    _state: State<'_, AppData>,
) -> Result<Vec<im_contact::Model>, String> {
    info!("Querying all conversation list:");
    // DEPRECATED: Friend system now uses Matrix m.direct and Synapse APIs
    // The frontend should use useFriendsStore with enhancedFriendsService instead
    // Returning empty list for backward compatibility
    warn!("[DEPRECATED] list_contacts_command is deprecated. Use Matrix friend store instead.");
    Ok(vec![])
}

// REMOVED: fetch_and_update_contacts function - Contact list now uses Matrix friend store
// The useFriendsStore with enhancedFriendsService handles friend/contact data via Matrix

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HideContactRequest {
    room_id: String,
    hide: bool,
}

#[tauri::command]
pub async fn hide_contact_command(
    state: State<'_, AppData>,
    data: HideContactRequest,
) -> Result<(), String> {
    info!("Hide contact: room_id={}, hide={}", data.room_id, data.hide);
    let result: Result<(), CommonError> = async {
        // 获取当前登录用户的 uid
        let login_uid = {
            let user_info = state.user_info.lock().await;
            user_info.uid.clone()
        };

        let resp: Option<bool> = state
            .rc
            .lock()
            .await
            .im_request(
                ImUrl::SetHide,
                Some(data.clone()),
                None::<serde_json::Value>,
            )
            .await?;

        if resp.is_some() {
            // 更新本地数据库
            update_contact_hide(
                &state.db_conn,
                &data.room_id.clone(),
                data.hide,
                &login_uid,
            )
            .await?;
            Ok(())
        } else {
            Err(CommonError::UnexpectedError(anyhow::anyhow!(
                "Failed to hide contact"
            )))
        }
    }
    .await;

    match result {
        Ok(()) => Ok(()),
        Err(e) => {
            error!("Failed to hide contact: {:?}", e);
            Err(e.to_string())
        }
    }
}
