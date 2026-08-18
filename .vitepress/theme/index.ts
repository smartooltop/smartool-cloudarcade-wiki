import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import GlossaryTooltip from './components/GlossaryTooltip.vue'
import './styles/glossary.css'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(GlossaryTooltip, null, {
      default: () => h(DefaultTheme.Layout)
    })
} satisfies Theme
