use crate::AppData;
use crate::error::CommonError;
use crate::pojo::common::{CursorPageParam, CursorPageResp, Page, PageParam};
use crate::repository::im_room_member_repository::update_my_room_info as update_my_room_info_db;
use crate::vo::vo::MyRoomInfoReq;

use entity::{im_room, im_room_member};
use tracing::{error, warn};

use crate::im_request_client::ImUrl;
use crate::repository::im_room_member_repository;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomMemberResponse {
    pub id: String,
    pub room_id: Option<String>,
    pub uid: Option<String>,
    pub account: Option<String>,
    pub my_name: Option<String>,
    pub active_status: Option<u8>,
    #[serde(rename = "roleId")]
    pub group_role: Option<i64>,
    pub loc_place: Option<String>,
    pub last_opt_time: i64,
    pub create_time: Option<i64>,
    pub name: String,
    pub avatar: Option<String>,
    pub user_state_id: Option<String>,
    #[serde(rename = "wearingItemId")]
    pub wearing_item_id: Option<String>,
    #[serde(rename = "itemIds")]
    pub item_ids: Option<Vec<String>>,
}

#[tauri::command]
pub async fn update_my_room_info(
    my_room_info: MyRoomInfoReq,
    state: State<'_, AppData>,
) -> Result<(), String> {
    let result: Result<(), CommonError> = async {
        // 获取当前用户信息
        let user_info = state.user_info.lock().await;
        let uid = user_info.uid.clone();
        drop(user_info);

        // 调用后端接口更新房间信息
        let _resp: Option<bool> = state
            .rc
            .lock()
            .await
            .im_request(
                ImUrl::UpdateMyRoomInfo,
                Some(my_room_info.clone()),
                None::<serde_json::Value>,
            )
            .await?;

        // 更新本地数据库
        update_my_room_info_db(
            &state.db_conn,
            &my_room_info.my_name,
            &my_room_info.id,
            &uid,
            &uid,
        )
        .await
        .map_err(|e| {
            anyhow::anyhow!(
                "[{}:{}] Failed to update local database: {}",
                file!(),
                line!(),
                e
            )
        })?;
        Ok(())
    }
    .await;

    match result {
        Ok(members) => Ok(members),
        Err(e) => {
            error!("Failed to update room information: {:?}", e);
            Err(e.to_string())
        }
    }
}

/// `获取room_id的房间的所有成员列表`
/// DEPRECATED: This function is deprecated. Frontend should use Matrix SDK directly:
/// - Use matrixClientService.getRoomMembers() or useGroupStore for room members
/// - This function now returns empty list for backward compatibility
#[tauri::command]
pub async fn get_room_members(
    _room_id: String,
    _state: State<'_, AppData>,
) -> Result<Vec<RoomMemberResponse>, String> {
    warn!(
        "[DEPRECATED] get_room_members is deprecated. Frontend should use Matrix SDK (matrixClientService.getRoomMembers() or useGroupStore)."
    );
    // Return empty list for backward compatibility
    Ok(vec![])
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CursorPageRoomMemberParam {
    room_id: String,
    #[serde(flatten)]
    cursor_page_param: CursorPageParam,
}

// 游标分页查询数据
#[tauri::command]
pub async fn cursor_page_room_members(
    param: CursorPageRoomMemberParam,
    state: State<'_, AppData>,
) -> Result<CursorPageResp<Vec<im_room_member::Model>>, String> {
    // 获取当前登录用户的 uid
    let login_uid = {
        let user_info = state.user_info.lock().await;
        user_info.uid.clone()
    };

    let data = im_room_member_repository::cursor_page_room_members(
        &state.db_conn,
        param.room_id,
        param.cursor_page_param,
        &login_uid,
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(data)
}

// 从本地数据库分页查询群房间数据
// DEPRECATED: This function is deprecated. Frontend should use Matrix SDK directly:
// - Use matrixClientService.getRooms() or useRoomStore for room list
// - This function now returns empty page for backward compatibility
#[tauri::command]
pub async fn page_room(
    _page_param: PageParam,
    _state: State<'_, AppData>,
) -> Result<Page<im_room::Model>, String> {
    warn!(
        "[DEPRECATED] page_room is deprecated. Frontend should use Matrix SDK (matrixClientService.getRooms() or useRoomStore)."
    );
    // Return empty page for backward compatibility
    Ok(Page {
        total: "0".to_string(),
        records: vec![],
        size: "20".to_string(),
    })
}
