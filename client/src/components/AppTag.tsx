import type { ComponentProps } from 'react';
import { Tag } from 'antd';

export type AppTagTone = 'neutral' | 'info' | 'success' | 'caution' | 'warning' | 'danger';

type AppTagProps = Omit<ComponentProps<typeof Tag>, 'bordered' | 'color'> & {
  tone?: AppTagTone;
};

export default function AppTag({ tone = 'neutral', className, ...props }: AppTagProps) {
  return (
    <Tag
      {...props}
      bordered={false}
      className={['app-tag', `app-tag--${tone}`, className].filter(Boolean).join(' ')}
    />
  );
}
