'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import styles from './login.module.css';

export default function AdminLoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            router.push('/admin');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
            >
                <Card variant="elevated" className={styles.card}>
                    <CardHeader>
                        <div className={styles.logo}>
                            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect width="48" height="48" rx="12" fill="var(--color-primary)" />
                                <path d="M14 18L24 12L34 18V30L24 36L14 30V18Z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                                <path d="M24 24L34 18" stroke="white" strokeWidth="2" />
                                <path d="M24 24V36" stroke="white" strokeWidth="2" />
                                <path d="M24 24L14 18" stroke="white" strokeWidth="2" />
                            </svg>
                        </div>
                        <CardTitle as="h1">Admin Login</CardTitle>
                        <p className={styles.subtitle}>Enter your credentials to access the quiz dashboard</p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className={styles.form}>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className={styles.error}
                                >
                                    {error}
                                </motion.div>
                            )}

                            <Input
                                label="Username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                required
                                fullWidth
                                autoComplete="username"
                            />

                            <Input
                                label="Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                fullWidth
                                autoComplete="current-password"
                            />

                            <Button
                                type="submit"
                                size="lg"
                                fullWidth
                                loading={loading}
                            >
                                Sign In
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
