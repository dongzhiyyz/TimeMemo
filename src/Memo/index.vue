<script setup lang="ts">
import type { MemoItemType } from '../Memo/memo';
import { memoList } from '../Memo/memo';
import { ref, computed} from 'vue';
import MemoItem from './MemoItem.vue';
import Papa from 'papaparse';

const selectedIds = ref<number[]>([]);// 勾选的备忘ID列表（管理模式用）
const showSidebar = ref(true);// UI：是否显示左侧边栏
const fileInputRef = ref<HTMLInputElement | null>(null);// 文件输入引用（用于导入CSV）

// ---------- 文件夹管理 ----------
type Folder = { id: number; name: string };
const folders = ref<Folder[]>([{ id: 1, name: '默认' }]);
const currentFolderId = ref<number | null>(1);
const newFolderName = ref('');

// 生成未占用的文件夹ID
const getNextFolderId = () => {
  const used = new Set(folders.value.map(f => f.id));
  let id = 1;
  while (used.has(id)) id++;
  return id;
};

const addFolder = () => {
  const name = newFolderName.value.trim();
  if (!name) return;
  const id = getNextFolderId();
  folders.value.push({ id, name });
  currentFolderId.value = id;
  newFolderName.value = '';
};

const setCurrentFolder = (id: number | null) => {
  currentFolderId.value = id;
};

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
    folderId: currentFolderId.value ?? null,
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

// ---------- 管理模式与批量 ----------
const manageMode = ref(false);

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

