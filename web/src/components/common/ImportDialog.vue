<template>
  <BaseDialog 
    :model-value="show" 
    :title="title"
    size="large"
    @update:model-value="$emit('update:show', $event)"
  >
    <template #footer>
      <button 
        @click="submitImport" 
        :disabled="!importForm.file || importing"
        class="btn btn-primary"
      >
        <font-awesome-icon v-if="importing" icon="spinner" spin />
        {{ importing ? '匯入中...' : '開始匯入' }}
      </button>
      <button @click="$emit('update:show', false)" class="btn btn-secondary">
        取消
      </button>
    </template>
    <div class="import-content">
        <!-- 匯入說明 -->
        <div class="import-instructions">
          <h3>匯入說明</h3>
          <p>{{ description }}</p>
          <ul>
            <li v-for="(instruction, index) in instructions" :key="index">
              {{ instruction }}
            </li>
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
            <div v-if="!importForm.file" class="upload-placeholder">
              <font-awesome-icon icon="cloud-upload-alt" size="3x" />
              <h3>點擊或拖拽檔案到此處</h3>
              <p>支援的檔案格式：{{ supportedFormats.join(', ') }}</p>
              <p class="file-types">最大檔案大小：{{ maxFileSize }}</p>
            </div>
            <div v-else class="file-selected">
              <div class="file-info">
                <h4>{{ importForm.file.name }}</h4>
                <p>{{ formatFileSize(importForm.file.size) }}</p>
              </div>
              <button @click.stop="removeFile" class="btn-remove">
                <font-awesome-icon icon="times" />
              </button>
            </div>
          </div>
          <input
            ref="fileInput"
            type="file"
            :accept="acceptTypes"
            @change="handleFileSelect"
            class="hidden"
          />
        </div>

        <!-- 格式指南 -->
        <div v-if="formatGuide" class="format-guide">
          <h3>匯入格式指南</h3>
          <div class="format-table">
            <table>
              <thead>
                <tr>
                  <th>欄位名稱</th>
                  <th>必填</th>
                  <th>格式說明</th>
                  <th>範例</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="field in formatGuide" :key="field.name">
                  <td>{{ field.name }}</td>
                  <td>{{ field.required ? '是' : '否' }}</td>
                  <td>{{ field.description }}</td>
                  <td>{{ field.example }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 匯入預覽 -->
        <div v-if="importForm.preview && importForm.preview.length > 0" class="import-preview">
          <h4>匯入預覽 (前 {{ importForm.preview.length }} 筆資料)</h4>
          <div class="preview-table">
            <table>
              <thead>
                <tr>
                  <th v-for="header in previewHeaders" :key="header">{{ header }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in importForm.preview" :key="index">
                  <td v-for="header in previewHeaders" :key="header">
                    {{ row[header] || '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 匯入結果 -->
        <div v-if="importResult" class="import-result">
          <h3>匯入結果</h3>
          <div class="result-summary">
            <div v-if="importResult.created > 0" class="result-item success">
              <font-awesome-icon icon="check-circle" />
              <span>成功創建：{{ importResult.created }} 個項目</span>
            </div>
            <div v-if="importResult.updated > 0" class="result-item success">
              <font-awesome-icon icon="check-circle" />
              <span>成功更新：{{ importResult.updated }} 個項目</span>
            </div>
            <div v-if="importResult.failed > 0" class="result-item error">
              <font-awesome-icon icon="times-circle" />
              <span>失敗：{{ importResult.failed }} 個項目</span>
            </div>
          </div>
          
          <div v-if="importResult.results && importResult.results.length > 0" class="result-details">
            <h4>詳細結果</h4>
            <div class="result-list">
              <div 
                v-for="(result, index) in importResult.results" 
                :key="index"
                :class="['result-row', { success: result.success, error: !result.success }]"
              >
                <span class="item-name">{{ result.name }}</span>
                <span v-if="result.category" class="item-category">{{ result.category }}</span>
                <span v-if="result.success" class="status-success">
                  <font-awesome-icon icon="check" />
                  {{ result.action === 'updated' ? '更新' : '創建' }}
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
import './ImportDialog.css'

export default {
  name: 'ImportDialog',
  components: {
    BaseDialog
  },
  props: {
    show: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: '匯入資料'
    },
    description: {
      type: String,
      default: '請上傳包含要匯入資料的檔案。'
    },
    instructions: {
      type: Array,
      default: () => [
        '請確保檔案格式正確',
        '必填欄位不能為空',
        '建議先下載範本檔案進行編輯'
      ]
    },
    supportedFormats: {
      type: Array,
      default: () => ['Excel (.xlsx)', 'CSV (.csv)']
    },
    maxFileSize: {
      type: String,
      default: '10MB'
    },
    acceptTypes: {
      type: String,
      default: '.xlsx,.csv'
    },
    formatGuide: {
      type: Array,
      default: null
    },
    onImport: {
      type: Function,
      required: true
    }
  },
  emits: ['update:show', 'import-success'],
  setup(props, { emit }) {
    const fileInput = ref(null)
    const importing = ref(false)
    const importForm = ref({
      file: null,
      preview: []
    })
    const importResult = ref(null)

    const previewHeaders = computed(() => {
      if (!importForm.value.preview || importForm.value.preview.length === 0) {
        return []
      }
      return Object.keys(importForm.value.preview[0])
    })

    const triggerFileInput = () => {
      fileInput.value?.click()
    }

    const handleFileSelect = (event) => {
      const file = event.target.files[0]
      if (file) {
        handleFile(file)
      }
    }

    const handleFileDrop = (event) => {
      const file = event.dataTransfer.files[0]
      if (file) {
        handleFile(file)
      }
    }

    const handleFile = async (file) => {
      // 檢查檔案大小
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        alert('檔案大小不能超過 10MB')
        return
      }

      // 檢查檔案類型
      const allowedTypes = ['.xlsx', '.csv']
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
      if (!allowedTypes.includes(fileExtension)) {
        alert('只支援 Excel (.xlsx) 和 CSV (.csv) 檔案')
        return
      }

      importForm.value.file = file
      importForm.value.preview = []
      importResult.value = null

      // 讀取檔案並生成預覽
      try {
        const preview = await readFilePreview(file)
        importForm.value.preview = preview.slice(0, 10) // 只顯示前10筆
      } catch (error) {
        console.error('讀取檔案失敗:', error)
        alert('讀取檔案失敗：' + error.message)
      }
    }

    const readFilePreview = async (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        
        reader.onload = (e) => {
          try {
            const data = e.target.result
            let preview = []

            if (file.name.toLowerCase().endsWith('.csv')) {
              preview = parseCSV(data)
            } else if (file.name.toLowerCase().endsWith('.xlsx')) {
              // 對於 Excel 檔案，我們需要額外的處理
              // 這裡簡化處理，實際應該使用 xlsx 庫
              preview = parseExcel(data)
            }

            resolve(preview)
          } catch (error) {
            reject(error)
          }
        }

        reader.onerror = () => reject(new Error('讀取檔案失敗'))

        if (file.name.toLowerCase().endsWith('.csv')) {
          reader.readAsText(file)
        } else {
          reader.readAsArrayBuffer(file)
        }
      })
    }

    const parseCSV = (csvText) => {
      const lines = csvText.split('\n')
      if (lines.length < 2) return []

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      const data = []

      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
          const row = {}
          headers.forEach((header, index) => {
            row[header] = values[index] || ''
          })
          data.push(row)
        }
      }

      return data
    }

    const parseExcel = (data) => {
      // 簡化的 Excel 解析，實際應該使用 xlsx 庫
      // 這裡返回空陣列，實際實現需要額外的庫
      console.warn('Excel 解析需要額外的 xlsx 庫支援')
      return []
    }

    const removeFile = () => {
      importForm.value.file = null
      importForm.value.preview = []
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
      if (!importForm.value.file) {
        alert('請先選擇要匯入的檔案')
        return
      }

      try {
        importing.value = true
        const result = await props.onImport(importForm.value.file)
        importResult.value = result
        emit('import-success', result)
      } catch (error) {
        console.error('匯入失敗:', error)
        importResult.value = {
          created: 0,
          updated: 0,
          failed: 1,
          results: [{
            name: '匯入失敗',
            category: '',
            success: false,
            error: error.message || '未知錯誤'
          }]
        }
      } finally {
        importing.value = false
      }
    }

    // 監聽 show 屬性變化，重置表單
    watch(() => props.show, (newVal) => {
      if (!newVal) {
        importForm.value = {
          file: null,
          preview: []
        }
        importResult.value = null
        if (fileInput.value) {
          fileInput.value.value = ''
        }
      }
    })

    const closeModal = () => {
      emit('update:show', false)
    }

    return {
      fileInput,
      importing,
      importForm,
      importResult,
      previewHeaders,
      closeModal,
      triggerFileInput,
      handleFileSelect,
      handleFileDrop,
      removeFile,
      formatFileSize,
      submitImport
    }
  }
}
</script>
