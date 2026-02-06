'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';

import styles from './SectionCardEditor.module.css';

export interface SectionCardFormData {
    id?: string;
    title: string;
    content: string;
    order?: number;
}

interface SectionCardEditorProps {
    initialData?: SectionCardFormData;
    onSave: (data: SectionCardFormData) => Promise<void>;
    onCancel: () => void;
    saving?: boolean;
}

export default function SectionCardEditor({
    initialData,
    onSave,
    onCancel,
    saving = false,
}: SectionCardEditorProps) {
    const [title, setTitle] = useState(initialData?.title || '');
    const [content, setContent] = useState(initialData?.content || '');
    const [errors, setErrors] = useState<{ title?: string }>({});

    const handleSubmit = async () => {
        // Validation
        if (!title.trim()) {
            setErrors({ title: 'Title is required' });
            return;
        }

        const formData: SectionCardFormData = {
            id: initialData?.id,
            title,
            content,
            order: initialData?.order,
        };

        await onSave(formData);
    };

    return (
        <Card variant="elevated" className={styles.editorContainer}>
            <CardHeader className={styles.header}>
                <CardTitle>{initialData ? 'Edit Section Card' : 'New Section Card'}</CardTitle>
                <button onClick={onCancel} className={styles.closeButton}>
                    ✕
                </button>
            </CardHeader>

            <CardContent className={styles.content}>
                <div className={styles.formGroup}>
                    <Input
                        label="Section Title"
                        value={title}
                        onChange={(e) => {
                            setTitle(e.target.value);
                            if (errors.title) setErrors({ ...errors, title: undefined });
                        }}
                        placeholder="Physics"
                        error={errors.title}
                        fullWidth
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Description</label>
                    <textarea
                        className={styles.textarea}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Enter a description or instructions for this section..."
                        rows={4}
                    />
                </div>

                <div className={styles.preview}>
                    <span className={styles.previewLabel}>Preview</span>
                    <div className={styles.previewContent}>

                        <h2 className={styles.previewTitle}>{title || 'Section Title'}</h2>
                        <div className={styles.previewBody}>
                            {content || 'Section content will appear here...'}
                        </div>
                    </div>
                </div>
            </CardContent>

            <CardFooter className={styles.actions}>
                <Button variant="secondary" onClick={onCancel} disabled={saving}>
                    Cancel
                </Button>
                <Button onClick={handleSubmit} loading={saving}>
                    {initialData ? 'Update Section' : 'Create Section'}
                </Button>
            </CardFooter>
        </Card>
    );
}
