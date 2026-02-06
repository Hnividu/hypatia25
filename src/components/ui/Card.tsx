'use client';

import { HTMLAttributes, forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import styles from './Card.module.css';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
    variant?: 'default' | 'elevated' | 'bordered' | 'glass';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hoverable?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ variant = 'default', padding = 'md', hoverable = false, className = '', children, ...props }, ref) => {
        return (
            <motion.div
                ref={ref}
                className={`${styles.card} ${styles[variant]} ${styles[`padding-${padding}`]} ${hoverable ? styles.hoverable : ''} ${className}`}
                {...props}
            >
                {children}
            </motion.div>
        );
    }
);

Card.displayName = 'Card';

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> { }

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
    ({ className = '', children, ...props }, ref) => (
        <div ref={ref} className={`${styles.header} ${className}`} {...props}>
            {children}
        </div>
    )
);

CardHeader.displayName = 'CardHeader';

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
    as?: 'h1' | 'h2' | 'h3' | 'h4';
}

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
    ({ as: Tag = 'h3', className = '', children, ...props }, ref) => (
        <Tag ref={ref} className={`${styles.title} ${className}`} {...props}>
            {children}
        </Tag>
    )
);

CardTitle.displayName = 'CardTitle';

interface CardContentProps extends HTMLAttributes<HTMLDivElement> { }

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
    ({ className = '', children, ...props }, ref) => (
        <div ref={ref} className={`${styles.content} ${className}`} {...props}>
            {children}
        </div>
    )
);

CardContent.displayName = 'CardContent';

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> { }

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
    ({ className = '', children, ...props }, ref) => (
        <div ref={ref} className={`${styles.footer} ${className}`} {...props}>
            {children}
        </div>
    )
);

CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
