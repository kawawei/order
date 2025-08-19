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
          <button class="btn-primary" @click="onClickAddEmployee">
            <font-awesome-icon icon="plus" />
            新增員工
          </button>
        </div>
        <div class="employee-filters">
          <label>
            類別：
            <select v-model="employeeRoleFilter">
              <option value="all">全部</option>
              <option v-for="role in filteredAssignableRoles" :key="role._id || role.id" :value="role._id || role.id">{{ role.name }}</option>
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
                <span class="role-badge" :class="getRoleClass(employee.role)">
                  {{ getRoleText(employee.role) }}
                </span>
              </div>
            </div>
            <div class="actions">
              <!-- 禁止刪除老闆帳號（僅隱藏刪除按鈕）/ Hide delete button for owner account -->
              <button class="btn-secondary" @click="editEmployee(employee)">
                <font-awesome-icon icon="pen" />
                編輯
              </button>
              <!-- 僅非老闆可顯示刪除按鈕 / Show delete button only when employee is not owner -->
              <button v-if="canDeleteEmployee(employee)" class="btn-danger" @click="deleteEmployee(employee.id)">
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
          <small class="save-hint">系統預設角色與權限：老闆、管理人員、工作人員（不可新增或修改）</small>
        </div>
        
        <div class="permissions-grid">
          <div v-for="role in displayRoles" :key="role._id || role.id" class="role-card">
            <div class="role-header">
              <h3>{{ role.name }}</h3>
              <span class="role-count">{{ getEmployeeCountByRole(role._id || role.id) }} 人</span>
            </div>
            
            <div class="permissions-list">
              <label v-for="perm in availablePermissions" :key="perm.key" class="permission-item">
                <span class="permission-name">{{ perm.label }}</span>
                <input type="checkbox" :checked="(role.permissions || []).includes(perm.key)" disabled />
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
          
          
          
          <div class="form-group" v-if="editingEmployee">
            <label>員工編號</label>
            <input :value="editingEmployee.employeeNumber || editingEmployee.account" type="text" disabled />
          </div>

          <div class="form-group">
            <label>角色</label>
            <select v-model="employeeForm.roleId" required>
              <option v-for="role in filteredAssignableRoles" :key="role._id || role.id" :value="role._id || role.id">{{ role.name }}</option>
            </select>
          </div>

          <!-- 新增時不輸入帳號/密碼，後端自動產生員工編號並作為初始密碼 -->
          
          
          
          <div class="form-actions">
            <button type="button" class="btn-secondary" @click="closeModal">取消</button>
            <button type="submit" class="btn-primary">
              {{ editingEmployee ? '更新' : '新增' }}
            </button>
          </div>
        </form>
      </div>
        </div>

  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { roleAPI, employeeAPI } from '@/services/api'

// 響應式數據
const employees = ref([])
const employeeRoleFilter = ref('all')
const showAddEmployeeModal = ref(false)
const editingEmployee = ref(null)
const employeeForm = ref({
  name: '',
  roleId: '',
  account: '',
  password: ''
})

// 後端角色與權限
const roles = ref([]) // 來源：後端 /roles
const permissionCatalog = ref([]) // 來源：後端 /roles/_catalog/permissions

// 以後端 catalog 渲染可選權限（唯讀顯示）
const availablePermissions = computed(() => permissionCatalog.value.map(p => ({ key: p.key, label: p.label })))

// 可指派的角色列表：
// - 老闆/管理員：可見所有非系統判定的角色
// - 管理人員：僅能指派「工作人員」
// - 工作人員：不可新增
const filteredAssignableRoles = computed(() => {
  const list = Array.isArray(roles.value) ? roles.value : []
  // 僅允許這三種固定角色
  const fixed = list.filter(r => isOwnerRoleName(r?.name) || isManagerRoleName(r?.name) || isStaffRoleName(r?.name))
  if (isCurrentOwner || isAdminActor) {
    // 老闆可指派管理人員/工作人員，但不顯示老闆避免誤選
    return fixed.filter(r => !isOwnerRoleName(r?.name))
  }
  if (isCurrentManager) return fixed.filter(r => isStaffRoleName(r?.name))
  return []
})

