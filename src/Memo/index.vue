<script setup lang="ts">
import { ref, computed } from 'vue';
import MemoItem from './MemoItem.vue';
import type { MemoItemType } from '../Memo/memo';

const memoList = ref<MemoItemType[]>([]);
const selectedIds = ref<number[]>([]);

// 获取无重复 ID
const getNextId = () => {
  const used = new Set(memoList.value.map(m => m.id));
  let id = 1;
  while (used.has(id)) id++;
  return id;
};

// ---------- 新增 ----------
const addMemo = () => {
  memoList.value.push({
    id: getNextId(),
    content: '',
    createdAt: new Date(),
    completed: false,
    completedAt: null,
  });
};

// ---------- 子组件更新 ----------
const updateContent = (id: number, content: string) => {
  const item = memoList.value.find(m => m.id === id);
  if (item) item.content = content;
};

const toggleComplete = (id: number) => {
  const item = memoList.value.find(m => m.id === id);
  if (!item) return;
  item.completed = !item.completed; // 切换完成状态
  item.completedAt = item.completed ? new Date() : null; // 完成时间设为当前时间或 null
};

const toggleSelect = (id: number, checked: boolean) => {
  const arr = selectedIds.value.slice();
  const i = arr.indexOf(id);
  if (checked && i === -1) arr.push(id);
  if (!checked && i !== -1) arr.splice(i, 1);
  selectedIds.value = arr;
};

const bulkDeleteSelected = () => {
  if (selectedIds.value.length === 0) return;
  const ok = window.confirm(`确定删除选中的 ${selectedIds.value.length} 条备忘？`);
  if (!ok) return;
  const ids = new Set(selectedIds.value);
  memoList.value = memoList.value.filter(m => !ids.has(m.id));
  selectedIds.value = [];
};

// ---------- 排序 ----------
const sortKey = ref<'time' | 'status'>('time');
const sortDirection = ref<'asc' | 'desc'>('asc');

// 点击按钮切换排序方式
const setSortBy = (key: 'time' | 'status') => {
  if (sortKey.value === key) {
    // 再点一次 → 翻转方向
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    // 切换排序方式，方向重置为升序
    sortKey.value = key;
    sortDirection.value = 'asc';
  }
};

const sortedList = computed(() => {
  const arr = [...memoList.value];

  if (sortKey.value === 'time') {
    arr.sort((a, b) =>
      sortDirection.value === 'asc'
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : b.createdAt.getTime() - a.createdAt.getTime()
    );
  } else if (sortKey.value === 'status') {
    arr.sort((a, b) => {
      const v1 = a.completed ? 1 : 0;
      const v2 = b.completed ? 1 : 0;
      return sortDirection.value === 'asc' ? v1 - v2 : v2 - v1;
    });
  }

  return arr;
});
</script>


<template>
  <h1>备忘录</h1>

  <button @click="addMemo">新增备忘</button>

  <div style="margin: 10px 0; display: flex; gap: 10px;">
    <!-- 按时间排序 -->
    <button @click="setSortBy('time')">
      时间排序
      <span v-if="sortKey === 'time'">
        {{ sortDirection === 'asc' ? '▲' : '▼' }}
      </span>
    </button>

    <!-- 按状态排序 -->
    <button @click="setSortBy('status')">
      完成状态
      <span v-if="sortKey === 'status'">
        {{ sortDirection === 'asc' ? '▲' : '▼' }}
      </span>
    </button>
  </div>

  <div style="margin: 10px 0;">
    <button @click="bulkDeleteSelected" :disabled="selectedIds.length === 0">删除选中</button>
  </div>

  <div v-for="item in sortedList" :key="item.id" style="display:flex;align-items:center;gap:10px;">
    <input type="checkbox"
      :checked="selectedIds.includes(item.id)"
      @change="toggleSelect(item.id, ($event.target as HTMLInputElement).checked)" />
    <MemoItem
      :item="item"
      @update="updateContent"
      @toggle="toggleComplete" />
  </div>
</template>
