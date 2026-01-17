<script setup lang="ts">
import type { FolderType, MemoItemType, MemoPriority } from '../Memo/memo';
import { glb, save_db_memos, save_db_config } from '../Memo/memo';
import { ref, computed, reactive, nextTick } from 'vue';
import { useConfirm } from '../confirm/confirm';
import { promptInput } from '../confirm/prompt';
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

function getNextFolderOrder() {
  const maxOrder = glb.folders.reduce((max, f) => Math.max(max, f.order), -1);
  return maxOrder + 1;
}
const memoRefs = new Map<number, any>();
const addFolder = () => {
  const name = state.newFolderName.trim();
  if (glb.folders.find(f => f.name === name)) {
    useConfirm(`文件夹 ${name} 已存在`, false);
    return;
  }
  if (!name) return;

  const temp = { order: getNextFolderOrder(), name }
  glb.folders.push(temp);
  glb.currFolder = temp;
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
  const item: MemoItemType = {
    id: getNextMemoId(),
    content: '',
    createdAt: new Date(),
    completed: false,
    completedAt: null,
    folderName: glb.currFolder.name,
    priority: 'medium',
    firstCompletedAt: null,
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
  const now = new Date();
  item.completed = checked;
  if (checked) {
    if (!item.firstCompletedAt) {
      item.firstCompletedAt = now;
    }
    item.completedAt = now;
  } else {
    item.completedAt = null;
  }
  save_db_memos();
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
const fixedCompDown = ref<boolean>(glb.fixedCompDown);

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

const setPriorityFilter = (p: 'all' | MemoPriority) => {
  glb.priorityFilter = p;
  save_db_config();
};

const setDateFilter = (v: 'all' | 'day' | 'week' | 'month' | 'year') => {
  glb.dateFilter = v;
  if (v === 'all') {
    glb.dateFilterBaseTime = null;
  } else if (!glb.dateFilterBaseTime) {
    glb.dateFilterBaseTime = Date.now();
  }
  save_db_config();
};

const setStatusFilter = (v: 'all' | 'completed' | 'uncompleted') => {
  glb.statusFilter = v;
  save_db_config();
};

const formatDateInputValue = (time: number | null) => {
  if (!time) return '';
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const dateFilterBaseDateStr = computed(() => formatDateInputValue(glb.dateFilterBaseTime));

const onDateFilterBaseChange = (value: string) => {
  if (!value) {
    glb.dateFilterBaseTime = null;
  } else {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      glb.dateFilterBaseTime = d.getTime();
    }
  }
  save_db_config();
};

const sortedList = computed(() => {
  const base = glb.dateFilterBaseTime ? new Date(glb.dateFilterBaseTime) : new Date();
  const startOfToday = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const startOfNextDay = new Date(startOfToday);
  startOfNextDay.setDate(startOfNextDay.getDate() + 1);

  const startOfYear = new Date(base.getFullYear(), 0, 1);
  const startOfNextYear = new Date(base.getFullYear() + 1, 0, 1);

  const startOfMonth = new Date(base.getFullYear(), base.getMonth(), 1);
  const startOfNextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);

  const day = startOfToday.getDay() || 7;
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - (day - 1));
  const startOfNextWeek = new Date(startOfWeek);
  startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);

  const matchDate = (m: MemoItemType) => {
    if (glb.dateFilter === 'all') return true;
    const d = m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt);
    if (glb.dateFilter === 'day') {
      return d >= startOfToday && d < startOfNextDay;
    }
    if (glb.dateFilter === 'week') {
      return d >= startOfWeek && d < startOfNextWeek;
    }
    if (glb.dateFilter === 'month') {
      return d >= startOfMonth && d < startOfNextMonth;
    }
    if (glb.dateFilter === 'year') {
      return d >= startOfYear && d < startOfNextYear;
    }
    return true;
  };

  const matchStatus = (m: MemoItemType) => {
    if (glb.statusFilter === 'all') return true;
    if (glb.statusFilter === 'completed') return m.completed;
    if (glb.statusFilter === 'uncompleted') return !m.completed;
    return true;
  };

  const arr = glb.memoList
    .filter(m => {
      const folderOk = glb.currFolder == null || m.folderName === glb.currFolder.name;
      const priorityOk = glb.priorityFilter === 'all' || m.priority === glb.priorityFilter;
      const dateOk = matchDate(m);
      const statusOk = matchStatus(m);
      return folderOk && priorityOk && dateOk && statusOk;
    })
    .slice();

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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function escapeCsv(str: string | number | boolean): string {
  const s = String(str ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const toCsvRow = (m: MemoItemType) => {
  const created = formatDateCN(m.createdAt);
  const createdNum = m.createdAt ? +new Date(m.createdAt) : '';

  const completedAt = m.completedAt ? formatDateCN(m.completedAt) : '';
  const completedNum = m.completedAt ? +new Date(m.completedAt) : '';

  const firstCompletedAt = m.firstCompletedAt ? formatDateCN(m.firstCompletedAt) : '';
  const firstCompletedNum = m.firstCompletedAt ? +new Date(m.firstCompletedAt) : '';

  const folderName = escapeCsv(m.folderName);

  return [
    m.id,
    escapeCsv(m.content),
    created,
    m.completed,
    completedAt,
    firstCompletedAt,
    folderName,
    m.priority ?? 'medium',
    createdNum,
    firstCompletedNum,
    completedNum,
  ].join(',');
};

const exportCsv = async () => {
  if (glb.memoList.length === 0) {
    window.alert('没有数据可导出');
    return;
  }
  const header = 'id,content,createdAt,completed,completedAt,firstCompletedAt,folderName,priority,createdNum,firstCompletedNum,completedNum';
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
  const iCreated = idx('createdAt') !== -1 ? idx('createdAt') : idx('created');
  const iCompleted = idx('completed');
  const iCompletedAt = idx('completedAt');
  const iFirstCompletedAt = idx('firstCompletedAt');
  const iFolderName = idx('folderName') !== -1 ? idx('folderName') : idx('folderId');
  const iPriority = idx('priority');

  const incoming: MemoItemType[] = [];

  for (let k = 1; k < lines.length; k++) {
    const cols = parseCsv(lines[k])[0];
    if (!cols || cols.length < header.length) continue;

    const idStr = iId >= 0 ? cols[iId] : '';
    const content = iContent >= 0 ? (cols[iContent] ?? '') : '';
    const createdAt = iCreated >= 0 && cols[iCreated] ? new Date(cols[iCreated]) : new Date();
    const completed = iCompleted >= 0 ? String(cols[iCompleted]).toLowerCase() === 'true' : false;
    const completedAt = iCompletedAt >= 0 && cols[iCompletedAt] ? new Date(cols[iCompletedAt]) : null;
    const firstCompletedAt =
      iFirstCompletedAt >= 0 && cols[iFirstCompletedAt]
        ? new Date(cols[iFirstCompletedAt])
        : completedAt;

    const folderName =
      iFolderName >= 0 ? (cols[iFolderName] || '').trim() : (glb.currFolder?.name ?? '默认');
    const rawPriority = iPriority >= 0 ? (cols[iPriority] || '').trim() : '';
    const priority: MemoPriority =
      rawPriority === 'high' || rawPriority === 'medium' || rawPriority === 'low'
        ? rawPriority
        : 'medium';
    const idParsed = Number(idStr);
    const id = Number.isFinite(idParsed) ? idParsed : NaN;

    incoming.push({ id, content, createdAt, completed, completedAt, folderName, priority, firstCompletedAt });
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

const triggerImport = () => {
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

const deleteFolder = async (folder: FolderType) => {
  // 1. 先确认是否删除文件夹
  const confirmDeleteFolder = await useConfirm(`是否删除文件夹 ${folder.name}？`);
  if (!confirmDeleteFolder) return;

  // 2. 检查该文件夹下是否有备忘项
  const memosInFolder = glb.memoList.filter(m => m.folderName === folder.name);
  if (memosInFolder.length > 0) {
    const confirmDeleteMemos = await useConfirm(
      `文件夹 ${folder.name} 中仍有 ${memosInFolder.length} 个项目。\n是否删除这些项目？`
    );
    if (!confirmDeleteMemos) return;

    // 删除文件夹内的所有备忘项
    glb.memoList = glb.memoList.filter(m => m.folderName !== folder.name);
  }

  // 3. 删除文件夹本身
  glb.folders = glb.folders.filter(f => f !== folder);

  // 4. 如果当前选中的文件夹被删除，清空选中
  if (glb.currFolder === folder) glb.currFolder = null;

  // 5. 保存数据库
  save_db_memos();
};

const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  folder: null
});
function showContextMenu(event, folder) {
  contextMenu.visible = true;
  contextMenu.x = event.clientX;
  contextMenu.y = event.clientY;
  contextMenu.folder = folder;
}

function hideContextMenu() {
  contextMenu.visible = false;
}

async function renameFolder(folder: FolderType) {
  const newName = await promptInput(`重命名文件夹 ${folder.name}`, folder.name);

  if (!newName) return;

  if (glb.folders.some(f => f.name === newName)) {
    await useConfirm(`文件夹名称 ${newName} 已存在`, false);
    renameFolder(folder);
    return;
  }

  // 更新所有关联的备忘项文件夹名称
  glb.memoList.forEach(m => {
    if (m.folderName === folder.name) {
      m.folderName = newName;
    }
  });

  folder.name = newName;
  save_db_memos();
}

const updatePriority = (id: number, priority: MemoPriority) => {
  const item = glb.memoList.find(m => m.id === id);
  if (!item) return;
  item.priority = priority;
  save_db_memos();
};

// function deleteFolder(folder) {
//   if (confirm(`确定删除 ${folder.name} 吗？`)) {
//     glb.folders = glb.folders.filter(f => f !== folder);
//     if (glb.currFolder === folder) glb.currFolder = null;
//   }
//   hideContextMenu();
// }

// 点击空白处隐藏菜单
document.addEventListener('click', hideContextMenu);

</script>

<template>
  <!-- 主布局容器 -->
  <div class="container">

    <!-- 左侧文件夹栏 -->
    <aside v-if="state.showSidebar" class="sidebar">

      <div style="font-weight:bold;margin-bottom:8px;">文件夹</div>

      <div class="toolbar-left" style="margin-bottom:8px;">
        <input placeholder="新文件夹名称" v-model="state.newFolderName" />
      </div>
      <button class="full-btn" @click="addFolder">添加文件夹</button>

      <div class="folder-list">
        <button class="btn-secondary" :class="{ active: glb.currFolder === null }" @click="setCurrentFolder(null)">
          全部
        </button>

        <button class="btn-secondary" v-for="f in glb.folders" :key="f.order" :class="{ active: glb.currFolder === f }"
          @click="setCurrentFolder(f)" @contextmenu.prevent="showContextMenu($event, f)">
          {{ f.name }}
        </button>
      </div>

      <div style="margin-top:16px;">
        <div style="font-weight:bold;margin-bottom:6px;">优先级筛选</div>
        <div class="toolbar-left">
          <button class="btn-secondary" :class="{ active: glb.priorityFilter === 'all' }"
            @click="setPriorityFilter('all')">
            全部
          </button>
          <button class="btn-secondary" :class="{ active: glb.priorityFilter === 'high' }"
            @click="setPriorityFilter('high')">
            高
          </button>
          <button class="btn-secondary" :class="{ active: glb.priorityFilter === 'medium' }"
            @click="setPriorityFilter('medium')">
            中
          </button>
          <button class="btn-secondary" :class="{ active: glb.priorityFilter === 'low' }"
            @click="setPriorityFilter('low')">
            低
          </button>
        </div>
      </div>

      <div style="margin-top:16px;">
        <div style="font-weight:bold;margin-bottom:6px;">时间分组</div>
        
        <div class="toolbar-left">
          <button class="btn-secondary" :class="{ active: glb.dateFilter === 'all' }" @click="setDateFilter('all')">
            全部
          </button>
          <button class="btn-secondary" :class="{ active: glb.dateFilter === 'day' }" @click="setDateFilter('day')">
            按日
          </button>
          <button class="btn-secondary" :class="{ active: glb.dateFilter === 'week' }" @click="setDateFilter('week')">
            按周
          </button>
          <button class="btn-secondary" :class="{ active: glb.dateFilter === 'month' }" @click="setDateFilter('month')">
            按月
          </button>
          <button class="btn-secondary" :class="{ active: glb.dateFilter === 'year' }" @click="setDateFilter('year')">
            按年
          </button>
        </div>
        
        <div v-if="glb.dateFilter !== 'all'" style="margin-top:8px;">
          <div class="toolbar-left">
            <span style="font-size:12px;margin-right:4px;">
              {{
                glb.dateFilter === 'day' ? '选择某一天'
                  : glb.dateFilter === 'week' ? '选择某一周中的任意一天'
                    : glb.dateFilter === 'month' ? '选择某一月中的任意一天'
                      : '选择某一年中的任意一天'
              }}
            </span>
            <input type="date" :value="dateFilterBaseDateStr"
              @change="onDateFilterBaseChange(($event.target as HTMLInputElement).value)" />
          </div>
        </div>

      </div>

      <div style="margin-top:16px;">
        <div style="font-weight:bold;margin-bottom:6px;">完成状态筛选</div>
        <div class="toolbar-left">
          <button class="btn-secondary" :class="{ active: glb.statusFilter === 'all' }" @click="setStatusFilter('all')">
            全部
          </button>
          <button class="btn-secondary" :class="{ active: glb.statusFilter === 'completed' }"
            @click="setStatusFilter('completed')">
            已完成
          </button>
          <button class="btn-secondary" :class="{ active: glb.statusFilter === 'uncompleted' }"
            @click="setStatusFilter('uncompleted')">
            未完成
          </button>
        </div>
      </div>

      <!-- 自定义右键菜单 -->
      <div v-if="contextMenu.visible" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
        class="context-menu" @click="hideContextMenu">
        <div class="context-menu-item" @click.stop="renameFolder(contextMenu.folder)">重命名</div>
        <div class="context-menu-item" @click.stop="deleteFolder(contextMenu.folder)">删除</div>
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
          <!-- <button class="btn-secondary" @click="state.showSidebar = !state.showSidebar">
            {{ state.showSidebar ? '隐藏边栏' : '显示边栏' }}
          </button>         -->
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

      <div v-for="item in sortedList" :key="item.id" class="list-row">
        <input v-if="state.manageMode" class="cb-manage" type="checkbox" :checked="state.selectedIds.includes(item.id)"
          @change="toggleSelect(item.id, ($event.target as HTMLInputElement).checked)" />
        <div style="flex:1;">
          <MemoItem :item="item" @update="updateContent" @delete="deleteMemo" @toggle="setCompleted"
            @updatePriority="updatePriority" :ref="el => memoRefs.set(item.id, el)" />
        </div>
      </div>
    </main>

  </div>
</template>
