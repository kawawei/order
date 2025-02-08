import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../../composables/useAuth'
import { useToast } from '../../../composables/useToast'
import '../../../assets/styles/login.css'

export default {
  setup() {
    const router = useRouter()
    const { register } = useAuth()
    const { showToast } = useToast()

    // 表單狀態
    const loading = ref(false)
    const showPassword = ref(false)

    // 步驟控制
    const currentStep = ref(1)

    const showStep1 = computed(() => currentStep.value === 1)
    const showStep2 = computed(() => currentStep.value === 2)

    const nextStep = () => {
      if (currentStep.value === 1) {
        currentStep.value = 2
      }
    }

    const prevStep = () => {
      if (currentStep.value === 2) {
        currentStep.value = 1
      }
    }

    // 初始化表單數據
    const form = ref({
      name: '',
      ownerName: '',
      email: '',
      phone: '',
      city: '',
      district: '',
      address: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: false
    })

    // 台灣縣市資料
    const taiwanCities = [
      '台北市', '新北市', '桃園市', '台中市', '台南市',
      '高雄市', '基隆市', '新竹市', '嘉義市', '新竹縣',
      '宜蘭縣', '花蓮縣', '南投縣', '彰化縣', '雲林縣',
      '嘉義縣', '屏東縣', '台東縣', '澎湖縣', '金門縣',
      '連江縣'
    ]

    // 區域資料
    const districtData = {
      '台北市': [
        '中正區', '大同區', '中山區', '萬華區', '信義區',
        '松山區', '大安區', '南港區', '北投區', '內湖區',
        '士林區', '文山區'
      ],
      '新北市': [
        '板橋區', '三重區', '中和區', '永和區', '新莊區',
        '新店區', '土城區', '蘆洲區', '樂生區', '樹林區'
      ],
      // 可以繼續添加其他縣市的區域資料
    }

    const cities = ref(taiwanCities)

    const districts = computed(() => {
      if (!form.value.city) return []
      return districtData[form.value.city] || []
    })

    const isPasswordMatch = computed(() => {
      return form.value.password === form.value.confirmPassword
    })

    const showTerms = () => {
      // TODO: 顯示服務條款
      console.log('顯示服務條款')
    }

    const showPrivacy = () => {
      // TODO: 顯示隱私政策
      console.log('顯示隱私政策')
    }

    const validateForm = () => {
      if (!isPasswordMatch.value) {
        toast.error('兩次輸入的密碼不一致')
        return false
      }

      if (!form.value.phone.match(/^[0-9]{10}$/)) {
        toast.error('請輸入正確的電話號碼（10位數字）')
        return false
      }

      if (!form.value.city || !form.value.district) {
        toast.error('請選擇縣市和區域')
        return false
      }

      return true
    }

    const handleRegister = async () => {
      if (!validateForm()) return

      try {
        loading.value = true
        await register({
          name: form.value.name,
          ownerName: form.value.ownerName,
          email: form.value.email,
          phone: form.value.phone,
          city: form.value.city,
          district: form.value.district,
          address: form.value.address,
          password: form.value.password
        })
        toast.success('註冊成功')
        router.push({ name: 'MerchantLogin' })
      } catch (error) {
        toast.error(error.message || '註冊失敗')
        console.error('註冊失敗：', error)
      } finally {
        loading.value = false
      }
    }

    return {
      loading,
      showPassword,
      currentStep,
      showStep1,
      showStep2,
      form,
      cities,
      districts,
      isPasswordMatch,
      nextStep,
      prevStep,
      showTerms,
      showPrivacy,
      handleRegister
    }
  }
}
