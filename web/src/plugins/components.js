import BaseButton from '../components/base/BaseButton.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseTag from '../components/base/BaseTag.vue'
import BaseTable from '../components/base/BaseTable.vue'
import BaseTabs from '../components/base/BaseTabs.vue'
import BaseTab from '../components/base/BaseTab.vue'
import BaseDialog from '../components/base/BaseDialog.vue'

export default {
  install: (app) => {
    app.component('BaseButton', BaseButton)
    app.component('BaseCard', BaseCard)
    app.component('BaseTag', BaseTag)
    app.component('BaseTable', BaseTable)
    app.component('BaseTabs', BaseTabs)
    app.component('BaseTab', BaseTab)
    app.component('BaseDialog', BaseDialog)
  }
}
