'use client';

import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ImageUpload.module.css';

interface ImageUploadProps {
    value?: string; // Base64 or URL
    onChange: (value: string) => void;
    maxSizeMB?: number; // Default 5MB
    label?: string;
}

export default function ImageUpload({ value, onChange, maxSizeMB = 4.5, label = 'Image' }: ImageUploadProps) {
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [uploading, setUploading] = useState(false);

    const handleFile = async (file: File) => {
        // Validation
        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file (JPG, PNG, GIF, WEBP)');
            return;
        }

        if (file.size > maxSizeMB * 1024 * 1024) {
            setError(`Image size must be less than ${maxSizeMB}MB`);
            return;
        }

        setError(null);
        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();
            onChange(data.url);
        } catch (err) {
            console.error(err);
            setError('Failed to upload image. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleDrag = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    return (
        <div className={styles.uploadContainer}>
            {label && <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>{label}</label>}

            <div
                className={`${styles.dropZone} ${dragActive ? styles.dragActive : ''} ${value ? styles.hasImage : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    className={styles.fileInput}
                    accept="image/*"
                    onChange={handleChange}
                />

                <AnimatePresence mode="wait">
                    {value ? (
                        <motion.div
                            key="preview"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={styles.previewContainer}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={value} alt="Preview" className={styles.previewImage} />
                            <button
                                type="button"
                                className={styles.removeButton}
                                onClick={handleRemove}
                                title="Remove Image"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="prompt"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={styles.uploadPrompt}
                        >
                            <div className={styles.uploadIcon}>
                                {uploading ? '⏳' : '🖼️'}
                            </div>
                            <span className={styles.uploadText}>
                                {uploading ? 'Uploading...' : 'Click to upload or drag & drop'}
                            </span>
                            {!uploading && (
                                <span className={styles.uploadSubtext}>JPG, PNG, GIF up to {maxSizeMB}MB</span>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {error && (
                <motion.div
                    className={styles.errorMessage}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    ⚠️ {error}
                </motion.div>
            )}
        </div>
    );
}
