import { ref } from 'vue'

const visible = ref(false)
const message = ref('')
const type = ref('info')
const position = ref('toast-top')
let timeout = null

export function useToast() {
  const show = (options) => {
    // 如果已經有 toast 在顯示，先清除定時器
    if (timeout) {
      clearTimeout(timeout)
    }

    // 設置 toast 內容
    message.value = options.message
    type.value = options.type || 'info'
    position.value = options.position || 'toast-top'
    visible.value = true

    // 設置自動隱藏
    timeout = setTimeout(() => {
      hide()
    }, options.duration || 3000)
  }

  const hide = () => {
    visible.value = false
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  // 快捷方法
  const success = (message, duration) => {
    show({ message, type: 'success', duration })
  }

  const error = (message, duration) => {
    show({ message, type: 'error', duration })
  }

  const warning = (message, duration) => {
    show({ message, type: 'warning', duration })
  }

  const info = (message, duration) => {
    show({ message, type: 'info', duration })
  }

  return {
    visible,
    message,
    type,
    position,
    show,
    hide,
    success,
    error,
    warning,
    info
  }
}
