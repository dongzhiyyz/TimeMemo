import dayjs, { type Dayjs } from 'dayjs';
import { reactive } from 'vue';

const DOC_MEMOS_ID: string = 'time_memo_1';
const DOC_MEMOS_INDEX_ID: string = 'time_memo_chunks_index';
const DOC_CHUNK_PREFIX: string = 'time_memo_';
const MAX_DOC_BYTES = 950 * 1024;
const DOC_CONFIG_ID: string = 'time_memo_config';

export type MemoPriority = 'high' | 'medium' | 'low';

export interface FolderType {
  order: number;
  name: string;
}

export interface MemoItemType {
  id: number;
  content: string;
  createdAt: Dayjs;
  completed: boolean;
  completedAt?: Dayjs | null;
  folderName: string;
  priority: MemoPriority;
  firstCompletedAt?: Dayjs | null;
}

export interface MemoItemSaveType {
  id: number;
  content: string;
  createdAt: number;
  completed: boolean;
  completedAt?: number | null;
  folderName: string;
  priority?: MemoPriority;
  firstCompletedAt?: number | null;
}
export interface GlobalVal {
  memoList: MemoItemType[];

  currFolder: FolderType;
  folders: FolderType[];
  sortKey: 'status' | 'time';
  sortDirection: 'asc' | 'desc';
  fixedCompDown: boolean;
  priorityFilter: 'all' | MemoPriority;
  dateFilter: 'all' | 'day' | 'week' | 'month' | 'year';
  statusFilter: 'all' | 'completed' | 'uncompleted';
  dateFilterBaseTime: number | null;
}

export interface DocConfig {
  sortKey: 'status' | 'time';     // 排序键
  sortDirection: 'asc' | 'desc';  // 排序方向
  fixedCompDown: boolean;         // 固定完成项在底部
  priorityFilter?: 'all' | MemoPriority;
  dateFilter?: 'all' | 'day' | 'week' | 'month' | 'year';
  statusFilter?: 'all' | 'completed' | 'uncompleted';
  dateFilterBaseTime?: number | null;
}
export interface DocMemos {
  memos: MemoItemSaveType[];
  currFolder: FolderType | null;  // 当前文件夹
  folders: FolderType[];          // 文件夹列表
}
interface DocIndex {
  ids: string[];
}

// export function throttle<T extends (...args: any[]) => any>(fn: T, interval = 500) {
//   let lastExec = 0;

//   const throttled = (...args: Parameters<T>) => {
//     const now = Date.now();
//     const force = (args[0] as any)?.force ?? false; // 可选：通过参数传 force
//     if (force || now - lastExec >= interval) {
//       fn(...args);    // 执行函数
//       lastExec = now;
//     }
//   };

//   // 强制保存方法
//   throttled.force = (...args: Parameters<T>) => {
//     fn(...args);
//     lastExec = Date.now();
//   };

//   return throttled;
// }

/**
 * 转换 MemoItemSaveType 数组为 MemoItemType 数组
 * @param arr - 输入的 MemoItemSaveType 数组
 * @returns 转换后的 MemoItemType 数组
 */
function type_change(arr: MemoItemSaveType[]): MemoItemType[] {
  return arr.map(it => ({
    ...it,
    createdAt: dayjs(it.createdAt),
    completedAt: it.completedAt ? dayjs(it.completedAt) : null,
    priority: it.priority ?? 'medium',
    firstCompletedAt: it.firstCompletedAt
      ? dayjs(it.firstCompletedAt)
      : it.completedAt
        ? dayjs(it.completedAt)
        : null,
  }))
}

