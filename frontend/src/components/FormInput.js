import React, { useCallback } from 'react';
import { COLORS, COMMON_STYLES } from '../utils/constants';

function FormInput({
  as = 'input',
  label,
  required,
  style,
  containerStyle,
  rows,
  ...inputProps
}) {
  const handleFocus = useCallback((e) => {
    e.target.style.borderColor = COLORS.primary;
  }, []);
  const handleBlur = useCallback((e) => {
    e.target.style.borderColor = COLORS.brownBorder;
  }, []);

  const baseStyle = {
    ...COMMON_STYLES.input,
    ...(as === 'textarea'
      ? { resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }
      : null),
    ...style,
  };

  const inputEl =
    as === 'textarea' ? (
      <textarea
        rows={rows}
        required={required}
        style={baseStyle}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...inputProps}
      />
    ) : (
      <input
        required={required}
        style={baseStyle}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...inputProps}
      />
    );

  if (!label) return inputEl;

  return (
    <div style={{ marginBottom: '20px', ...containerStyle }}>
      <label
        style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: 500,
          color: COLORS.darkBrown,
          marginBottom: '8px',
        }}
      >
        {label}
        {required ? ' *' : ''}
      </label>
      {inputEl}
    </div>
  );
}

export default FormInput;
