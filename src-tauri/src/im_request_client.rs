use std::str::FromStr;

use anyhow::Ok;
use base64::{Engine, prelude::BASE64_STANDARD};
use reqwest::header;
use serde_json::json;
use tracing::{error, info};

use crate::{
    pojo::common::ApiResult,
    vo::vo::{LoginReq, LoginResp, RefreshTokenReq, RefreshTokenResp},
};

#[derive(Debug)]
pub struct ImRequestClient {
    client: reqwest::Client,
    base_url: String,
    pub token: Option<String>,
    pub refresh_token: Option<String>,
}

impl ImRequestClient {
    pub fn new(base_url: String) -> Result<Self, anyhow::Error> {
        let mut headers = header::HeaderMap::new();
        headers.insert(
            header::CONTENT_TYPE,
            header::HeaderValue::from_static("application/json"),
        );
        let basic_auth = BASE64_STANDARD.encode("luohuo_web_pro:luohuo_web_pro_secret");
        let basic_auth_value = header::HeaderValue::from_str(&basic_auth)
            .map_err(|e| anyhow::anyhow!("Failed to create HTTP client: {e}"))?;
        headers.insert(header::AUTHORIZATION, basic_auth_value);

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .redirect(reqwest::redirect::Policy::limited(10)) // 启用自动重定向跟随，最多10次
            .build()
            .map_err(|e| anyhow::anyhow!("Failed to create HTTP client: {e}"))?;

        Ok(Self {
            client,
            base_url,
            token: None,
            refresh_token: None,
        })
    }

    pub fn set_base_url(&mut self, base_url: String) {
        self.base_url = base_url;
    }

    /// 构建请求的公共方法（不发送请求）
    ///
    /// 提取了 URL 构建、token 添加、body/params 处理等公共逻辑
    ///
    /// # 参数
    /// - `method`: HTTP 方法
    /// - `path`: API 路径
    /// - `body`: 请求体（可选）
    /// - `params`: 查询参数（可选）
    /// - `extra_headers`: 额外的请求头（可选）
    fn build_request<B: serde::Serialize, C: serde::Serialize>(
        &self,
        method: http::Method,
        path: &str,
        body: &Option<B>,
        params: &Option<C>,
        extra_headers: Option<Vec<(&str, &str)>>,
    ) -> reqwest::RequestBuilder {
        let url = format!("{}/{}", self.base_url, path);
        info!("Request URL: {}, Method: {}", &url, method);

        let mut request_builder = self.client.request(method, &url);

        // 设置 token 请求头
        if let Some(token) = &self.token {
            request_builder = request_builder.header("token", token);
        }

        // 添加额外的请求头
        if let Some(headers) = extra_headers {
            for (key, value) in headers {
                request_builder = request_builder.header(key, value);
            }
        }

        // 设置请求体
        if let Some(body) = body {
            request_builder = request_builder.json(body);
        } else {
            request_builder = request_builder.json(&serde_json::json!({}));
        }

        // 设置查询参数
        if let Some(params) = params {
            request_builder = request_builder.query(params);
        }

        request_builder
    }

    pub async fn request<
        T: serde::de::DeserializeOwned,
        B: serde::Serialize,
        C: serde::Serialize,
    >(
        &mut self,
        method: http::Method,
        path: &str,
        body: Option<B>,
        params: Option<C>,
    ) -> Result<ApiResult<T>, anyhow::Error> {
        let mut retry_count = 0;
        const MAX_RETRY_COUNT: u8 = 2;

        loop {
            // 使用 build_request 构建请求
            let request_builder = self.build_request(method.clone(), path, &body, &params, None);

            // 发送请求
            let response = request_builder.send().await?;

            // 检查 HTTP 状态码，在解析 JSON 之前
            let status = response.status();
            if status.is_client_error() || status.is_server_error() {
                let url = format!("{}/{}", self.base_url, path);

                // 尝试读取错误响应体以提供更好的调试信息
                let error_body = response.text().await
                    .unwrap_or_else(|_| format!("HTTP {}", status.as_u16()));

                error!(
                    "Request failed: {} {}; body: {}",
                    url, status, error_body
                );

                return Err(anyhow::anyhow!(
                    "请求失败 (HTTP {}): {}。如果持续出现此错误，请检查服务器配置或联系管理员。",
                    status.as_u16(),
                    error_body.chars().take(200).collect::<String>()
                ));
            }

            let result: ApiResult<T> = response.json().await?;

            let url = format!("{}/{}", self.base_url, path);

            match result.code {
                Some(406) => {
                    if retry_count >= MAX_RETRY_COUNT {
                        return Err(anyhow::anyhow!("token过期，刷新token失败"));
                    }

                    error!("Token expired, starting token refresh");
                    self.start_refresh_token().await?;
                    retry_count += 1;
                    continue;
                }
                Some(401) => {
                    error!(
                        "{}; 方法: {}; 失败信息: {}",
                        &url,
                        method,
                        result.msg.clone().unwrap_or_default()
                    );
                    return Err(anyhow::anyhow!("请重新登录"));
                }
                Some(200) => {
                    info!("Request successful: {}, Method: {}", &url, method.clone());
                    return Ok(result);
                }
                _ => {
                    error!(
                        "{}; 方法: {}; 失败信息: {}",
                        &url,
                        method,
                        result.msg.clone().unwrap_or_default()
                    );
                    return Err(anyhow::anyhow!(
                        "{}",
                        result.msg.clone().unwrap_or_default()
                    ));
                }
            }
        }
    }

