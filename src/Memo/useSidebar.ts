import { reactive, computed, ref, onMounted, onBeforeUnmount } from 'vue';
import dayjs from 'dayjs';
import { glb, save_db_memos, save_db_config } from './memo';
import type { FolderType } from './memo';
import { useConfirm } from '../confirm/confirm';
import { promptInput } from '../confirm/prompt';

const contextMenuState = reactive({
  visible: false,
  x: 0,
  y: 0,
  folder: null as FolderType | null,
});

export function useSidebar() {
  const showSidebar = ref(true);
  const newFolderName = ref('');

  const setCurrentFolder = (folder: FolderType | null) => {
    glb.currFolder = folder;
  };

  const getNextFolderOrder = () => {
    const maxOrder = glb.folders.reduce((max, f) => Math.max(max, f.order), -1);
    return maxOrder + 1;
  };

  const addFolder = () => {
    const name = newFolderName.value.trim();
    if (glb.folders.find(f => f.name === name)) {
      useConfirm(`文件夹 ${name} 已存在`, false);
      return;
    }
    if (!name) return;

    const temp = { order: getNextFolderOrder(), name };
    glb.folders.push(temp);
    glb.currFolder = temp;
    newFolderName.value = '';
  };

  const setPriorityFilter = (p: 'all' | 'high' | 'medium' | 'low') => {
    glb.priorityFilter = p;
    save_db_config();
  };

  const setDateFilter = (v: 'all' | 'day' | 'week' | 'month' | 'year') => {
    glb.dateFilter = v;
    if (v === 'all') {
      glb.dateFilterBaseTime = null;
    } else if (!glb.dateFilterBaseTime) {
      glb.dateFilterBaseTime = dayjs().valueOf();
    }
    save_db_config();
  };

  const setStatusFilter = (v: 'all' | 'completed' | 'uncompleted') => {
    glb.statusFilter = v;
    save_db_config();
  };

  const dateFilterBaseDateStr = computed({
    get: () => {
      const t = glb.dateFilterBaseTime;
      return t != null ? dayjs(t).format('YYYY-MM-DD') : '';
    },
    set: (value: string) => {
      if (!value) {
        glb.dateFilterBaseTime = null;
      } else {
        const d = dayjs(value);
        if (d.isValid()) {
          glb.dateFilterBaseTime = d.valueOf();
        }
      }
      save_db_config();
    },
  });

  const onDateFilterBaseChange = (value: string) => {
    if (!value) {
      glb.dateFilterBaseTime = null;
    } else {
      const d = dayjs(value);
      if (d.isValid()) {
        glb.dateFilterBaseTime = d.valueOf();
      }
    }
    save_db_config();
  };

  const showContextMenu = (event: MouseEvent, folder: FolderType) => {
    contextMenuState.visible = true;
    contextMenuState.x = event.clientX;
    contextMenuState.y = event.clientY;
    contextMenuState.folder = folder;
  };

  const hideContextMenu = () => {
    contextMenuState.visible = false;
  };

  const deleteFolder = async (folder: FolderType) => {
    const confirmDeleteFolder = await useConfirm(`是否删除文件夹 ${folder.name}？`);
    if (!confirmDeleteFolder) return;

    const memosInFolder = glb.memoList.filter(m => m.folderName === folder.name);
    if (memosInFolder.length > 0) {
      const confirmDeleteMemos = await useConfirm(
        `文件夹 ${folder.name} 中仍有 ${memosInFolder.length} 个项目。\n是否删除这些项目？`,
      );
      if (!confirmDeleteMemos) return;

      glb.memoList = glb.memoList.filter(m => m.folderName !== folder.name);
    }

    glb.folders = glb.folders.filter(f => f !== folder);

    if (glb.currFolder === folder) glb.currFolder = null as any;

    save_db_memos();
  };

  const renameFolder = async (folder: FolderType) => {
    const newName = await promptInput(`重命名文件夹 ${folder.name}`, folder.name);
    if (!newName) return;

    if (glb.folders.some(f => f.name === newName)) {
      await useConfirm(`文件夹名称 ${newName} 已存在`, false);
      return;
    }

    glb.memoList.forEach(m => {
      if (m.folderName === folder.name) {
        m.folderName = newName;
      }
    });

    folder.name = newName;
    save_db_memos();
  };

  const handleDocumentClick = () => {
    hideContextMenu();
  };

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleDocumentClick);
  });

  return {
    showSidebar,
    newFolderName,
    setCurrentFolder,
    addFolder,
    setPriorityFilter,
    setDateFilter,
    setStatusFilter,
    dateFilterBaseDateStr,
    onDateFilterBaseChange,
    contextMenu: contextMenuState,
    showContextMenu,
    hideContextMenu,
    deleteFolder,
    renameFolder,
  };
}