// 權限卡片顯示的固定角色清單
const displayRoles = computed(() => {
  const list = Array.isArray(roles.value) ? roles.value : []
  return list.filter(r => isOwnerRoleName(r?.name) || isManagerRoleName(r?.name) || isStaffRoleName(r?.name))
})

// 角色操作權限：
const isAdminActor = (() => {
  try {
    return !!localStorage.getItem('admin_user')
  } catch (e) {
    return false
  }
})()
const isMerchantActor = (() => {
  try {
    return !!localStorage.getItem('merchant_user')
  } catch (e) {
    return false
  }
})()
// 解析目前商家使用者資訊（可能是老闆、管理人員或工作人員）
const currentMerchantUser = (() => {
  try {
    const raw = localStorage.getItem('merchant_user')
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
})()

// 根據名稱識別商家角色
const isOwnerRoleName = (name) => {
  const n = String(name || '').trim().toLowerCase()
  return n === '老闆' || n === 'owner'
}
const isManagerRoleName = (name) => {
  const n = String(name || '').trim().toLowerCase()
  return n === '管理人員' || n === 'manager'
}
const isStaffRoleName = (name) => {
  const n = String(name || '').trim().toLowerCase()
  return n === '工作人員' || n === 'staff' || n === 'employee'
}

// 取得目前使用者是否為老闆/管理人員/工作人員
const currentEmployeeRoleName = (() => {
  if (!currentMerchantUser) return null
  // 後端若回傳 role 物件或字串，useAuth 已保存 employeeRoleName/Id
  return currentMerchantUser.employeeRoleName || null
})()

const isCurrentOwner = (() => {
  if (!currentMerchantUser) return false
  // 商家本體登入（老闆）
  if (currentMerchantUser.role === 'merchant') return true
  return isOwnerRoleName(currentEmployeeRoleName)
})()

const isCurrentManager = (() => {
  if (!currentMerchantUser) return false
  return isManagerRoleName(currentEmployeeRoleName)
})()

const isCurrentStaff = (() => {
  if (!currentMerchantUser) return false
  return isStaffRoleName(currentEmployeeRoleName)
})()

// 角色已固定（老闆／管理人員／工作人員），僅允許分派，不提供新增/編輯/刪除
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
  const found = roles.value.find(r => r._id === roleKey || r.id === roleKey)
  return found ? found.name : '未知'
}

const getEmployeeCountByRole = (roleKey) => {
  return employees.value.filter(emp => emp.role === roleKey).length
}

const filteredEmployees = computed(() => {
  const selected = employeeRoleFilter.value
  if (selected === 'all') return employees.value
  return employees.value.filter(emp => emp.role === selected)
})

const onClickAddEmployee = () => {
  // 僅老闆或管理人員可新增；管理人員只能新增「工作人員」
  if (!isCurrentOwner && !isAdminActor && !isCurrentManager) {
    alert('您沒有權限新增員工')
    return
  }
  showAddEmployeeModal.value = true
}

const editEmployee = (employee) => {
  // 管理人員可編輯，但僅限管理「工作人員」
  if (!isCurrentOwner && !isAdminActor) {
    if (!isCurrentManager) {
      alert('您沒有權限編輯員工')
      return
    }
    // 若目標不是工作人員，禁止編輯
    const targetRole = roles.value.find(r => (r._id || r.id) === (employee.role?._id || employee.role))
    if (targetRole && !isStaffRoleName(targetRole.name)) {
      alert('管理人員僅能編輯「工作人員」')
      return
    }
  }
  editingEmployee.value = employee
  employeeForm.value = {
    name: employee.name,
    roleId: employee.role?._id || employee.role || ''
  }
  showAddEmployeeModal.value = true
}

const deleteEmployee = (employeeId) => {
  // 保護「老闆」帳號，不可刪除 / Protect owner account from deletion
  const target = employees.value.find(emp => emp.id === employeeId)
  if (target && (target.isOwner === true || isOwnerByRoleId(target.role))) {
    alert('老闆帳號不可刪除')
    return
  }
  // 管理人員僅能刪除「工作人員」
  if (!isCurrentOwner && !isAdminActor) {
    if (!isCurrentManager) {
      alert('您沒有權限刪除員工')
      return
    }
    const targetRole = roles.value.find(r => (r._id || r.id) === target.role)
    if (targetRole && !isStaffRoleName(targetRole.name)) {
      alert('管理人員僅能刪除「工作人員」')
      return
    }
  }
  if (confirm('確定要刪除此員工嗎？')) {
    employees.value = employees.value.filter(emp => emp.id !== employeeId)
  }
}