const moveTargetFolderId = ref<number | null>(folders.value[0]?.id ?? null);
const bulkMoveSelected = () => {
  if (selectedIds.value.length === 0 || moveTargetFolderId.value == null) return;
  const ids = new Set(selectedIds.value);
  memoList.value.forEach(m => {
    if (ids.has(m.id)) m.folderId = moveTargetFolderId.value as number;
  });
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
  const arr = memoList.value.filter(m => {
    if (currentFolderId.value == null) return true; // 全部
    return m.folderId === currentFolderId.value;
  }).slice();

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

const allViewIds = computed(() => sortedList.value.map(m => m.id));
const isAllSelected = computed(() => allViewIds.value.length > 0 && allViewIds.value.every(id => selectedIds.value.includes(id)));
const toggleSelectAll = (checked: boolean) => {
  if (checked) {
    const set = new Set<number>([...selectedIds.value, ...allViewIds.value]);
    selectedIds.value = Array.from(set);
  } else {
    const removeSet = new Set<number>(allViewIds.value);
    selectedIds.value = selectedIds.value.filter(id => !removeSet.has(id));
  }
};

// ---------- CSV 导出/导入 ----------
const escapeCsv = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  const needsQuote = /[",\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
};

const folderNameById = (id: number | null | undefined) => {
  if (id == null) return '';
  const f = folders.value.find(x => x.id === id);
  return f ? f.name : '';
};

const toCsvRow = (m: MemoItemType) => {
  const created = m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date(m.createdAt).toISOString();
  const completedAt = m.completedAt ? (m.completedAt instanceof Date ? m.completedAt.toISOString() : new Date(m.completedAt).toISOString()) : '';
  const folderIdStr = m.folderId === null || m.folderId === undefined ? '' : String(m.folderId);
  const folderNameStr = escapeCsv(folderNameById(m.folderId));
  return [m.id, escapeCsv(m.content), created, m.completed, completedAt, folderIdStr, folderNameStr].join(',');
};

const exportCsv = async () => {
  if (memoList.value.length === 0) {
    window.alert('没有数据可导出');
    return;
  }
  const header = 'id,content,createdAt,completed,completedAt,folderId,folderName';
  const lines = [header, ...memoList.value.map(toCsvRow)];
  const text = lines.join('\n');
  const suggestedName = `TimeMemo_${Date.now()}.csv`;

  if (window.utools.showSaveDialog) {
    const filePath = window.utools.showSaveDialog({
      title: '保存 CSV 文件',
      defaultPath: suggestedName,
      buttonLabel: '保存',
      filters: [
        { name: 'CSV 文件', extensions: ['csv'] }
      ],
      properties: ['showOverwriteConfirmation']
    });

    if (filePath) {
      window.services.writeTextFile2(filePath, text);
      window.alert(`已导出到: ${filePath}`);
    }
  }
};

const parseCsv = (text: string): string[][] => {
  const result = Papa.parse<string[]>(text, {
    delimiter: ",",
    skipEmptyLines: true,
  });
  return result.data;
};

const ensureFolderByName = (name: string) => {
  const key = (name || '').trim();
  if (!key) return currentFolderId.value ?? (folders.value[0]?.id ?? 1);
  const existing = folders.value.find(f => f.name === key);
  if (existing) return existing.id;
  const id = getNextFolderId();
  folders.value.push({ id, name: key });
  return id;
};

const importCsvText = (text: string) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length <= 1) return;

  // 解析表头
  const header = lines[0].split(',');
  const idx = (name: string) => header.indexOf(name);

  const iId = idx('id');
  const iContent = idx('content');
  const iCreated = idx('createdAt');
  const iCompleted = idx('completed');
  const iCompletedAt = idx('completedAt');
  const iFolderId = idx('folderId');
  const iFolderName = idx('folderName');

  const incoming: MemoItemType[] = [];

  // ---------- 逐行解析 ----------
  for (let k = 1; k < lines.length; k++) {
    const cols = parseCsv(lines[k])[0];
    if (!cols || cols.length < header.length) continue;

    // 读取基本字段
    const idStr = cols[iId];
    const content = cols[iContent] ?? '';
    const createdAt = cols[iCreated] ? new Date(cols[iCreated]) : new Date();
    const completed = String(cols[iCompleted]).toLowerCase() === 'true';
    const completedAt = cols[iCompletedAt] ? new Date(cols[iCompletedAt]) : null;

    // ----- 处理文件夹 -----
    const folderName = (cols[iFolderName] || '').trim();
    const folderIdStr = cols[iFolderId];

    let folderId: number | null = null;
    if (folderName) {
      // 有名字 → 按名字归类
      folderId = ensureFolderByName(folderName);
    } else if (folderIdStr && !Number.isNaN(Number(folderIdStr))) {
      // 有 folderId → 用 folderId
      folderId = Number(folderIdStr);
    } else {
      // 都没有 → 用当前文件夹（保持你的旧逻辑）
      folderId = currentFolderId.value ?? null;
    }

    // 处理ID
    const idParsed = Number(idStr);
    const id = Number.isFinite(idParsed) ? idParsed : NaN;

    incoming.push({ id, content, createdAt, completed, completedAt, folderId });
  }

  if (incoming.length === 0) return;

  // ---------- 处理重复ID ----------
  const existingIds = new Set(memoList.value.map(m => m.id));
  const duplicates = incoming.filter(m => Number.isFinite(m.id) && existingIds.has(m.id));

  // --- 有重复 ID ---
  if (duplicates.length > 0) {
    const keepAll = window.confirm(
      `检测到 ${duplicates.length} 个重复ID。\n\n是否保留已有项并为导入项重新分配ID？`
    );

    if (keepAll) {
      // 重新分配ID给重复项
      duplicates.forEach(m => {
        m.id = getNextId();
      });
    } else {
      const keepImport = window.confirm(
        '是否保留导入项并覆盖已有项？\n\n“确定”：覆盖已有项\n“取消”：忽略这些重复的导入'
      );

      if (keepImport) {
        // 覆盖已有项
        duplicates.forEach(m => {
          const idx = memoList.value.findIndex(x => x.id === m.id);
          if (idx >= 0) {
            const t = memoList.value[idx];
            t.content = m.content;
            t.createdAt = m.createdAt;
            t.completed = m.completed;
            t.completedAt = m.completedAt;
            t.folderId = m.folderId;
          }
        });

        // 插入非重复
        incoming
          .filter(m => !existingIds.has(m.id))
          .forEach(m => {
            const isValid = Number.isFinite(m.id) && !existingIds.has(m.id);
            const nid = isValid ? m.id : getNextId();
            memoList.value.push({ ...m, id: nid });
          });

        return;
      } else {
        // 忽略重复项，只加入非重复的
        incoming
          .filter(m => !existingIds.has(m.id))
          .forEach(m => {
            const isValid = Number.isFinite(m.id) && !existingIds.has(m.id);
            const nid = isValid ? m.id : getNextId();
            memoList.value.push({ ...m, id: nid });
          });

        return;
      }
    }
  }

  // --- 没有重复 ID，直接插入 ---
  incoming.forEach(m => {
    const isValid = Number.isFinite(m.id) && !existingIds.has(m.id);
    const nid = isValid ? m.id : getNextId();
    memoList.value.push({ ...m, id: nid });
    existingIds.add(nid);
  });
};

