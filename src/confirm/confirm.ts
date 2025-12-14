import { createApp, h } from 'vue';
import ConfirmDialog from './confirm.vue';

export function useConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render() {
        return h(ConfirmDialog, {
          message,
          onConfirm: () => {
            resolve(true);
            app.unmount();
            container.remove();
          },
          onCancel: () => {
            resolve(false);
            app.unmount();
            container.remove();
          }
        });
      }
    });

    app.mount(container);
  });
}
