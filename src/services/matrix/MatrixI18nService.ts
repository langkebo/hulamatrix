import { ref, type Ref } from 'vue'

export type Locale = 'zh-CN' | 'zh-TW' | 'en-US' | 'en-GB' | 'ja-JP' | 'ko-KR' | 'ru-RU' | 'de-DE' | 'fr-FR' | 'es-ES'

export interface LocaleInfo {
  code: Locale
  name: string
  nativeName: string
  dir: 'ltr' | 'rtl'
}

export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: 'zh-CN', name: '简体中文', nativeName: '简体中文', dir: 'ltr' },
  { code: 'zh-TW', name: '繁體中文', nativeName: '繁體中文', dir: 'ltr' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English (US)', dir: 'ltr' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English (UK)', dir: 'ltr' },
  { code: 'ja-JP', name: '日本語', nativeName: '日本語', dir: 'ltr' },
  { code: 'ko-KR', name: '한국어', nativeName: '한국어', dir: 'ltr' },
  { code: 'ru-RU', name: 'Русский', nativeName: 'Русский', dir: 'ltr' },
  { code: 'de-DE', name: 'Deutsch', nativeName: 'Deutsch', dir: 'ltr' },
  { code: 'fr-FR', name: 'Français', nativeName: 'Français', dir: 'ltr' },
  { code: 'es-ES', name: 'Español', nativeName: 'Español', dir: 'ltr' }
]

export const DEFAULT_LOCALE: Locale = 'zh-CN'

export interface DateTimeFormatOptions {
  dateStyle?: 'full' | 'long' | 'medium' | 'short'
  timeStyle?: 'full' | 'long' | 'medium' | 'short'
  format?: 'datetime' | 'date' | 'time' | 'relative' | 'calendar'
}

export interface NumberFormatOptions {
  style?: 'decimal' | 'currency' | 'percent'
  currency?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

class MatrixI18nService {
  private static instance: MatrixI18nService
  private _currentLocale: Ref<Locale> = ref(DEFAULT_LOCALE)
  private _fallbackLocale: Ref<Locale> = ref('en-US')
  private _i18nListeners: Map<string, ((data: any) => void)[]> = new Map()
  private _dateTimeFormats: Map<string, Intl.DateTimeFormat> = new Map()
  private _numberFormats: Map<string, Intl.NumberFormat> = new Map()

  private constructor() {}

  static getInstance(): MatrixI18nService {
    if (!MatrixI18nService.instance) {
      MatrixI18nService.instance = new MatrixI18nService()
    }
    return MatrixI18nService.instance
  }

  get currentLocale(): Ref<Locale> {
    return this._currentLocale
  }

  get fallbackLocale(): Ref<Locale> {
    return this._fallbackLocale
  }

  get supportedLocales(): LocaleInfo[] {
    return SUPPORTED_LOCALES
  }

  get currentLocaleInfo(): LocaleInfo | undefined {
    return SUPPORTED_LOCALES.find((l) => l.code === this._currentLocale.value)
  }

  async setLocale(locale: Locale): Promise<void> {
    if (!SUPPORTED_LOCALES.some((l) => l.code === locale)) {
      console.warn(`Locale ${locale} is not supported, falling back to ${DEFAULT_LOCALE}`)
      locale = DEFAULT_LOCALE
    }

    const oldLocale = this._currentLocale.value
    this._currentLocale.value = locale

    this.clearFormatCache()
    this.notifyListeners('localeChanged', { oldLocale, newLocale: locale })
  }

  setFallbackLocale(locale: Locale): void {
    if (!SUPPORTED_LOCALES.some((l) => l.code === locale)) {
      console.warn(`Fallback locale ${locale} is not supported`)
      return
    }
    this._fallbackLocale.value = locale
  }

  t(key: string, params?: Record<string, any>): string {
    const translation = this.getTranslation(key)
    return this.interpolateParams(translation, params)
  }

