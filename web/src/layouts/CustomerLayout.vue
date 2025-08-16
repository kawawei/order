<template>
  <div class="customer-layout">
    <!-- 頂部導航 -->
    <header class="customer-header">
      <div class="header-content">
        <div class="brand">
          <font-awesome-icon icon="utensils" class="brand-icon" />
          <span class="brand-text">點餐系統</span>
        </div>
        
        <nav class="nav-links">
          <router-link to="/menu" class="nav-link">
            <font-awesome-icon icon="book-open" />
            菜單
          </router-link>
          <router-link to="/orders" class="nav-link">
            <font-awesome-icon icon="receipt" />
            點餐紀錄
          </router-link>
        </nav>
      </div>
    </header>

    <!-- 主要內容區 -->
    <main class="main-content">
      <router-view />
    </main>

    <!-- 底部 -->
    <footer class="customer-footer">
      <div class="footer-content">
        <p>&copy; 2024 點餐系統. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
// 這個布局組件不需要特殊邏輯
</script>

<style scoped>
.customer-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #fafafa;
}

.customer-header {
  background-color: white;
  border-bottom: 1px solid #e6e6e6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1d1d1f;
  text-decoration: none;
}

.brand-icon {
  color: #007AFF;
  font-size: 1.5rem;
}

.brand-text {
  color: #1d1d1f;
}

.nav-links {
  display: flex;
  gap: 24px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  text-decoration: none;
  color: #666;
  font-weight: 500;
  transition: all 0.2s ease;
}

.nav-link:hover {
  background-color: #f5f5f7;
  color: #1d1d1f;
}

.nav-link.router-link-active {
  background-color: #e3f2fd;
  color: #007AFF;
}

.main-content {
  flex: 1;
  width: 100%;
}

.customer-footer {
  background-color: white;
  border-top: 1px solid #e6e6e6;
  margin-top: auto;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
  color: #666;
  font-size: 0.875rem;
}

.footer-content p {
  margin: 0;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .header-content {
    padding: 0 16px;
  }
  
  .brand {
    font-size: 1.125rem;
  }
  
  .nav-links {
    gap: 16px;
  }
  
  .nav-link {
    padding: 6px 8px;
    font-size: 0.875rem;
  }
  
  .nav-link span {
    display: none;
  }
  
  .footer-content {
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .header-content {
    padding: 0 12px;
  }
  
  .nav-links {
    gap: 12px;
  }
}
</style>
