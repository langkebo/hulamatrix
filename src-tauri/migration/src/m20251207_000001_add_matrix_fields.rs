use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // SQLite 不支持在单个 ALTER TABLE 语句中添加多个列
        // 需要分别为每个列执行 ALTER TABLE

        // 添加 event_id 列
        manager
            .alter_table(
                Table::alter()
                    .table(ImMessage::Table)
                    .add_column(ColumnDef::new(ImMessage::EventId).string().null())
                    .to_owned(),
            )
            .await?;

        // 添加 mxc_url 列
        manager
            .alter_table(
                Table::alter()
                    .table(ImMessage::Table)
                    .add_column(ColumnDef::new(ImMessage::MxcUrl).string().null())
                    .to_owned(),
            )
            .await?;

        // 添加 sender 列
        manager
            .alter_table(
                Table::alter()
                    .table(ImMessage::Table)
                    .add_column(ColumnDef::new(ImMessage::Sender).string().null())
                    .to_owned(),
            )
            .await?;

        // 添加 origin_server_ts 列
        manager
            .alter_table(
                Table::alter()
                    .table(ImMessage::Table)
                    .add_column(ColumnDef::new(ImMessage::OriginServerTs).big_integer().null())
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // SQLite 不支持在单个 ALTER TABLE 语句中删除多个列
        // 需要分别为每个列执行 ALTER TABLE

        // 删除 event_id 列
        manager
            .alter_table(
                Table::alter()
                    .table(ImMessage::Table)
                    .drop_column(ImMessage::EventId)
                    .to_owned(),
            )
            .await?;

        // 删除 mxc_url 列
        manager
            .alter_table(
                Table::alter()
                    .table(ImMessage::Table)
                    .drop_column(ImMessage::MxcUrl)
                    .to_owned(),
            )
            .await?;

        // 删除 sender 列
        manager
            .alter_table(
                Table::alter()
                    .table(ImMessage::Table)
                    .drop_column(ImMessage::Sender)
                    .to_owned(),
            )
            .await?;

        // 删除 origin_server_ts 列
        manager
            .alter_table(
                Table::alter()
                    .table(ImMessage::Table)
                    .drop_column(ImMessage::OriginServerTs)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum ImMessage {
    Table,
    EventId,
    MxcUrl,
    Sender,
    OriginServerTs,
}
