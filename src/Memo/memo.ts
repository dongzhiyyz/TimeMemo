import { toRaw, watch, reactive } from 'vue';

const DOC_ID_OLD: string = 'time_memo_1';
const DOC_MEMOS_ID: string = 'time_memo_1';
const DOC_CONFIG_ID: string = 'time_memo_config';

export interface FolderType {
  order: number;
  name: string;
};
export interface MemoItemType {
  id: number;                   // 唯一标识符
  content: string;              // 备忘内容
  createdAt: Date;              // 创建时间
  completed: boolean;           // 是否完成
  completedAt?: Date | null;    // 完成时间
  folderName: string;           // 所属文件夹名称
}
export interface MemoItemSaveType {
  id: number;
  content: string;
  createdAt: number;
  completed: boolean;
  completedAt?: number | null;
  folderName: string;
}
export interface GlobalVal {
  memoList: MemoItemType[];

  currFolder: FolderType;
  folders: FolderType[];
  sortKey: 'status' | 'time';
  sortDirection: 'asc' | 'desc';
  fixedCompDown: boolean;
}

export interface DocConfig {
  sortKey: 'status' | 'time';     // 排序键
  sortDirection: 'asc' | 'desc';  // 排序方向
  fixedCompDown: boolean;         // 固定完成项在底部
}
export interface DocMemos {
  memos: MemoItemSaveType[];
  currFolder: FolderType | null;  // 当前文件夹
  folders: FolderType[];          // 文件夹列表
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
    createdAt: new Date(it.createdAt),
    completedAt: it.completedAt ? new Date(it.completedAt) : null,
  }))
}

/**
 * 保存所有memo到数据库
 */
export function save_db_memos() {
  if (!doc_memos) return;

  // 备忘列表 -> 只保留普通 JS 对象和原始值
  doc_memos.memos = glb.memoList.map(item => ({
    id: item.id,
    content: item.content,
    createdAt: item.createdAt instanceof Date ? item.createdAt.getTime() : item.createdAt,
    completed: item.completed,
    completedAt: item.completedAt instanceof Date ? item.completedAt.getTime() : item.completedAt ?? null,
    folderName: item.folderName
  }));

  // 文件夹列表 -> 浅拷贝成普通对象数组
  doc_memos.folders = glb.folders.map(f => ({
    ...f
  }));

  // 当前选中文件夹 -> 保存普通对象，避免 Proxy
  doc_memos.currFolder = glb.currFolder ?
    {
      ...glb.currFolder
    }
    : null;

  try {
    const result = utools.db.put(doc_memos);
    if (result?.ok) doc_memos._rev = result.rev;
  } catch (err) {
    console.error('保存备忘数据失败', err);
  }
}


/**
 * 保存所有config到数据库
 */
export function save_db_config() {
  if (!doc_config) return;

  doc_config.sortKey = glb.sortKey;
  doc_config.sortDirection = glb.sortDirection;
  doc_config.fixedCompDown = glb.fixedCompDown;

  const result = utools.db.put(doc_config);
  if (result?.ok)
    doc_config._rev = result.rev;
}

function loadDbMemos() {
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
