'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import styles from './join.module.css';

interface ParticipantInfo {
    regId: string;
    name: string;
    schoolName: string;
}

export default function JoinQuizPage() {
    const router = useRouter();
    const [step, setStep] = useState<'regId' | 'quizCode'>('regId');
    const [regId, setRegId] = useState('');
    const [quizCode, setQuizCode] = useState('');
    const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRegIdSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const response = await fetch('/api/participants/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ regId: regId.trim() }),
            });

            const data = await response.json();

            if (!response.ok || !data.valid) {
                throw new Error(data.error || 'Invalid Registration ID');
            }

            setParticipant(data.participant);
            setStep('quizCode');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Validation failed');
        } finally {
            setLoading(false);
        }
    };

    const handleQuizCodeSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!participant) return;

        // Store validated participant info in sessionStorage (more secure than URL params)
        sessionStorage.setItem('hypatia_participant', JSON.stringify({
            regId: participant.regId,
            name: participant.schoolName,
            validatedAt: Date.now()
        }));

        // Navigate to the play page with just the quiz code
        router.push(`/play/${quizCode.trim()}`);
    };

    return (
        <div className={styles.container}>
            <div className={styles.background}>
                <div className={styles.gradient1} />
                <div className={styles.gradient2} />
            </div>

            <motion.div
                className={styles.content}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            >
                <div className={styles.logo}>
                    <Image
                        src="/MCSS.png"
                        alt="MCSS Logo"
                        width={96}
                        height={96}
                        className={styles.logoImage}
                        priority
                    />
                </div>

                <h1 className={styles.title}>Join Quiz</h1>

                <AnimatePresence mode="wait">
                    {step === 'regId' && (
                        <motion.div
                            key="regId"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card variant="glass" className={styles.card}>
                                <CardContent>
                                    <p className={styles.instruction}>
                                        Enter your Registration ID to get started
                                    </p>

                                    <form onSubmit={handleRegIdSubmit} className={styles.form}>
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
                                            type="text"
                                            value={regId}
                                            onChange={(e) => setRegId(e.target.value.toUpperCase())}
                                            placeholder="REG-XXXX-XXXX"
                                            className={styles.input}
                                            fullWidth
                                            autoFocus
                                        />

                                        <Button
                                            type="submit"
                                            size="xl"
                                            fullWidth
                                            loading={loading}
                                            disabled={!regId.trim()}
                                        >
                                            Continue
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {step === 'quizCode' && participant && (
                        <motion.div
                            key="quizCode"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card variant="glass" className={styles.card}>
                                <CardContent>
                                    <div className={styles.welcome}>
                                        <span className={styles.welcomeLabel}>Welcome,</span>
                                        <span className={styles.welcomeName}>{participant.schoolName}</span>
                                    </div>

                                    <p className={styles.instruction}>
                                        Enter the quiz code given
                                    </p>

                                    <form onSubmit={handleQuizCodeSubmit} className={styles.form}>
                                        <Input
                                            type="text"
                                            value={quizCode}
                                            onChange={(e) => setQuizCode(e.target.value)}
                                            placeholder="QUIZ CODE"
                                            className={styles.codeInput}
                                            fullWidth
                                            autoFocus
                                        />

                                        <Button
                                            type="submit"
                                            size="xl"
                                            fullWidth
                                            disabled={!quizCode.trim()}
                                        >
                                            Join Quiz
                                        </Button>

                                        <button
                                            type="button"
                                            className={styles.backLink}
                                            onClick={() => {
                                                setStep('regId');
                                                setParticipant(null);
                                                setError(null);
                                            }}
                                        >
                                            Not you? Go back
                                        </button>
                                    </form>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            <div className={styles.footer}>
                <div className={styles.copyright}>
                    <p>© 2025 Mahanama College Science Society. All rights reserved.</p>
                    <p className={styles.developer}>Developed by Hirosh Nividu • Fellow Mahanamian</p>
                </div>
            </div>
        </div>
    );
}
