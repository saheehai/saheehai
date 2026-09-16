import React from 'react';
import { COMMON_STYLES } from '../utils/constants';

function Alert({ kind = 'error', children, style }) {
  const base = kind === 'success' ? COMMON_STYLES.alert.success : COMMON_STYLES.alert.error;
  return <div style={{ ...base, ...style }}>{children}</div>;
}

export default Alert;
