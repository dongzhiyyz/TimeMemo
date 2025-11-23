<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { defineProps, defineEmits } from 'vue';
import type { MemoItemType } from '../Memo/memo';

// 接收父组件传入的备忘条目数据
const props = defineProps<{ item: MemoItemType }>();
const emit = defineEmits<{
  (e: 'toggle', id: number): void;
  (e: 'update', id: number, content: string): void;
}>();

const showDetail = ref(false);
const popupRef = ref<HTMLElement | null>(null);

// 点击弹窗外部时关闭详细信息
const handleClickOutside = (event: MouseEvent) => {
  if (popupRef.value && !popupRef.value.contains(event.target as Node)) {
    showDetail.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside, { capture: true });
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});


// 输入框内容变更：向父组件派发更新事件
const onInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  emit('update', props.item.id, target.value);
};

// 格式化日期：MM-DD
const formatDateShort = (date: Date | null | undefined) => {
  if (!date) return '';
  const d = new Date(date);
  return `${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

// 格式化日期到秒：YYYY-MM-DD HH:mm:ss
const formatDateFull = (date: Date | null | undefined) => {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// 计算花费时间（创建到完成的时间差）
const elapsedTime = () => {
  if (!props.item.completedAt) return '';
  const diffMs = props.item.completedAt.getTime() - props.item.createdAt.getTime();
  const diffSec = diffMs / 1000;

  if (diffSec < 60) return `${Math.floor(diffSec)} 秒`;
  const diffMin = diffSec / 60;
  if (diffMin < 60) return `${Math.floor(diffMin)} 分`;
  const diffHour = diffMin / 60;
  if (diffHour < 24) return `${Math.floor(diffHour)} 时`;
  const diffDay = diffHour / 24;
  return `${Math.floor(diffDay)} 天`;
};
</script>

<template>
  <!-- 单条备忘条目 -->
  <div class="memo-item" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%;">
    <!-- 输入框 -->
    <input
      :value="item.content"
      @input="onInput"
      placeholder="输入内容..."
      style="flex:1;min-width:100px"
    />

    <!-- 显示时间或花费 -->
    <div>
      <span v-if="!item.completed">{{ formatDateShort(item.createdAt) }}</span>
      <span v-else>{{ elapsedTime() }}</span>
    </div>

    <!-- 详细信息按钮：打开弹窗 -->
    <button @click.stop="showDetail = true" style="padding:2px 4px;">...</button>

    <!-- 状态切换：完成/未完成 -->
    <button @click="emit('toggle', item.id)">
      {{ item.completed ? '恢复未完成' : '标记完成' }}
    </button>

    <!-- 详细信息弹窗 -->
    <div 
      v-if="showDetail" 
      ref="popupRef" 
      class="detail-popup"
      @click.stop
    >
      <div>内容：{{ item.content }}</div>
      <div>创建时间：{{ formatDateFull(item.createdAt) }}</div>
      <div v-if="item.completed">完成时间：{{ formatDateFull(item.completedAt) }}</div>
      <div v-if="item.completed">花费时间：{{ elapsedTime() }}</div>
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

/* 弹出详细信息样式 */
.detail-popup {
  position: absolute;
  top: 30px;
  left: 0;
  background: #fff;
  border: 1px solid #ccc;
  padding: 8px;
  font-size: 12px;
  z-index: 100;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}
</style>
