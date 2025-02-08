import { ref } from 'vue'

const defaultOptions = {
  size: [
    { name: 'large', label: '大份', price: 30 },
    { name: 'small', label: '小份', price: 20 }
  ],
  extra: [
    { name: 'extra_rice', label: '加飯', price: 10 },
    { name: 'extra_noodles', label: '加麵', price: 10 }
  ],
  sugar: [
    { name: 'normal', label: '正常' },
    { name: 'half', label: '半糖' },
    { name: 'less', label: '少糖' },
    { name: 'no', label: '無糖' }
  ]
}

export function useMenu() {
  const menuItems = ref({
    rice: [
      {
        id: 1,
        name: '台式滷肉飯',
        image: 'https://placehold.co/300x200/e6e6e6/1d1d1f?text=台式滷肉飯',
        basePrice: 120,
        options: ['size', 'extra']
      },
      {
        id: 2,
        name: '湯包蛋飯',
        image: 'https://placehold.co/300x200/e6e6e6/1d1d1f?text=湯包蛋飯',
        basePrice: 90,
        options: ['size', 'extra']
      },
      {
        id: 3,
        name: '咖哩飯',
        image: 'https://placehold.co/300x200/e6e6e6/1d1d1f?text=咖哩飯',
        basePrice: 140,
        options: ['size', 'extra']
      },
      {
        id: 4,
        name: '三寶飯',
        image: 'https://placehold.co/300x200/e6e6e6/1d1d1f?text=三寶飯',
        basePrice: 130,
        options: ['size', 'extra']
      }
    ],
    noodles: [
      {
        id: 5,
        name: '紅燉牛肉麵',
        image: 'https://placehold.co/300x200/e6e6e6/1d1d1f?text=紅燉牛肉麵',
        basePrice: 150,
        options: ['size', 'extra']
      },
      {
        id: 6,
        name: '海鮮炒麵',
        image: 'https://placehold.co/300x200/e6e6e6/1d1d1f?text=海鮮炒麵',
        basePrice: 160,
        options: ['size', 'extra']
      },
      {
        id: 7,
        name: '豬排麵',
        image: 'https://placehold.co/300x200/e6e6e6/1d1d1f?text=豬排麵',
        basePrice: 140,
        options: ['size', 'extra']
      }
    ],
    drinks: [
      {
        id: 8,
        name: '珍珠奶茶',
        image: 'https://placehold.co/300x200/e6e6e6/1d1d1f?text=珍珠奶茶',
        basePrice: 60,
        options: ['sugar']
      },
      {
        id: 9,
        name: '四季青茶',
        image: 'https://placehold.co/300x200/e6e6e6/1d1d1f?text=四季青茶',
        basePrice: 45,
        options: ['sugar']
      },
      {
        id: 10,
        name: '紅茶拉鈴',
        image: 'https://placehold.co/300x200/e6e6e6/1d1d1f?text=紅茶拉鈴',
        basePrice: 55,
        options: ['sugar']
      },
      {
        id: 11,
        name: '檸檬綠茶',
        image: 'https://placehold.co/300x200/e6e6e6/1d1d1f?text=檸檬綠茶',
        basePrice: 50,
        options: ['sugar']
      }
    ]
  })

  const categories = ref([
    { name: 'rice', label: '飯類' },
    { name: 'noodles', label: '麵類' },
    { name: 'drinks', label: '飲料' }
  ])
  const activeCategory = ref('rice')

  const addCategory = (category) => {
    categories.value.push({
      name: category.toLowerCase().replace(/\s+/g, '-'),
      label: category
    })
    if (categories.value.length === 1) {
      activeCategory.value = categories.value[0].name
    }
  }

  const removeCategory = (categoryName) => {
    const index = categories.value.findIndex(c => c.name === categoryName)
    if (index !== -1) {
      categories.value.splice(index, 1)
      if (activeCategory.value === categoryName) {
        activeCategory.value = categories.value[0]?.name || ''
      }
    }
  }

  return {
    categories,
    activeCategory,
    addCategory,
    removeCategory,
    menuItems
  }
}
