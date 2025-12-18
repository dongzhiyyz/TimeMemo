<script setup lang="ts">
import type { FolderType, MemoItemType } from '../Memo/memo';
import { glb, save_db_memos, save_db_config } from '../Memo/memo';
import { ref, computed, reactive, nextTick } from 'vue';
import { useConfirm } from '../confirm/confirm';
import MemoItem from './MemoItem.vue';
import Papa from 'papaparse';

// const fileInputRef = ref<HTMLInputElement | null>(null);// 文件输入引用（用于导入CSV）
interface GlobalState {
  selectedIds: number[];
  showSidebar: boolean;
  // fileInputRef: HTMLInputElement | null;
  newFolderName: string;
  // ---------- 管理模式与批量 ----------
  manageMode: boolean;
}

const state = reactive<GlobalState>({
  selectedIds: [],
  showSidebar: true,
  // fileInputRef: null,
  newFolderName: '',
  // ---------- 管理模式与批量 ----------
  manageMode: false,
});

const memoRefs = new Map<number, any>();

const addFolder = () => {
  const name = state.newFolderName.trim();
  if (!name) return;
  glb.folders.push({ order: glb.folders.length, name });
  glb.currFolder = { order: glb.folders.length, name };
  state.newFolderName = '';
};

const setCurrentFolder = (folder: FolderType | null) => {
  glb.currFolder = folder;
};

// 获取无重复 ID
const getNextMemoId = () => {
  const used = new Set(glb.memoList.map(m => m.id));
  let id = 1;
  while (used.has(id)) id++;
  return id;
};

// ---------- 新增 ----------
const addMemo = () => {
  const item:MemoItemType = {
    id: getNextMemoId(),
    content: '',
    createdAt: new Date(),
    completed: false,
    completedAt: null,
    folderName: glb.currFolder.name,
  }
  glb.memoList.push(item);
  nextTick(() => {
    const comp = memoRefs.get(item.id);
    comp?.inputRef?.focus?.();
  });
};

// ---------- 子组件更新 ----------
const updateContent = (id: number, content: string) => {
  if (content) {
    const item = glb.memoList.find(m => m.id === id);
    if (item) item.content = content;
  } else {
    glb.memoList = glb.memoList.filter(m => m.id !== id);
  }
  save_db_memos();
};

const deleteMemo = (id: number) => {
  useConfirm(`确定删除该备忘？`).then(ok => {
    if (!ok) return;

    glb.memoList = glb.memoList.filter(m => m.id !== id);
    save_db_memos();
  });
};

const setCompleted = (id: number, checked: boolean) => {
  const item = glb.memoList.find(m => m.id === id);
  if (!item) return;
  item.completed = checked;
  item.completedAt = checked ? new Date() : null;
};

const toggleSelect = (id: number, checked: boolean) => {
  const arr = state.selectedIds.slice();
  const i = arr.indexOf(id);
  if (checked && i === -1) arr.push(id);
  if (!checked && i !== -1) arr.splice(i, 1);
  state.selectedIds = arr;
};

const bulkDeleteSelected = () => {
  if (state.selectedIds.length === 0) return;
  useConfirm(`确定删除选中的 ${state.selectedIds.length} 条备忘？`).then(ok => {
    if (!ok) return;

    const ids = new Set(state.selectedIds);
    glb.memoList = glb.memoList.filter(m => !ids.has(m.id));
    state.selectedIds = [];
    save_db_memos();
  });
};

const moveTargetFolderName = ref<string | null>(glb.folders[0]?.name ?? null);
const bulkMoveSelected = () => {
  if (state.selectedIds.length === 0 || moveTargetFolderName.value == null) 
    return;
  
  const memoMap = new Map(glb.memoList.map(m => [m.id, m]));
  state.selectedIds.forEach(id => {
    memoMap.get(id)!.folderName = moveTargetFolderName.value!;
  });

  state.selectedIds = [];
  // save_db_memos();
};

// ---------- 排序 ----------
const sortKey = ref<'time' | 'status'>(glb.sortKey);
const sortDirection = ref<'asc' | 'desc'>(glb.sortDirection);
const fixedCompDown = ref<boolean>(glb.fixedCompDown); // 固定完成项在底部