const triggerImport = () => fileInputRef.value?.click();
const onImportFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    window.utools.ubrowser.show();
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    importCsvText(text);
    input.value = '';
  };
  reader.readAsText(file, 'utf-8');
};
</script>


<template>
  <!-- 主布局容器 -->
  <div class="container">
    <!-- 左侧文件夹栏 -->
    <aside v-if="showSidebar" class="sidebar">
      <div style="font-weight:bold;margin-bottom:8px;">文件夹</div>
      <div class="toolbar-left" style="margin-bottom:8px;">
        <input placeholder="输入名称" v-model="newFolderName" />
        <button class="btn-secondary" @click="addFolder">添加</button>
      </div>
      <div class="folder-list">
        <button class="btn-secondary" :class="{ active: currentFolderId === null }"
          @click="setCurrentFolder(null)">全部</button>
        <button class="btn-secondary" v-for="f in folders" :key="f.id" :class="{ active: currentFolderId === f.id }"
          @click="setCurrentFolder(f.id)">{{ f.name }}</button>
      </div>
    </aside>

    <!-- 右侧内容区 -->
    <main class="main">
      <!-- 顶部工具栏：左操作 + 右排序/导入导出 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <button @click="addMemo">新增备忘</button>
          <button class="btn-secondary" @click="manageMode = !manageMode">{{ manageMode ? '退出管理' : '管理' }}</button>
          <button class="btn-secondary" @click="showSidebar = !showSidebar">{{ showSidebar ? '隐藏边栏' : '显示边栏' }}</button>
        </div>
        <div class="toolbar-right">
          <button class="btn-secondary" @click="setSortBy('time')">
            时间排序
            <span v-if="sortKey === 'time'">
              {{ sortDirection === 'asc' ? '▲' : '▼' }}
            </span>
          </button>
          <button class="btn-secondary" @click="setSortBy('status')">
            完成状态
            <span v-if="sortKey === 'status'">
              {{ sortDirection === 'asc' ? '▲' : '▼' }}
            </span>
          </button>
          <input ref="fileInputRef" type="file" accept=".csv" style="display:none" @change="onImportFileChange" />
        </div>
      </div>

      <!-- 管理工具栏（管理模式下显示） -->
      <div v-if="manageMode" class="toolbar">
        <label style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" :checked="isAllSelected"
            @change="toggleSelectAll(($event.target as HTMLInputElement).checked)" />
          全选当前列表
        </label>
        <button @click="bulkDeleteSelected" :disabled="selectedIds.length === 0">删除选中</button>
        <button @click="exportCsv">导出CSV</button>
        <button class="btn-secondary" @click="triggerImport">导入CSV</button>
        <select v-model.number="moveTargetFolderId">
          <option v-for="f in folders" :key="f.id" :value="f.id">{{ f.name }}</option>
        </select>
        <button @click="bulkMoveSelected"
          :disabled="selectedIds.length === 0 || moveTargetFolderId == null">移动到文件夹</button>
      </div>

      <!-- 列表行 -->
      <div v-for="item in sortedList" :key="item.id" class="list-row">
        <input v-if="manageMode" type="checkbox" :checked="selectedIds.includes(item.id)"
          @change="toggleSelect(item.id, ($event.target as HTMLInputElement).checked)" />
        <div style="flex:1;">
          <MemoItem :item="item" @update="updateContent" @toggle="toggleComplete" />
        </div>
      </div>
    </main>
  </div>
</template>
