import { createApp } from 'vue';
import Prompt from './prompt.vue';

export function promptInput(title: string, defaultValue?: string): Promise<string | null> {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp(Prompt, {
      title,
      defaultValue,
      onOk: (value: string) => {
        resolve(value);
        app.unmount();
        container.remove();
      },
      onCancel: () => {
        resolve(null);
        app.unmount();
        container.remove();
      }
    });

    app.mount(container);
  });
}
