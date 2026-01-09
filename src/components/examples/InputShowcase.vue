<template>
  <div class="input-showcase">
    <h2>输入框组件示例 - 使用统一色彩系统</h2>

    <!-- 基础输入框 -->
    <section class="showcase-section">
      <h3>基础输入框</h3>
      <div class="input-group">
        <input type="text" class="input-brand" placeholder="请输入内容" />
        <input type="text" class="input-brand" placeholder="禁用状态" disabled />
      </div>
    </section>

    <!-- 带标签的输入框 -->
    <section class="showcase-section">
      <h3>带标签的输入框</h3>
      <div class="input-group">
        <div class="input-wrapper">
          <label for="username" class="input-label">用户名</label>
          <input id="username" type="text" class="input-brand" placeholder="请输入用户名" />
        </div>
        <div class="input-wrapper">
          <label for="password" class="input-label">密码</label>
          <input id="password" type="password" class="input-brand" placeholder="请输入密码" />
        </div>
      </div>
    </section>

    <!-- 带图标的输入框 -->
    <section class="showcase-section">
      <h3>带图标的输入框</h3>
      <div class="input-group">
        <div class="input-with-icon">
          <Icon icon="mdi:magnify" class="input-icon" />
          <input type="text" class="input-brand input-with-icon-input" placeholder="搜索..." />
        </div>
        <div class="input-with-icon">
          <Icon icon="mdi:email" class="input-icon" />
          <input type="email" class="input-brand input-with-icon-input" placeholder="电子邮箱" />
        </div>
      </div>
    </section>

    <!-- 状态变体 -->
    <section class="showcase-section">
      <h3>状态变体</h3>
      <div class="input-group">
        <input type="text" class="input-brand input-success" placeholder="成功状态" value="有效的内容" />
        <input type="text" class="input-brand input-warning" placeholder="警告状态" value="需要注意的内容" />
        <input type="text" class="input-brand input-error" placeholder="错误状态" value="无效的内容" />
      </div>
    </section>

    <!-- 尺寸变体 -->
    <section class="showcase-section">
      <h3>尺寸变体</h3>
      <div class="input-group">
        <input type="text" class="input-brand input-sm" placeholder="小尺寸" />
        <input type="text" class="input-brand" placeholder="默认尺寸" />
        <input type="text" class="input-brand input-lg" placeholder="大尺寸" />
      </div>
    </section>

    <!-- 文本域 -->
    <section class="showcase-section">
      <h3>文本域</h3>
      <div class="input-group">
        <textarea class="textarea-brand" placeholder="请输入多行内容" rows="4"></textarea>
      </div>
    </section>

    <!-- 字数统计 -->
    <section class="showcase-section">
      <h3>字数统计</h3>
      <div class="input-group">
        <div class="input-wrapper">
          <textarea
            v-model="message"
            class="textarea-brand"
            placeholder="请输入消息（最多200字）"
            rows="3"
            maxlength="200"></textarea>
          <span class="input-counter">{{ message.length }}/200</span>
        </div>
      </div>
    </section>

    <!-- 帮助文本 -->
    <section class="showcase-section">
      <h3>帮助文本</h3>
      <div class="input-group">
        <div class="input-wrapper">
          <label for="email2" class="input-label">电子邮箱</label>
          <input id="email2" type="email" class="input-brand" placeholder="example@domain.com" />
          <span class="input-helper">我们会将验证链接发送到您的邮箱</span>
        </div>
        <div class="input-wrapper">
          <label for="password2" class="input-label">密码</label>
          <input id="password2" type="password" class="input-brand input-error" placeholder="请输入密码" />
          <span class="input-helper input-error-text">密码至少需要8个字符，包含字母和数字</span>
        </div>
      </div>
    </section>

    <!-- 选择框 -->
    <section class="showcase-section">
      <h3>选择框</h3>
      <div class="input-group">
        <select class="select-brand">
          <option value="">请选择选项</option>
          <option value="1">选项 1</option>
          <option value="2">选项 2</option>
          <option value="3">选项 3</option>
        </select>
      </div>
    </section>

    <!-- 复选框和单选框 -->
    <section class="showcase-section">
      <h3>复选框和单选框</h3>
      <div class="input-group">
        <label class="checkbox-brand">
          <input type="checkbox" />
          <span class="checkbox-indicator"></span>
          <span>同意用户协议</span>
        </label>
        <label class="checkbox-brand">
          <input type="checkbox" checked disabled />
          <span class="checkbox-indicator"></span>
          <span>已选中（禁用）</span>
        </label>
        <label class="radio-brand">
          <input type="radio" name="plan" value="basic" />
          <span class="radio-brand-indicator"></span>
          <span>基础版</span>
        </label>
        <label class="radio-brand">
          <input type="radio" name="plan" value="pro" />
          <span class="radio-brand-indicator"></span>
          <span>专业版</span>
        </label>
      </div>
    </section>

    <!-- 开关 -->
    <section class="showcase-section">
      <h3>开关</h3>
      <div class="input-group">
        <label class="switch-label">
          <span>接收通知</span>
          <div class="switch-brand" :class="{ active: notificationsEnabled }" @click="toggleNotifications"></div>
        </label>
        <label class="switch-label">
          <span>自动保存</span>
          <div class="switch-brand active"></div>
        </label>
      </div>
    </section>

    <!-- 搜索框示例 -->
    <section class="showcase-section">
      <h3>搜索框</h3>
      <div class="input-group">
        <div class="search-box">
          <Icon icon="mdi:magnify" class="search-icon" />
          <input v-model="searchQuery" type="text" class="search-input" placeholder="搜索..." />
          <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
            <Icon icon="mdi:close" />
          </button>
        </div>
      </div>
    </section>

    <!-- 表单组 -->
    <section class="showcase-section">
      <h3>完整表单示例</h3>
      <form class="form-brand" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="name" class="form-label">
            姓名
            <span class="required">*</span>
          </label>
          <input id="name" v-model="formData.name" type="text" class="input-brand" placeholder="请输入姓名" required />
        </div>
        <div class="form-group">
          <label for="email3" class="form-label">
            邮箱
            <span class="required">*</span>
          </label>
          <input
            id="email3"
            v-model="formData.email"
            type="email"
            class="input-brand"
            placeholder="请输入邮箱"
            required />
        </div>
        <div class="form-group">
          <label for="message3" class="form-label">留言</label>
          <textarea
            id="message3"
            v-model="formData.message"
            class="textarea-brand"
            placeholder="请输入留言内容"
            rows="4"></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-brand">提交</button>
          <button type="reset" class="btn-brand-outline">重置</button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { Icon } from '@iconify/vue'