    /// 流式请求方法（用于 SSE 等流式响应）
    ///
    /// 与 `request` 方法的区别：
    /// 1. 添加 `Accept: text/event-stream` 请求头
    /// 2. 返回 `reqwest::Response` 而不是解析 JSON
    /// 3. 不支持自动 token 刷新重试（因为流式响应无法中断重试）
    ///
    /// # 参数
    /// - `method`: HTTP 方法
    /// - `path`: API 路径
    /// - `body`: 请求体（可选）
    /// - `params`: 查询参数（可选）
    ///
    /// # 返回
    /// - `Ok(Response)`: 成功返回响应对象，可用于读取流式数据
    /// - `Err`: 请求失败或状态码非 2xx
    pub async fn request_stream<B: serde::Serialize, C: serde::Serialize>(
        &mut self,
        method: http::Method,
        path: &str,
        body: Option<B>,
        params: Option<C>,
    ) -> Result<reqwest::Response, anyhow::Error> {
        // 添加流式请求头
        let extra_headers = Some(vec![("Accept", "text/event-stream")]);

        // 使用 build_request 构建请求
        let request_builder =
            self.build_request(method.clone(), path, &body, &params, extra_headers);

        // 发送请求
        let response = request_builder.send().await?;

        // 检查响应状态（但不解析 JSON）
        let status = response.status();
        if !status.is_success() {
            let url = format!("{}/{}", self.base_url, path);
            error!("流式请求失败，URL: {}, 状态码: {}", url, status);

            // 根据状态码返回不同的错误信息
            match status.as_u16() {
                406 => {
                    error!("Token expired in stream request");
                    return Err(anyhow::anyhow!("token过期，请刷新后重试"));
                }
                401 => {
                    error!("Unauthorized in stream request");
                    return Err(anyhow::anyhow!("请重新登录"));
                }
                _ => {
                    return Err(anyhow::anyhow!("请求失败，状态码: {status}"));
                }
            }
        }

        info!("流式请求成功，开始接收流式数据");
        Ok(response)
    }

    pub async fn start_refresh_token(&mut self) -> Result<(), anyhow::Error> {
        info!("Starting token refresh");
        let url = format!("{}/{}", self.base_url, ImUrl::RefreshToken.get_url().1);

        let refresh_token = self.refresh_token.clone()
            .ok_or_else(|| anyhow::anyhow!("No refresh token available"))?;

        let body = json!({
          "refreshToken": refresh_token
        });

        let request_builder = self.client.request(http::Method::POST, &url);
        let response = request_builder.json(&body).send().await?;
        let result: ApiResult<serde_json::Value> = response.json().await?;

        if !result.success {
            let msg = result.msg.clone().unwrap_or_default();
            error!("刷新token失败: {}", msg);
            return Err(anyhow::anyhow!("刷新token失败: {}", msg));
        }

        // Safely extract data
        if let Some(data) = &result.data {
            if let Some(token) = data.get("token").and_then(|v| v.as_str()) {
                self.token = Some(token.to_owned());
            }
            if let Some(refresh_token) = data.get("refreshToken").and_then(|v| v.as_str()) {
                self.refresh_token = Some(refresh_token.to_owned());
            }
        }

        Ok(())
    }

