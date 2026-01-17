import { reactive, ref, computed, nextTick } from 'vue';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import { glb, save_db_memos, save_db_config } from './memo';
import type { MemoItemType, MemoPriority } from './memo';
import { useConfirm } from '../confirm/confirm';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

interface GlobalState {
  selectedIds: number[];
  manageMode: boolean;
}

const memoRefs = new Map<number, any>();

export function useMemoList() {
  const state = reactive<GlobalState>({
    selectedIds: [],
    manageMode: false,
  });

  const getNextMemoId = () => {
    const used = new Set(glb.memoList.map(m => m.id));
    let id = 1;
    while (used.has(id)) id++;
    return id;
  };

  const addMemo = () => {
    if (!glb.currFolder) return;
    const item: MemoItemType = {
      id: getNextMemoId(),
      content: '',
      createdAt: dayjs(),
      completed: false,
      completedAt: null,
      folderName: glb.currFolder.name,
      priority: 'medium',
      firstCompletedAt: null,
    };
    glb.memoList.push(item);
    nextTick(() => {
      const comp = memoRefs.get(item.id);
      comp?.inputRef?.focus?.();
    });
  };

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
    const now = dayjs();
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

  const updatePriority = (id: number, priority: MemoPriority) => {
    const item = glb.memoList.find(m => m.id === id);
    if (!item) return;
    item.priority = priority;
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
    if (state.selectedIds.length === 0 || moveTargetFolderName.value == null) return;

    const memoMap = new Map(glb.memoList.map(m => [m.id, m]));
    state.selectedIds.forEach(id => {
      const memo = memoMap.get(id);
      if (memo) {
        memo.folderName = moveTargetFolderName.value as string;
      }
    });

    state.selectedIds = [];
  };

  const sortKey = ref<'time' | 'status'>(glb.sortKey);
  const sortDirection = ref<'asc' | 'desc'>(glb.sortDirection);
  const fixedCompDown = ref<boolean>(glb.fixedCompDown);

  const paramToConfig = () => {
    glb.sortKey = sortKey.value;
    glb.sortDirection = sortDirection.value;
    glb.fixedCompDown = fixedCompDown.value;
    save_db_config();
  };

  const setSortBy = (key: 'time' | 'status') => {
    if (sortKey.value === key) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey.value = key;
      sortDirection.value = 'asc';
    }
  };

  const sortedList = computed(() => {
    const baseDay = dayjs(glb.dateFilterBaseTime ?? undefined);

    const matchDate = (m: MemoItemType) => {
      if (glb.dateFilter === 'all') return true;
      const d = m.createdAt;

      switch (glb.dateFilter) {
        case 'day':
          return d.isSame(baseDay, 'day');
        case 'week':
          return d.isoWeek() === baseDay.isoWeek() && d.year() === baseDay.year();
        case 'month':
          return d.isSame(baseDay, 'month');
        case 'year':
          return d.isSame(baseDay, 'year');
        default:
          return true;
      }
    };

    const matchStatus = (m: MemoItemType) => {
      if (glb.statusFilter === 'all') return true;
      return glb.statusFilter === 'completed' ? m.completed : !m.completed;
    };

    const arr = glb.memoList.filter(m => {
      const folderOk = !glb.currFolder || m.folderName === glb.currFolder.name;
      const priorityOk = glb.priorityFilter === 'all' || m.priority === glb.priorityFilter;
      return folderOk && priorityOk && matchDate(m) && matchStatus(m);
    });

    const completedValue = (m: MemoItemType) => (m.completed ? 1 : 0);

    if (sortKey.value === 'time') {
      arr.sort((a, b) => {
        const cmp = a.createdAt.valueOf() - b.createdAt.valueOf();
        return sortDirection.value === 'asc' ? cmp : -cmp;
      });

      if (fixedCompDown.value) {
        arr.sort((a, b) => completedValue(a) - completedValue(b));
      }
    } else if (sortKey.value === 'status') {
      arr.sort((a, b) =>
        sortDirection.value === 'asc'
          ? completedValue(a) - completedValue(b)
          : completedValue(b) - completedValue(a),
      );
    }

    paramToConfig();
    save_db_memos();
    return arr;
  });

  const allViewIds = computed(() => sortedList.value.map(m => m.id));

  const isAllSelected = computed(
    () => allViewIds.value.length > 0 && allViewIds.value.every(id => state.selectedIds.includes(id)),
  );

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const set = new Set<number>([...state.selectedIds, ...allViewIds.value]);
      state.selectedIds = Array.from(set);
    } else {
      const removeSet = new Set<number>(allViewIds.value);
      state.selectedIds = state.selectedIds.filter(id => !removeSet.has(id));
    }
  };

  return {
    state,
    memoRefs,
    addMemo,
    updateContent,
    deleteMemo,
    setCompleted,
    updatePriority,
    toggleSelect,
    bulkDeleteSelected,
    moveTargetFolderName,
    bulkMoveSelected,
    sortKey,
    sortDirection,
    fixedCompDown,
    setSortBy,
    sortedList,
    isAllSelected,
    toggleSelectAll,
  };
}

