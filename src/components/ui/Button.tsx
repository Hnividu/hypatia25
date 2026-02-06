'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'option-a' | 'option-b' | 'option-c' | 'option-d';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref' | 'children'> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    fullWidth?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    children?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = 'primary',
            size = 'md',
            loading = false,
            fullWidth = false,
            leftIcon,
            rightIcon,
            children,
            disabled,
            className = '',
            ...props
        },
        ref
    ) => {
        const isDisabled = disabled || loading;

        return (
            <motion.button
                ref={ref}
                className={`${styles.button} ${styles[variant]} ${styles[size]} ${fullWidth ? styles.fullWidth : ''} ${className}`}
                disabled={isDisabled}
                whileHover={!isDisabled ? { scale: 1.02 } : undefined}
                whileTap={!isDisabled ? { scale: 0.98 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                {...props}
            >
                {loading && (
                    <span className={styles.spinner}>
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" />
                        </svg>
                    </span>
                )}
                {!loading && leftIcon && <span className={styles.icon}>{leftIcon}</span>}
                <span className={loading ? styles.hiddenText : ''}>{children}</span>
                {!loading && rightIcon && <span className={styles.icon}>{rightIcon}</span>}
            </motion.button>
        );
    }
);

Button.displayName = 'Button';

export default Button;