export function save_db_memos() {
  if (!doc_memos) return;

  const allMemos = glb.memoList.map(item => ({
    id: item.id,
    content: item.content,
    createdAt: item.createdAt ? item.createdAt.valueOf() : 0,
    completed: item.completed,
    completedAt: item.completedAt ? item.completedAt.valueOf() : null,
    folderName: item.folderName,
    priority: item.priority ?? 'medium',
    firstCompletedAt: item.firstCompletedAt ? item.firstCompletedAt.valueOf() : null,
  }));

  // 文件夹列表 -> 浅拷贝成普通对象数组
  const foldersCopy = glb.folders.map(f => ({
    ...f
  }));

  // 当前选中文件夹 -> 保存普通对象，避免 Proxy
  const currFolderCopy = glb.currFolder ?
    {
      ...glb.currFolder
    }
    : null;

  const idxDoc: DbDoc<DocIndex> | null = utools.db.get(DOC_MEMOS_INDEX_ID);
  const buildSize = (obj: any) => {
    try {
      return new TextEncoder().encode(JSON.stringify(obj)).length;
    } catch {
      const s = JSON.stringify(obj);
      return s.length;
    }
  };

  const singleDocCandidate: DbDoc<DocMemos> = {
    _id: DOC_MEMOS_ID,
    memos: allMemos,
    currFolder: currFolderCopy,
    folders: foldersCopy,
  };

  const needChunk = buildSize(singleDocCandidate) > MAX_DOC_BYTES || !!idxDoc;

  if (!needChunk) {
    doc_memos.memos = allMemos;
    doc_memos.folders = foldersCopy;
    doc_memos.currFolder = currFolderCopy;
    try {
      const result = utools.db.put(doc_memos);
      if (result?.ok) doc_memos._rev = result.rev;
    } catch (err) {
      console.error('保存备忘数据失败', err);
    }
    return;
  }

  const chunkDocs: DbDoc<DocMemos>[] = [];
  let currentChunk: MemoItemSaveType[] = [];
  const ids: string[] = [];
  const pushChunk = (index: number) => {
    const id = `${DOC_CHUNK_PREFIX}${index}`;
    const doc: DbDoc<DocMemos> = {
      _id: id,
      memos: currentChunk.slice(),
      currFolder: index === 1 ? currFolderCopy : null,
      folders: index === 1 ? foldersCopy : [],
    };
    chunkDocs.push(doc);
    ids.push(id);
    currentChunk = [];
  };

  let index = 1;
  for (let i = 0; i < allMemos.length; i++) {
    currentChunk.push(allMemos[i]);
    const testDoc: DbDoc<DocMemos> = {
      _id: `${DOC_CHUNK_PREFIX}${index}`,
      memos: currentChunk,
      currFolder: index === 1 ? currFolderCopy : null,
      folders: index === 1 ? foldersCopy : [],
    };
    if (buildSize(testDoc) > MAX_DOC_BYTES) {
      if (currentChunk.length === 1) {
        pushChunk(index);
        index++;
      } else {
        currentChunk.pop();
        pushChunk(index);
        index++;
        currentChunk.push(allMemos[i]);
      }
    }
  }
  if (currentChunk.length > 0) {
    pushChunk(index);
  }

  for (let d of chunkDocs) {
    const res = utools.db.put(d);
    if (d._id === DOC_MEMOS_ID && res?.ok) {
      d._rev = res.rev;
      doc_memos = d;
    }
  }

  const newIdxDoc: DbDoc<DocIndex> = {
    _id: DOC_MEMOS_INDEX_ID,
    ids,
  };
  const idxRes = utools.db.put(newIdxDoc);
  if (idxRes?.ok) newIdxDoc._rev = idxRes.rev;
}


/**
 * 保存所有config到数据库
 */
export function save_db_config() {
  if (!doc_config) return;

  doc_config.sortKey = glb.sortKey;
  doc_config.sortDirection = glb.sortDirection;
  doc_config.fixedCompDown = glb.fixedCompDown;
  doc_config.priorityFilter = glb.priorityFilter;
  doc_config.dateFilter = glb.dateFilter;
  doc_config.statusFilter = glb.statusFilter;
  doc_config.dateFilterBaseTime = glb.dateFilterBaseTime;

  const result = utools.db.put(doc_config);
  if (result?.ok)
    doc_config._rev = result.rev;
}

