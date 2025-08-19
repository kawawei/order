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
              <option v-for="role in roles" :key="role._id || role.id" :value="role._id || role.id">{{ role.name }}</option>
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
          <small class="save-hint">請使用右上角按鈕新增或編輯角色</small>
          <button class="btn-primary" @click="openAddRoleModal">
            <font-awesome-icon icon="plus" />
            新增角色
          </button>
        </div>
        
        <div class="permissions-grid">
          <div v-for="role in roles" :key="role._id || role.id" class="role-card">
            <div class="role-header">
              <h3>{{ role.name }}</h3>
              <div class="role-right">
                <span class="role-count">{{ getEmployeeCountByRole(role._id || role.id) }} 人</span>
                <div class="role-actions">
                  <button v-if="canEditRole(role)" class="btn-secondary" @click="openEditRoleModal(role)">
                    <font-awesome-icon icon="pen" />
                  </button>
                  <button v-if="canDeleteRole(role)" class="btn-danger" @click="deleteRole(role._id || role.id)">
                    <font-awesome-icon icon="trash" />
                  </button>
                </div>
              </div>
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
          
          <div class="form-group">
            <label>電子郵件</label>
            <input v-model="employeeForm.email" type="email" required />
          </div>
          
          <div class="form-group" v-if="editingEmployee">
            <label>員工編號</label>
            <input :value="editingEmployee.employeeNumber || editingEmployee.account" type="text" disabled />
          </div>

          <div class="form-group">
            <label>角色</label>
            <select v-model="employeeForm.roleId" required>
              <option v-for="role in roles" :key="role._id || role.id" :value="role._id || role.id">{{ role.name }}</option>
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
import { roleAPI, employeeAPI } from '@/services/api'

// 響應式數據
const employees = ref([])
const employeeRoleFilter = ref('all')
const showAddEmployeeModal = ref(false)
const editingEmployee = ref(null)
const employeeForm = ref({
  name: '',
  email: '',
  roleId: '',
  account: '',
  password: ''
})

// 後端角色與權限
const roles = ref([]) // 來源：後端 /roles
const permissionCatalog = ref([]) // 來源：後端 /roles/_catalog/permissions

// 以後端 catalog 渲染可選權限
const availablePermissions = computed(() => permissionCatalog.value.map(p => ({ key: p.key, label: p.label })))

// 本地 UI 顯示需要的 role 表單狀態
const showRoleModal = ref(false)
const editingRole = ref(null)
const roleForm = ref({ id: '', name: '', permissionKeys: [] })
const roleFormError = ref('')

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

const editEmployee = (employee) => {
  editingEmployee.value = employee
  employeeForm.value = {
    name: employee.name,
    email: employee.email,
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
    roleId: ''
  }
}

const submitEmployeeForm = async () => {
  if (editingEmployee.value) {
    // 更新員工
    const id = editingEmployee.value.id || editingEmployee.value._id
    await employeeAPI.updateEmployee(id, {
      name: employeeForm.value.name,
      email: employeeForm.value.email,
      roleId: employeeForm.value.roleId
    })
  } else {
    // 新增員工
    await employeeAPI.createEmployee({
      name: employeeForm.value.name,
      email: employeeForm.value.email,
      roleId: employeeForm.value.roleId
    })
  }
  await fetchEmployees()
  closeModal()
}

const openAddRoleModal = () => {
  editingRole.value = null
  roleForm.value = { id: '', name: '', permissionKeys: [] }
  roleFormError.value = ''
  showRoleModal.value = true
}

const openEditRoleModal = (role) => {
  editingRole.value = { ...role }
  roleForm.value = {
    id: role._id || role.id,
    name: role.name,
    permissionKeys: Array.isArray(role.permissions) ? role.permissions : []
  }
  roleFormError.value = ''
  showRoleModal.value = true
}

const closeRoleModal = () => {
  showRoleModal.value = false
  editingRole.value = null
  roleFormError.value = ''
}

const submitRoleForm = async () => {
  roleFormError.value = ''
  const trimmedName = roleForm.value.name.trim()
  if (!trimmedName) {
    roleFormError.value = '請填寫角色名稱'
    return
  }

  const payload = {
    name: trimmedName,
    permissions: roleForm.value.permissionKeys
  }

  if (editingRole.value && roleForm.value.id) {
    // 禁止非管理員修改系統角色
    if (editingRole.value.isSystem && !isAdminActor) {
      roleFormError.value = '系統預設角色不可修改，請聯繫管理員'
      return
    }
    await roleAPI.updateRole(roleForm.value.id, payload)
  } else {
    await roleAPI.createRole(payload)
  }

  await fetchRoles()
  closeRoleModal()
}

const deleteRole = async (roleId) => {
  const used = getEmployeeCountByRole(roleId)
  if (used > 0) {
    alert('有員工正在使用此角色，請先調整員工角色後再刪除')
    return
  }
  await roleAPI.deleteRole(roleId)
  await fetchRoles()
}

// 初始化數據
const fetchPermissionCatalog = async () => {
  const res = await roleAPI.getPermissionCatalog()
  permissionCatalog.value = res.data?.permissions || []
}

const fetchRoles = async () => {
  const res = await roleAPI.getRoles()
  roles.value = res.data?.roles || []
}

const fetchEmployees = async () => {
  const res = await employeeAPI.getEmployees()
  // 正規化員工資料，保留 roleId 以便綁定
  employees.value = (res.data?.employees || []).map(e => ({
    id: e._id || e.id,
    name: e.name,
    email: e.email,
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

// 角色操作權限：僅 admin 可編輯/刪除系統角色
const isAdminActor = (() => {
  try {
    return !!localStorage.getItem('admin_user')
  } catch (e) {
    return false
  }
})()
const canEditRole = (role) => {
  if (role?.isSystem) return isAdminActor
  return true
}
const canDeleteRole = (role) => {
  if (role?.isSystem) return isAdminActor
  return true
}

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
