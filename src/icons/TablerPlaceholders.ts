import { defineComponent, h } from 'vue'

const makeIcon = (emoji: string) =>
  defineComponent({
    name: 'IconPlaceholder',
    setup() {
      return () => h('span', { style: 'display:inline-block' }, emoji)
    }
  })

export const Building = makeIcon('🏢')
export const Globe = makeIcon('🌐')
export const Archive = makeIcon('📦')
export const Star = makeIcon('⭐')
export const Users = makeIcon('👥')
export const Hash = makeIcon('#')
export const Calendar = makeIcon('📅')
export const Clock = makeIcon('🕒')
export const Plus = makeIcon('➕')
export const Settings = makeIcon('⚙️')
export const Search = makeIcon('🔍')
export const UserPlus = makeIcon('👤➕')
export const MoreHorizontal = makeIcon('⋯')
export const MessageCircle = makeIcon('💬')
export const Video = makeIcon('🎥')
export const FileText = makeIcon('📄')
export const Bell = makeIcon('🔔')
export const Lock = makeIcon('🔒')
export const Trash = makeIcon('🗑️')
export const X = makeIcon('✖️')
export const BarChart = makeIcon('📊')
export const Send = makeIcon('📨')
export const Mail = makeIcon('✉️')
export const Key = makeIcon('🔑')
export const HelpCircle = makeIcon('❓')
export const Check = makeIcon('✔️')
export const Camera = makeIcon('📷')
