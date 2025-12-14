<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { MemoItemType } from '../Memo/memo'

const showDetail = ref(false)
const props = defineProps<{ item: MemoItemType }>()
const emit = defineEmits<{
  (e: 'toggle', id: number): void
  (e: 'update', id: number, content: string): void
  (e: 'delete', id: number): void
}>()

/* ---------- 输入框：本地状态 ---------- */
const localContent = ref(props.item.content)
watch(
  () => props.item.content,
  v => {
    if (v !== localContent.value) {
      localContent.value = v
    }
  }
)

// 父 → 子同步（比如切换 memo、外部修改）
watch(
  () => props.item.content,
  v => {
    if (v !== localContent.value) {
      localContent.value = v
    }
  }
)

function onBlur() {
  if (localContent.value !== props.item.content || !localContent.value) {
    emit('update', props.item.id, localContent.value)
  }
}

function onDelete() {
  emit('delete', props.item.id)
  showDetail.value = false
}

/* ---------- 日期工具 ---------- */
const toDate = (d: Date | string | number | null | undefined) => {
  if (!d) return null
  return d instanceof Date ? d : new Date(d)
}

const formatDateShort = (date?: Date | string | number | null) => {
  const d = toDate(date)
  if (!d) return ''
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatDateFull = (date?: Date | string | number | null) => {
  const d = toDate(date)
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/* ---------- 花费时间：computed ---------- */
const elapsedTimeText = computed(() => {
  if (!props.item.completed) return ''
  const start = toDate(props.item.createdAt)
  const end = toDate(props.item.completedAt)
  if (!start || !end) return ''

  const diffSec = (end.getTime() - start.getTime()) / 1000
  if (diffSec < 60) return `${Math.floor(diffSec)} 秒`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 时`
  return `${Math.floor(diffSec / 86400)} 天`
})

// 只暴露引用，不做任何事
const inputRef = ref<HTMLInputElement | null>(null)
defineExpose({
  inputRef
})

</script>

<template>
  <div class="memo-item" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%;">
    <!-- 输入框 -->
    <input 
      ref="inputRef"
      v-model="localContent" 
      placeholder="输入内容..." 
      style="flex:1;min-width:100px"
      @blur="onBlur" 
    />

    <!-- 时间 / 花费 -->
    <div>
      <span v-if="!item.completed">{{ formatDateShort(item.createdAt) }}</span>
      <span v-else>{{ elapsedTimeText }}</span>
    </div>

    <!-- 详情 -->
    <button @click.stop="showDetail = true" style="padding:2px 6px;">
      详情
    </button>

    <!-- 详情面板 -->
    <div v-if="showDetail" class="detail-overlay" @click="showDetail = false">
      <div class="detail-panel" @click.stop>
        <div class="panel-header">
          <div>详细信息</div>
          <button style="padding:2px 6px;background:#d9534f;color:#fff;border:none;border-radius:2px;"
            @click.stop="onDelete">
            删除
          </button>
        </div>

        <div class="panel-body">
          <div>内容：{{ item.content }}</div>
          <div>创建时间：{{ formatDateFull(item.createdAt) }}</div>
          <div v-if="item.completed">完成时间：{{ formatDateFull(item.completedAt) }}</div>
          <div v-if="item.completed">花费时间：{{ elapsedTimeText }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.memo-item {
  padding: 4px 8px;
  border-bottom: 1px solid #ddd;
  font-size: 14px;
  position: relative;
}

.memo-item input {
  padding: 2px 4px;
}

.memo-item button {
  padding: 2px 6px;
  cursor: pointer;
}

.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.detail-panel {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 360px;
  max-width: 80vw;
  background: #fff;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  animation: slideInRight 0.2s ease-out;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  font-weight: bold;
}

.panel-body {
  padding: 12px;
  font-size: 13px;
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
  }

  to {
    transform: translateX(0);
  }
}
</style>