    pub async fn im_request<
        T: serde::de::DeserializeOwned,
        B: serde::Serialize,
        C: serde::Serialize,
    >(
        &mut self,
        url: ImUrl,
        body: Option<B>,
        params: Option<C>,
    ) -> Result<Option<T>, anyhow::Error> {
        let (method, path) = url.get_url();
        let result: ApiResult<T> = self.request(method, path, body, params).await?;
        Ok(result.data)
    }
}

impl ImRequest for ImRequestClient {
    async fn login(&mut self, login_req: LoginReq) -> Result<Option<LoginResp>, anyhow::Error> {
        let result: Option<LoginResp> = self
            .im_request(ImUrl::Login, Some(login_req), None::<serde_json::Value>)
            .await?;

        if let Some(data) = result.clone() {
            self.token = Some(data.token.clone());
            self.refresh_token = Some(data.refresh_token.clone());
        }

        Ok(result)
    }

    async fn refresh_token(
        &mut self,
        refresh_token_req: RefreshTokenReq,
    ) -> Result<Option<RefreshTokenResp>, anyhow::Error> {
        let result: Option<RefreshTokenResp> = self
            .im_request(
                ImUrl::RefreshToken,
                Some(refresh_token_req),
                None::<serde_json::Value>,
            )
            .await?;

        if let Some(data) = result.clone() {
            self.token = Some(data.token.clone());
            self.refresh_token = Some(data.refresh_token.clone());
        }

        Ok(result)
    }
}

pub enum ImUrl {
    Login,
    RefreshToken,
    ForgetPassword,
    CheckToken,
    Logout,
    Register,
    // REMOVED: GetQiniuToken - Media upload now uses Matrix media repository
    InitConfig,
    // REMOVED: FileUpload - File upload now uses Matrix media repository
    GetAssistantModelList,
    SendCaptcha,
    GetCaptcha,
    Announcement,
    EditAnnouncement,
    DeleteAnnouncement,
    PushAnnouncement,
    GetAnnouncementList,
    ApplyGroup,
    SearchGroup,
    UpdateMyRoomInfo,
    UpdateRoomInfo,
    // REMOVED: GroupList, GroupListMember, GroupDetail - Group system now uses Matrix rooms and spaces
    GroupInfo,
    // REMOVED: RevokeAdmin, AddAdmin, ExitGroup - Group member operations now use Matrix power levels
    // REMOVED: AcceptInvite, InviteList - Invitations now use Matrix room invites
    // REMOVED: InviteGroupMember, RemoveGroupMember - Member management now uses Matrix room APIs
    // REMOVED: CreateGroup - Group creation now uses Matrix room creation APIs
    Shield,
    Notification,
    DeleteSession,
    SetSessionTop,
    // REMOVED: SessionDetailWithFriends - Friend system now uses Matrix m.direct and Synapse APIs
    SessionDetail,
    GetMsgReadCount,
    GetMsgReadList,
    HandleInvite,
    NoticeUnReadCount,
    RequestNoticePage,
    ChangeUserState,
    GetAllUserState,
    // REMOVED: UploadAvatar - Avatar upload now uses Matrix media repository
    GetEmoji,
    DeleteEmoji,
    AddEmoji,
    RecallMsg,
    BlockUser,
    MarkMsg,
    // REMOVED: SetUserBadge - Badge system is custom backend feature, not supported by Matrix
    ModifyUserInfo,
    GetUserInfoDetail,
    GetMsgList,
    GetMsgPage,
    GetAllUserBaseInfo,
    // REMOVED: GetBadgesBatch, GetBadgeList - Badge system is custom backend feature
    GetMemberStatistic,
    // REMOVED: Feed* enum values - Moments/Feed feature removed (custom backend no longer supported)
    // This included: FeedDetail, FeedList, PushFeed, DelFeed, EditFeed, GetFeedPermission
    // FeedLikeToggle, FeedLikeList, FeedLikeCount, FeedLikeHasLiked
    // FeedCommentAdd, FeedCommentDelete, FeedCommentList, FeedCommentAll, FeedCommentCount
    SendMsg,
    SetHide,
    // REMOVED: GetFriendPage - Friend system now uses Matrix m.direct and Synapse APIs
    MarkMsgRead,
    CheckEmail,
    MergeMsg,
    GetUserByIds,
    GenerateQRCode,
    CheckQRStatus,
    ScanQRCode,
    ConfirmQRCode,
    // REMOVED: All AI-related enum values - AI features removed (custom backend no longer supported)
    // This included 70+ AI endpoints for:
    // - AI Chat Messages: MessageSend, MessageSendStream, MessageListByConversationId, MessageDelete, etc.
    // - AI Conversations: ConversationCreateMy, ConversationUpdateMy, etc.
    // - AI Models: ModelCreate, ModelUpdate, ModelDelete, etc.
    // - AI Chat Roles: ChatRoleMyPage, ChatRoleCreate, etc.
    // - AI API Keys: ApiKeyCreate, ApiKeyUpdate, etc.
    // - AI Tools: ToolCreate, ToolUpdate, etc.
    // - AI Image: ImageDraw, ImageMyPage, ImageMidjourneyImagine, etc.
    // - AI Video: VideoGenerate, VideoMyPage, etc.
    // - AI Audio: AudioGenerate, AudioMyPage, etc.
    // - AI Knowledge Base: KnowledgePage, KnowledgeDocumentPage, KnowledgeSegment*, etc.
    // - AI Mind Maps: MindMapGenerateStream, MindMapDelete, etc.
    // - AI Music: MusicGenerate, MusicMyPage, etc.
    // - AI Workflows: WorkflowCreate, WorkflowUpdate, etc.
    // - AI Writing: WriteGenerateStream, WriteDelete, etc.
}

