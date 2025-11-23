/// <reference types="utools-api-types" />

export {};

declare global {
  interface Window {
    services: {
      readFile: (file: string) => string;
      writeTextFile: (text: string) => string;
      writeTextFile2: (file: string, text: string) => string;
      writeImageFile: (base64Url: string) => string | undefined;
    };
  }
}
