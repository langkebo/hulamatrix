import { ref, computed, nextTick } from 'vue'
import { useGroupStore } from '@/stores/group'

import type { Ref } from 'vue'
import type { UserItem } from '@/services/types'
import { useUserStore } from '@/stores/user'
import type { EditorRange } from '@/hooks/useMsgInput/types'
import DOMPurify from 'dompurify'

/**
 * @提及功能处理 Composable
 */
export function useMentionHandler(messageInputDom: Ref, editorRange: Ref<EditorRange | null>) {
  const groupStore = useGroupStore()

  const userStore = useUserStore()

  // @提及相关的响应式状态
  const ait = ref(false)
  const aitKey = ref('')
  const selectedAitKey = ref('')

  // 用户列表
  const personList = computed(() => {
    return groupStore.userList
      .map((user) => {
        const displayName = user.myName || user.name
        return {
          ...user,
          searchKey: displayName.toLowerCase(),
          avatar: user.avatar || ''
        }
      })
      .filter((user) => {
        // 过滤掉自己
        if (user.uid === userStore.userInfo?.uid) return false
        // 过滤掉机器人
        if (user.roleId && user.roleId >= 100) return false
        return true
      })
      .sort((a, b) => {
        // 优先显示在线用户
        if (a.activeStatus !== b.activeStatus) {
          return b.activeStatus ? 1 : -1
        }
        // 按名称排序
        return (a.searchKey || '').localeCompare(b.searchKey || '')
      })
  })

  // 监听输入变化
  const handleInputChange = () => {
    const textContent = messageInputDom.value?.textContent || ''
    const lastChar = textContent[textContent.length - 1]

    // 检查是否输入了@符号
    if (lastChar === '@' && !ait.value) {
      showMentionPanel()
    } else if (ait.value) {
      // 过滤用户列表
      filterUserList(textContent)
    } else {
      hideMentionPanel()
    }
  }

  /**
   * 显示@提及面板
   */
  const showMentionPanel = () => {
    ait.value = true
    aitKey.value = ''
    selectedAitKey.value = ''

    // 滚动到第一个用户
    nextTick(() => {
      selectedAitKey.value = personList.value[0]?.uid || ''
    })
  }

  /**
   * 隐藏@提及面板
   */
  const hideMentionPanel = () => {
    ait.value = false
    aitKey.value = ''
    selectedAitKey.value = ''
  }

  /**
   * 过滤用户列表
   */
  const filterUserList = (searchText: string) => {
    // 找到最后一个@符号的位置
    const lastAtIndex = searchText.lastIndexOf('@')
    if (lastAtIndex === -1) {
      hideMentionPanel()
      return
    }

    // 提取@符号后的内容作为搜索关键词
    const searchKey = searchText.slice(lastAtIndex + 1).toLowerCase()
    aitKey.value = searchKey

    // 更新选中项
    const filtered = personList.value.filter((user) => user.searchKey.includes(searchKey))

    if (filtered.length > 0) {
      selectedAitKey.value = filtered[0]?.uid || ''
    } else {
      selectedAitKey.value = ''
    }
  }

  /**
   * 处理@提及选择
   */
  const handleAit = (item: UserItem) => {
    const myEditorRange = editorRange?.value?.range
    if (!myEditorRange) return

    const textNode = myEditorRange.endContainer
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      // 创建文本节点
      const textNode = document.createTextNode('')
      myEditorRange.insertNode(textNode)
      myEditorRange.selectNodeContents(textNode)
    }

    // 获取当前文本内容
    const endOffset = myEditorRange.endOffset
    const textNodeValue = textNode?.nodeValue as string

    // 查找@符号的位置
    const expRes = /@([^@]*)$/.exec(textNodeValue)
    if (!expRes) return

    // 构建@提及的HTML
    const mentionHtml = createMentionHtml(item)

    // 替换@符号后的内容
    const beforeAt = textNodeValue.slice(0, endOffset - expRes[0].length)

    // 更新文本节点
    textNode.nodeValue = beforeAt

    // 插入@提及元素
    const mentionElement = document.createElement('span')
    mentionElement.innerHTML = DOMPurify.sanitize(mentionHtml)
    mentionElement.id = 'aitSpan'
    mentionElement.dataset.aitUid = item.uid
    mentionElement.contentEditable = 'false'

    // 插入到光标位置
    const newRange = document.createRange()
    newRange.setStart(textNode, beforeAt.length)
    newRange.insertNode(mentionElement)
    newRange.collapse(false)

    // 添加空格
    const spaceNode = document.createTextNode(' ')
    newRange.insertNode(spaceNode)
    newRange.collapse(false)

    // 更新选择
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(newRange)
    }

    // 隐藏@提及面板
    hideMentionPanel()

    // 聚焦输入框
    messageInputDom.value.focus()
  }

  /**
   * 创建@提及的HTML
   */
  const createMentionHtml = (user: UserItem): string => {
    const userInfo = groupStore.getUserInfo(user.uid)
    const displayName = userInfo?.myName || user.name

    return `
      <span class="ait-user" data-ait-uid="${user.uid}">
        <span class="ait-text">@${displayName}</span>
      </span>
    `
  }

  /**
   * 处理键盘导航
   */
  const handleKeyNavigation = (e: KeyboardEvent) => {
    if (!ait.value || personList.value.length === 0) return

    const currentIndex = personList.value.findIndex((u) => u.uid === selectedAitKey.value)

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        if (currentIndex > 0) {
          const prevUser = personList.value[currentIndex - 1]
          if (prevUser) {
            selectedAitKey.value = prevUser.uid
          }
        }
        break

      case 'ArrowDown':
        e.preventDefault()
        if (currentIndex < personList.value.length - 1) {
          const nextUser = personList.value[currentIndex + 1]
          if (nextUser) {
            selectedAitKey.value = nextUser.uid
          }
        }
        break

      case 'Enter':
        e.preventDefault()
        if (selectedAitKey.value) {
          const selectedUser = personList.value.find((u) => u.uid === selectedAitKey.value)
          if (selectedUser) {
            handleAit(selectedUser)
          }
        }
        break

      case 'Escape':
        e.preventDefault()
        hideMentionPanel()
        break
    }
  }

  /**
   * 处理点击外部
   */
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Element
    const mentionPanel = document.querySelector('.mention-panel')

    if (mentionPanel && !mentionPanel.contains(target)) {
      hideMentionPanel()
    }
  }

  return {
    // 状态
    ait,
    aitKey,
    selectedAitKey,
    personList,

    // 方法
    showMentionPanel,
    hideMentionPanel,
    handleAit,
    handleKeyNavigation,
    handleClickOutside,
    handleInputChange
  }
}