function paramToConfig() {
  glb.sortKey = sortKey.value;
  glb.sortDirection = sortDirection.value;
  glb.fixedCompDown = fixedCompDown.value;
  save_db_config();
}

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
  const arr = glb.memoList.filter(m => {
    if (glb.currFolder == null) return true; // 全部
    return m.folderName === glb.currFolder.name;
  }).slice();

  if (sortKey.value === 'time') {
    // 按创建时间排序
    arr.sort((a, b) =>
      sortDirection.value === 'asc'
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : b.createdAt.getTime() - a.createdAt.getTime()
    );

    // 固定完成项在底部
    if (fixedCompDown.value) {
      arr.sort((a, b) => {
        const v1 = a.completed ? 1 : 0;
        const v2 = b.completed ? 1 : 0;
        return v1 - v2;
      });
    }
  } else if (sortKey.value === 'status') {
    // 按完成状态排序
    arr.sort((a, b) => {
      const v1 = a.completed ? 1 : 0;
      const v2 = b.completed ? 1 : 0;
      return sortDirection.value === 'asc' ? v1 - v2 : v2 - v1;
    });
  }
  paramToConfig();  
  save_db_memos();  
  return arr;
});

const allViewIds = computed(() => sortedList.value.map(m => m.id));
const isAllSelected = computed(() => allViewIds.value.length > 0 && allViewIds.value.every(id => state.selectedIds.includes(id)));
const toggleSelectAll = (checked: boolean) => {
  if (checked) {
    const set = new Set<number>([...state.selectedIds, ...allViewIds.value]);
    state.selectedIds = Array.from(set);
  } else {
    const removeSet = new Set<number>(allViewIds.value);
    state.selectedIds = state.selectedIds.filter(id => !removeSet.has(id));
  }
};

