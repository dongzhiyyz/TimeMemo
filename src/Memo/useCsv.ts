import Papa from 'papaparse';
import dayjs, { type Dayjs } from 'dayjs';
import { glb, save_db_memos } from './memo';
import type { MemoItemType, MemoPriority } from './memo';
import { useConfirm } from '../confirm/confirm';

function formatDateCN(date: Dayjs | Date | string | number | undefined | null): string {
  if (!date) return '';
  if (dayjs.isDayjs(date)) {
    return date.format('YYYY-MM-DD HH:mm:ss');
  }
  const d = date instanceof Date ? date : new Date(date);
  return dayjs(d).format('YYYY-MM-DD HH:mm:ss');
}

function escapeCsv(str: string | number | boolean): string {
  const s = String(str ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const toCsvRow = (m: MemoItemType) => {
  const created = m.createdAt.format('YYYY-MM-DD HH:mm:ss');
  const createdNum = m.createdAt ? m.createdAt.valueOf() : '';

  const completedAt = m.completedAt ? formatDateCN(m.completedAt) : '';
  const completedNum = m.completedAt ? m.completedAt.valueOf() : '';

  const firstCompletedAt = m.firstCompletedAt ? formatDateCN(m.firstCompletedAt) : '';
  const firstCompletedNum = m.firstCompletedAt ? m.firstCompletedAt.valueOf() : '';

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

const parseCsv = (text: string): string[][] => {
  const result = Papa.parse<string[]>(text, {
    delimiter: ',',
    skipEmptyLines: true,
  });
  return result.data;
};

const getNextMemoId = () => {
  const used = new Set(glb.memoList.map(m => m.id));
  let id = 1;
  while (used.has(id)) id++;
  return id;
};

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
    const content = iContent >= 0 ? cols[iContent] ?? '' : '';
    const createdAt = iCreated >= 0 && cols[iCreated] ? dayjs(cols[iCreated]) : dayjs();
    const completed = iCompleted >= 0 ? String(cols[iCompleted]).toLowerCase() === 'true' : false;
    const completedAt = iCompletedAt >= 0 && cols[iCompletedAt] ? dayjs(cols[iCompletedAt]) : null;
    const firstCompletedAt =
      iFirstCompletedAt >= 0 && cols[iFirstCompletedAt] ? dayjs(cols[iFirstCompletedAt]) : completedAt;

    const folderName =
      iFolderName >= 0 ? (cols[iFolderName] || '').trim() : glb.currFolder?.name ?? '默认';
    const rawPriority = iPriority >= 0 ? (cols[iPriority] || '').trim() : '';
    const priority: MemoPriority =
      rawPriority === 'high' || rawPriority === 'medium' || rawPriority === 'low'
        ? rawPriority
        : 'medium';
    const idParsed = Number(idStr);
    const id = Number.isFinite(idParsed) ? idParsed : NaN;

    incoming.push({
      id,
      content,
      createdAt,
      completed,
      completedAt,
      folderName,
      priority,
      firstCompletedAt: firstCompletedAt ?? null,
    });
  }

  if (incoming.length === 0) return;

  const existingIds = new Set(glb.memoList.map(m => m.id));
  const duplicates = incoming.filter(m => Number.isFinite(m.id) && existingIds.has(m.id));

  if (duplicates.length > 0) {
    const keepAll = await useConfirm(
      `检测到 ${duplicates.length} 个重复ID。\n是否保留已有项并为导入项重新分配ID？`,
    );

    if (keepAll) {
      duplicates.forEach(m => {
        m.id = getNextMemoId();
      });
    } else {
      const keepImport = await useConfirm(
        '是否保留导入项并覆盖已有项？\n确定：覆盖已有项\n取消：忽略这些重复导入',
      );

      if (keepImport) {
        duplicates.forEach(m => {
          const idx = glb.memoList.findIndex(x => x.id === m.id);
          if (idx >= 0) {
            glb.memoList[idx] = { ...glb.memoList[idx], ...m };
          }
        });
      } else {
        const filtered = incoming.filter(m => !existingIds.has(m.id));
        incoming.splice(0, incoming.length, ...filtered);
      }
    }
  }

  incoming.forEach(m => {
    const isValid = Number.isFinite(m.id) && !existingIds.has(m.id);
    const nid = isValid ? m.id : getNextMemoId();
    glb.memoList.push({ ...m, id: nid });
    existingIds.add(nid);
  });

  save_db_memos();
};

const exportCsv = async () => {
  if (glb.memoList.length === 0) {
    window.alert('没有数据可导出');
    return;
  }
  const header =
    'id,content,createdAt,completed,completedAt,firstCompletedAt,folderName,priority,createdNum,firstCompletedNum,completedNum';
  const lines = [header, ...glb.memoList.map(toCsvRow)];
  const text = lines.join('\n');
  const suggestedName = `TimeMemo_${dayjs().valueOf()}.csv`;

  if (window.utools.showSaveDialog) {
    const filePath = window.utools.showSaveDialog({
      title: '保存 CSV 文件',
      defaultPath: suggestedName,
      buttonLabel: '保存',
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
      properties: ['showOverwriteConfirmation'],
    });

    if (filePath) {
      window.services.writeTextFile2(filePath, text);
      utools.shellShowItemInFolder(filePath);
    }
  }
};

const triggerImport = () => {
  const filePaths = utools.showOpenDialog({
    title: '请选择要导入的CSV文件',
    defaultPath: '',
    buttonLabel: '导入',
    filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
    properties: ['openFile'],
  });

  if (!filePaths) return;

  const text = window.services.readFile(filePaths[0]);
  importCsvText(text);
};

export function useCsv() {
  return {
    exportCsv,
    triggerImport,
  };
}

