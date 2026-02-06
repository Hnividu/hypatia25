'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import styles from './QuestionEditor.module.css';

type QuestionType = 'mcq' | 'categorize' | 'numerical';

interface MCQOption {
    id: string;
    text: string;
    isCorrect: boolean;
}

interface Category {
    id: string;
    name: string;
}

interface CategoryItem {
    id: string;
    text: string;
    categoryId: string;
}

interface QuestionData {
    type: QuestionType;
    text: string;
    timeLimit: number;
    doublePoints: boolean;
    data: MCQData | CategorizeData | NumericalData;
}

interface MCQData {
    options: MCQOption[];
}

interface CategorizeData {
    categories: Category[];
    items: CategoryItem[];
}

interface NumericalData {
    correctAnswer: number;
    tolerance: number;
    unit?: string;
}

interface QuestionEditorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (question: QuestionData) => Promise<void>;
    editingQuestion?: QuestionData;
}

export default function QuestionEditor({
    isOpen,
    onClose,
    onSave,
    editingQuestion,
}: QuestionEditorProps) {
    const [type, setType] = useState<QuestionType>(editingQuestion?.type || 'mcq');
    const [text, setText] = useState(editingQuestion?.text || '');
    const [timeLimit, setTimeLimit] = useState(editingQuestion?.timeLimit || 30);
    const [doublePoints, setDoublePoints] = useState(editingQuestion?.doublePoints || false);
    const [saving, setSaving] = useState(false);

    // MCQ state
    const [mcqOptions, setMcqOptions] = useState<MCQOption[]>(
        (editingQuestion?.data as MCQData)?.options || [
            { id: '1', text: '', isCorrect: true },
            { id: '2', text: '', isCorrect: false },
            { id: '3', text: '', isCorrect: false },
            { id: '4', text: '', isCorrect: false },
        ]
    );

    // Categorize state
    const [categories, setCategories] = useState<Category[]>(
        (editingQuestion?.data as CategorizeData)?.categories || [
            { id: '1', name: '' },
            { id: '2', name: '' },
        ]
    );
    const [categoryItems, setCategoryItems] = useState<CategoryItem[]>(
        (editingQuestion?.data as CategorizeData)?.items || []
    );

    // Numerical state
    const [correctAnswer, setCorrectAnswer] = useState(
        (editingQuestion?.data as NumericalData)?.correctAnswer || 0
    );
    const [tolerance, setTolerance] = useState(
        (editingQuestion?.data as NumericalData)?.tolerance || 0
    );
    const [unit, setUnit] = useState(
        (editingQuestion?.data as NumericalData)?.unit || ''
    );

    const handleSave = async () => {
        setSaving(true);
        try {
            let data: MCQData | CategorizeData | NumericalData;

            switch (type) {
                case 'mcq':
                    data = { options: mcqOptions.filter((o) => o.text.trim()) };
                    break;
                case 'categorize':
                    data = {
                        categories: categories.filter((c) => c.name.trim()),
                        items: categoryItems.filter((i) => i.text.trim()),
                    };
                    break;
                case 'numerical':
                    data = { correctAnswer, tolerance, unit: unit || undefined };
                    break;
            }

            await onSave({
                type,
                text,
                timeLimit,
                doublePoints,
                data,
            });

            onClose();
        } finally {
            setSaving(false);
        }
    };

    const updateMcqOption = (id: string, updates: Partial<MCQOption>) => {
        setMcqOptions((prev) =>
            prev.map((opt) => {
                if (opt.id === id) {
                    return { ...opt, ...updates };
                }
                // If setting this as correct, unset others
                if (updates.isCorrect && opt.id !== id) {
                    return { ...opt, isCorrect: false };
                }
                return opt;
            })
        );
    };

    const addCategoryItem = () => {
        const newId = String(Date.now());
        setCategoryItems((prev) => [
            ...prev,
            { id: newId, text: '', categoryId: categories[0]?.id || '' },
        ]);
    };

    const updateCategoryItem = (id: string, updates: Partial<CategoryItem>) => {
        setCategoryItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
        );
    };

    const removeCategoryItem = (id: string) => {
        setCategoryItems((prev) => prev.filter((item) => item.id !== id));
    };

    const questionTypes = [
        { value: 'mcq' as QuestionType, label: 'Multiple Choice', icon: '○' },
        { value: 'categorize' as QuestionType, label: 'Categorization', icon: '⊞' },
        { value: 'numerical' as QuestionType, label: 'Numerical', icon: '#' },
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Question" size="lg">
            <div className={styles.editor}>
                {/* Question Type Selector */}
                <div className={styles.typeSelector}>
                    {questionTypes.map((qt) => (
                        <button
                            key={qt.value}
                            type="button"
                            className={`${styles.typeButton} ${type === qt.value ? styles.active : ''}`}
                            onClick={() => setType(qt.value)}
                        >
                            <span className={styles.typeIcon}>{qt.icon}</span>
                            {qt.label}
                        </button>
                    ))}
                </div>

                {/* Question Text */}
                <div className={styles.field}>
                    <label className={styles.label}>Question</label>
                    <textarea
                        className={styles.textarea}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Enter your question..."
                        rows={3}
                    />
                </div>

                {/* Type-specific fields */}
                {type === 'mcq' && (
                    <div className={styles.optionsSection}>
                        <label className={styles.label}>Answer Options</label>
                        <p className={styles.hint}>Click the circle to mark the correct answer</p>
                        <div className={styles.options}>
                            {mcqOptions.map((option, index) => (
                                <div key={option.id} className={styles.optionRow}>
                                    <button
                                        type="button"
                                        className={`${styles.correctToggle} ${option.isCorrect ? styles.correct : ''}`}
                                        onClick={() => updateMcqOption(option.id, { isCorrect: true })}
                                        aria-label={option.isCorrect ? 'Correct answer' : 'Mark as correct'}
                                    >
                                        {option.isCorrect && (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                    </button>
                                    <input
                                        type="text"
                                        className={styles.optionInput}
                                        value={option.text}
                                        onChange={(e) => updateMcqOption(option.id, { text: e.target.value })}
                                        placeholder={`Option ${index + 1}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {type === 'categorize' && (
                    <div className={styles.categorizeSection}>
                        <div className={styles.categoriesRow}>
                            {categories.map((cat, index) => (
                                <div key={cat.id} className={styles.categoryCard}>
                                    <input
                                        type="text"
                                        className={styles.categoryInput}
                                        value={cat.name}
                                        onChange={(e) =>
                                            setCategories((prev) =>
                                                prev.map((c) =>
                                                    c.id === cat.id ? { ...c, name: e.target.value } : c
                                                )
                                            )
                                        }
                                        placeholder={`Category ${index + 1}`}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className={styles.itemsSection}>
                            <div className={styles.itemsHeader}>
                                <label className={styles.label}>Items to Categorize</label>
                                <Button type="button" size="sm" variant="secondary" onClick={addCategoryItem}>
                                    Add Item
                                </Button>
                            </div>
                            <div className={styles.itemsList}>
                                {categoryItems.map((item) => (
                                    <div key={item.id} className={styles.itemRow}>
                                        <input
                                            type="text"
                                            className={styles.itemInput}
                                            value={item.text}
                                            onChange={(e) => updateCategoryItem(item.id, { text: e.target.value })}
                                            placeholder="Item text"
                                        />
                                        <select
                                            className={styles.categorySelect}
                                            value={item.categoryId}
                                            onChange={(e) => updateCategoryItem(item.id, { categoryId: e.target.value })}
                                        >
                                            {categories.map((cat) => (
                                                <option key={cat.id} value={cat.id}>
                                                    {cat.name || `Category ${categories.indexOf(cat) + 1}`}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className={styles.removeButton}
                                            onClick={() => removeCategoryItem(item.id)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                                {categoryItems.length === 0 && (
                                    <p className={styles.emptyItems}>No items yet. Add items to be categorized.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {type === 'numerical' && (
                    <div className={styles.numericalSection}>
                        <div className={styles.numericalRow}>
                            <Input
                                label="Correct Answer"
                                type="number"
                                value={correctAnswer}
                                onChange={(e) => setCorrectAnswer(Number(e.target.value))}
                                fullWidth
                            />
                            <Input
                                label="Tolerance (±)"
                                type="number"
                                value={tolerance}
                                onChange={(e) => setTolerance(Number(e.target.value))}
                                hint="Acceptable deviation from correct answer"
                                fullWidth
                            />
                            <Input
                                label="Unit (Optional)"
                                type="text"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                placeholder="e.g., kg, m, %"
                                fullWidth
                            />
                        </div>
                    </div>
                )}

                {/* Settings */}
                <div className={styles.settings}>
                    <div className={styles.settingRow}>
                        <label className={styles.label}>Time Limit</label>
                        <div className={styles.timeInput}>
                            <input
                                type="number"
                                value={timeLimit}
                                onChange={(e) => setTimeLimit(Number(e.target.value))}
                                min={5}
                                max={300}
                            />
                            <span>seconds</span>
                        </div>
                    </div>

                    <div className={styles.settingRow}>
                        <label className={styles.label}>Double Points</label>
                        <button
                            type="button"
                            className={`${styles.toggle} ${doublePoints ? styles.toggleActive : ''}`}
                            onClick={() => setDoublePoints(!doublePoints)}
                            aria-pressed={doublePoints}
                        >
                            <span className={styles.toggleKnob} />
                        </button>
                    </div>
                </div>

                {/* Actions */}
                <div className={styles.actions}>
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        loading={saving}
                        disabled={!text.trim()}
                    >
                        Save Question
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
