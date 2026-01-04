use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_index(
                Index::create()
                    .name("idx_im_message_room_id")
                    .table(ImMessage::Table)
                    .col(ImMessage::RoomId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_im_message_event_id")
                    .table(ImMessage::Table)
                    .col(ImMessage::EventId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_im_message_origin_ts")
                    .table(ImMessage::Table)
                    .col(ImMessage::OriginServerTs)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_index(Index::drop().name("idx_im_message_room_id").table(ImMessage::Table).to_owned())
            .await?;
        manager
            .drop_index(Index::drop().name("idx_im_message_event_id").table(ImMessage::Table).to_owned())
            .await?;
        manager
            .drop_index(Index::drop().name("idx_im_message_origin_ts").table(ImMessage::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum ImMessage {
    Table,
    RoomId,
    EventId,
    OriginServerTs,
}