function loadDbMemos() {
  const idx: DbDoc<DocIndex> | null = utools.db.get(DOC_MEMOS_INDEX_ID);
  if (idx && Array.isArray(idx.ids) && idx.ids.length > 0) {
    let allMemos: MemoItemType[] = [];
    let folders: FolderType[] = [];
    let currFolder: FolderType | null = null;
    for (let i = 0; i < idx.ids.length; i++) {
      const id = idx.ids[i];
      const d: DbDoc<DocMemos> | null = utools.db.get(id);
      if (!d) continue;
      if (i === 0) {
        doc_memos = d;
        folders = Array.isArray(d.folders) ? [...d.folders] : [];
        currFolder = d.currFolder && typeof d.currFolder === 'object' ? d.currFolder : null;
      }
      const part = Array.isArray(d.memos) ? type_change(d.memos) : [];
      allMemos = allMemos.concat(part);
    }

    allMemos.forEach(it => { if (!it.folderName) { it.folderName = '默认' } });
    const memoFolderSet = new Set<string>(allMemos.map(it => it.folderName));
    const folderNameSet = new Set<string>(folders.map(it => it.name));
    let nextOrder = folders.length > 0 ? Math.max(...folders.map(it => it.order)) + 1 : 0;
    const newFolders: FolderType[] = [];
    memoFolderSet.forEach(name => {
      if (!folderNameSet.has(name)) {
        newFolders.push({
          order: nextOrder++,
          name
        });
      }
    });
    folders.push(...newFolders);
    folders.forEach(f => {
      if (!f.order) {
        f.order = nextOrder++;
      }
    });
    const validCurrFolder = folders.find(f => f.name === currFolder?.name) ?? folders[0] ?? null;
    glb.memoList = allMemos.slice();
    glb.folders = folders.slice();
    glb.currFolder = validCurrFolder;
    return;
  }

  const doc: DbDoc<DocMemos> | null = utools.db.get(DOC_MEMOS_ID);

  if (doc) {
    doc_memos = doc;

    // ===== 取原始数据 =====
    const rawMemos: MemoItemType[] = Array.isArray(doc.memos) ? type_change(doc.memos) : [];
    const rawFolders: FolderType[] = Array.isArray(doc.folders) ? [...doc.folders] : [];
    const rawCurrFolder: FolderType | null = doc.currFolder && typeof doc.currFolder === 'object' ? doc.currFolder : null;

    // ===== memo：补默认文件夹 =====
    rawMemos.forEach(it => { if (!it.folderName) { it.folderName = '默认' } });

    // ===== memo 中实际使用的 folderName =====
    const memoFolderSet = new Set<string>(rawMemos.map(it => it.folderName));

    // ===== 已存在的 folders 名称 =====
    const folderNameSet = new Set<string>(rawFolders.map(it => it.name));

    // ===== 安全生成起始 id / order =====
    let nextOrder = rawFolders.length > 0 ? Math.max(...rawFolders.map(it => it.order)) + 1 : 0;
    console.log('nextOrder', nextOrder);

    // ===== 补缺失的 folder =====
    const newFolders: FolderType[] = [];
    memoFolderSet.forEach(name => {
      if (!folderNameSet.has(name)) {
        newFolders.push({
          order: nextOrder++,
          name
        });
      }
    });

    rawFolders.push(...newFolders);

    // 查找没有order的文件夹，给它分配一个order
    rawFolders.forEach(f => {
      if (!f.order) {
        f.order = nextOrder++;
      }
    });

    // ===== 修正 currFolder（防幽灵） =====
    const validCurrFolder = rawFolders.find(f => f.name === rawCurrFolder?.name) ?? rawFolders[0] ?? null;

    // ===== 写入全局状态 =====
    glb.memoList = rawMemos.slice();
    glb.folders = rawFolders.slice();
    glb.currFolder = validCurrFolder;

  } else {
    // ===== 首次初始化 DB =====
    const newDoc: DbDoc<DocMemos> = {
      _id: DOC_MEMOS_ID,
      memos: [],
      currFolder: { name: '默认', order: 0 },
      folders: [{ name: '默认', order: 0 }],
    };

    glb.memoList = [];
    glb.folders = newDoc.folders.slice();
    glb.currFolder = newDoc.currFolder;

    const result = utools.db.put(newDoc);
    if (result.ok) {
      newDoc._rev = result.rev;
      doc_memos = newDoc;
    }
  }
}

function loadDbConfig() {
  const doc: DbDoc<DocConfig> | null = utools.db.get(DOC_CONFIG_ID);
  if (doc) {
    doc_config = doc;
  } else {
    const newDoc: DbDoc<DocConfig> = {
      _id: DOC_CONFIG_ID,
      sortKey: 'status',
      sortDirection: 'asc',
      fixedCompDown: false, // 固定完成项在底部
      priorityFilter: 'all',
      dateFilter: 'all',
      statusFilter: 'all',
      dateFilterBaseTime: null,
    };
    const result = utools.db.put(newDoc);
    if (result.ok) {
      newDoc._rev = result.rev;
      doc_config = newDoc;
    }
  }

  glb.sortKey = doc_config.sortKey;
  glb.sortDirection = doc_config.sortDirection;
  glb.fixedCompDown = doc_config.fixedCompDown;
  glb.priorityFilter = doc_config.priorityFilter ?? 'all';
  glb.dateFilter = doc_config.dateFilter ?? 'all';
  glb.statusFilter = doc_config.statusFilter ?? 'all';
  glb.dateFilterBaseTime = doc_config.dateFilterBaseTime ?? null;
}

// function watchGlb() {
//   watch(glb, () => {
//     save_db_memos();
//   }, { deep: true });
// }

let doc_memos: DbDoc<DocMemos> | null = null;
let doc_config: DbDoc<DocConfig> | null = null;
export const glb = reactive<GlobalVal>
  ({
    memoList: [],
    currFolder: { name: '默认', order: 0 },
    folders: [{ name: '默认', order: 0 }],
    sortKey: 'status',
    sortDirection: 'asc',
    fixedCompDown: false,
    priorityFilter: 'all',
    dateFilter: 'all',
    statusFilter: 'all',
    dateFilterBaseTime: null,
  });

loadDbMemos();
loadDbConfig();
// watchGlb();

// 自动保存
// let timer: number | null = null;
// export function startAutoSave() {
//   if (timer !== null) return;

//   timer = window.setInterval(() => {
//     saveToDbSnapshot();
//   }, 800); // 500~1000ms 都可以
// }
// startAutoSave();
