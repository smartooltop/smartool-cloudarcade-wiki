<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { glossaryMap } from '../../data/glossary'

interface TipState {
  x: number
  y: number
  term: string
  ipa?: string
  zh: string
  type: 'word' | 'term'
}

const tip = ref<HTMLElement | null>(null)
const tipVisible = ref(false)
const tipData = ref<TipState | null>(null)

let activeTerm: HTMLElement | null = null
let hideTimer: number | null = null

const TIP_OFFSET = 12

function lookup(el: HTMLElement): TipState | null {
  const term = el.getAttribute('data-term')
  if (!term) return null
  const entry = glossaryMap[term.toLowerCase()]
  if (!entry) return null
  return {
    x: 0,
    y: 0,
    term: entry.term,
    ipa: entry.ipa,
    zh: entry.zh,
    type: entry.type
  }
}

function positionTip(el: HTMLElement) {
  if (!tip.value) return
  const rect = el.getBoundingClientRect()
  const tipRect = tip.value.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  let x = rect.left
  let y = rect.bottom + TIP_OFFSET

  // 水平方向溢出时翻转
  if (x + tipRect.width > vw - 8) {
    x = rect.right - tipRect.width
  }
  if (x < 8) x = 8
  // 垂直方向溢出时显示在元素上方
  if (y + tipRect.height > vh - 8) {
    y = rect.top - tipRect.height - TIP_OFFSET
  }
  if (y < 8) y = 8

  tip.value.style.left = `${x}px`
  tip.value.style.top = `${y}px`
}

function showTip(el: HTMLElement) {
  const data = lookup(el)
  if (!data) return
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  activeTerm = el
  tipData.value = data
  tipVisible.value = true
  nextTick(() => positionTip(el))
}

function hideTip() {
  tipVisible.value = false
  activeTerm = null
}

function handleMouseOver(e: MouseEvent) {
  const target = e.target as HTMLElement
  const termEl = target.closest('.glossary-term') as HTMLElement | null
  if (termEl) {
    if (termEl !== activeTerm) {
      showTip(termEl)
    }
    return
  }
  // 移入气泡自身不隐藏
  if (tipVisible.value && target.closest('.glossary-tooltip')) return
  hideTip()
}

function handleMouseOut(e: MouseEvent) {
  const to = e.relatedTarget as HTMLElement | null
  const from = e.target as HTMLElement
  // 从词条移动到气泡内部：延迟隐藏
  if (from.closest('.glossary-term') && to && to.closest('.glossary-tooltip')) {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = window.setTimeout(hideTip, 200)
    return
  }
}

function handleScroll() {
  if (activeTerm) positionTip(activeTerm)
}

onMounted(() => {
  document.addEventListener('mouseover', handleMouseOver)
  document.addEventListener('mouseout', handleMouseOut)
  window.addEventListener('scroll', handleScroll, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mouseover', handleMouseOver)
  document.removeEventListener('mouseout', handleMouseOut)
  window.removeEventListener('scroll', handleScroll, true)
})
</script>

<template>
  <div class="glossary-tooltip-root">
    <slot />
    <Teleport to="body">
      <Transition name="glossary-tip">
        <div
          v-if="tipVisible && tipData"
          ref="tip"
          class="glossary-tooltip"
          role="tooltip"
          @mouseover="handleMouseOver"
        >
          <div class="glossary-tooltip-head">
            <span class="glossary-tooltip-term">{{ tipData.term }}</span>
            <span class="glossary-tooltip-type">
              {{ tipData.type === 'word' ? '单词' : '术语' }}
            </span>
          </div>
          <div v-if="tipData.ipa" class="glossary-tooltip-ipa">{{ tipData.ipa }}</div>
          <div class="glossary-tooltip-zh">{{ tipData.zh }}</div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
