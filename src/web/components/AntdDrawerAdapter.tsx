import React from 'react';
import { Drawer } from 'antd';
import type { DrawerProps } from 'antd';

export type DrawerAdapterProps = Omit<DrawerProps, 'open'> & {
  open: boolean;
};

export default function AntdDrawerAdapter({ open, ...props }: DrawerAdapterProps) {
  return (
    <Drawer
      open={open}
      placement="right"
      size="large"
      destroyOnHidden
      {...props}
    />
  );
}