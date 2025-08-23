<template>
  <BaseDialog 
    :model-value="show" 
    title="匯入菜品圖片"
    size="large"
    @update:model-value="$emit('update:show', $event)"
  >
    <template #footer>
      <button 
        @click="submitImport" 
        :disabled="!selectedFiles.length || importing"
        class="btn btn-primary"
      >
        <font-awesome-icon v-if="importing" icon="spinner" spin />
        {{ importing ? '匯入中...' : '開始匯入' }}
      </button>
      <button @click="$emit('update:show', false)" class="btn btn-secondary">
        取消
      </button>
    </template>
    
    <div class="import-images-content">
      <!-- 匯入說明 -->
      <div class="import-instructions">
        <h3>匯入說明</h3>
        <p>請上傳菜品圖片，系統會根據圖片檔案名自動匹配對應的菜品。</p>
        <ul>
          <li>圖片檔案名必須與菜品名稱完全一致</li>
          <li>支援的格式：JPG、PNG、GIF、WebP</li>
          <li>最大檔案大小：5MB</li>
          <li>可以一次選擇多張圖片</li>
        </ul>
      </div>

      <!-- 檔案上傳區域 -->
      <div class="upload-section">
        <div 
          class="upload-area" 
          @click="triggerFileInput"
          @dragover.prevent
          @drop.prevent="handleFileDrop"
        >
          <div v-if="!selectedFiles.length" class="upload-placeholder">
            <font-awesome-icon icon="images" size="3x" />
            <h3>點擊或拖拽圖片到此處</h3>
            <p>支援的格式：JPG、PNG、GIF、WebP</p>
            <p class="file-types">最大檔案大小：5MB</p>
          </div>
          <div v-else class="files-selected">
            <div class="files-info">
              <h4>已選擇 {{ selectedFiles.length }} 張圖片</h4>
              <p>點擊「開始匯入」進行批量處理</p>
            </div>
            <button @click.stop="clearFiles" class="btn-remove">
              <font-awesome-icon icon="times" />
              清除
            </button>
          </div>
        </div>
        <input
          ref="fileInput"
          type="file"
          multiple
          accept="image/*"
          @change="handleFileSelect"
          class="hidden"
        />
      </div>

      <!-- 檔案預覽 -->
      <div v-if="selectedFiles.length > 0" class="files-preview">
        <h4>選擇的圖片 ({{ selectedFiles.length }} 張)</h4>
        <div class="files-grid">
          <div 
            v-for="(file, index) in selectedFiles" 
            :key="index"
            class="file-item"
          >
            <div class="file-preview">
              <img :src="file.preview" :alt="file.name" />
            </div>
            <div class="file-info">
              <span class="file-name">{{ file.name }}</span>
              <span class="file-size">{{ formatFileSize(file.size) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 匯入結果 -->
      <div v-if="importResult" class="import-result">
        <h3>匯入結果</h3>
        <div class="result-summary">
          <div v-if="importResult.success > 0" class="result-item success">
            <font-awesome-icon icon="check-circle" />
            <span>成功匹配：{{ importResult.success }} 張圖片</span>
          </div>
          <div v-if="importResult.notFound > 0" class="result-item warning">
            <font-awesome-icon icon="exclamation-triangle" />
            <span>未找到對應菜品：{{ importResult.notFound }} 張圖片</span>
          </div>
          <div v-if="importResult.failed > 0" class="result-item error">
            <font-awesome-icon icon="times-circle" />
            <span>匯入失敗：{{ importResult.failed }} 張圖片</span>
          </div>
        </div>
        
        <div v-if="importResult.details && importResult.details.length > 0" class="result-details">
          <h4>詳細結果</h4>
          <div class="result-list">
            <div 
              v-for="(result, index) in importResult.details" 
              :key="index"
              :class="['result-row', { 
                success: result.success, 
                warning: result.notFound,
                error: result.failed 
              }]"
            >
              <span class="item-name">{{ result.fileName }}</span>
              <span v-if="result.dishName" class="item-dish">{{ result.dishName }}</span>
              <span v-if="result.success" class="status-success">
                <font-awesome-icon icon="check" />
                成功
              </span>
              <span v-else-if="result.notFound" class="status-warning">
                <font-awesome-icon icon="exclamation-triangle" />
                未找到對應菜品
              </span>
              <span v-else class="status-error">
                <font-awesome-icon icon="times" />
                {{ result.error }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseDialog>
</template>

<script>
import { ref, computed, watch } from 'vue'
import BaseDialog from '@/components/base/BaseDialog.vue'
import { menuAPI } from '@/services/api'
import './ImportImagesDialog.css'

export default {
  name: 'ImportImagesDialog',
  components: {
    BaseDialog
  },
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:show', 'import-success'],
  setup(props, { emit }) {
    const fileInput = ref(null)
    const importing = ref(false)
    const selectedFiles = ref([])
    const importResult = ref(null)

    const triggerFileInput = () => {
      fileInput.value?.click()
    }

    const handleFileSelect = (event) => {
      const files = Array.from(event.target.files)
      handleFiles(files)
    }

    const handleFileDrop = (event) => {
      const files = Array.from(event.dataTransfer.files)
      handleFiles(files)
    }

    const handleFiles = async (files) => {
      const imageFiles = files.filter(file => file.type.startsWith('image/'))
      
      if (imageFiles.length === 0) {
        alert('請選擇圖片檔案')
        return
      }

      // 檢查檔案大小
      const maxSize = 5 * 1024 * 1024 // 5MB
      const validFiles = imageFiles.filter(file => {
        if (file.size > maxSize) {
          alert(`檔案 ${file.name} 超過 5MB 限制`)
          return false
        }
        return true
      })

      // 為每個檔案生成預覽
      const filesWithPreview = await Promise.all(
        validFiles.map(async (file) => {
          const preview = await createImagePreview(file)
          return {
            file,
            name: file.name,
            size: file.size,
            preview
          }
        })
      )

      selectedFiles.value = filesWithPreview
      importResult.value = null
    }

    const createImagePreview = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target.result)
        reader.readAsDataURL(file)
      })
    }

    const clearFiles = () => {
      selectedFiles.value = []
      importResult.value = null
      if (fileInput.value) {
        fileInput.value.value = ''
      }
    }

    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const submitImport = async () => {
      if (!selectedFiles.value.length) {
        alert('請先選擇要匯入的圖片')
        return
      }

      try {
        importing.value = true
        
        // 準備 FormData
        const formData = new FormData()
        selectedFiles.value.forEach((fileData, index) => {
          formData.append('images', fileData.file)
        })

        // 調用 API
        const response = await menuAPI.importImages(formData)
        
        if (response.status === 'success') {
          importResult.value = response.data
          emit('import-success', response.data)
        } else {
          throw new Error(response.message || '匯入失敗')
        }
      } catch (error) {
        console.error('圖片匯入失敗:', error)
        importResult.value = {
          success: 0,
          notFound: 0,
          failed: selectedFiles.value.length,
          details: selectedFiles.value.map(fileData => ({
            fileName: fileData.name,
            success: false,
            failed: true,
            error: error.message || '未知錯誤'
          }))
        }
      } finally {
        importing.value = false
      }
    }

    // 監聽 show 屬性變化，重置表單
    watch(() => props.show, (newVal) => {
      if (!newVal) {
        selectedFiles.value = []
        importResult.value = null
        if (fileInput.value) {
          fileInput.value.value = ''
        }
      }
    })

    return {
      fileInput,
      importing,
      selectedFiles,
      importResult,
      triggerFileInput,
      handleFileSelect,
      handleFileDrop,
      clearFiles,
      formatFileSize,
      submitImport
    }
  }
}
</script>
