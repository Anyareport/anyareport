import { App } from 'antd';

export function useAntdMessage() {
  return App.useApp().message;
}