  private getTranslation(key: string): string {
    const translations: Record<Locale, Record<string, string>> = {
      'zh-CN': {
        'common.ok': '确定',
        'common.cancel': '取消',
        'common.save': '保存',
        'common.delete': '删除',
        'common.edit': '编辑',
        'common.close': '关闭',
        'common.loading': '加载中...',
        'common.error': '发生错误',
        'common.success': '操作成功',
        'common.confirm': '确认',
        'common.back': '返回',
        'common.next': '下一步',
        'common.previous': '上一步',
        'common.submit': '提交',
        'common.search': '搜索',
        'common.settings': '设置',
        'common.help': '帮助',
        'common.about': '关于',
        'common.logout': '退出登录',
        'common.login': '登录',
        'common.register': '注册',
        'user_menu.notifications.title': '通知设置',
        'user_menu.notifications.level_all': '所有消息',
        'user_menu.notifications.level_mention': '仅@提及',
        'user_menu.notifications.level_mute': '静音',
        'user_menu.notifications.enabled': '启用通知',
        'user_menu.notifications.sound': '声音提示',
        'user_menu.notifications.desktop': '桌面通知',
        'user_menu.privacy.title': '隐私设置',
        'user_menu.privacy.read_receipts': '显示已读回执',
        'user_menu.privacy.typing_status': '显示输入状态',
        'user_menu.privacy.online_status': '显示在线状态',
        'user_menu.security.title': '安全设置',
        'user_menu.devices.title': '设备管理',
        'chat.message.send': '发送消息',
        'chat.message.placeholder': '输入消息...',
        'chat.message.file': '发送文件',
        'chat.message.image': '发送图片',
        'chat.message.video': '发送视频',
        'chat.message.voice': '发送语音',
        'chat.message.emoji': '选择表情',
        'chat.message.mention': '提及成员',
        'chat.message.reply': '回复消息',
        'room.invite_members': '邀请成员',
        'room.remove_members': '移除成员',
        'room.settings': '房间设置',
        'room.leave': '离开房间',
        'room.leave_confirm': '确定要离开此房间吗？',
        'space.create_space': '创建空间',
        'space.add_room': '添加房间',
        'space.remove_room': '从空间移除',
        'space.members': '空间成员',
        'space.settings': '空间设置'
      },
      'zh-TW': {
        'common.ok': '確定',
        'common.cancel': '取消',
        'common.save': '儲存',
        'common.delete': '刪除',
        'common.edit': '編輯',
        'common.close': '關閉',
        'common.loading': '載入中...',
        'common.error': '發生錯誤',
        'common.success': '操作成功',
        'common.confirm': '確認',
        'common.back': '返回',
        'common.next': '下一步',
        'common.previous': '上一步',
        'common.submit': '提交',
        'common.search': '搜尋',
        'common.settings': '設定',
        'common.help': '說明',
        'common.about': '關於',
        'common.logout': '登出',
        'common.login': '登入',
        'common.register': '註冊',
        'user_menu.notifications.title': '通知設定',
        'user_menu.notifications.level_all': '所有訊息',
        'user_menu.notifications.level_mention': '僅@提及',
        'user_menu.notifications.level_mute': '靜音',
        'user_menu.notifications.enabled': '啟用通知',
        'user_menu.notifications.sound': '聲音提示',
        'user_menu.notifications.desktop': '桌面通知',
        'user_menu.privacy.title': '隱私設定',
        'user_menu.privacy.read_receipts': '顯示已讀回執',
        'user_menu.privacy.typing_status': '顯示輸入狀態',
        'user_menu.privacy.online_status': '顯示上線狀態',
        'user_menu.security.title': '安全設定',
        'user_menu.devices.title': '裝置管理',
        'chat.message.send': '傳送訊息',
        'chat.message.placeholder': '輸入訊息...',
        'chat.message.file': '傳送檔案',
        'chat.message.image': '傳送圖片',
        'chat.message.video': '傳送影片',
        'chat.message.voice': '傳送語音',
        'chat.message.emoji': '選擇表情',
        'chat.message.mention': '提及成員',
        'chat.message.reply': '回覆訊息',
        'room.invite_members': '邀請成員',
        'room.remove_members': '移除成員',
        'room.settings': '房間設定',
        'room.leave': '離開房間',
        'room.leave_confirm': '確定要離開此房間嗎？',
        'space.create_space': '建立空間',
        'space.add_room': '新增房間',
        'space.remove_room': '從空間移除',
        'space.members': '空間成員',
        'space.settings': '空間設定'
      },
      'en-US': {
        'common.ok': 'OK',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.close': 'Close',
        'common.loading': 'Loading...',
        'common.error': 'An error occurred',
        'common.success': 'Operation successful',
        'common.confirm': 'Confirm',
        'common.back': 'Back',
        'common.next': 'Next',
        'common.previous': 'Previous',
        'common.submit': 'Submit',
        'common.search': 'Search',
        'common.settings': 'Settings',
        'common.help': 'Help',
        'common.about': 'About',
        'common.logout': 'Logout',
        'common.login': 'Login',
        'common.register': 'Register',
        'user_menu.notifications.title': 'Notification Settings',
        'user_menu.notifications.level_all': 'All messages',
        'user_menu.notifications.level_mention': 'Mentions only',
        'user_menu.notifications.level_mute': 'Mute',
        'user_menu.notifications.enabled': 'Enable notifications',
        'user_menu.notifications.sound': 'Sound alerts',
        'user_menu.notifications.desktop': 'Desktop notifications',
        'user_menu.privacy.title': 'Privacy Settings',
        'user_menu.privacy.read_receipts': 'Show read receipts',
        'user_menu.privacy.typing_status': 'Show typing status',
        'user_menu.privacy.online_status': 'Show online status',
        'user_menu.security.title': 'Security Settings',
        'user_menu.devices.title': 'Device Management',
        'chat.message.send': 'Send message',
        'chat.message.placeholder': 'Type a message...',
        'chat.message.file': 'Send file',
        'chat.message.image': 'Send image',
        'chat.message.video': 'Send video',
        'chat.message.voice': 'Send voice',
        'chat.message.emoji': 'Select emoji',
        'chat.message.mention': 'Mention member',
        'chat.message.reply': 'Reply',
        'room.invite_members': 'Invite members',
        'room.remove_members': 'Remove members',
        'room.settings': 'Room settings',
        'room.leave': 'Leave room',
        'room.leave_confirm': 'Are you sure you want to leave this room?',
        'space.create_space': 'Create space',
        'space.add_room': 'Add room',
        'space.remove_room': 'Remove from space',
        'space.members': 'Space members',
        'space.settings': 'Space settings'
      },
      'en-GB': {
        'common.ok': 'OK',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.close': 'Close',
        'common.loading': 'Loading...',
        'common.error': 'An error occurred',
        'common.success': 'Operation successful',
        'common.confirm': 'Confirm',
        'common.back': 'Back',
        'common.next': 'Next',
        'common.previous': 'Previous',
        'common.submit': 'Submit',
        'common.search': 'Search',
        'common.settings': 'Settings',
        'common.help': 'Help',
        'common.about': 'About',
        'common.logout': 'Log out',
        'common.login': 'Log in',
        'common.register': 'Register',
        'user_menu.notifications.title': 'Notification Settings',
        'user_menu.notifications.level_all': 'All messages',
        'user_menu.notifications.level_mention': 'Mentions only',
        'user_menu.notifications.level_mute': 'Mute',
        'user_menu.notifications.enabled': 'Enable notifications',
        'user_menu.notifications.sound': 'Sound alerts',
        'user_menu.notifications.desktop': 'Desktop notifications',
        'user_menu.privacy.title': 'Privacy Settings',
        'user_menu.privacy.read_receipts': 'Show read receipts',
        'user_menu.privacy.typing_status': 'Show typing status',
        'user_menu.privacy.online_status': 'Show online status',
        'user_menu.security.title': 'Security Settings',
        'user_menu.devices.title': 'Device Management',
        'chat.message.send': 'Send message',
        'chat.message.placeholder': 'Type a message...',
        'chat.message.file': 'Send file',
        'chat.message.image': 'Send image',
        'chat.message.video': 'Send video',
        'chat.message.voice': 'Send voice',
        'chat.message.emoji': 'Select emoji',
        'chat.message.mention': 'Mention member',
        'chat.message.reply': 'Reply',
        'room.invite_members': 'Invite members',
        'room.remove_members': 'Remove members',
        'room.settings': 'Room settings',
        'room.leave': 'Leave room',
        'room.leave_confirm': 'Are you sure you want to leave this room?',
        'space.create_space': 'Create space',
        'space.add_room': 'Add room',
        'space.remove_room': 'Remove from space',
        'space.members': 'Space members',
        'space.settings': 'Space settings'
      },
      'ja-JP': {
        'common.ok': 'OK',
        'common.cancel': 'キャンセル',
        'common.save': '保存',
        'common.delete': '削除',
        'common.edit': '編集',
        'common.close': '閉じる',
        'common.loading': '読み込み中...',
        'common.error': 'エラーが発生しました',
        'common.success': '操作が成功しました',
        'common.confirm': '確認',
        'common.back': '戻る',
        'common.next': '次へ',
        'common.previous': '前へ',
        'common.submit': '送信',
        'common.search': '検索',
        'common.settings': '設定',
        'common.help': 'ヘルプ',
        'common.about': 'について',
        'common.logout': 'ログアウト',
        'common.login': 'ログイン',
        'common.register': '登録',
        'user_menu.notifications.title': '通知設定',
        'user_menu.notifications.level_all': 'すべてのメッセージ',
        'user_menu.notifications.level_mention': 'メンションのみ',
        'user_menu.notifications.level_mute': 'ミュート',
        'user_menu.notifications.enabled': '通知を有効にする',
        'user_menu.notifications.sound': 'サウンド通知',
        'user_menu.notifications.desktop': 'デスクトップ通知',
        'user_menu.privacy.title': 'プライバシー設定',
        'user_menu.privacy.read_receipts': '既読を表示',
        'user_menu.privacy.typing_status': '入力状態を表示',
        'user_menu.privacy.online_status': 'オンライン状態を表示',
        'user_menu.security.title': 'セキュリティ設定',
        'user_menu.devices.title': 'デバイス管理',
        'chat.message.send': 'メッセージを送信',
        'chat.message.placeholder': 'メッセージを入力...',
        'chat.message.file': 'ファイルを送信',
        'chat.message.image': '画像を送信',
        'chat.message.video': '動画を送信',
        'chat.message.voice': '音声を送信',
        'chat.message.emoji': '絵文字を選択',
        'chat.message.mention': 'メンバーを言及',
        'chat.message.reply': '返信',
        'room.invite_members': 'メンバーを招待',
        'room.remove_members': 'メンバーを削除',
        'room.settings': 'ルーム設定',
        'room.leave': 'ルームを退出',
        'room.leave_confirm': 'このルームを退出しますか？',
        'space.create_space': 'スペースを作成',
        'space.add_room': 'ルームを追加',
        'space.remove_room': 'スペースから削除',
        'space.members': 'スペースメンバー',
        'space.settings': 'スペース設定'
      },
      'ko-KR': {
        'common.ok': '확인',
        'common.cancel': '취소',
        'common.save': '저장',
        'common.delete': '삭제',
        'common.edit': '수정',
        'common.close': '닫기',
        'common.loading': '로딩 중...',
        'common.error': '오류가 발생했습니다',
        'common.success': '작업이 성공했습니다',
        'common.confirm': '확인',
        'common.back': '뒤로',
        'common.next': '다음',
        'common.previous': '이전',
        'common.submit': '제출',
        'common.search': '검색',
        'common.settings': '설정',
        'common.help': '도움말',
        'common.about': '정보',
        'common.logout': '로그아웃',
        'common.login': '로그인',
        'common.register': '등록',
        'user_menu.notifications.title': '알림 설정',
        'user_menu.notifications.level_all': '모든 메시지',
        'user_menu.notifications.level_mention': '멘션만',
        'user_menu.notifications.level_mute': '음소거',
        'user_menu.notifications.enabled': '알림 활성화',
        'user_menu.notifications.sound': '소리 알림',
        'user_menu.notifications.desktop': '데스크톱 알림',
        'user_menu.privacy.title': '개인정보 설정',
        'user_menu.privacy.read_receipts': '읽음 표시 표시',
        'user_menu.privacy.typing_status': '입력 상태 표시',
        'user_menu.privacy.online_status': '온라인 상태 표시',
        'user_menu.security.title': '보안 설정',
        'user_menu.devices.title': '장치 관리',
        'chat.message.send': '메시지 보내기',
        'chat.message.placeholder': '메시지 입력...',
        'chat.message.file': '파일 보내기',
        'chat.message.image': '이미지 보내기',
        'chat.message.video': '동영상 보내기',
        'chat.message.voice': '음성 보내기',
        'chat.message.emoji': '이모지 선택',
        'chat.message.mention': '멤버 언급',
        'chat.message.reply': '답장',
        'room.invite_members': '멤버 초대',
        'room.remove_members': '멤버 제거',
        'room.settings': '방 설정',
        'room.leave': '방 나가기',
        'room.leave_confirm': '이 방을 나가시겠습니까?',
        'space.create_space': '공간 만들기',
        'space.add_room': '방 추가',
        'space.remove_room': '공간에서 제거',
        'space.members': '공간 멤버',
        'space.settings': '공간 설정'
      },
      'ru-RU': {
        'common.ok': 'ОК',
        'common.cancel': 'Отмена',
        'common.save': 'Сохранить',
        'common.delete': 'Удалить',
        'common.edit': 'Редактировать',
        'common.close': 'Закрыть',
        'common.loading': 'Загрузка...',
        'common.error': 'Произошла ошибка',
        'common.success': 'Операция успешна',
        'common.confirm': 'Подтвердить',
        'common.back': 'Назад',
        'common.next': 'Далее',
        'common.previous': 'Назад',
        'common.submit': 'Отправить',
        'common.search': 'Поиск',
        'common.settings': 'Настройки',
        'common.help': 'Помощь',
        'common.about': 'О приложении',
        'common.logout': 'Выйти',
        'common.login': 'Войти',
        'common.register': 'Регистрация',
        'user_menu.notifications.title': 'Настройки уведомлений',
        'user_menu.notifications.level_all': 'Все сообщения',
        'user_menu.notifications.level_mention': 'Только упоминания',
        'user_menu.notifications.level_mute': 'Без звука',
        'user_menu.notifications.enabled': 'Включить уведомления',
        'user_menu.notifications.sound': 'Звуковые сигналы',
        'user_menu.notifications.desktop': 'Уведомления на рабочем столе',
        'user_menu.privacy.title': 'Настройки конфиденциальности',
        'user_menu.privacy.read_receipts': 'Показывать уведомления о прочтении',
        'user_menu.privacy.typing_status': 'Показывать статус набора',
        'user_menu.privacy.online_status': 'Показывать онлайн-статус',
        'user_menu.security.title': 'Настройки безопасности',
        'user_menu.devices.title': 'Управление устройствами',
        'chat.message.send': 'Отправить сообщение',
        'chat.message.placeholder': 'Введите сообщение...',
        'chat.message.file': 'Отправить файл',
        'chat.message.image': 'Отправить изображение',
        'chat.message.video': 'Отправить видео',
        'chat.message.voice': 'Отправить голосовое',
        'chat.message.emoji': 'Выбрать эмодзи',
        'chat.message.mention': 'Упомянуть участника',
        'chat.message.reply': 'Ответить',
        'room.invite_members': 'Пригласить участников',
        'room.remove_members': 'Удалить участников',
        'room.settings': 'Настройки комнаты',
        'room.leave': 'Покинуть комнату',
        'room.leave_confirm': 'Вы уверены, что хотите покинуть эту комнату?',
        'space.create_space': 'Создать пространство',
        'space.add_room': 'Добавить комнату',
        'space.remove_room': 'Удалить из пространства',
        'space.members': 'Участники пространства',
        'space.settings': 'Настройки пространства'
      },
      'de-DE': {
        'common.ok': 'OK',
        'common.cancel': 'Abbrechen',
        'common.save': 'Speichern',
        'common.delete': 'Löschen',
        'common.edit': 'Bearbeiten',
        'common.close': 'Schließen',
        'common.loading': 'Wird geladen...',
        'common.error': 'Ein Fehler ist aufgetreten',
        'common.success': 'Vorgang erfolgreich',
        'common.confirm': 'Bestätigen',
        'common.back': 'Zurück',
        'common.next': 'Weiter',
        'common.previous': 'Zurück',
        'common.submit': 'Absenden',
        'common.search': 'Suchen',
        'common.settings': 'Einstellungen',
        'common.help': 'Hilfe',
        'common.about': 'Über',
        'common.logout': 'Abmelden',
        'common.login': 'Anmelden',
        'common.register': 'Registrieren',
        'user_menu.notifications.title': 'Benachrichtigungseinstellungen',
        'user_menu.notifications.level_all': 'Alle Nachrichten',
        'user_menu.notifications.level_mention': 'Nur Erwähnungen',
        'user_menu.notifications.level_mute': 'Stumm',
        'user_menu.notifications.enabled': 'Benachrichtigungen aktivieren',
        'user_menu.notifications.sound': 'Töne',
        'user_menu.notifications.desktop': 'Desktop-Benachrichtigungen',
        'user_menu.privacy.title': 'Datenschutzeinstellungen',
        'user_menu.privacy.read_receipts': 'Lesebestätigungen anzeigen',
        'user_menu.privacy.typing_status': 'Tippen-Status anzeigen',
        'user_menu.privacy.online_status': 'Online-Status anzeigen',
        'user_menu.security.title': 'Sicherheitseinstellungen',
        'user_menu.devices.title': 'Geräteverwaltung',
        'chat.message.send': 'Nachricht senden',
        'chat.message.placeholder': 'Nachricht eingeben...',
        'chat.message.file': 'Datei senden',
        'chat.message.image': 'Bild senden',
        'chat.message.video': 'Video senden',
        'chat.message.voice': 'Sprachnachricht senden',
        'chat.message.emoji': 'Emoji auswählen',
        'chat.message.mention': 'Mitglied erwähnen',
        'chat.message.reply': 'Antworten',
        'room.invite_members': 'Mitglieder einladen',
        'room.remove_members': 'Mitglieder entfernen',
        'room.settings': 'Raumeinstellungen',
        'room.leave': 'Raum verlassen',
        'room.leave_confirm': 'Möchten Sie diesen Raum wirklich verlassen?',
        'space.create_space': 'Space erstellen',
        'space.add_room': 'Raum hinzufügen',
        'space.remove_room': 'Aus Space entfernen',
        'space.members': 'Space-Mitglieder',
        'space.settings': 'Space-Einstellungen'
      },
      'fr-FR': {
        'common.ok': 'OK',
        'common.cancel': 'Annuler',
        'common.save': 'Enregistrer',
        'common.delete': 'Supprimer',
        'common.edit': 'Modifier',
        'common.close': 'Fermer',
        'common.loading': 'Chargement...',
        'common.error': 'Une erreur est survenue',
        'common.success': 'Opération réussie',
        'common.confirm': 'Confirmer',
        'common.back': 'Retour',
        'common.next': 'Suivant',
        'common.previous': 'Précédent',
        'common.submit': 'Soumettre',
        'common.search': 'Rechercher',
        'common.settings': 'Paramètres',
        'common.help': 'Aide',
        'common.about': 'À propos',
        'common.logout': 'Déconnexion',
        'common.login': 'Connexion',
        'common.register': 'Inscription',
        'user_menu.notifications.title': 'Paramètres de notification',
        'user_menu.notifications.level_all': 'Tous les messages',
        'user_menu.notifications.level_mention': 'Mentions uniquement',
        'user_menu.notifications.level_mute': 'Muet',
        'user_menu.notifications.enabled': 'Activer les notifications',
        'user_menu.notifications.sound': 'Alertes sonores',
        'user_menu.notifications.desktop': 'Notifications de bureau',
        'user_menu.privacy.title': 'Paramètres de confidentialité',
        'user_menu.privacy.read_receipts': 'Afficher les accusés de lecture',
        'user_menu.privacy.typing_status': 'Afficher le statut de frappe',
        'user_menu.privacy.online_status': 'Afficher le statut en ligne',
        'user_menu.security.title': 'Paramètres de sécurité',
        'user_menu.devices.title': 'Gestion des appareils',
        'chat.message.send': 'Envoyer un message',
        'chat.message.placeholder': 'Tapez un message...',
        'chat.message.file': 'Envoyer un fichier',
        'chat.message.image': 'Envoyer une image',
        'chat.message.video': 'Envoyer une vidéo',
        'chat.message.voice': 'Envoyer un message vocal',
        'chat.message.emoji': 'Sélectionner un emoji',
        'chat.message.mention': 'Mentionner un membre',
        'chat.message.reply': 'Répondre',
        'room.invite_members': 'Inviter des membres',
        'room.remove_members': 'Supprimer des membres',
        'room.settings': 'Paramètres du salon',
        'room.leave': 'Quitter le salon',
        'room.leave_confirm': 'Êtes-vous sûr de vouloir quitter ce salon ?',
        'space.create_space': 'Créer un espace',
        'space.add_room': 'Ajouter un salon',
        'space.remove_room': "Supprimer de l'espace",
        'space.members': "Membres de l'espace",
        'space.settings': "Paramètres de l'espace"
      },
      'es-ES': {
        'common.ok': 'Aceptar',
        'common.cancel': 'Cancelar',
        'common.save': 'Guardar',
        'common.delete': 'Eliminar',
        'common.edit': 'Editar',
        'common.close': 'Cerrar',
        'common.loading': 'Cargando...',
        'common.error': 'Se produjo un error',
        'common.success': 'Operación exitosa',
        'common.confirm': 'Confirmar',
        'common.back': 'Volver',
        'common.next': 'Siguiente',
        'common.previous': 'Anterior',
        'common.submit': 'Enviar',
        'common.search': 'Buscar',
        'common.settings': 'Configuración',
        'common.help': 'Ayuda',
        'common.about': 'Acerca de',
        'common.logout': 'Cerrar sesión',
        'common.login': 'Iniciar sesión',
        'common.register': 'Registrarse',
        'user_menu.notifications.title': 'Configuración de notificaciones',
        'user_menu.notifications.level_all': 'Todos los mensajes',
        'user_menu.notifications.level_mention': 'Solo menciones',
        'user_menu.notifications.level_mute': 'Silenciar',
        'user_menu.notifications.enabled': 'Habilitar notificaciones',
        'user_menu.notifications.sound': 'Alertas de sonido',
        'user_menu.notifications.desktop': 'Notificaciones de escritorio',
        'user_menu.privacy.title': 'Configuración de privacidad',
        'user_menu.privacy.read_receipts': 'Mostrar recibos de lectura',
        'user_menu.privacy.typing_status': 'Mostrar estado de escritura',
        'user_menu.privacy.online_status': 'Mostrar estado en línea',
        'user_menu.security.title': 'Configuración de seguridad',
        'user_menu.devices.title': 'Gestión de dispositivos',
        'chat.message.send': 'Enviar mensaje',
        'chat.message.placeholder': 'Escribe un mensaje...',
        'chat.message.file': 'Enviar archivo',
        'chat.message.image': 'Enviar imagen',
        'chat.message.video': 'Enviar video',
        'chat.message.voice': 'Enviar nota de voz',
        'chat.message.emoji': 'Seleccionar emoji',
        'chat.message.mention': 'Mencionar miembro',
        'chat.message.reply': 'Responder',
        'room.invite_members': 'Invitar miembros',
        'room.remove_members': 'Eliminar miembros',
        'room.settings': 'Configuración de la sala',
        'room.leave': 'Salir de la sala',
        'room.leave_confirm': '¿Estás seguro de que quieres salir de esta sala?',
        'space.create_space': 'Crear espacio',
        'space.add_room': 'Añadir sala',
        'space.remove_room': 'Eliminar del espacio',
        'space.members': 'Miembros del espacio',
        'space.settings': 'Configuración del espacio'
      }
    }

    const locale = this._currentLocale.value
    const fallback = this._fallbackLocale.value

    const translation =
      translations[locale]?.[key] || translations[fallback]?.[key] || translations['en-US']?.[key] || key

    return translation
  }

