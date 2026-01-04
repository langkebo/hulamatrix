<template>
  <n-icon :size="size">
    <component :is="iconComponent" />
  </n-icon>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import * as TablerIcons from '@vicons/tabler'

defineOptions({
  name: 'MobileIcon'
})

interface Props {
  name: string
  size?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  size: 20
})

// Map icon names to Tabler icon components
const iconMap: Record<string, any> = {
  // Navigation
  'chevron-right': TablerIcons.ChevronRight,
  'chevron-left': TablerIcons.ChevronLeft,
  'chevron-up': TablerIcons.ChevronUp,
  'chevron-down': TablerIcons.ChevronDown,

  // Actions
  settings: TablerIcons.Settings,
  'settings-2': TablerIcons.Adjustments,
  'log-out': TablerIcons.Logout,
  'log-in': TablerIcons.Login,
  user: TablerIcons.User,
  users: TablerIcons.Users,
  'user-plus': TablerIcons.UserPlus,
  'user-minus': TablerIcons.UserMinus,
  'user-check': TablerIcons.UserCheck,
  'user-x': TablerIcons.UserX,

  // Security
  lock: TablerIcons.Lock,
  'lock-open': TablerIcons.LockOpen,
  shield: TablerIcons.Shield,
  'shield-check': TablerIcons.ShieldCheck,
  'shield-x': TablerIcons.ShieldX,
  key: TablerIcons.Key,
  eye: TablerIcons.Eye,
  'eye-off': TablerIcons.EyeOff,

  // Communication
  bell: TablerIcons.Bell,
  'bell-off': TablerIcons.BellOff,
  'message-circle': TablerIcons.MessageCircle,
  'message-square': TablerIcons.Message,
  send: TablerIcons.Send,
  mail: TablerIcons.Mail,

  // Media
  image: TablerIcons.Photo,
  video: TablerIcons.Video,
  camera: TablerIcons.Camera,
  microphone: TablerIcons.Microphone,
  'microphone-off': TablerIcons.MicrophoneOff,

  // Devices
  smartphone: TablerIcons.DeviceMobile,
  devices: TablerIcons.Devices,
  monitor: TablerIcons.DeviceDesktop,
  laptop: TablerIcons.DeviceLaptop,

  // Files
  file: TablerIcons.File,
  folder: TablerIcons.Folder,
  download: TablerIcons.Download,
  upload: TablerIcons.Upload,

  // Interface
  menu: TablerIcons.Menu,
  'more-horizontal': TablerIcons.Dots,
  'more-vertical': TablerIcons.DotsVertical,
  x: TablerIcons.X,
  check: TablerIcons.Check,
  search: TablerIcons.Search,
  filter: TablerIcons.Filter,
  sliders: TablerIcons.AdjustmentsHorizontal,
  plus: TablerIcons.Plus,
  minus: TablerIcons.Minus,

  // Status
  'alert-circle': TablerIcons.AlertCircle,
  'alert-triangle': TablerIcons.AlertTriangle,
  'info-circle': TablerIcons.InfoCircle,
  'check-circle': TablerIcons.CircleCheck,
  'x-circle': TablerIcons.CircleX,
  'help-circle': TablerIcons.Help,

  // Miscellaneous
  qrcode: TablerIcons.Qrcode,
  palette: TablerIcons.Palette,
  sun: TablerIcons.Sun,
  moon: TablerIcons.Moon,
  clock: TablerIcons.Clock,
  calendar: TablerIcons.Calendar,
  hash: TablerIcons.Hash,
  link: TablerIcons.Link,
  copy: TablerIcons.Copy,
  trash: TablerIcons.Trash,
  edit: TablerIcons.Edit,
  'external-link': TablerIcons.ExternalLink,

  // Spaces
  home: TablerIcons.Home,
  star: TablerIcons.Star,
  'star-filled': TablerIcons.Star,
  bookmark: TablerIcons.Bookmark,
  'bookmark-filled': TablerIcons.Bookmark
}

const iconComponent = computed(() => {
  return iconMap[props.name] || TablerIcons.Help // Default to help icon if icon not found
})
</script>