impl ImUrl {
    pub fn get_url(&self) -> (http::Method, &str) {
        match self {
            // Token 相关
            ImUrl::Login => (http::Method::POST, "oauth/anyTenant/login"),
            ImUrl::RefreshToken => (http::Method::POST, "oauth/anyTenant/refresh"),
            ImUrl::ForgetPassword => (http::Method::PUT, "oauth/anyTenant/password"),
            ImUrl::CheckToken => (http::Method::POST, "oauth/check"),
            ImUrl::Logout => (http::Method::POST, "oauth/anyUser/logout"),
            ImUrl::Register => (http::Method::POST, "oauth/anyTenant/registerByEmail"),

            // 系统相关
            // REMOVED: GetQiniuToken - Media upload now uses Matrix media repository
            ImUrl::InitConfig => (http::Method::GET, "system/anyTenant/config/init"),
            // REMOVED: FileUpload - File upload now uses Matrix media repository
            ImUrl::GetAssistantModelList => (http::Method::GET, "system/model/list"),

            // 验证码相关
            ImUrl::SendCaptcha => (http::Method::POST, "oauth/anyTenant/sendEmailCode"),
            ImUrl::GetCaptcha => (http::Method::GET, "oauth/anyTenant/captcha"),

            // 群公告相关
            ImUrl::Announcement => (http::Method::GET, "im/room/announcement"),
            ImUrl::EditAnnouncement => (http::Method::POST, "im/room/announcement/edit"),
            ImUrl::DeleteAnnouncement => (http::Method::POST, "im/room/announcement/delete"),
            ImUrl::PushAnnouncement => (http::Method::POST, "im/room/announcement/push"),
            ImUrl::GetAnnouncementList => (http::Method::GET, "im/room/announcement/list"),

            // 群聊申请相关
            ImUrl::ApplyGroup => (http::Method::POST, "im/room/apply/group"),

            // 群聊搜索和管理
            ImUrl::SearchGroup => (http::Method::GET, "im/room/search"),
            ImUrl::UpdateMyRoomInfo => (http::Method::POST, "im/room/updateMyRoomInfo"),
            ImUrl::UpdateRoomInfo => (http::Method::POST, "im/room/updateRoomInfo"),
            // REMOVED: GroupList, GroupListMember, GroupDetail - Group system now uses Matrix rooms and spaces
            ImUrl::GroupInfo => (http::Method::GET, "im/room/group/info"),
            // REMOVED: Admin endpoints - Admin operations now use Matrix power levels
            // REMOVED: Member management endpoints - Member operations now use Matrix room APIs
            // REMOVED: CreateGroup, InviteList - Group creation and invites now use Matrix room APIs

            // 聊天会话相关
            ImUrl::Shield => (http::Method::POST, "im/chat/setShield"),
            ImUrl::Notification => (http::Method::POST, "im/chat/notification"),
            ImUrl::DeleteSession => (http::Method::DELETE, "im/chat/delete"),
            ImUrl::SetSessionTop => (http::Method::POST, "im/chat/setTop"),
            // REMOVED: SessionDetailWithFriends endpoint - Friend system now uses Matrix m.direct and Synapse APIs
            ImUrl::SessionDetail => (http::Method::GET, "im/chat/contact/detail"),
            ImUrl::SetHide => (http::Method::POST, "im/chat/setHide"),

            // 消息已读未读
            ImUrl::GetMsgReadCount => (http::Method::GET, "im/chat/msg/read"),
            ImUrl::MarkMsgRead => (http::Method::PUT, "im/chat/msg/read"),
            ImUrl::SendMsg => (http::Method::POST, "im/chat/msg"),
            ImUrl::GetMsgReadList => (http::Method::GET, "im/chat/msg/read/page"),

            // REMOVED: Friend-related endpoints - Friend system now uses Matrix m.direct and Synapse APIs
            // This included: ModifyFriendRemark, DeleteFriend, SendAddFriendRequest, GetFriendPage
            // GetContactList, SearchFriend

            // 群聊申请相关
            ImUrl::HandleInvite => (http::Method::POST, "im/room/apply/handler/apply"),
            ImUrl::NoticeUnReadCount => (http::Method::GET, "im/room/notice/unread"),
            ImUrl::RequestNoticePage => (http::Method::GET, "im/room/notice/page"),

            // 用户状态相关
            ImUrl::ChangeUserState => (http::Method::POST, "im/user/state/changeState"),
            ImUrl::GetAllUserState => (http::Method::GET, "im/user/state/list"),

            // 用户信息相关
            // REMOVED: UploadAvatar - Avatar upload now uses Matrix media repository
            ImUrl::GetEmoji => (http::Method::GET, "im/user/emoji/list"),
            ImUrl::DeleteEmoji => (http::Method::DELETE, "im/user/emoji"),
            ImUrl::AddEmoji => (http::Method::POST, "im/user/emoji"),
            // REMOVED: SetUserBadge - Badge system is custom backend feature, not supported by Matrix
            ImUrl::ModifyUserInfo => (http::Method::PUT, "im/user/info"),
            ImUrl::GetUserInfoDetail => (http::Method::GET, "im/user/userInfo"),
            // REMOVED: GetBadgesBatch, GetBadgeList - Badge system is custom backend feature
            ImUrl::BlockUser => (http::Method::PUT, "im/user/black"),

            // 扫码登录相关
            ImUrl::GenerateQRCode => (http::Method::GET, "oauth/anyTenant/qr/generate"),
            ImUrl::CheckQRStatus => (http::Method::GET, "oauth/anyTenant/qr/status/query"),
            ImUrl::ScanQRCode => (http::Method::POST, "oauth/qrcode/scan"),
            ImUrl::ConfirmQRCode => (http::Method::POST, "oauth/qrcode/confirm"),

            // 消息相关
            ImUrl::RecallMsg => (http::Method::PUT, "im/chat/msg/recall"),
            ImUrl::MarkMsg => (http::Method::PUT, "im/chat/msg/mark"),
            ImUrl::GetMsgPage => (http::Method::GET, "im/chat/msg/page"),
            ImUrl::GetMsgList => (http::Method::POST, "im/chat/msg/list"),
            ImUrl::GetMemberStatistic => (http::Method::GET, "im/chat/member/statistic"),

            // REMOVED: All feed-related API endpoints - Moments/Feed feature removed (custom backend no longer supported)
            // This included: FeedList, PushFeed, GetFeedPermission, EditFeed, DelFeed, FeedDetail
            // FeedLikeToggle, FeedLikeList, FeedLikeCount, FeedLikeHasLiked
            // FeedCommentAdd, FeedCommentDelete, FeedCommentList, FeedCommentAll, FeedCommentCount

            // REMOVED: All AI-related API endpoints - AI features removed (custom backend no longer supported)
            // This removed 160+ lines of AI endpoint mappings for:
            // - AI Chat Messages, Conversations, Models, Roles, API Keys, Tools
            // - AI Image, Video, Audio generation
            // - AI Knowledge Base (documents, segments, search)
            // - AI Mind Maps, Music, Workflows, Writing
            // All paths starting with /ai/*

            // 群成员信息
            ImUrl::GetAllUserBaseInfo => (http::Method::GET, "im/room/group/member/list"),
            ImUrl::CheckEmail => (http::Method::GET, "oauth/anyTenant/checkEmail"),

            ImUrl::MergeMsg => (http::Method::POST, "im/room/mergeMessage"),
            ImUrl::GetUserByIds => (http::Method::POST, "im/user/getUserByIds"),
        }
    }

