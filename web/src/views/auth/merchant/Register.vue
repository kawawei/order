<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <h1>餐廳管理系統</h1>
        <p>註冊新帳號</p>
        <div class="step-indicator">
          <div class="step-numbers">
            <div 
              v-for="step in 2" 
              :key="step"
              :class="['step', { active: currentStep >= step, completed: currentStep > step }]"
            >
              {{ step }}
            </div>
          </div>
          <div class="step-labels">
            <div 
              v-for="step in 2" 
              :key="step"
              :class="{ active: currentStep >= step }"
            >
              {{ step === 1 ? '基本資料' : '帳號資料' }}
            </div>
          </div>
        </div>
      </div>
      
      <form class="login-form" @submit.prevent="handleRegister">
        <!-- 第一階段：基本信息和地址 -->
        <div v-if="showStep1" class="form-step" key="step1">
          <div class="form-group">
            <div class="input-group">
              <span class="input-icon">
                <font-awesome-icon icon="store" />
              </span>
              <input 
                type="text" 
                v-model="form.name"
                placeholder="請輸入餐廳名稱"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <div class="input-group">
              <span class="input-icon">
                <font-awesome-icon icon="user" />
              </span>
              <input 
                type="text" 
                v-model="form.ownerName"
                placeholder="請輸入負責人姓名"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <div class="input-group">
              <span class="input-icon">
                <font-awesome-icon icon="phone" />
              </span>
              <input 
                type="tel" 
                v-model="form.phone"
                placeholder="請輸入聯絡電話"
                required
                pattern="[0-9]{10}"
              />
            </div>
          </div>

          <div class="form-group">
            <div class="input-group location-group">
              <select 
                v-model="form.city"
                required
                class="location-select"
              >
                <option value="" disabled selected>選擇縣市</option>
                <option v-for="city in cities" :key="city" :value="city">
                  {{ city }}
                </option>
              </select>
              <select 
                v-model="form.district"
                required
                class="location-select"
                :disabled="!form.city"
              >
                <option value="" disabled selected>選擇區域</option>
                <option v-for="district in districts" :key="district" :value="district">
                  {{ district }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <div class="input-group">
              <span class="input-icon">
                <font-awesome-icon icon="map-marked-alt" />
              </span>
              <input 
                type="text" 
                v-model="form.address"
                placeholder="請輸入詳細地址"
                required
              />
            </div>
          </div>

          <BaseButton 
            type="button"
            variant="primary"
            class="next-button"
            :disabled="!form.name || !form.ownerName || !form.phone || !form.city || !form.district || !form.address"
            @click="nextStep"
          >
            下一步
          </BaseButton>
        </div>

        <!-- 第二階段：帳號信息 -->
        <div v-if="showStep2" class="form-step" key="step2">
          <div class="form-group">
            <div class="input-group">
              <span class="input-icon">
                <font-awesome-icon icon="envelope" />
              </span>
              <input 
                type="email" 
                v-model="form.email"
                placeholder="請輸入電子郵件"
                required
              />
            </div>
          </div>
          
          <div class="form-group">
            <div class="input-group">
              <span class="input-icon">
                <font-awesome-icon icon="lock" />
              </span>
              <input 
                :type="showPassword ? 'text' : 'password'" 
                v-model="form.password"
                placeholder="請輸入密碼"
                required
              />
              <button 
                type="button"
                class="toggle-password"
                @click="showPassword = !showPassword"
              >
                <font-awesome-icon :icon="showPassword ? 'eye-slash' : 'eye'" />
              </button>
            </div>
          </div>

          <div class="form-group">
            <div class="input-group">
              <span class="input-icon">
                <font-awesome-icon icon="lock" />
              </span>
              <input 
                :type="showPassword ? 'text' : 'password'" 
                v-model="form.confirmPassword"
                placeholder="請再次輸入密碼"
                required
              />
            </div>
          </div>
          
          <div class="form-group terms">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                v-model="form.agreeToTerms"
                required
              />
              <span>我同意<a href="#" @click.prevent="showTerms">服務條款</a>和<a href="#" @click.prevent="showPrivacy">隱私政策</a></span>
            </label>
          </div>

          <div class="button-group">
            <BaseButton 
              type="button"
              variant="secondary"
              class="prev-button"
              @click="prevStep"
            >
              上一步
            </BaseButton>

            <BaseButton 
              type="submit"
              variant="primary"
              :loading="loading"
              class="submit-button"
              :disabled="loading || !form.agreeToTerms || !isPasswordMatch || !form.email || !form.password || !form.confirmPassword"
            >
              {{ loading ? '註冊中...' : '註冊' }}
            </BaseButton>
          </div>
        </div>

        <div class="form-footer">
          <p>已經有帳號了？<router-link to="/merchant/login" class="login-link">立即登入</router-link></p>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import registerScript from './RegisterScript.js'

export default {
  ...registerScript
}
</script>

<style scoped>
@import './Register.css';
</style>
