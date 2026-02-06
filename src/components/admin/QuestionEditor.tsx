'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import styles from './QuestionEditor.module.css';

export type QuestionType = 'mcq' | 'numerical' | 'categorize';

export interface MCQData {
    options: { id: string; text: string }[];
    correctOptionId: string;
}

export interface NumericalData {
    correctAnswer: number;
    tolerance: number;
}

export interface CategorizeData {
    categories: { id: string; name: string }[];
    items: { id: string; text: string; categoryId: string }[];
}

export interface QuestionFormData {
    id?: string;
    type: QuestionType;
    text: string;
    timeLimit: number;
    doublePoints: boolean;
    data: MCQData | NumericalData | CategorizeData;
}

interface QuestionEditorProps {
    initialData?: QuestionFormData;
    onSave: (data: QuestionFormData) => Promise<void>;
    onCancel: () => void;
    saving?: boolean;
}

export default function QuestionEditor({
    initialData,
    onSave,
    onCancel,
    saving = false,
}: QuestionEditorProps) {
    const [type, setType] = useState<QuestionType>(initialData?.type || 'mcq');
    const [text, setText] = useState(initialData?.text || '');
    const [timeLimit, setTimeLimit] = useState(initialData?.timeLimit || 30);
    const [doublePoints, setDoublePoints] = useState(initialData?.doublePoints || false);

    // Type-specific states
    const [mcqData, setMcqData] = useState<MCQData>(() => {
        if (initialData?.type === 'mcq') {
            return initialData.data as MCQData;
        }
        return {
            options: [
                { id: '1', text: '', isCorrect: false },
                { id: '2', text: '', isCorrect: false }
            ],
            correctOptionId: ''
        };
    });

    const [numericalData, setNumericalData] = useState<NumericalData>(() => {
        if (initialData?.type === 'numerical') {
            return initialData.data as NumericalData;
        }
        return { correctAnswer: 0, tolerance: 0 };
    });

    const [categorizeData, setCategorizeData] = useState<CategorizeData>(() => {
        if (initialData?.type === 'categorize') {
            return initialData.data as CategorizeData;
        }
        return {
            categories: [
                { id: crypto.randomUUID(), name: '' },
                { id: crypto.randomUUID(), name: '' }
            ],
            items: []
        };
    });

    // Reset data when type changes if not editing
    useEffect(() => {
        if (initialData && initialData.type === type) return;
    }, [type, initialData]);

    const updateMcqOption = (index: number, text: string) => {
        const newOptions = [...mcqData.options];
        newOptions[index] = { ...newOptions[index], text };
        setMcqData({ ...mcqData, options: newOptions });
    };

    const addMcqOption = () => {
        setMcqData({
            ...mcqData,
            options: [
                ...mcqData.options,
                { id: crypto.randomUUID(), text: '' }
            ]
        });
    };

    const removeMcqOption = (id: string) => {
        if (mcqData.options.length <= 2) return;
        setMcqData({
            ...mcqData,
            options: mcqData.options.filter(o => o.id !== id),
            // Reset correct option if it was the one removed
            correctOptionId: mcqData.correctOptionId === id ? '' : mcqData.correctOptionId
        });
    };

    const addCategory = () => {
        setCategorizeData({
            ...categorizeData,
            categories: [...categorizeData.categories, { id: crypto.randomUUID(), name: '' }]
        });
    };

    const updateCategory = (id: string, name: string) => {
        setCategorizeData({
            ...categorizeData,
            categories: categorizeData.categories.map(c => c.id === id ? { ...c, name } : c)
        });
    };

    const removeCategory = (id: string) => {
        if (categorizeData.categories.length <= 2) return;
        setCategorizeData({
            ...categorizeData,
            categories: categorizeData.categories.filter(c => c.id !== id),
            items: categorizeData.items.filter(i => i.categoryId !== id)
        });
    };

    const addItem = () => {
        if (categorizeData.categories.length === 0) return;
        setCategorizeData({
            ...categorizeData,
            items: [
                ...categorizeData.items,
                { id: crypto.randomUUID(), text: '', categoryId: categorizeData.categories[0].id }
            ]
        });
    };

    const updateItem = (id: string, field: 'text' | 'categoryId', value: string) => {
        setCategorizeData({
            ...categorizeData,
            items: categorizeData.items.map(i => i.id === id ? { ...i, [field]: value } : i)
        });
    };

    const removeItem = (id: string) => {
        setCategorizeData({
            ...categorizeData,
            items: categorizeData.items.filter(i => i.id !== id)
        });
    };

    const handleSubmit = async () => {
        let data: MCQData | NumericalData | CategorizeData;

        switch (type) {
            case 'mcq':
                data = mcqData;
                break;
            case 'numerical':
                data = numericalData;
                break;
            case 'categorize':
                data = categorizeData;
                break;
        }

        await onSave({
            id: initialData?.id,
            type,
            text,
            timeLimit,
            doublePoints,
            data,
        });
    };

    const isValid = () => {
        if (!text.trim()) return false;

        switch (type) {
            case 'mcq':
                return mcqData.options.every(o => o.text.trim()) && !!mcqData.correctOptionId;
            case 'numerical':
                return !isNaN(numericalData.correctAnswer) && !isNaN(numericalData.tolerance);
            case 'categorize':
                return categorizeData.categories.every(c => c.name.trim()) &&
                    categorizeData.items.every(i => i.text.trim()) &&
                    categorizeData.items.length > 0;
            default:
                return false;
        }
    };

    return (
        <Card variant="elevated" className={styles.editor}>
            <CardHeader>
                <CardTitle>{initialData ? 'Edit Question' : 'Add New Question'}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className={styles.form}>
                    {/* Type Selector */}
                    <div className={styles.typeSelector}>
                        <label className={styles.label}>Question Type</label>
                        <div className={styles.typeButtons}>
                            <button
                                type="button"
                                className={`${styles.typeButton} ${type === 'mcq' ? styles.active : ''}`}
                                onClick={() => setType('mcq')}
                            >
                                <span className={styles.typeIcon}>📝</span>
                                MCQ
                            </button>
                            <button
                                type="button"
                                className={`${styles.typeButton} ${type === 'numerical' ? styles.active : ''}`}
                                onClick={() => setType('numerical')}
                            >
                                <span className={styles.typeIcon}>🔢</span>
                                Numerical
                            </button>
                            <button
                                type="button"
                                className={`${styles.typeButton} ${type === 'categorize' ? styles.active : ''}`}
                                onClick={() => setType('categorize')}
                            >
                                <span className={styles.typeIcon}>📊</span>
                                Categorize
                            </button>
                        </div>
                    </div>

                    {/* Question Text */}
                    <div className={styles.field}>
                        <label className={styles.label}>Question Text</label>
                        <textarea
                            className={styles.textarea}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Enter your question..."
                            rows={3}
                        />
                    </div>



                    {/* Type-specific fields */}
                    <AnimatePresence mode="wait">
                        {type === 'mcq' && (
                            <motion.div
                                key="mcq"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className={styles.typeFields}
                            >
                                <label className={styles.label}>Answer Options</label>
                                <p className={styles.hint}>Select the correct answer by clicking the radio button</p>
                                <div className={styles.optionsList}>
                                    {mcqData.options.map((option, index) => (
                                        <div key={option.id} className={styles.optionRow}>
                                            <input
                                                type="radio"
                                                name="correctOption"
                                                checked={mcqData.correctOptionId === option.id}
                                                onChange={() => setMcqData({ ...mcqData, correctOptionId: option.id })}
                                                className={styles.radio}
                                            />
                                            <Input
                                                value={option.text}
                                                onChange={(e) => updateMcqOption(index, e.target.value)}
                                                placeholder={`Option ${index + 1}`}
                                                fullWidth
                                            />
                                            {mcqData.options.length > 2 && (
                                                <button
                                                    type="button"
                                                    className={styles.removeButton}
                                                    onClick={() => removeMcqOption(option.id)}
                                                    title="Remove Option"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        className={styles.addButton}
                                        onClick={addMcqOption}
                                        style={{ marginTop: '0.5rem', width: 'fit-content' }}
                                    >
                                        + Add Option
                                    </button>
                                </div>
                            </motion.div>
                        )}
                        {type === 'numerical' && (
                            <motion.div
                                key="numerical"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className={styles.typeFields}
                            >
                                <div className={styles.numericalFields}>
                                    <Input
                                        label="Correct Answer"
                                        type="number"
                                        value={numericalData.correctAnswer.toString()}
                                        onChange={(e) => setNumericalData({
                                            ...numericalData,
                                            correctAnswer: parseFloat(e.target.value) || 0,
                                        })}
                                        fullWidth
                                    />
                                    <Input
                                        label="Tolerance (±)"
                                        type="number"
                                        value={numericalData.tolerance.toString()}
                                        onChange={(e) => setNumericalData({
                                            ...numericalData,
                                            tolerance: parseFloat(e.target.value) || 0,
                                        })}
                                        hint="Answers within this range will be accepted"
                                        fullWidth
                                    />
                                </div>
                            </motion.div>
                        )}
                        {type === 'categorize' && (
                            <motion.div
                                key="categorize"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className={styles.typeFields}
                            >
                                {/* Categories */}
                                <div className={styles.categoriesSection}>
                                    <div className={styles.sectionHeader}>
                                        <label className={styles.label}>Categories</label>
                                        <button type="button" className={styles.addButton} onClick={addCategory}>
                                            + Add Category
                                        </button>
                                    </div>
                                    <div className={styles.categoriesList}>
                                        {categorizeData.categories.map((cat) => (
                                            <div key={cat.id} className={styles.categoryRow}>
                                                <Input
                                                    value={cat.name}
                                                    onChange={(e) => updateCategory(cat.id, e.target.value)}
                                                    placeholder="Category name"
                                                    fullWidth
                                                />
                                                {categorizeData.categories.length > 2 && (
                                                    <button
                                                        type="button"
                                                        className={styles.removeButton}
                                                        onClick={() => removeCategory(cat.id)}
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Items */}
                                <div className={styles.itemsSection}>
                                    <div className={styles.sectionHeader}>
                                        <label className={styles.label}>Items to Categorize</label>
                                        <button type="button" className={styles.addButton} onClick={addItem}>
                                            + Add Item
                                        </button>
                                    </div>
                                    <div className={styles.itemsList}>
                                        {categorizeData.items.map((item) => (
                                            <div key={item.id} className={styles.itemRow}>
                                                <Input
                                                    value={item.text}
                                                    onChange={(e) => updateItem(item.id, 'text', e.target.value)}
                                                    placeholder="Item text"
                                                    fullWidth
                                                />
                                                <select
                                                    value={item.categoryId}
                                                    onChange={(e) => updateItem(item.id, 'categoryId', e.target.value)}
                                                    className={styles.categorySelect}
                                                >
                                                    {categorizeData.categories.map((cat) => (
                                                        <option key={cat.id} value={cat.id}>
                                                            {cat.name || 'Unnamed'}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    className={styles.removeButton}
                                                    onClick={() => removeItem(item.id)}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                        {categorizeData.items.length === 0 && (
                                            <p className={styles.emptyHint}>Add items that participants will sort into categories</p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Settings */}
                    <div className={styles.settings}>
                        <Input
                            label="Time Limit (seconds)"
                            type="number"
                            value={timeLimit.toString()}
                            onChange={(e) => setTimeLimit(parseInt(e.target.value) || 30)}
                        />
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={doublePoints}
                                onChange={(e) => setDoublePoints(e.target.checked)}
                                className={styles.checkbox}
                            />
                            Double Points
                        </label>
                    </div>
                </div>
            </CardContent>

            <CardFooter className={styles.actions}>
                <Button variant="secondary" onClick={onCancel} disabled={saving}>
                    Cancel
                </Button>
                <Button onClick={handleSubmit} loading={saving} disabled={!isValid()}>
                    {initialData ? 'Save Changes' : 'Add Question'}
                </Button>
            </CardFooter>
        </Card>
    );
}