  private interpolateParams(text: string, params?: Record<string, any>): string {
    if (!params) return text

    return text.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match
    })
  }

  formatDate(date: Date | number | string, options?: DateTimeFormatOptions): string {
    const d = typeof date === 'string' ? new Date(date) : typeof date === 'number' ? new Date(date) : date

    if (options?.format === 'relative') {
      return this.formatRelativeTime(d)
    }

    if (options?.format === 'calendar') {
      return this.formatCalendarDate(d)
    }

    const locale = this._currentLocale.value
    const formatKey = `${locale}-${JSON.stringify(options)}`

    if (!this._dateTimeFormats.has(formatKey)) {
      const intlOptions: Intl.DateTimeFormatOptions = {
        dateStyle: options?.dateStyle || 'medium',
        timeStyle: options?.timeStyle || 'short'
      }

      if (options?.format === 'date') {
        intlOptions.dateStyle = options?.dateStyle || 'medium'
        intlOptions.timeStyle = undefined
      } else if (options?.format === 'time') {
        intlOptions.dateStyle = undefined
        intlOptions.timeStyle = options?.timeStyle || 'short'
      }

      this._dateTimeFormats.set(formatKey, new Intl.DateTimeFormat(locale, intlOptions))
    }

    return this._dateTimeFormats.get(formatKey)!.format(d)
  }

  formatRelativeTime(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    const locale = this._currentLocale.value

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

    if (diffSec < 60) {
      return this.t('time.just_now')
    } else if (diffMin < 60) {
      return rtf.format(-diffMin, 'minute')
    } else if (diffHour < 24) {
      return rtf.format(-diffHour, 'hour')
    } else if (diffDay < 7) {
      return rtf.format(-diffDay, 'day')
    } else {
      return this.formatDate(date, { format: 'date' })
    }
  }

  formatCalendarDate(date: Date): string {
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString()

    if (isToday) {
      return this.t('time.today')
    } else if (isYesterday) {
      return this.t('time.yesterday')
    }

    return this.formatDate(date, { format: 'date' })
  }

  formatNumber(num: number | string, options?: NumberFormatOptions): string {
    const value = typeof num === 'string' ? parseFloat(num) : num
    if (isNaN(value)) return String(num)

    const locale = this._currentLocale.value
    const formatKey = `${locale}-${JSON.stringify(options)}`

    if (!this._numberFormats.has(formatKey)) {
      const intlOptions: Intl.NumberFormatOptions = {
        style: options?.style || 'decimal',
        minimumFractionDigits: options?.minimumFractionDigits ?? 0,
        maximumFractionDigits: options?.maximumFractionDigits ?? 2
      }

      if (options?.style === 'currency' && options?.currency) {
        intlOptions.currency = options.currency
      }

      this._numberFormats.set(formatKey, new Intl.NumberFormat(locale, intlOptions))
    }

    return this._numberFormats.get(formatKey)!.format(value)
  }

  formatCurrency(amount: number, currency: string = 'CNY'): string {
    return this.formatNumber(amount, {
      style: 'currency',
      currency
    })
  }

  formatPercent(value: number): string {
    return this.formatNumber(value, {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    })
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return this.t('file_size.bytes', { count: 0 })

    const units = ['bytes', 'kb', 'mb', 'gb', 'tb']
    const k = 1024
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    const value = bytes / k ** i

    const locale = this._currentLocale.value

    if (locale.startsWith('zh')) {
      const zhUnits = ['字节', 'KB', 'MB', 'GB', 'TB']
      return `${this.formatNumber(value, { maximumFractionDigits: 1 })} ${zhUnits[i]}`
    }

    return `${this.formatNumber(value, { maximumFractionDigits: 1 })} ${units[i].toUpperCase()}`
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    const locale = this._currentLocale.value

    if (hours > 0) {
      if (locale.startsWith('zh')) {
        return `${hours}小时${minutes}分${secs}秒`
      }
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      if (locale.startsWith('zh')) {
        return `${minutes}分${secs}秒`
      }
      return `${minutes}m ${secs}s`
    }

    if (locale.startsWith('zh')) {
      return `${secs}秒`
    }
    return `${secs}s`
  }

  private clearFormatCache(): void {
    this._dateTimeFormats.clear()
    this._numberFormats.clear()
  }

  getLocaleDirection(): 'ltr' | 'rtl' {
    return this.currentLocaleInfo?.dir || 'ltr'
  }

  isRTL(): boolean {
    return this.getLocaleDirection() === 'rtl'
  }

  on(event: string, listener: (data: any) => void): void {
    if (!this._i18nListeners.has(event)) {
      this._i18nListeners.set(event, [])
    }
    this._i18nListeners.get(event)?.push(listener)
  }

  off(event: string, listener: (data: any) => void): void {
    const listeners = this._i18nListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners(event: string, data: any): void {
    const listeners = this._i18nListeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => listener(data))
    }
  }

  addTranslations(_locale: Locale, _translations: Record<string, string>): void {
    console.warn('MatrixI18nService: addTranslations is not fully implemented')
  }

  destroy(): void {
    this._i18nListeners.clear()
    this.clearFormatCache()
  }
}

export default MatrixI18nService
