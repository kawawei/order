import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { authAPI } from '@/services/api';
import { useToast } from 'vue-toastification';

export default {
  setup() {
    const router = useRouter();
    const toast = useToast();
    
    const formData = ref({
      email: '',
      password: ''
    });
    
    const loading = ref(false);
    const errors = ref({});

    const validateForm = () => {
      const newErrors = {};
      
      if (!formData.value.email) {
        newErrors.email = '請輸入電子郵件';
      }
      
      if (!formData.value.password) {
        newErrors.password = '請輸入密碼';
      }
      
      errors.value = newErrors;
      return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async () => {
      if (!validateForm()) return;
      
      loading.value = true;
      try {
        const response = await authAPI.login(formData.value);
        
        // 保存 token
        localStorage.setItem('token', response.token);
        
        // 保存商家信息
        localStorage.setItem('merchant', JSON.stringify(response.data.merchant));
        
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
