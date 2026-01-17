<script setup lang="ts">
import dayjs from 'dayjs'
import { ref, computed, watch } from 'vue'
import type { MemoItemType, MemoPriority } from '../Memo/memo'

const showDetail = ref(false)
const props = defineProps<{ item: MemoItemType }>()
const emit = defineEmits<{
  (e: 'toggle', id: number, checked: boolean): void
  (e: 'update', id: number, content: string): void
  (e: 'delete', id: number): void
  (e: 'updatePriority', id: number, priority: MemoPriority): void
}>()

const localContent = ref(props.item.content)
watch(
  () => props.item.content,
  v => {
    if (v !== localContent.value) {
      localContent.value = v
    }
  }
)

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

function setPriority(priority: MemoPriority) {
  if (props.item.priority === priority) return
  emit('updatePriority', props.item.id, priority)
}

const toDate = (d: any) => {
  if (!d) return null
  if (dayjs.isDayjs(d)) return d.toDate()
  return d instanceof Date ? d : new Date(d)
}

const formatDateShort = (date?: any) => {
  const d = toDate(date)
  if (!d) return ''
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatDateFull = (date?: any) => {
  const d = toDate(date)
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const elapsedTimeText = computed(() => {
  if (!props.item.completed) return ''
  const start = toDate(props.item.createdAt)
  const end = toDate(props.item.completedAt)
  if (!start || !end) return ''

  const diffSec = (end.getTime() - start.getTime()) / 1000
  if (diffSec < 60) return `${Math.floor(diffSec)} 秒`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分`
  if (diffSec < 86400 * 3) return `${Math.floor(diffSec / 3600)} 时`
  return `${Math.floor(diffSec / 86400)} 天`
})

const inputRef = ref<HTMLInputElement | null>(null)
defineExpose({
  inputRef
})
</script>

<template>
  <div class="memo-item" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%;">
    <div class="status-area">
      <input class="cb-complete" type="checkbox" :checked="props.item.completed"
        @change="emit('toggle', props.item.id, ($event.target as HTMLInputElement).checked)" />
      <select class="priority-select" :class="`priority-${props.item.priority}`" :value="props.item.priority"
        @change="setPriority(($event.target as HTMLSelectElement).value as MemoPriority)">
        <option value="high">高</option>
        <option value="medium">中</option>
        <option value="low">低</option>
      </select>
    </div>

    <input ref="inputRef" v-model="localContent" placeholder="输入内容..." style="flex:1;min-width:100px;font-size:13px;"
      @blur="onBlur" />

    <div class="time-spent">
      <span v-if="!props.item.completed" class="created-time">{{ formatDateShort(props.item.createdAt) }}</span>
      <span v-else class="elapsed-time">{{ elapsedTimeText }}</span>
    </div>

    <button @click.stop="showDetail = true" style="padding:2px 6px;">
      ...
    </button>

    <div v-if="showDetail" class="detail-overlay" @click="showDetail = false">
      <div class="detail-panel" @click.stop>
        <div class="panel-header">
          <div>详细信息</div>
          <button style="padding:2px 6px;background:#d9534f;color:#fff;border:none;border-radius:2px;"
            @click.stop="onDelete">
            删除
          </button>
        </div>

        <div class="panel-body card">
          <div class="card-row">
            <span class="label">内容：</span>
            <span class="value">{{ props.item.content }}</span>
          </div>
          <div class="card-row">
            <span class="label">文件夹：</span>
            <span class="value">{{ props.item.folderName }}</span>
          </div>
          <div class="card-row">
            <span class="label">创建时间：</span>
            <span class="value">{{ formatDateFull(props.item.createdAt) }}</span>
          </div>
          <div class="card-row" v-if="props.item.firstCompletedAt">
            <span class="label">首次完成时间：</span>
            <span class="value">{{ formatDateFull(props.item.firstCompletedAt) }}</span>
          </div>
          <div class="card-row" v-if="props.item.completed">
            <span class="label">最近完成时间：</span>
            <span class="value">{{ formatDateFull(props.item.completedAt) }}</span>
          </div>
          <div class="card-row" v-if="props.item.completed">
            <span class="label">花费时间：</span>
            <span class="value">{{ elapsedTimeText }}</span>
          </div>
          <div class="card-row">
            <span class="label">优先级：</span>
            <span class="value">
              {{ props.item.priority === 'high' ? '高' : props.item.priority === 'low' ? '低' : '中' }}
            </span>
          </div>
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

.status-area {
  display: flex;
  align-items: center;
  gap: 6px;
}

.priority-select {
  font-size: 12px;
  padding: 0 6px;
  height: 22px;
  text-align: center;
  text-align-last: center;
  -webkit-appearance: none;
  appearance: none;
  background-image: none;
  border-radius: 999px;
}

.priority-select.priority-high {
  background-color: #fee2e2;
  color: #b91c1c;
}

.priority-select.priority-medium {
  background-color: #fef3c7;
  color: #8f3e0b;
}

.priority-select.priority-low {
  background-color: #dcfce7;
  color: #166534;
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
  width: 500px;
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

.panel-body.card {
  background: #fff;
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 12px;
  max-width: 500px;
}

.card-row {
  display: flex;
  margin-bottom: 6px;
}

.card-row .label {
  width: 100px;
  font-weight: 600;
  color: #555;
}

.card-row .value {
  flex: 1;
  color: #333;
  word-break: break-word;
}

.time-spent {
  font-size: 13px;
  width: 50px;
}

.created-time {
  color: #000000;
}

.elapsed-time {
  color: #02c581;
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
