export interface MemoItemType {
  id: number;                   // 唯一标识符
  content: string;              // 备忘内容
  createdAt: Date;              // 创建时间
  completed: boolean;           // 是否完成
  completedAt?: Date | null;    // 完成时间
  folderId?: number | null;     // 所属文件夹
}