    fn from_str(s: &str) -> Result<Self, anyhow::Error> {
        match s {
            // Token 相关
            "login" => Ok(ImUrl::Login),
            "refreshToken" => Ok(ImUrl::RefreshToken),
            "forgetPassword" => Ok(ImUrl::ForgetPassword),
            "checkToken" => Ok(ImUrl::CheckToken),
            "logout" => Ok(ImUrl::Logout),
            "register" => Ok(ImUrl::Register),

            // 系统相关
            // REMOVED: getQiniuToken - Media upload now uses Matrix media repository
            "initConfig" => Ok(ImUrl::InitConfig),
            // REMOVED: fileUpload - File upload now uses Matrix media repository
            "getAssistantModelList" => Ok(ImUrl::GetAssistantModelList),

            // 验证码相关
            "sendCaptcha" => Ok(ImUrl::SendCaptcha),
            "getCaptcha" => Ok(ImUrl::GetCaptcha),

            // 群公告相关
            "announcement" => Ok(ImUrl::Announcement),
            "editAnnouncement" => Ok(ImUrl::EditAnnouncement),
            "deleteAnnouncement" => Ok(ImUrl::DeleteAnnouncement),
            "pushAnnouncement" => Ok(ImUrl::PushAnnouncement),
            "getAnnouncementList" => Ok(ImUrl::GetAnnouncementList),

            // 群聊申请相关
            "applyGroup" => Ok(ImUrl::ApplyGroup),

            // 群聊搜索和管理
            "searchGroup" => Ok(ImUrl::SearchGroup),
            "updateMyRoomInfo" => Ok(ImUrl::UpdateMyRoomInfo),
            "updateRoomInfo" => Ok(ImUrl::UpdateRoomInfo),
            // REMOVED: Group-related string mappings - Group system now uses Matrix rooms and spaces
            // This included: groupList, groupDetail
            "groupInfo" => Ok(ImUrl::GroupInfo),
            // REMOVED: Admin and member management mappings - Now use Matrix power levels and room APIs
            // This included: revokeAdmin, addAdmin, exitGroup, acceptInvite, inviteList
            // inviteGroupMember, removeGroupMember, createGroup

            // 聊天会话相关
            "shield" => Ok(ImUrl::Shield),
            "notification" => Ok(ImUrl::Notification),
            "deleteSession" => Ok(ImUrl::DeleteSession),
            "setSessionTop" => Ok(ImUrl::SetSessionTop),
            // REMOVED: sessionDetailWithFriends - Friend system now uses Matrix m.direct and Synapse APIs
            "sessionDetail" => Ok(ImUrl::SessionDetail),

            // 消息已读未读
            "getMsgReadCount" => Ok(ImUrl::GetMsgReadCount),
            "getMsgReadList" => Ok(ImUrl::GetMsgReadList),

            // REMOVED: Friend-related string mappings - Friend system now uses Matrix m.direct and Synapse APIs
            // This included: modifyFriendRemark, deleteFriend, sendAddFriendRequest, getFriendPage
            // getContactList, searchFriend

            // 群聊申请相关
            "handleInvite" => Ok(ImUrl::HandleInvite),
            "noticeUnReadCount" => Ok(ImUrl::NoticeUnReadCount),
            "requestNoticePage" => Ok(ImUrl::RequestNoticePage),

            // 用户状态相关
            "changeUserState" => Ok(ImUrl::ChangeUserState),
            "getAllUserState" => Ok(ImUrl::GetAllUserState),

            // 用户信息相关
            // REMOVED: uploadAvatar - Avatar upload now uses Matrix media repository
            "getEmoji" => Ok(ImUrl::GetEmoji),
            "deleteEmoji" => Ok(ImUrl::DeleteEmoji),
            "addEmoji" => Ok(ImUrl::AddEmoji),
            // REMOVED: setUserBadge - Badge system is custom backend feature, not supported by Matrix
            "ModifyUserInfo" => Ok(ImUrl::ModifyUserInfo),
            "getUserInfoDetail" => Ok(ImUrl::GetUserInfoDetail),
            // REMOVED: getBadgesBatch, getBadgeList - Badge system is custom backend feature
            "blockUser" => Ok(ImUrl::BlockUser),

            // 消息相关
            "recallMsg" => Ok(ImUrl::RecallMsg),
            "markMsg" => Ok(ImUrl::MarkMsg),
            "getMsgList" => Ok(ImUrl::GetMsgList),
            "getMsgPage" => Ok(ImUrl::GetMsgPage),
            "getMemberStatistic" => Ok(ImUrl::GetMemberStatistic),

            // REMOVED: All feed-related string mappings - Moments/Feed feature removed (custom backend no longer supported)
            // This included: feedDetail, feedList, pushFeed, delFeed, editFeed, getFeedPermission
            // feedLikeToggle, feedLikeList, feedLikeCount, feedLikeHasLiked
            // feedCommentAdd, feedCommentDelete, feedCommentList, feedCommentAll, feedCommentCount

            // 群成员信息
            "getAllUserBaseInfo" => Ok(ImUrl::GetAllUserBaseInfo),
            "sendMsg" => Ok(ImUrl::SendMsg),
            "setHide" => Ok(ImUrl::SetHide),
            // REMOVED: getFriendPage - Friend system now uses Matrix m.direct and Synapse APIs
            // REMOVED: groupListMember - Group member listing now uses Matrix room state APIs
            "markMsgRead" => Ok(ImUrl::MarkMsgRead),
            "checkEmail" => Ok(ImUrl::CheckEmail),
            "mergeMsg" => Ok(ImUrl::MergeMsg),
            "getUserByIds" => Ok(ImUrl::GetUserByIds),
            "generateQRCode" => Ok(ImUrl::GenerateQRCode),
            "checkQRStatus" => Ok(ImUrl::CheckQRStatus),
            "scanQRCode" => Ok(ImUrl::ScanQRCode),
            "confirmQRCode" => Ok(ImUrl::ConfirmQRCode),





            // ================ API 密钥 ================

            // ================ 平台配置 ================












            // 未匹配的字符串
            _ => Err(anyhow::anyhow!("未知的URL类型: {s}")),
        }
    }
}