const message = ref('')
const searchQuery = ref('')
const notificationsEnabled = ref(false)

const formData = reactive({
  name: '',
  email: '',
  message: ''
})

const toggleNotifications = () => {
  notificationsEnabled.value = !notificationsEnabled.value
}

const handleSubmit = () => {
  console.log('表单提交:', formData)
}
</script>

<style lang="scss" scoped>
.input-showcase {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;

  h2 {
    font-size: 32px;
    font-weight: 600;
    margin-bottom: 32px;
    color: var(--hula-text-primary, var(--hula-gray-800, var(--hula-brand-primary)));
  }

  .showcase-section {
    margin-bottom: 40px;

    h3 {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 16px;
      color: var(--hula-text-secondary, var(--hula-gray-600, var(--hula-brand-primary)));
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-width: 600px;
    }
  }
}

/* 基础输入框样式 */
.input-brand {
  width: 100%;
  padding: 10px 16px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--hula-text-primary, var(--hula-gray-800, var(--hula-brand-primary)));
  background: var(--hula-bg-component, var(--hula-brand-primary));
  border: 2px solid var(--hula-border, var(--hula-gray-200, var(--hula-brand-primary)));
  border-radius: 8px;
  transition: all 0.3s ease;

  &::placeholder {
    color: var(--hula-text-tertiary, var(--hula-gray-500, var(--hula-brand-primary)));
  }

  &:hover {
    border-color: var(--hula-gray-300, var(--hula-brand-primary));
  }

  &:focus {
    outline: none;
    border-color: var(--hula-brand-primary, var(--hula-brand-primary));
    box-shadow: 0 0 0 3px var(--hula-brand-subtle, rgba(var(--hula-success-rgb), 0.1));
  }

  &:disabled {
    background: var(--hula-gray-100, var(--hula-brand-primary));
    color: var(--hula-gray-500, var(--hula-brand-primary));
    cursor: not-allowed;
  }

  /* 尺寸变体 */
  &.input-sm {
    padding: 6px 12px;
    font-size: 12px;
  }

  &.input-lg {
    padding: 14px 20px;
    font-size: 16px;
  }

  /* 状态变体 */
  &.input-success {
    border-color: var(--hula-success, var(--hula-brand-primary));

    &:focus {
      border-color: var(--hula-success, var(--hula-brand-primary));
      box-shadow: 0 0 0 3px rgba(var(--hula-success-rgb, 0, 191, 165), 0.1);
    }
  }

  &.input-warning {
    border-color: var(--hula-warning, var(--hula-brand-primary));

    &:focus {
      border-color: var(--hula-warning, var(--hula-brand-primary));
      box-shadow: 0 0 0 3px rgba(var(--hula-warning-rgb, 255, 184, 77), 0.1);
    }
  }

  &.input-error {
    border-color: var(--hula-error, var(--hula-brand-primary));

    &:focus {
      border-color: var(--hula-error, var(--hula-brand-primary));
      box-shadow: 0 0 0 3px rgba(var(--hula-error-rgb, 255, 107, 107), 0.1);
    }
  }
}

