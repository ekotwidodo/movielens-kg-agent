/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GRAPH_NAMESPACE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
