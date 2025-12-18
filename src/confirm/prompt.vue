<template>
  <div v-if="visible" class="modal-overlay">
    <div class="modal-box">
      <div class="modal-title">{{ title }}</div>
      <input v-model="value" type="text" />
      <div class="modal-actions">
        <button @click="cancel">取消</button>
        <button @click="ok">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  title: string;
  defaultValue?: string;
}>();

const emit = defineEmits<{
  (e: 'ok', value: string): void;
  (e: 'cancel'): void;
}>();

const visible = ref(true);
const value = ref(props.defaultValue || '');

function ok() {
  emit('ok', value.value);
  visible.value = false;
}

function cancel() {
  emit('cancel');
  visible.value = false;
}
</script>

<style>
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center;
}
.modal-box { background: #fff; padding: 20px; border-radius: 4px; width: 300px; }
.modal-actions { margin-top: 10px; display: flex; justify-content: flex-end; gap: 10px; }
</style>