const closeModal = () => {
  showAddEmployeeModal.value = false
  editingEmployee.value = null
  employeeForm.value = {
    name: '',
    roleId: ''
  }
}

const submitEmployeeForm = async () => {
  // 新增/更新前的權限檢查
  const selectedRole = roles.value.find(r => (r._id || r.id) === employeeForm.value.roleId)
  // 管理人員僅能新增/編輯為「工作人員」
  if (!isCurrentOwner && !isAdminActor) {
    if (!isCurrentManager) {
      alert('您沒有權限進行此操作')
    return
  }
    if (selectedRole && !isStaffRoleName(selectedRole.name)) {
      alert('管理人員僅能指派「工作人員」角色')
    return
  }
  }
  if (editingEmployee.value) {
    // 更新員工
    const id = editingEmployee.value.id || editingEmployee.value._id
    await employeeAPI.updateEmployee(id, {
      name: employeeForm.value.name,
      roleId: employeeForm.value.roleId
    })
  } else {
    // 新增員工
    await employeeAPI.createEmployee({
      name: employeeForm.value.name,
      roleId: employeeForm.value.roleId
    })
  }
  await fetchEmployees()
  closeModal()
}

// 取消新增/編輯/刪除角色的相關方法（固定角色）

// 初始化數據
const fetchPermissionCatalog = async () => {
  const res = await roleAPI.getPermissionCatalog()
  permissionCatalog.value = res.data?.permissions || []
}

const fetchRoles = async () => {
  try {
    const res = await roleAPI.getRoles()
    roles.value = res.data?.roles || []
  } catch (err) {
    roles.value = []
    console.warn('取得角色失敗：', err?.message || err)
  }
}

const fetchEmployees = async () => {
  const res = await employeeAPI.getEmployees()
  // 正規化員工資料，保留 roleId 以便綁定
  employees.value = (res.data?.employees || []).map(e => ({
    id: e._id || e.id,
    name: e.name,
    account: e.account,
    role: e.role?._id || e.role || null,
    employeeNumber: e.employeeNumber || e.account
  }))
}

onMounted(async () => {
  await Promise.all([
    fetchPermissionCatalog(),
    fetchRoles(),
    fetchEmployees()
  ])
})

// 產生公司內唯一的員工編號（6 碼英數交錯：字母-數字 重複3次）
const generateUniqueEmployeeNumber = () => {
  const existing = new Set(employees.value.map(e => e.employeeNumber).filter(Boolean))
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  let code = ''
  do {
    code = ''
    for (let i = 0; i < 3; i++) {
      code += letters[Math.floor(Math.random() * letters.length)]
      code += digits[Math.floor(Math.random() * digits.length)]
    }
  } while (existing.has(code))
  return code
}

// 自動儲存到本地儲存
// 後端儲存，不再寫入本地儲存

// 當角色被刪除且剛好是目前篩選的角色時，重置篩選為全部
watch(roles, () => {
  if (employeeRoleFilter.value !== 'all' && !roles.value.some(r => r.key === employeeRoleFilter.value)) {
    employeeRoleFilter.value = 'all'
  }
}, { deep: true })

// 不提供 canEditRole/canDeleteRole（固定角色）

// 判斷是否為老闆角色（依角色名稱或 isOwner 標記）/ Determine if role is owner
const isOwnerByRoleId = (roleId) => {
  const r = roles.value.find(r => (r._id || r.id) === roleId)
  if (!r) return false
  const name = String(r.name || '').trim()
  return (r.isOwner === true) || (r.isSystem === true && name === '老闆') || name === '老闆' || name.toLowerCase() === 'owner'
}

// 僅非老闆可刪除 / Only non-owner employees can be deleted
const canDeleteEmployee = (employee) => {
  if (!employee) return false
  if (employee.isOwner === true) return false
  return !isOwnerByRoleId(employee.role)
}
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
