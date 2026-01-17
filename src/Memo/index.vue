<script setup lang="ts">
import { glb } from '../Memo/memo';
import MemoItem from './MemoItem.vue';
import { useSidebar } from './useSidebar';
import { useMemoList } from './useMemoList';
import { useCsv } from './useCsv';

const {
    showSidebar,
    newFolderName,
    setCurrentFolder,
    addFolder,
    setPriorityFilter,
    setDateFilter,
    setStatusFilter,
    dateFilterBaseDateStr,
    onDateFilterBaseChange,
    contextMenu,
    showContextMenu,
    hideContextMenu,
    deleteFolder,
    renameFolder,
} = useSidebar();

const {
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
} = useMemoList();

const {
    exportCsv,
    triggerImport
} = useCsv();

</script>

<template>
    <!-- 主布局容器 -->
    <div class="container">

        <!-- 左侧文件夹栏 -->
        <aside v-if="showSidebar" class="sidebar">

            <div style="font-weight:bold;margin-bottom:8px;">文件夹</div>

            <div class="toolbar-left" style="margin-bottom:8px;">
                <input placeholder="输入名称" v-model="newFolderName" style="flex: 1;" />
                <button class="full-btn" @click="addFolder">添加</button>
            </div>

            <div class="folder-list">
                <button class="btn-secondary" :class="{ active: glb.currFolder === null }"
                    @click="setCurrentFolder(null)">
                    全部
                </button>

                <button class="btn-secondary" v-for="f in glb.folders" :key="f.order"
                    :class="{ active: glb.currFolder === f }" @click="setCurrentFolder(f)"
                    @contextmenu.prevent="showContextMenu($event, f)">
                    {{ f.name }}
                </button>
            </div>

            <div style="margin-top:16px;">
                <div style="font-weight:bold;margin-bottom:6px;">优先级筛选</div>
                <div class="toolbar-left">
                    <button class="btn-secondary" :class="{ active: glb.priorityFilter === 'all' }"
                        @click="setPriorityFilter('all')">全部</button>
                    <button class="btn-secondary" :class="{ active: glb.priorityFilter === 'high' }"
                        @click="setPriorityFilter('high')">高</button>
                    <button class="btn-secondary" :class="{ active: glb.priorityFilter === 'medium' }"
                        @click="setPriorityFilter('medium')">中</button>
                    <button class="btn-secondary" :class="{ active: glb.priorityFilter === 'low' }"
                        @click="setPriorityFilter('low')">低</button>
                </div>
            </div>

            <div style="margin-top:16px;">
                <div style="font-weight:bold;margin-bottom:6px;">时间分组</div>

                <div class="toolbar-left">
                    <button class="btn-secondary" :class="{ active: glb.dateFilter === 'all' }"
                        @click="setDateFilter('all')">
                        全部
                    </button>
                    <button class="btn-secondary" :class="{ active: glb.dateFilter === 'day' }"
                        @click="setDateFilter('day')">
                        按日
                    </button>
                    <button class="btn-secondary" :class="{ active: glb.dateFilter === 'week' }"
                        @click="setDateFilter('week')">
                        按周
                    </button>
                    <button class="btn-secondary" :class="{ active: glb.dateFilter === 'month' }"
                        @click="setDateFilter('month')">
                        按月
                    </button>
                    <button class="btn-secondary" :class="{ active: glb.dateFilter === 'year' }"
                        @click="setDateFilter('year')">
                        按年
                    </button>
                </div>

                <div v-if="glb.dateFilter !== 'all'" style="margin-top:8px;">
                    <div class="toolbar-left">
                        <span style="font-size:12px;margin-right:4px;">
                            {{
                                glb.dateFilter === 'day' ? '选择某一天'
                                    : glb.dateFilter === 'week' ? '选择某一周'
                                        : glb.dateFilter === 'month' ? '选择某一月'
                            : '选择某一年'
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
                    <button class="btn-secondary" :class="{ active: glb.statusFilter === 'all' }"
                        @click="setStatusFilter('all')">
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
                    <button @click="addMemo" :disabled="!glb.currFolder">新增备忘</button>
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
                <button @click="exportCsv">导出全部</button>
                <button @click="triggerImport">导入数据</button>
                <div class="spacer"></div>

                <button @click="bulkMoveSelected"
                    :disabled="state.selectedIds.length === 0 || moveTargetFolderName == null">
                    移动到文件夹
                </button>

                <select v-model="moveTargetFolderName">
                    <option v-for="f in glb.folders" :key="f.order" :value="f.name">{{ f.name }}</option>
                </select>

            </div>

            <div v-for="item in sortedList" :key="item.id" class="list-row">
                <input v-if="state.manageMode" class="cb-manage" type="checkbox"
                    :checked="state.selectedIds.includes(item.id)"
                    @change="toggleSelect(item.id, ($event.target as HTMLInputElement).checked)" />
                <div style="flex:1;">
                    <MemoItem :item="item" @update="updateContent" @delete="deleteMemo" @toggle="setCompleted"
                        @updatePriority="updatePriority" :ref="el => memoRefs.set(item.id, el)" />
                </div>
            </div>
        </main>

    </div>
</template>
