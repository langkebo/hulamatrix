use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

// IO 错误辅助函数
fn io_error<E: std::error::Error + Send + Sync + 'static>(err: E) -> String {
    format!("IO error: {}", err)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column: Option<u32>,
}

/// 保存错误日志到文件
///
/// 将前端捕获的错误、警告和信息日志保存到 docs/error_log.md 文件
#[tauri::command]
pub async fn save_error_log(logs: Vec<LogEntry>) -> Result<(), String> {
    if logs.is_empty() {
        return Ok(());
    }

    // 获取项目根目录（src-tauri 的父目录）
    let mut log_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    log_path.pop(); // 移除 src-tauri
    log_path.push("docs");
    log_path.push("error_log.md");

    // 确保 docs 目录存在
    if let Some(parent) = log_path.parent() {
        std::fs::create_dir_all(parent).map_err(io_error)?;
    }

    // 格式化日志
    let formatted_logs = format_logs(&logs);

    // 打开文件，如果不存在则创建，存在则追加
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(io_error)?;

    // 写入日志
    file.write_all(formatted_logs.as_bytes())
        .map_err(io_error)?;

    file.flush().map_err(io_error)?;

    tracing::info!("已保存 {} 条错误日志到: {:?}", logs.len(), log_path);

    Ok(())
}

/// 格式化日志为 Markdown
fn format_logs(logs: &[LogEntry]) -> String {
    let mut output = String::new();

    // 添加分隔线和时间戳
    output.push_str(&format!(
        "\n---\n**错误日志时间**: {}  \n**日志条数**: {}  \n\n",
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
        logs.len()
    ));

    for log in logs {
        let level_emoji = match log.level.as_str() {
            "error" => "🔴",
            "warn" => "🟡",
            "info" => "🔵",
            _ => "⚪",
        };

        output.push_str(&format!("### {} `{}`\n\n", level_emoji, log.level));
        output.push_str(&format!("**时间**: `{}`  \n", log.timestamp));

        if let Some(url) = &log.url {
            output.push_str(&format!("**位置**: `{}`", url));
            if let Some(line) = log.line {
                output.push_str(&format!(":`{}`", line));
                if let Some(col) = log.column {
                    output.push_str(&format!(":`{}`", col));
                }
            }
            output.push_str("  \n");
        }

        output.push_str(&format!("**消息**:  \n```\n{}\n```\n\n", log.message));

        if let Some(stack) = &log.stack {
            output.push_str(&format!("**堆栈**:  \n```\n{}\n```\n\n", stack));
        }

        output.push_str("---\n\n");
    }

    output
}

/// 清空错误日志文件
#[tauri::command]
pub async fn clear_error_log() -> Result<(), String> {
    // 获取项目根目录（src-tauri 的父目录）
    let mut log_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    log_path.pop(); // 移除 src-tauri
    log_path.push("docs");
    log_path.push("error_log.md");

    std::fs::write(&log_path, "# 错误日志\n\n_此文件由应用自动生成_\n\n").map_err(io_error)?;

    tracing::info!("已清空错误日志: {:?}", log_path);

    Ok(())
}

/// 读取最近的错误日志
#[tauri::command]
pub async fn read_error_log(limit: usize) -> Result<String, String> {
    // 获取项目根目录（src-tauri 的父目录）
    let mut log_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    log_path.pop(); // 移除 src-tauri
    log_path.push("docs");
    log_path.push("error_log.md");

    if !log_path.exists() {
        return Ok("# 错误日志\n\n_暂无错误日志_\n".to_string());
    }

    let content = std::fs::read_to_string(&log_path).map_err(io_error)?;

    // 如果文件太大，只返回最后 N 个字符
    if content.len() > limit {
        let start = content.len().saturating_sub(limit);
        // 从最近的分隔符开始
        let adjusted_start = content[start..]
            .find("---\n")
            .map(|pos| start + pos)
            .unwrap_or(start);

        Ok(format!(
            "...(日志过大，只显示最近 {} 字节)...\n\n{}",
            limit,
            &content[adjusted_start..]
        ))
    } else {
        Ok(content)
    }
}
