'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import styles from './QuestionView.module.css';

interface DraggableItemProps {
    id: string;
    text: string;
    disabled?: boolean;
}

export function DraggableItem({ id, text, disabled }: DraggableItemProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: id,
        data: { text },
        disabled
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 2 : 1,
        opacity: isDragging ? 0.5 : 1, // Visual feedback when dragging source
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={styles.draggableItem}
        >
            {text}
        </div>
    );
}

import { useDroppable } from '@dnd-kit/core';

interface DroppableContainerProps {
    id: string;
    className?: string;
    children: React.ReactNode;
    active?: boolean;
}

export function DroppableContainer({ id, className, children, active }: DroppableContainerProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: id,
    });

    return (
        <div
            ref={setNodeRef}
            className={`${className} ${isOver ? styles.droppableActive : ''}`}
        >
            {children}
        </div>
    );
}
