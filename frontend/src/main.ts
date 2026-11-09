import { createApp } from 'vue'
import './estilos.css'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

createApp(App).mount('#app')
