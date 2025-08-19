<template>
  <div class="permissions-page">
    <div class="page-header">
      <h1>權限管理</h1>
      <p class="page-description">管理員工帳戶和權限分配</p>
    </div>

    <div class="content-grid">
      <!-- 員工管理 -->
      <div class="section-card">
        <div class="section-header">
          <h2>員工管理</h2>
          <button class="btn-primary" @click="showAddEmployeeModal = true">
            <font-awesome-icon icon="plus" />
            新增員工
          </button>
        </div>
        <div class="employee-filters">
          <label>
            類別：
            <select v-model="employeeRoleFilter">
              <option value="all">全部</option>
              <option v-for="role in roles" :key="role.key" :value="role.key">{{ role.label }}</option>
            </select>
          </label>
        </div>
        <div class="employee-list">
          <div v-for="employee in filteredEmployees" :key="employee.id" class="employee-item">
            <div class="employee-info">
              <div class="avatar">
                <font-awesome-icon icon="user" />
              </div>
              <div class="details">
                <h3>{{ employee.name }}</h3>
                <p>{{ employee.email }}</p>
                <span class="role-badge" :class="getRoleClass(employee.role)">
                  {{ getRoleText(employee.role) }}
                </span>
              </div>
            </div>
            <div class="actions">
              <button class="btn-secondary" @click="editEmployee(employee)">
                <font-awesome-icon icon="pen" />
                編輯
              </button>
              <button class="btn-danger" @click="deleteEmployee(employee.id)">
                <font-awesome-icon icon="trash" />
                刪除
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 權限配置 -->
      <div class="section-card">
        <div class="section-header">
          <h2>權限配置</h2>
          <small class="save-hint">變更會自動儲存</small>
          <button class="btn-primary" @click="openAddRoleModal">
            <font-awesome-icon icon="plus" />
            新增角色
          </button>
        </div>
        
        <div class="permissions-grid">
          <div v-for="role in roles" :key="role.key" class="role-card">
            <div class="role-header">
              <h3>{{ role.label }}</h3>
              <div class="role-right">
                <span class="role-count">{{ getEmployeeCountByRole(role.key) }} 人</span>
                <div class="role-actions">
                  <button class="btn-secondary" @click="openEditRoleModal(role)">
                    <font-awesome-icon icon="pen" />
                  </button>
                  <button class="btn-danger" @click="deleteRole(role.key)">
                    <font-awesome-icon icon="trash" />
                  </button>
                </div>
              </div>
            </div>
            
            <div class="permissions-list">
              <label v-for="permission in role.permissions" :key="permission.key" class="permission-item">
                <span class="permission-name">{{ permission.label }}</span>
                <input type="checkbox" v-model="permission.enabled" />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增/編輯員工對話框 -->
    <div v-if="showAddEmployeeModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingEmployee ? '編輯員工' : '新增員工' }}</h3>
          <button class="close-btn" @click="closeModal">
            <font-awesome-icon icon="xmark" />
          </button>
        </div>
        
        <form @submit.prevent="submitEmployeeForm" class="employee-form">
          <div class="form-group">
            <label>姓名</label>
            <input v-model="employeeForm.name" type="text" required />
          </div>
          
          <div class="form-group">
            <label>電子郵件</label>
            <input v-model="employeeForm.email" type="email" required />
          </div>
          
          <div class="form-group" v-if="editingEmployee">
            <label>員工編號</label>
            <input :value="editingEmployee.employeeNumber" type="text" disabled />
            <small>系統自動生成，僅供查看</small>
          </div>

          <div class="form-group">
            <label>角色</label>
            <select v-model="employeeForm.role" required>
              <option v-for="role in roles" :key="role.key" :value="role.key">{{ role.label }}</option>
            </select>
          </div>
          
          
          
          <div class="form-actions">
            <button type="button" class="btn-secondary" @click="closeModal">取消</button>
            <button type="submit" class="btn-primary">
              {{ editingEmployee ? '更新' : '新增' }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <!-- 新增/編輯角色對話框 -->
    <div v-if="showRoleModal" class="modal-overlay" @click="closeRoleModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingRole ? '編輯角色' : '新增角色' }}</h3>
          <button class="close-btn" @click="closeRoleModal">
            <font-awesome-icon icon="xmark" />
          </button>
        </div>

        <form @submit.prevent="submitRoleForm" class="employee-form">
          <div class="form-group">
            <label>角色名稱</label>
            <input v-model.trim="roleForm.label" type="text" required />
          </div>

          <div class="form-group">
            <label>唯一鍵（英數、底線或連字號）</label>
            <input v-model.trim="roleForm.key" type="text" pattern="[a-zA-Z0-9_\-]+" required />
            <small>變更鍵會同步更新已指派此角色的員工</small>
          </div>

          <div class="form-group">
            <label>權限</label>
            <div class="permissions-catalog">
              <label v-for="perm in availablePermissions" :key="perm.key" class="permission-item">
                <span class="permission-name">{{ perm.label }}</span>
                <input type="checkbox" :value="perm.key" v-model="roleForm.permissionKeys" />
              </label>
            </div>
          </div>

          <p v-if="roleFormError" class="form-error">{{ roleFormError }}</p>

          <div class="form-actions">
            <button type="button" class="btn-secondary" @click="closeRoleModal">取消</button>
            <button type="submit" class="btn-primary">{{ editingRole ? '更新' : '新增' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

// 響應式數據
const employees = ref([])
const employeeRoleFilter = ref('all')
const showAddEmployeeModal = ref(false)
const editingEmployee = ref(null)
const employeeForm = ref({
  name: '',
  email: '',
  role: 'cashier'
})

// 角色定義
const getDefaultRoles = () => ([
  {
    key: 'owner',
    label: '老闆',
    permissions: [
      { key: 'menu_manage', label: '菜單管理', enabled: true },
      { key: 'inventory_manage', label: '庫存管理', enabled: true },
      { key: 'order_manage', label: '訂單管理', enabled: true },
      { key: 'employee_manage', label: '員工管理', enabled: true },
      { key: 'reports_view', label: '報表查看', enabled: true },
      { key: 'settings_manage', label: '系統設置', enabled: true }
    ]
  },
  {
    key: 'cashier',
    label: '收銀員',
    permissions: [
      { key: 'menu_view', label: '菜單查看', enabled: true },
      { key: 'order_create', label: '創建訂單', enabled: true },
      { key: 'order_edit', label: '編輯訂單', enabled: true },
      { key: 'order_checkout', label: '結帳處理', enabled: true },
      { key: 'inventory_view', label: '庫存查看', enabled: true }
    ]
  },
  {
    key: 'kitchen',
    label: '廚房人員',
    permissions: [
      { key: 'order_view', label: '訂單查看', enabled: true },
      { key: 'order_status_update', label: '更新訂單狀態', enabled: true },
      { key: 'inventory_view', label: '庫存查看', enabled: true }
    ]
  }
])

const roles = ref(getDefaultRoles())

// 可供角色選擇的權限清單
const availablePermissions = [
  { key: 'menu_manage', label: '菜單管理' },
  { key: 'inventory_manage', label: '庫存管理' },
  { key: 'order_manage', label: '訂單管理' },
  { key: 'employee_manage', label: '員工管理' },
  { key: 'reports_view', label: '報表查看' },
  { key: 'settings_manage', label: '系統設置' },
  { key: 'menu_view', label: '菜單查看' },
  { key: 'order_create', label: '創建訂單' },
  { key: 'order_edit', label: '編輯訂單' },
  { key: 'order_checkout', label: '結帳處理' },
  { key: 'inventory_view', label: '庫存查看' },
  { key: 'order_view', label: '訂單查看' },
  { key: 'order_status_update', label: '更新訂單狀態' }
]

// 方法
const getRoleClass = (role) => {
  const roleMap = {
    owner: 'role-owner',
    cashier: 'role-cashier',
    kitchen: 'role-kitchen'
  }
  return roleMap[role] || 'role-default'
}

const getRoleText = (roleKey) => {
  const found = roles.value.find(r => r.key === roleKey)
  return found ? found.label : '未知'
}

const getEmployeeCountByRole = (roleKey) => {
  return employees.value.filter(emp => emp.role === roleKey).length
}

const filteredEmployees = computed(() => {
  const selected = employeeRoleFilter.value
  if (selected === 'all') return employees.value
  return employees.value.filter(emp => emp.role === selected)
})

const editEmployee = (employee) => {
  editingEmployee.value = employee
  employeeForm.value = {
    name: employee.name,
    email: employee.email,
    role: employee.role
  }
  showAddEmployeeModal.value = true
}

const deleteEmployee = (employeeId) => {
  if (confirm('確定要刪除此員工嗎？')) {
    employees.value = employees.value.filter(emp => emp.id !== employeeId)
  }
}

const closeModal = () => {
  showAddEmployeeModal.value = false
  editingEmployee.value = null
  employeeForm.value = {
    name: '',
    email: '',
    role: 'cashier'
  }
}

const submitEmployeeForm = () => {
  if (editingEmployee.value) {
    // 更新員工
    const index = employees.value.findIndex(emp => emp.id === editingEmployee.value.id)
    if (index !== -1) {
      employees.value[index] = {
        ...editingEmployee.value,
        ...employeeForm.value
      }
    }
  } else {
    // 新增員工（自動生成不可修改的員工編號）
    const newEmployeeNumber = generateUniqueEmployeeNumber()
    const newEmployee = {
      id: Date.now().toString(),
      employeeNumber: newEmployeeNumber,
      ...employeeForm.value
    }
    employees.value.push(newEmployee)
    alert(`已為該員工生成員工編號：${newEmployeeNumber}`)
  }
  
  closeModal()
}

// 角色 CRUD 狀態
const showRoleModal = ref(false)
const editingRole = ref(null)
const roleForm = ref({ key: '', label: '', permissionKeys: [] })
const roleFormError = ref('')

const openAddRoleModal = () => {
  editingRole.value = null
  roleForm.value = { key: '', label: '', permissionKeys: [] }
  roleFormError.value = ''
  showRoleModal.value = true
}

const openEditRoleModal = (role) => {
  editingRole.value = { ...role }
  roleForm.value = {
    key: role.key,
    label: role.label,
    permissionKeys: role.permissions.filter(p => p.enabled).map(p => p.key)
  }
  roleFormError.value = ''
  showRoleModal.value = true
}

const closeRoleModal = () => {
  showRoleModal.value = false
  editingRole.value = null
  roleFormError.value = ''
}

const submitRoleForm = () => {
  roleFormError.value = ''
  const trimmedKey = roleForm.value.key.trim()
  const trimmedLabel = roleForm.value.label.trim()
  if (!trimmedKey || !trimmedLabel) {
    roleFormError.value = '請填寫完整資料'
    return
  }

  const isDuplicate = roles.value.some(r => r.key === trimmedKey && (!editingRole.value || r.key !== editingRole.value.key))
  if (isDuplicate) {
    roleFormError.value = '角色鍵已存在，請更換'
    return
  }

  const newPermissions = availablePermissions.map(p => ({
    key: p.key,
    label: p.label,
    enabled: roleForm.value.permissionKeys.includes(p.key)
  }))

  if (editingRole.value) {
    const oldKey = editingRole.value.key
    const idx = roles.value.findIndex(r => r.key === oldKey)
    if (idx !== -1) {
      roles.value[idx] = { key: trimmedKey, label: trimmedLabel, permissions: newPermissions }
    }
    if (oldKey !== trimmedKey) {
      employees.value = employees.value.map(emp => emp.role === oldKey ? { ...emp, role: trimmedKey } : emp)
    }
  } else {
    roles.value.push({ key: trimmedKey, label: trimmedLabel, permissions: newPermissions })
  }

  closeRoleModal()
}

const deleteRole = (roleKey) => {
  const used = getEmployeeCountByRole(roleKey)
  if (used > 0) {
    alert('有員工正在使用此角色，請先調整員工角色後再刪除')
    return
  }
  roles.value = roles.value.filter(r => r.key !== roleKey)
}

// 初始化數據
onMounted(() => {
  // 從本地儲存還原，沒有則用預設
  try {
    const storedEmployees = localStorage.getItem('merchant_permissions_employees')
    const storedRoles = localStorage.getItem('merchant_permissions_roles')

    if (storedEmployees) {
      employees.value = JSON.parse(storedEmployees)
    } else {
      employees.value = [
        { id: '1', name: '張老闆', email: 'boss@restaurant.com', role: 'owner' },
        { id: '2', name: '李收銀', email: 'cashier@restaurant.com', role: 'cashier' },
        { id: '3', name: '王廚師', email: 'chef@restaurant.com', role: 'kitchen' }
      ]
    }

    // 為缺少員工編號的紀錄補發唯一編號（同次補發保證不重複）
    const used = new Set(employees.value.map(e => e.employeeNumber).filter(Boolean))
    employees.value = employees.value.map(emp => {
      if (emp.employeeNumber && !used.has(emp.employeeNumber)) {
        used.add(emp.employeeNumber)
        return emp
      }
      let code = emp.employeeNumber
      if (!code) {
        do {
          code = Math.floor(100000 + Math.random() * 900000).toString()
        } while (used.has(code))
      }
      used.add(code)
      return { ...emp, employeeNumber: code }
    })

    if (storedRoles) {
      roles.value = JSON.parse(storedRoles)
    } else {
      roles.value = getDefaultRoles()
    }
  } catch (e) {
    // JSON 解析失敗時回退到預設
    employees.value = [
      { id: '1', name: '張老闆', email: 'boss@restaurant.com', role: 'owner' },
      { id: '2', name: '李收銀', email: 'cashier@restaurant.com', role: 'cashier' },
      { id: '3', name: '王廚師', email: 'chef@restaurant.com', role: 'kitchen' }
    ]
    roles.value = getDefaultRoles()
  }
})

// 產生公司內唯一的員工編號（6 碼數字）
const generateUniqueEmployeeNumber = () => {
  const existing = new Set(employees.value.map(e => e.employeeNumber).filter(Boolean))
  let code = ''
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString()
  } while (existing.has(code))
  return code
}

// 自動儲存到本地儲存
watch(employees, (val) => {
  try {
    localStorage.setItem('merchant_permissions_employees', JSON.stringify(val))
  } catch (e) {}
}, { deep: true })

watch(roles, (val) => {
  try {
    localStorage.setItem('merchant_permissions_roles', JSON.stringify(val))
  } catch (e) {}
}, { deep: true })

// 當角色被刪除且剛好是目前篩選的角色時，重置篩選為全部
watch(roles, () => {
  if (employeeRoleFilter.value !== 'all' && !roles.value.some(r => r.key === employeeRoleFilter.value)) {
    employeeRoleFilter.value = 'all'
  }
}, { deep: true })
</script>

<style scoped>
.permissions-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 2rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}

.page-description {
  color: #666;
  font-size: 1rem;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.section-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
}

.btn-primary {
  background: #1a73e8;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background: #1557b0;
}

.employee-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.employee-filters {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.employee-filters select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.875rem;
}

.employee-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid #eee;
  border-radius: 8px;
  background: #fafafa;
}

