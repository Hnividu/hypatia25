import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';
import styles from './SectionCardView.module.css';

interface SectionCardViewProps {
    title: string;
    content: string;
    sectionNumber?: number;
    totalSections?: number;
}

export default function SectionCardView({ title, content, sectionNumber = 1, totalSections = 1 }: SectionCardViewProps) {
    return (
        <div className={styles.container}>
            <Card variant="glass" className={styles.card}>
                <CardContent>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className={styles.badge}
                        style={{ display: 'inline-block' }}
                    >
                        Section {sectionNumber} of {totalSections}
                    </motion.div>

                    <motion.h1
                        className={styles.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                    >
                        {title}
                    </motion.h1>

                    <motion.div
                        className={styles.divider}
                        initial={{ width: 0 }}
                        animate={{ width: 60 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                    />

                    <motion.p
                        className={styles.content}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6, duration: 0.5 }}
                    >
                        {content}
                    </motion.p>


                </CardContent>
            </Card>
        </div>
    );
}
