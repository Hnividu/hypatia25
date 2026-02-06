'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import QuestionEditor, { QuestionFormData, MCQData, NumericalData, CategorizeData } from '@/components/admin/QuestionEditor';
import SectionCardEditor, { SectionCardFormData } from '@/components/admin/SectionCardEditor';
import AdminSessionPanel from '@/components/admin/AdminSessionPanel';
import Link from 'next/link';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './dashboard.module.css';

function SortableItem({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: 'none'
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={className}>
            {children}
        </div>
    );
}

interface QuizData {
    id: string;
    name: string;
    description: string;
    updatedAt?: string;
    questionCount: number;
}

interface Question {
    id: string;
    type: 'mcq' | 'numerical' | 'categorize';
    text: string;
    order: number;
    timeLimit: number;
    doublePoints: boolean;
    data: string;
}

interface SectionCard {
    id: string;
    quizId: string;
    title: string;
    content: string;
    order: number;
    createdAt: string;
}

export default function AdminDashboardPage() {
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [sections, setSections] = useState<SectionCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);

    // Edit states
    const [editingQuizInfo, setEditingQuizInfo] = useState(false);
    const [quizName, setQuizName] = useState('');
    const [quizDescription, setQuizDescription] = useState('');

    // Question editor states
    const [showQuestionEditor, setShowQuestionEditor] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

    // Section editor states
    const [showSectionEditor, setShowSectionEditor] = useState(false);
    const [editingSection, setEditingSection] = useState<SectionCard | null>(null);

    // Draggable Items State
    type DashboardItem = (Question & { itemType: 'question' }) | (SectionCard & { itemType: 'section' });
    const [items, setItems] = useState<DashboardItem[]>([]);
    const [orderChanged, setOrderChanged] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const fetchQuiz = useCallback(async () => {
        try {
            const [quizRes, sectionsRes] = await Promise.all([
                fetch('/api/quizzes'),
                fetch('/api/quizzes/sections')
            ]);

            const quizData = await quizRes.json();
            const sectionsData = await sectionsRes.json();

            if (!quizRes.ok) throw new Error(quizData.error);
            if (!sectionsRes.ok) throw new Error(sectionsData.error);

            if (quizData.warning) {
                // Determine missing sheets for better error message
                let missingSheetsMsg = '';
                if (quizData.debug?.availableSheets) {
                    const required = ['Quiz', 'Questions', 'Leaderboard', 'SectionCards'];
                    const available = quizData.debug.availableSheets;
                    const missing = required.filter(s => !available.includes(s));
                    if (missing.length > 0) {
                        missingSheetsMsg = ` Missing sheets: ${missing.join(', ')}.`;
                    }
                }
                setWarning(`${quizData.warning}${missingSheetsMsg}`);
            } else {
                setWarning(null);
            }

            setQuiz(quizData.quiz);
            setQuestions(quizData.questions || []);
            setSections(sectionsData.sections || []);

            // Populate Items
            const loadedQuestions = (quizData.questions || []).map((q: Question) => ({ ...q, itemType: 'question' as const }));
            const loadedSections = (sectionsData.sections || []).map((s: SectionCard) => ({ ...s, itemType: 'section' as const }));
            const merged = [...loadedQuestions, ...loadedSections].sort((a: any, b: any) => a.order - b.order);
            setItems(merged);

            setQuizName(quizData.quiz?.name || '');
            setQuizDescription(quizData.quiz?.description || '');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load quiz');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQuiz();
    }, [fetchQuiz]);

    const handleSaveQuizInfo = async () => {
        setSaving(true);
        try {
            const response = await fetch('/api/quizzes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: quizName, description: quizDescription }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error);
            }

            setQuiz((prev) => prev ? { ...prev, name: quizName, description: quizDescription } : null);
            setEditingQuizInfo(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save quiz');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveQuestion = async (data: QuestionFormData) => {
        setSaving(true);
        try {
            const payload = {
                type: data.type,
                text: data.text,
                order: editingQuestion?.order ?? questions.length,
                timeLimit: data.timeLimit,
                doublePoints: data.doublePoints,
                data: JSON.stringify(data.data),
            };

            let response: Response;

            if (data.id) {
                // Update existing question
                response = await fetch(`/api/quizzes/questions/${data.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } else {
                // Create new question
                response = await fetch('/api/quizzes/questions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            }

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error);
            }

            // Refresh questions
            await fetchQuiz();
            setShowQuestionEditor(false);
            setEditingQuestion(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save question');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteQuestion = async (questionId: string) => {
        if (!confirm('Are you sure you want to delete this question?')) return;

        try {
            const response = await fetch(`/api/quizzes/questions/${questionId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error);
            }

            setQuestions((prev) => prev.filter((q) => q.id !== questionId));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete question');
        }
    };

    const handleEditQuestion = (question: Question) => {
        setEditingQuestion(question);
        setShowQuestionEditor(true);
    };

    const handleSaveSection = async (data: SectionCardFormData) => {
        setSaving(true);
        try {
            const payload = {
                title: data.title,
                content: data.content,
                order: editingSection?.order ?? (questions.length + sections.length),
            };

            let response: Response;

            if (data.id) {
                // Update existing section
                response = await fetch(`/api/quizzes/sections/${data.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } else {
                // Create new section
                response = await fetch('/api/quizzes/sections', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            }

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error);
            }

            // Refresh quiz data
            await fetchQuiz();
            setShowSectionEditor(false);
            setEditingSection(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save section');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSection = async (sectionId: string) => {
        if (!confirm('Are you sure you want to delete this section card?')) return;

        try {
            const response = await fetch(`/api/quizzes/sections/${sectionId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error);
            }

            setSections((prev) => prev.filter((s) => s.id !== sectionId));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete section');
        }
    };

    const handleEditSection = (section: SectionCard) => {
        setEditingSection(section);
        setShowSectionEditor(true);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
            setOrderChanged(true);
        }
    };

    const handleSaveOrder = async () => {
        setSaving(true);
        try {
            const updates = items.map((item, index) => ({
                id: item.id,
                type: item.itemType,
                order: index + 1
            }));

            const response = await fetch('/api/quizzes/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: updates }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update order');
            }

            setOrderChanged(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save order');
        } finally {
            setSaving(false);
        }
    };

    const parseQuestionData = (question: Question): QuestionFormData => {
        let parsedData: MCQData | NumericalData | CategorizeData;

        try {
            parsedData = JSON.parse(question.data);
        } catch {
            // Default data based on type
            if (question.type === 'mcq') {
                parsedData = { options: [], correctOptionId: '' };
            } else if (question.type === 'numerical') {
                parsedData = { correctAnswer: 0, tolerance: 0 };
            } else {
                parsedData = { categories: [], items: [] };
            }
        }

        return {
            id: question.id,
            type: question.type,
            text: question.text,
            timeLimit: question.timeLimit,
            doublePoints: question.doublePoints,
            data: parsedData,
        };
    };

    const getQuestionTypeLabel = (type: string) => {
        switch (type) {
            case 'mcq': return 'Multiple Choice';
            case 'numerical': return 'Numerical';
            case 'categorize': return 'Categorize';
            default: return type;
        }
    };

    const getQuestionTypeIcon = (type: string) => {
        switch (type) {
            case 'mcq': return '📝';
            case 'numerical': return '🔢';
            case 'categorize': return '📊';
            default: return '❓';
        }
    };

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <p>Loading quiz...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1>Quiz Editor</h1>
                    <p className={styles.subtitle}>Manage the quiz and questions</p>
                </div>
            </header>

            {error && (
                <div className={styles.errorBanner}>
                    <p>{error}</p>
                    <button onClick={() => setError(null)}>✕</button>
                </div>
            )}

            {warning && (
                <div className={styles.errorBanner} style={{ background: 'rgba(234, 179, 8, 0.2)', borderColor: 'rgba(234, 179, 8, 0.5)', color: '#fcd34d' }}>
                    <p>⚠️ {warning}</p>
                    <button onClick={() => setWarning(null)} style={{ color: '#fcd34d' }}>✕</button>
                </div>
            )}

            {/* Live Session Section */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={styles.section}
            >
                <AdminSessionPanel sessionId="hypatia25" />
            </motion.section>

            {/* Quiz Info Section */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={styles.section}
            >
                <Card variant="elevated">
                    <CardHeader>
                        <div className={styles.sectionHeader}>
                            <CardTitle>Quiz Information</CardTitle>
                            {!editingQuizInfo && (
                                <Button variant="secondary" onClick={() => setEditingQuizInfo(true)}>
                                    Edit
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {editingQuizInfo ? (
                            <div className={styles.editForm}>
                                <Input
                                    label="Quiz Name"
                                    value={quizName}
                                    onChange={(e) => setQuizName(e.target.value)}
                                    placeholder="Enter quiz name..."
                                    fullWidth
                                />
                                <div className={styles.textareaWrapper}>
                                    <label className={styles.label}>Description</label>
                                    <textarea
                                        className={styles.textarea}
                                        value={quizDescription}
                                        onChange={(e) => setQuizDescription(e.target.value)}
                                        placeholder="Enter quiz description..."
                                        rows={3}
                                    />
                                </div>
                                <div className={styles.editActions}>
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            setEditingQuizInfo(false);
                                            setQuizName(quiz?.name || '');
                                            setQuizDescription(quiz?.description || '');
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSaveQuizInfo} loading={saving}>
                                        Save
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.quizInfo}>
                                <h2 className={styles.quizName}>{quiz?.name || 'Untitled Quiz'}</h2>
                                <p className={styles.quizDescription}>
                                    {quiz?.description || 'No description provided'}
                                </p>
                                <div className={styles.quizMeta}>
                                    <span>{questions.length} questions</span>
                                    {quiz?.updatedAt && (
                                        <span>Last updated: {new Date(quiz.updatedAt).toLocaleDateString()}</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.section>

            {/* Questions Section */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={styles.section}
            >
                <Card>
                    <CardHeader>
                        <div className={styles.sectionHeader}>
                            <CardTitle>
                                Questions ({items.length})
                                {orderChanged && (
                                    <Button
                                        onClick={handleSaveOrder}
                                        loading={saving}
                                        style={{ marginLeft: '1rem', fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}
                                    >
                                        💾 Save Order
                                    </Button>
                                )}
                            </CardTitle>
                            {!showQuestionEditor && (
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Button onClick={() => {
                                        setEditingQuestion(null);
                                        setShowQuestionEditor(true);
                                    }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                        Add Question
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            setEditingSection(null);
                                            setShowSectionEditor(true);
                                        }}
                                        style={{ marginLeft: '0.5rem' }}
                                    >
                                        <span style={{ marginRight: '0.5rem' }}>📑</span>
                                        Add Section
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <AnimatePresence mode="wait">
                            {showQuestionEditor ? (
                                <motion.div
                                    key="editor"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                >
                                    <QuestionEditor
                                        initialData={editingQuestion ? parseQuestionData(editingQuestion) : undefined}
                                        onSave={handleSaveQuestion}
                                        onCancel={() => {
                                            setShowQuestionEditor(false);
                                            setEditingQuestion(null);
                                        }}
                                        saving={saving}
                                    />
                                </motion.div>
                            ) : showSectionEditor ? (
                                <motion.div
                                    key="sectionEditor"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                >
                                    <SectionCardEditor
                                        initialData={editingSection ? {
                                            id: editingSection.id,
                                            title: editingSection.title,
                                            content: editingSection.content,
                                            order: editingSection.order
                                        } : undefined}
                                        onSave={handleSaveSection}
                                        onCancel={() => {
                                            setShowSectionEditor(false);
                                            setEditingSection(null);
                                        }}
                                        saving={saving}
                                    />
                                </motion.div>
                            ) : (items.length === 0) ? (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className={styles.empty}
                                >
                                    <div className={styles.emptyIcon}>📝</div>
                                    <p>No questions yet</p>
                                    <p className={styles.emptyHint}>Click &quot;Add Question&quot; to create your first question</p>
                                </motion.div>
                            ) : (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext
                                        items={items.map(i => i.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className={styles.questionList}>
                                            {items.map((item, index) => (
                                                <SortableItem
                                                    key={item.id}
                                                    id={item.id}
                                                    className={`${styles.questionCard} ${item.itemType === 'section' ? styles.sectionCard : ''}`}
                                                >
                                                    <div
                                                        style={{
                                                            padding: '0 0.5rem',
                                                            cursor: 'grab',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            color: 'rgba(255,255,255,0.3)',
                                                            fontSize: '1.2rem',
                                                            marginRight: '0.5rem'
                                                        }}
                                                        title="Drag to reorder"
                                                    >
                                                        ⋮⋮
                                                    </div>

                                                    {item.itemType === 'question' ? (
                                                        // Render Question Card
                                                        <>
                                                            <div className={styles.questionNumber}>
                                                                Q{items.slice(0, index).filter(i => i.itemType === 'question').length + 1}
                                                            </div>
                                                            <div className={styles.questionContent}>
                                                                <div className={styles.questionType}>
                                                                    <span className={styles.typeIcon}>{getQuestionTypeIcon(item.type)}</span>
                                                                    {getQuestionTypeLabel(item.type)}
                                                                </div>
                                                                <p className={styles.questionText}>{item.text}</p>

                                                                <div className={styles.questionMeta}>
                                                                    <span>{item.timeLimit}s</span>
                                                                    {item.doublePoints && <span className={styles.doublePoints}>2x Points</span>}
                                                                </div>
                                                            </div>
                                                            <div className={styles.questionActions}>
                                                                <button
                                                                    className={styles.actionButton}
                                                                    onClick={() => handleEditQuestion(item)}
                                                                    title="Edit"
                                                                >
                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    className={`${styles.actionButton} ${styles.deleteButton}`}
                                                                    onClick={() => handleDeleteQuestion(item.id)}
                                                                    title="Delete"
                                                                >
                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                        <polyline points="3 6 5 6 21 6" />
                                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        // Render Section Card
                                                        <>
                                                            <div className={styles.sectionBadge}>SECTION</div>
                                                            <div className={styles.questionContent}>
                                                                <h3 className={styles.sectionTitle}>{item.title}</h3>
                                                                <p className={styles.sectionContent}>{item.content}</p>
                                                            </div>
                                                            <div className={styles.questionActions}>
                                                                <button
                                                                    className={styles.actionButton}
                                                                    onClick={() => handleEditSection(item)}
                                                                    title="Edit Section"
                                                                >
                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    className={`${styles.actionButton} ${styles.deleteButton}`}
                                                                    onClick={() => handleDeleteSection(item.id)}
                                                                    title="Delete Section"
                                                                >
                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                        <polyline points="3 6 5 6 21 6" />
                                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </SortableItem>
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Card>
            </motion.section >
        </div >
    );
}
