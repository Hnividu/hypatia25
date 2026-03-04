import { useState, useEffect, useMemo } from 'react';
// Framer motion removed for performance
import Button from '@/components/ui/Button';
import { QuestionForParticipant } from '@/types/quiz';
import {
    DndContext,
    DragOverlay,
    DragStartEvent,
    DragEndEvent,
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor,
    KeyboardSensor
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { DraggableItem, DroppableContainer } from './DragDropComponents';
import styles from './QuestionView.module.css';

interface QuestionViewProps {
    question: QuestionForParticipant;
    questionNumber: number;
    totalQuestions: number;
    timeRemaining: number;
    onSubmit: (answer: any) => void;
    submitted: boolean;
}

export default function QuestionView({
    question,
    questionNumber,
    totalQuestions,
    timeRemaining,
    onSubmit,
    submitted
}: QuestionViewProps) {
    // Generic answer state
    const [answer, setAnswer] = useState<any>(null);

    // Categorize specific state
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

    // Reset state when question changes
    useEffect(() => {
        setAnswer(null);
        setSelectedItemId(null);
    }, [question.id]);

    const handleSubmit = () => {
        if (canSubmit && !submitted) {
            onSubmit(answer);
        }
    };

    const isMCQ = question.type === 'mcq';
    const isNumerical = question.type === 'numerical';
    const isCategorize = question.type === 'categorize';

    // Helper to check if answer is valid/complete enough to submit
    const canSubmit = useMemo(() => {
        if (submitted) return false;
        if (timeRemaining === 0) return false;

        if (isMCQ) return !!answer;
        if (isNumerical) return answer !== null && answer !== '' && !isNaN(Number(answer));
        if (isCategorize) {
            // Check if all items are placed
            const placements = answer as { itemId: string; categoryId: string }[] || [];
            // In types: items is {id, text}[]
            const totalItems = (question as any).items?.length || 0;
            return placements.length === totalItems;
        }
        return false;
    }, [answer, submitted, timeRemaining, isMCQ, isNumerical, isCategorize, question]);

    // ─────────────────────────────────────────────────────────────────────────────
    // Categorize Handlers
    // ─────────────────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────────────────
    // Categorize Handlers (DnD)
    // ─────────────────────────────────────────────────────────────────────────────

    // DnD State
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        if (submitted) return;
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return; // Dropped outside

        const itemId = active.id as string;
        const targetId = over.id as string;

        const currentPlacements = (answer as { itemId: string; categoryId: string }[]) || [];
        const filtered = currentPlacements.filter(p => p.itemId !== itemId); // Remove existing placement

        if (targetId === 'pool') {
            // Dropped back in pool: just remove from placements (already done by filtered)
            setAnswer(filtered);
        } else {
            // Dropped in a category: add new placement
            setAnswer([...filtered, { itemId, categoryId: targetId }]);
        }
    };

    // Derived state for categorize view
    const categorizeState = useMemo(() => {
        if (!isCategorize) return null;

        const q = question as any; // Cast to access items/categories
        const placements = (answer as { itemId: string; categoryId: string }[]) || [];
        const placedItemIds = new Set(placements.map(p => p.itemId));

        // When dragging, we might want to keep the item in its original place visually 
        // until drop, OR just let the DragOverlay handle it. 
        // For standard dnd-kit lists, usually the item "disappears" from the list 
        // while the overlay follows the cursor.

        // Items NOT in any category (and not currently being dragged out of pool effectively)
        const unplacedItems = q.items.filter((i: any) => !placedItemIds.has(i.id));

        const itemsByCategory = new Map<string, any[]>();
        q.categories.forEach((c: any) => itemsByCategory.set(c.id, []));

        placements.forEach(p => {
            const item = q.items.find((i: any) => i.id === p.itemId);
            if (item) {
                itemsByCategory.get(p.categoryId)?.push(item);
            }
        });

        return { unplacedItems, itemsByCategory };
    }, [question, answer, isCategorize]);

    // ─────────────────────────────────────────────────────────────────────────────

    return (
        <div className={styles.container}>
            {/* Header: Progress & Timer */}
            <div className={styles.header}>
                <div className={styles.progress}>
                    <span className={styles.questionNumber}>
                        Question {questionNumber}
                        <span className={styles.total}>/{totalQuestions}</span>
                    </span>
                    <div className={styles.progressBar}>
                        <div
                            className={styles.progressFill}
                            style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
                        />
                    </div>
                </div>
                <div className={`${styles.timer} ${timeRemaining <= 5 ? styles.urgent : ''}`}>
                    <span className={styles.timerIcon}>⏱️</span>
                    <span className={styles.timeValue}>{timeRemaining}s</span>
                </div>
            </div>

            {/* Question Text */}
            <div className={styles.questionCard} key={question.id}>
                <h2 className={styles.questionText}>
                    {'text' in question ? question.text : (question as any).title}
                </h2>
            </div>

            {/* ─────────────────────────────────────────────────────────────────────────────
               MCQ VIEW
               ───────────────────────────────────────────────────────────────────────────── */}
            {isMCQ && (
                <div className={styles.optionsGrid}>
                    {(question as any).options.map((option: any, index: number) => (
                        <button
                            key={option.id}
                            className={`${styles.optionButton} ${answer === option.id ? styles.selected : ''
                                } ${submitted ? styles.disabled : ''}`}
                            onClick={() => !submitted && setAnswer(option.id)}
                            disabled={submitted}
                        >
                            <span className={styles.optionLabel}>{String.fromCharCode(65 + index)}</span>
                            <span className={styles.optionText}>{option.text}</span>
                            {answer === option.id && (
                                <span className={styles.checkMark}>✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────────────────
               NUMERICAL VIEW
               ───────────────────────────────────────────────────────────────────────────── */}
            {isNumerical && (
                <div className={styles.numericalContainer}>
                    <input
                        type="number"
                        className={styles.numericalInput}
                        placeholder="Enter value"
                        value={answer === null || isNaN(answer) ? '' : answer}
                        onChange={(e) => {
                            const val = e.target.value;
                            setAnswer(val === '' ? '' : parseFloat(val));
                        }}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        disabled={submitted}
                    />
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────────────────
               CATEGORIZE VIEW
               ───────────────────────────────────────────────────────────────────────────── */}
            {/* ─────────────────────────────────────────────────────────────────────────────
               CATEGORIZE VIEW (Drag & Drop)
               ───────────────────────────────────────────────────────────────────────────── */}
            {isCategorize && categorizeState && (
                <DndContext
                    sensors={sensors}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className={styles.categorizeContainer}>
                        {/* Pool of unplaced items */}
                        <DroppableContainer id="pool" className={styles.itemsPool}>
                            {categorizeState.unplacedItems.map((item: any) => (
                                <DraggableItem
                                    key={item.id}
                                    id={item.id}
                                    text={item.text}
                                    disabled={submitted}
                                />
                            ))}
                            {categorizeState.unplacedItems.length === 0 && (
                                <div style={{ color: '#888', fontStyle: 'italic', padding: '1rem' }}>
                                    All items placed
                                </div>
                            )}
                        </DroppableContainer>

                        {/* Category Buckets */}
                        <div className={styles.categoriesRow}>
                            {(question as any).categories.map((cat: any) => (
                                <DroppableContainer
                                    key={cat.id}
                                    id={cat.id}
                                    className={styles.categoryBucket}
                                >
                                    <div className={styles.categoryTitle}>{cat.name}</div>
                                    {categorizeState.itemsByCategory.get(cat.id)?.map((item: any) => (
                                        <DraggableItem
                                            key={item.id}
                                            id={item.id}
                                            text={item.text}
                                            disabled={submitted}
                                        />
                                    ))}
                                </DroppableContainer>
                            ))}
                        </div>
                    </div>

                    <DragOverlay>
                        {activeId ? (
                            <div className={styles.draggableItem} style={{ background: '#fbbf24', color: 'black' }}>
                                {/* Find the item text regardless of where it is */}
                                {[...categorizeState.unplacedItems, ...Array.from(categorizeState.itemsByCategory.values()).flat()]
                                    .find((i: any) => i.id === activeId)?.text}
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            )}

            {/* Submit Button */}
            <div className={styles.footer}>
                <div className={styles.statusMessage}>
                    {submitted ? (
                        <span className={styles.waitingText}>
                            Answer submitted! Waiting for others...
                        </span>
                    ) : (
                        timeRemaining === 0 && <span className={styles.timeUpText}>Time's up!</span>
                    )}
                </div>
                {!submitted && (
                    <Button
                        onClick={handleSubmit}
                        disabled={!canSubmit || timeRemaining === 0}
                        className={styles.submitButton}
                    >
                        Submit Answer
                    </Button>
                )}
            </div>
        </div>
    );
}