/* 输入框标签 */
.input-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--hula-text-primary, var(--hula-gray-800, var(--hula-brand-primary)));
  font-size: 14px;
}

/* 输入框包装器 */
.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 带图标的输入框 */
.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;

  .input-icon {
    position: absolute;
    left: 12px;
    color: var(--hula-text-tertiary, var(--hula-gray-500, var(--hula-brand-primary)));
    font-size: 20px;
  }

  .input-with-icon-input {
    padding-left: 44px;
  }
}

/* 文本域 */
.textarea-brand {
  @extend .input-brand;
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

/* 字数统计 */
.input-counter {
  align-self: flex-end;
  font-size: 12px;
  color: var(--hula-text-tertiary, var(--hula-gray-500, var(--hula-brand-primary)));
}

/* 帮助文本 */
.input-helper {
  font-size: 12px;
  color: var(--hula-text-tertiary, var(--hula-gray-500, var(--hula-brand-primary)));

  &.input-error-text {
    color: var(--hula-error, var(--hula-brand-primary));
  }
}

/* 选择框 */
.select-brand {
  @extend .input-brand;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23707070' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 6l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
  cursor: pointer;
}

/* 复选框和单选框 */
.checkbox-brand,
.radio-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;

  input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }

  .checkbox-indicator,
  .radio-brand-indicator {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: 2px solid var(--hula-gray-400, var(--hula-brand-primary));
    border-radius: 4px;
    background: var(--hula-white);
    transition: all 0.3s ease;

    &::after {
      content: '';
      display: none;
      width: 10px;
      height: 10px;
      background: var(--hula-brand-primary, var(--hula-brand-primary));
      border-radius: 2px;
    }
  }

  .radio-brand-indicator {
    border-radius: 50%;

    &::after {
      border-radius: 50%;
      width: 10px;
      height: 10px;
    }
  }

  input:checked ~ .checkbox-indicator,
  input:checked ~ .radio-brand-indicator {
    border-color: var(--hula-brand-primary, var(--hula-brand-primary));
    background: var(--hula-brand-subtle, rgba(var(--hula-success-rgb), 0.1));

    &::after {
      display: block;
    }
  }

  input:disabled ~ * {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover input:not(:disabled) ~ .checkbox-indicator,
  &:hover input:not(:disabled) ~ .radio-brand-indicator {
    border-color: var(--hula-brand-primary, var(--hula-brand-primary));
  }
}

