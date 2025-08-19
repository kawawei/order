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
        
        // 保存 token 與商家信息（使用分離鍵名）
        localStorage.setItem('merchant_token', response.token);
        if (response?.data?.merchant) {
          localStorage.setItem('merchant_user', JSON.stringify({
            ...response.data.merchant,
            role: 'merchant',
            merchantId: response.data.merchant?._id || response.data.merchant?.id || null
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
