import React, { useCallback, useId } from 'react';
import { COLORS, COMMON_STYLES } from '../utils/constants';

function FormInput({
  as = 'input',
  label,
  required,
  style,
  containerStyle,
  rows,
  hint,
  id,
  ...inputProps
}) {
  // A label is only a label to assistive tech when it points at its field.
  const generatedId = useId();
  const inputId = id || generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;

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

  const shared = {
    id: inputId,
    required,
    style: baseStyle,
    onFocus: handleFocus,
    onBlur: handleBlur,
    'aria-describedby': hintId,
    ...inputProps,
  };

  const inputEl =
    as === 'textarea' ? <textarea rows={rows} {...shared} /> : <input {...shared} />;

  if (!label) return inputEl;

  return (
    <div style={{ marginBottom: '20px', ...containerStyle }}>
      <label
        htmlFor={inputId}
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
      {hint && (
        <p id={hintId} className="form-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

export default FormInput;