.employee-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.avatar {
  width: 40px;
  height: 40px;
  background: #e3f2fd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1a73e8;
}

.details h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 500;
}

.details p {
  margin: 0 0 0.5rem 0;
  color: #666;
  font-size: 0.875rem;
}

.role-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.role-owner {
  background: #ffebee;
  color: #c62828;
}

.role-cashier {
  background: #e8f5e8;
  color: #2e7d32;
}

.role-kitchen {
  background: #fff3e0;
  color: #ef6c00;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn-secondary {
  background: #f5f5f5;
  color: #666;
  border: 1px solid #ddd;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
}

.btn-secondary:hover {
  background: #e8e8e8;
}

.btn-danger {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
}

.btn-danger:hover {
  background: #ffcdd2;
}

.permissions-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.role-card {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 1rem;
  background: #fafafa;
}

.role-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.role-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.role-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}

.role-count {
  background: #e3f2fd;
  color: #1a73e8;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.role-actions {
  display: flex;
  gap: 0.5rem;
}

.permissions-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.permission-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
  border: 1px solid #f0f0f0;
}

.permission-name {
  font-size: 0.875rem;
  color: #333;
}

.permission-status {
  font-weight: 500;
  font-size: 0.875rem;
}

.permission-status.enabled {
  color: #2e7d32;
}

.permission-status.disabled {
  color: #c62828;
}

.save-hint {
  color: #888;
  font-size: 0.875rem;
}

.permissions-catalog {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-error {
  color: #c62828;
  font-size: 0.875rem;
}

/* 對話框樣式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: #666;
  padding: 0.25rem;
}

.close-btn:hover {
  color: #333;
}

.employee-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: #333;
}

.form-group input,
.form-group select {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.form-group small {
  color: #666;
  font-size: 0.875rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
  
  .employee-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
