<script lang="ts" setup>
import Memo from './Memo/index.vue'
import { onMounted, ref } from 'vue';
import { saveToDb } from './Memo/memo';

const route = ref('时间笔记') // 路由状态，用于控制显示哪个组件，默认显示Hello组件
const enterAction = ref({}) // 存储uTools插件进入时的参数信息

// 组件挂载后执行的钩子函数
onMounted(() => {
  // 检查是否在uTools环境中运行
  if (window.utools) {
    // 监听uTools插件进入事件
    window.utools.onPluginEnter((action) => {
      route.value = action.code // 根据进入方式的code设置当前路由     
      enterAction.value = action // 保存进入参数，传递给子组件
    })

    // 监听uTools插件退出事件
    window.utools.onPluginOut((isKill) => {
      saveToDb.force()
      route.value = '' // 清空路由状态
    })
  }
})
</script>

<template>
  <!-- 条件渲染：根据route值显示不同组件 -->

  <!-- 当route为'时间笔记'或空字符串时显示Hello组件 -->
  <template v-if="route === '时间笔记' || route === ''">
    <Memo :enterAction="enterAction"></Memo>
  </template>

</template>