impl FromStr for ImUrl {
    type Err = anyhow::Error;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::from_str(s)
    }
}

pub trait ImRequest {
    async fn login(&mut self, login_req: LoginReq) -> Result<Option<LoginResp>, anyhow::Error>;
    async fn refresh_token(
        &mut self,
        refresh_token_req: RefreshTokenReq,
    ) -> Result<Option<RefreshTokenResp>, anyhow::Error>;
}

// 测试
#[cfg(test)]
mod test {
    use serde_json::json;

    use crate::{
        im_request_client::{ImRequest, ImRequestClient},
        vo::vo::{LoginReq, LoginResp},
    };
    // #[tokio::test]
    // async fn test_get() -> Result<(), anyhow::Error> {
    //     let mut request_client = ImRequestClient::new("http://192.168.1.14:18760".to_string())?;
    //     request_client.set_token("1c40166d-e077-4581-a287-46cfeb942dec");
    //     request_client.set_refresh_token("e8fd2e8a64424a53a3f089482d6fad9e");

    //     let params = Some([("pageSize", "50"), ("cursor", "")]);

    //     let result: ApiResult<serde_json::Value> =
    //         request_client.get("im/user/friend/page", params).await?;

    //     info!("{:?}", serde_json::json!(result).to_string());
    //     Ok(())
    // }

    #[tokio::test]
    #[ignore = "requires actual server at http://192.168.1.14:18760"]
    async fn test_login() -> Result<(), anyhow::Error> {
        let mut request_client = ImRequestClient::new("http://192.168.1.14:18760".to_string())?;
        let login_req = json!({
            "grantType": "PASSWORD",
            "systemType": "2",
            "deviceType": "MOBILE",
            "account": "ql",
            "clientId": "testClientId",
            "password": "123456",
            "asyncData": true
        });
        let login_req: LoginReq = serde_json::from_value(login_req)?;
        let result: Option<LoginResp> = request_client.login(login_req).await?;
        println!("{:?}", serde_json::json!(result).to_string());
        Ok(())
    }
}
