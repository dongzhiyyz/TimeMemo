import { ref, Ref, toRaw, watch } from 'vue';

export interface MemoItemType {
  id: number;                   // 唯一标识符
  content: string;              // 备忘内容
  createdAt: Date;              // 创建时间
  completed: boolean;           // 是否完成
  completedAt?: Date | null;    // 完成时间
  folderId?: number | null;     // 所属文件夹
}

const docId: string = 'time_memo_1';
export const memoList: Ref<MemoItemType[]> = ref<MemoItemType[]>([]);// 备忘数据源

let timeMemoDoc: DbDoc<{ data: MemoItemType[] }>;
const doc = utools.db.get(docId) as DbDoc<{ data: MemoItemType[] }> | null;


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


// 防抖保存
export const saveToDb = throttle(() => {
  timeMemoDoc.data = toRaw(memoList.value);
  const result = utools.db.put(timeMemoDoc);
  if (result?.ok) timeMemoDoc._rev = result.rev;
}, 500);


if (doc) {
  timeMemoDoc = doc;
  let temp = Array.isArray(doc.data) ? reviveDates(doc.data) : [];
  temp.forEach(m => {
    memoList.value.push({ ...m });
  });
} else {
  const newDoc: DbDoc<{ data: MemoItemType[] }> = { _id: docId, data: [] };
  const result = utools.db.put(newDoc);
  if (result.ok) {
    newDoc._rev = result.rev;
    timeMemoDoc = newDoc;
    memoList.value = [];
  }
}

// 深度监听 → 任何修改都触发
watch(memoList, () => {
  saveToDb();
}, { deep: true });
