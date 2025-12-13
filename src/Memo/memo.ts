import { ref, Ref, toRaw, watch, reactive } from 'vue';

const DOC_ID: string = 'time_memo_1';

export interface Folder {
  id: number;
  name: string
};
export interface DocData {
  memos: MemoItemType[];
  currFolderId: number;
  folders: Folder[];
}
export interface MemoItemType {
  id: number;                   // 唯一标识符
  content: string;              // 备忘内容
  createdAt: Date;              // 创建时间
  completed: boolean;           // 是否完成
  completedAt?: Date | null;    // 完成时间
  folderId?: number | null;     // 所属文件夹
}
export interface GlobalVal {
  memoList: MemoItemType[];
  currFolderId: number;
  folder: Folder[];
  doc: DbDoc<DocData> | null;
}
export const glb = reactive<GlobalVal>({
  memoList: [],
  currFolderId: 1,
  folder: [{ id: 1, name: '默认' }],
  doc: null,
});


function throttle<T extends (...args: any[]) => any>(fn: T, interval = 500) {
  let lastExec = 0;

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    const force = (args[0] as any)?.force ?? false; // 可选：通过参数传 force
    if (force || now - lastExec >= interval) {
      fn(...args);    // 执行函数
      lastExec = now;
    }
  };

  // 强制保存方法
  throttled.force = (...args: Parameters<T>) => {
    fn(...args);
    lastExec = Date.now();
  };

  return throttled;
}


const reviveDates = (arr: MemoItemType[]) => arr.map((it) => {
  const x = { ...it };
  if (x.createdAt && !(x.createdAt instanceof Date)) x.createdAt = new Date(x.createdAt);
  if (x.completedAt && !(x.completedAt instanceof Date)) x.completedAt = new Date(x.completedAt);
  return x;
});


export const saveToDb = throttle(() => {
  glb.doc.memos = toRaw(glb.memoList);
  glb.doc.folders = toRaw(glb.folder);
  glb.doc.currFolderId = glb.currFolderId;
  const result = utools.db.put(glb.doc);
  if (result?.ok) glb.doc._rev = result.rev;
}, 500);

const doc = utools.db.get(DOC_ID) as DbDoc<DocData> | null;
if (doc) {
  glb.doc = doc;
  const rawMemos: MemoItemType[] = Array.isArray(doc.memos)
    ? reviveDates(doc.memos)
    : Array.isArray(doc.memos)
      ? reviveDates(doc.memos)
      : [];

  const rawFolders: Folder[] = Array.isArray(doc.folders) ? doc.folders : [];
  const rawCurrentFolderId: number | null = typeof doc.currFolderId === 'number' ? doc.currFolderId : null;

  if (rawFolders.length > 0) {
    glb.folder = rawFolders.slice();
    glb.currFolderId = rawCurrentFolderId ?? (glb.folder[0]?.id ?? null);
  } else {
    const used = new Set<number>();
    rawMemos.forEach(m => {
      if (typeof m.folderId === 'number') used.add(m.folderId as number);
    });
    if (used.size === 0) {
      glb.folder = [{ id: 1, name: '默认' }];
      glb.currFolderId = 1;
    } else {
      const list: Folder[] = Array.from(used).map(id => ({ id, name: `文件夹${id}` }));
      glb.folder = list.length > 0 ? list : [{ id: 1, name: '默认' }];
      glb.currFolderId = glb.folder[0]?.id ?? null;
    }
  }

  rawMemos.forEach(m => {
    let fid: number | null = m.folderId ?? glb.currFolderId ?? null;
    if (fid != null && !glb.folder.some(f => f.id === fid)) {
      glb.folder.push({ id: fid, name: `文件夹${fid}` });
    }
    m.folderId = fid;
    glb.memoList.push({ ...m });
  });
} else {
  const newDoc: DbDoc<DocData> = { _id: DOC_ID, currFolderId: glb.currFolderId, memos: [], folders: [] };
  const result = utools.db.put(newDoc);
  if (result.ok) {
    newDoc._rev = result.rev;
    glb.doc = newDoc;
    glb.memoList = [];
  }
}

watch([glb.memoList, glb.folder, glb.currFolderId], () => {
  saveToDb();
}, { deep: true });