// ---------- CSV 导出/导入 ----------
function formatDateCN(date: Date | string | undefined | null): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function escapeCsv(str: string | number | boolean): string {
  const s = String(str ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const toCsvRow = (m: MemoItemType) => {
  const created = formatDateCN(m.createdAt); // 人眼可读
  const createdNum = m.createdAt ? +new Date(m.createdAt) : ''; // 时间戳

  const completedAt = m.completedAt ? formatDateCN(m.completedAt) : '';
  const completedNum = m.completedAt ? +new Date(m.completedAt) : '';

  const folderName = escapeCsv(m.folderName);

  return [
    m.id,
    escapeCsv(m.content),
    created,
    m.completed,
    completedAt,
    folderName,
    createdNum,
    completedNum,
  ].join(',');
};

const exportCsv = async () => {
  if (glb.memoList.length === 0) {
    window.alert('没有数据可导出');
    return;
  }
  const header = 'id,content,created,completed,completedAt,folderId,folderName,createdNum,completedNum,';
  const lines = [header, ...glb.memoList.map(toCsvRow)];
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
      // window.alert(`已导出到: ${filePath}`);
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

// const ensureFolderByName = (name: string) => {
//   const key = (name || '').trim();
//   if (!key) return glb.currFolder ?? (glb.folders[0] ?? null);
//   const existing = glb.folders.find(f => f.name === key);
//   if (existing) return existing;
//   const order = glb.folders.length;
//   glb.folders.push({ order, name: key });
//   return { order, name: key };
// };

const importCsvText = async (text: string) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length <= 1) return;

  const header = lines[0].split(',');
  const idx = (name: string) => header.indexOf(name);

  const iId = idx('id');
  const iContent = idx('content');
  const iCreated = idx('createdAt');
  const iCompleted = idx('completed');
  const iCompletedAt = idx('completedAt');
  const iFolderName = idx('folderName');

  const incoming: MemoItemType[] = [];

  for (let k = 1; k < lines.length; k++) {
    const cols = parseCsv(lines[k])[0];
    if (!cols || cols.length < header.length) continue;

    const idStr = cols[iId];
    const content = cols[iContent] ?? '';
    const createdAt = cols[iCreated] ? new Date(cols[iCreated]) : new Date();
    const completed = String(cols[iCompleted]).toLowerCase() === 'true';
    const completedAt = cols[iCompletedAt] ? new Date(cols[iCompletedAt]) : null;

    const folderName = (cols[iFolderName] || '').trim();
    const idParsed = Number(idStr);
    const id = Number.isFinite(idParsed) ? idParsed : NaN;

    incoming.push({ id, content, createdAt, completed, completedAt, folderName });
  }

  if (incoming.length === 0) return;

  const existingIds = new Set(glb.memoList.map(m => m.id));
  const duplicates = incoming.filter(m => Number.isFinite(m.id) && existingIds.has(m.id));

  // --- 有重复 ID ---
  if (duplicates.length > 0) {
    const keepAll = await useConfirm(
      `检测到 ${duplicates.length} 个重复ID。\n是否保留已有项并为导入项重新分配ID？`
    );

    if (keepAll) {
      duplicates.forEach(m => {
        m.id = getNextMemoId();
      });
    } else {
      const keepImport = await useConfirm(
        '是否保留导入项并覆盖已有项？\n确定：覆盖已有项\n取消：忽略这些重复导入'
      );

      if (keepImport) {
        // 覆盖已有项
        duplicates.forEach(m => {
          const idx = glb.memoList.findIndex(x => x.id === m.id);
          if (idx >= 0) {
            glb.memoList[idx] = { ...glb.memoList[idx], ...m };
          }
        });
      } else {
        // 忽略重复项
        incoming.splice(
          0,
          incoming.length,
          ...incoming.filter(m => !existingIds.has(m.id))
        );
      }
    }
  }

  // --- 插入非重复项 ---
  incoming.forEach(m => {
    const isValid = Number.isFinite(m.id) && !existingIds.has(m.id);
    const nid = isValid ? m.id : getNextMemoId();
    glb.memoList.push({ ...m, id: nid });
    existingIds.add(nid);
  });

  save_db_memos();
};

const triggerImport = () =>{
 const filePaths = utools.showOpenDialog({
    title: '请选择要导入的CSV文件',
    defaultPath: '',
    buttonLabel: '导入',
    filters: [
      { name: 'CSV 文件', extensions: ['csv'] }
    ],
    properties: ['openFile']
  });
  
  if (!filePaths) return;
  
  const text = window.services.readFile(filePaths[0]);
  importCsvText(text);

  //  fileInputRef.value?.click()
};

// const onImportFileChange = (e: Event) => {
//   const input = e.target as HTMLInputElement;
//   const file = input.files?.[0];
//   if (!file) return;
  
//   const reader = new FileReader();
//   reader.onload = () => {
//     const text = String(reader.result || '');
//     importCsvText(text);
//     input.value = '';
//   };
//   reader.readAsText(file, 'utf-8');
// };

</script>


<template>
  <!-- 主布局容器 -->
  <div class="container">
    <!-- 左侧文件夹栏 -->
    <aside v-if="state.showSidebar" class="sidebar">
      <div style="font-weight:bold;margin-bottom:8px;">文件夹</div>
      <div class="toolbar-left" style="margin-bottom:8px;">
        <input placeholder="输入名称" v-model="state.newFolderName" />
        <button class="btn-secondary" @click="addFolder">添加</button>
      </div>

      <div class="folder-list">
        <button class="btn-secondary" :class="{ active: glb.currFolder === null }"
          @click="setCurrentFolder(null)">全部</button>
        <button class="btn-secondary" v-for="f in glb.folders" :key="f.order"
          :class="{ active: glb.currFolder === f }" @click="setCurrentFolder(f)">{{ f.name }}</button>
      </div>

    </aside>

    <!-- 右侧内容区 -->
    <main class="main">
      <!-- 顶部工具栏：左操作 + 右排序/导入导出 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <button @click="addMemo">新增备忘</button>
          <button class="btn-secondary" @click="state.manageMode = !state.manageMode">
            {{ state.manageMode ? '退出管理' : '管理' }}
          </button>
          <button class="btn-secondary" @click="state.showSidebar = !state.showSidebar">
            {{ state.showSidebar ? '隐藏边栏' : '显示边栏' }}
          </button>
        </div>
        <div class="toolbar-right">
          <label style="display:flex;align-items:center;gap:6px;">
            <input type="checkbox" v-model="fixedCompDown" />
            固定完成项在底部
          </label>
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
        </div>
      </div>

      <!-- 管理工具栏（管理模式下显示） -->
      <div v-if="state.manageMode" class="toolbar">
        <label style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" :checked="isAllSelected"
            @change="toggleSelectAll(($event.target as HTMLInputElement).checked)" />
          全选当前列表
        </label>

        <button @click="bulkDeleteSelected" :disabled="state.selectedIds.length === 0">删除选中</button>

        <div class="spacer"></div>
        <button @click="exportCsv">导出CSV</button>
        <button @click="triggerImport">导入CSV</button>
        <div class="spacer"></div>

        <button @click="bulkMoveSelected" :disabled="state.selectedIds.length === 0 || moveTargetFolderName == null">
          移动到文件夹
        </button>

        <select v-model="moveTargetFolderName">
          <option v-for="f in glb.folders" :key="f.order" :value="f.name">{{ f.name }}</option>
        </select>

      </div>

      <!-- 列表行 -->
      <div v-for="item in sortedList" :key="item.id" class="list-row">
        <input
          v-if="state.manageMode"
          class="cb-manage"
          type="checkbox"
          :checked="state.selectedIds.includes(item.id)"
          @change="toggleSelect(item.id, ($event.target as HTMLInputElement).checked)"
        />
        <input
          v-else
          class="cb-complete"
          type="checkbox"
          :checked="item.completed"
          @change="setCompleted(item.id, ($event.target as HTMLInputElement).checked)"
        />
        <div style="flex:1;">
          <MemoItem :item="item" @update="updateContent" @delete="deleteMemo" :ref="el => memoRefs.set(item.id, el)" />
        </div>
      </div>
    </main>
  </div>
</template>