/* 开关 */
.switch-label {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  user-select: none;

  span {
    font-size: 14px;
    color: var(--hula-text-primary, var(--hula-gray-800, var(--hula-brand-primary)));
  }
}

.switch-brand {
  position: relative;
  width: 48px;
  height: 26px;
  background: var(--hula-gray-300, var(--hula-brand-primary));
  border-radius: 9999px;
  cursor: pointer;
  transition: background 0.3s ease;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    background: var(--hula-white);
    border-radius: 50%;
    transition: transform 0.3s ease;
    box-shadow: 0 2px 4px rgba(var(--hula-black-rgb), 0.2);
  }

  &.active {
    background: var(--hula-brand-primary, var(--hula-brand-primary));

    &::after {
      transform: translateX(22px);
    }
  }

  &:hover {
    filter: brightness(0.95);
  }
}

/* 搜索框 */
.search-box {
  position: relative;
  display: flex;
  align-items: center;

  .search-icon {
    position: absolute;
    left: 12px;
    color: var(--hula-text-tertiary, var(--hula-gray-500, var(--hula-brand-primary)));
    font-size: 20px;
  }

  .search-input {
    padding-left: 44px;
    padding-right: 44px;
  }

  .search-clear {
    position: absolute;
    right: 12px;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 50%;
    background: var(--hula-gray-200, var(--hula-brand-primary));
    color: var(--hula-gray-600, var(--hula-brand-primary));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;

    &:hover {
      background: var(--hula-gray-300, var(--hula-brand-primary));
    }
  }
}

/* 表单样式 */
.form-brand {
  @extend .input-brand;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 500px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-weight: 500;
  font-size: 14px;
  color: var(--hula-text-primary, var(--hula-gray-800, var(--hula-brand-primary)));

  .required {
    color: var(--hula-error, var(--hula-brand-primary));
    margin-left: 2px;
  }
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;

  .btn-brand,
  .btn-brand-outline {
    flex: 1;
  }
}

/* 必填标记 */
.required {
  color: var(--hula-error, var(--hula-brand-primary));
}

/* 无障碍优化 */
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: none;
  border-color: var(--hula-brand-primary, var(--hula-brand-primary));
  box-shadow: 0 0 0 3px var(--hula-brand-subtle, rgba(var(--hula-success-rgb), 0.1));
}

/* 暗色模式适配 */
[data-theme='dark'] {
  .input-brand,
  .textarea-brand,
  .select-brand {
    background: var(--hula-pc-bg-elevated, var(--hula-brand-primary));
    border-color: var(--hula-pc-border, var(--hula-brand-primary));
    color: var(--hula-pc-text-primary, var(--hula-brand-primary));

    &::placeholder {
      color: var(--hula-pc-text-tertiary, var(--hula-brand-primary));
    }

    &:hover {
      border-color: var(--hula-gray-500, var(--hula-brand-primary));
    }
  }

  .checkbox-brand .checkbox-indicator,
  .radio-brand .radio-brand-indicator {
    background: var(--hula-pc-bg-elevated, var(--hula-brand-primary));
    border-color: var(--hula-gray-500, var(--hula-brand-primary));
  }

  .switch-brand {
    background: var(--hula-gray-600, var(--hula-brand-primary));
  }
}

/* 响应式适配 */
@media (max-width: 768px) {
  .input-showcase {
    padding: 16px;
  }

  .showcase-section .input-group {
    max-width: 100%;
  }
}
</style>
