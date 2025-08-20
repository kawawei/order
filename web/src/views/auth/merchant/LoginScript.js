import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { authAPI } from '@/services/api';
import { useToast } from 'vue-toastification';

export default {
  setup() {
    const router = useRouter();
    const toast = useToast();
    
    const formData = ref({
      merchantCode: '',
      employeeCode: ''
    });
    
    const loading = ref(false);
    const errors = ref({});

    const validateForm = () => {
      const newErrors = {};
      
      if (!formData.value.merchantCode) {
        newErrors.email = '請輸入商家代碼';
      }
      
      if (!formData.value.employeeCode) {
        newErrors.password = '請輸入員工編號';
      }
      
      errors.value = newErrors;
      return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async () => {
      if (!validateForm()) return;
      
      loading.value = true;
      try {
        const response = await authAPI.login(formData.value);
        
        // 保存 token 與商家/員工信息（使用分離鍵名）
        localStorage.setItem('merchant_token', response.token);
        if (response?.data?.merchant) {
          localStorage.setItem('merchant_user', JSON.stringify({
            ...response.data.merchant,
            role: 'merchant',
            merchantId: response.data.merchant?._id || response.data.merchant?.id || null
          }));
        } else if (response?.data?.employee) {
          const employee = response.data.employee;
          const merchantId =
            (typeof employee?.merchant === 'string' ? employee.merchant : null) ||
            employee?.merchant?._id ||
            employee?.merchant?.id ||
            employee?.merchantId ||
            null;
          const employeeRoleId = (employee?.role && (employee?.role?._id || employee?.role?.id)) || employee?.roleId || employee?.role || null;
          const employeeRoleName = (employee?.role && (employee?.role?.name || employee?.role?.title)) || null;
          
          // 添加調試信息
          console.log('=== 員工登入前端處理 ===');
          console.log('員工數據:', employee);
          console.log('businessName:', employee.businessName);
          console.log('merchantCode:', employee.merchantCode);
          
          localStorage.setItem('merchant_user', JSON.stringify({
            ...employee,
            role: 'employee',
            merchantId,
            employeeRoleId,
            employeeRoleName,
            // 確保餐廳名稱和代碼被保存
            businessName: employee.businessName || null,
            merchantCode: employee.merchantCode || null
          }));
        }
        
        toast.success('登入成功！');
        
        // 導航到商家儀表板
        router.push('/merchant/dashboard');
      } catch (error) {
        console.error('登入錯誤:', error);
        toast.error(error.message || '登入失敗，請檢查您的憑證');
      } finally {
        loading.value = false;
      }
    };

    return {
      formData,
      loading,
      errors,
      handleLogin
    };
  }
};
