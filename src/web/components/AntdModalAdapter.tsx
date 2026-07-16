import React from 'react';
import { Modal } from 'antd';
import type { ModalProps } from 'antd';

export type CenteredModalProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  bodyStyle?: React.CSSProperties;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
};

export default function AntdModalAdapter({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 860,
  bodyStyle,
  closeOnBackdrop = false,
  closeOnEscape = false,
  showCloseButton = true,
  ...antdProps
}: CenteredModalProps & ModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={title}
      footer={footer}
      width={maxWidth}
      centered
      destroyOnHidden
      keyboard={closeOnEscape}
      maskClosable={closeOnBackdrop}
      closable={showCloseButton}
      styles={{
        body: bodyStyle,
        ...(antdProps.styles || {}),
      }}
      {...antdProps}
    >
      {children}
    </Modal>
  );
}