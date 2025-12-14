<script setup lang="ts">

import { ref } from 'vue';

const props = defineProps<{
  message: string
}>();

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>();

const visible = ref(true);

const confirm = () => {
  emit('confirm');
  visible.value = false;
};

const cancel = () => {
  emit('cancel');
  visible.value = false;
};
</script>

<template>
  <div v-if="visible" class="overlay" @click="cancel">
    <div class="dialog" @click.stop>
      <div class="message">{{ message }}</div>
      <div class="buttons">
        <button @click="confirm">确定</button>
        <button @click="cancel">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.dialog {
  background: #fff;
  padding: 16px;
  border-radius: 4px;
  min-width: 220px;
}
.message {
  margin-bottom: 12px;
}
.buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
button {
  padding: 4px 12px;
  cursor: pointer;
}
</style>
