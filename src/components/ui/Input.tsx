'use client';

import { InputHTMLAttributes, forwardRef, useState, useId } from 'react';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            label,
            error,
            hint,
            leftIcon,
            rightIcon,
            fullWidth = false,
            className = '',
            id,
            ...props
        },
        ref
    ) => {
        const [focused, setFocused] = useState(false);
        const generatedId = useId();
        const inputId = id || `input-${generatedId}`;

        return (
            <div className={`${styles.wrapper} ${fullWidth ? styles.fullWidth : ''} ${className}`}>
                {label && (
                    <label htmlFor={inputId} className={styles.label}>
                        {label}
                    </label>
                )}
                <div
                    className={`
            ${styles.inputContainer}
            ${focused ? styles.focused : ''}
            ${error ? styles.hasError : ''}
          `}
                >
                    {leftIcon && <span className={styles.icon}>{leftIcon}</span>}
                    <input
                        ref={ref}
                        id={inputId}
                        className={styles.input}
                        onFocus={(e) => {
                            setFocused(true);
                            props.onFocus?.(e);
                        }}
                        onBlur={(e) => {
                            setFocused(false);
                            props.onBlur?.(e);
                        }}
                        onWheel={(e) => {
                            if (props.type === 'number') {
                                (e.target as HTMLElement).blur();
                            }
                            props.onWheel?.(e);
                        }}
                        {...props}
                    />
                    {rightIcon && <span className={styles.icon}>{rightIcon}</span>}
                </div>
                {error && <span className={styles.error}>{error}</span>}
                {hint && !error && <span className={styles.hint}>{hint}</span>}
            </div>
        );
    }
);

Input.displayName = 'Input';

export default Input;
