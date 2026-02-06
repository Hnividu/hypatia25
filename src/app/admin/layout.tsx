'use client';

import { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import styles from './admin.module.css';

interface AdminLayoutProps {
    children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();

    // Don't show layout on login page
    if (pathname === '/admin/login') {
        return <>{children}</>;
    }

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/admin/login');
    };

    return (
        <div className={styles.layout}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.logo}>
                        <Image
                            src="/MCSS.png"
                            alt="MCSS Logo"
                            width={32}
                            height={32}
                            className={styles.logoImage}
                            priority
                        />
                        <span className={styles.logoText}>Quiz Admin Dashboard</span>
                    </div>

                    <button
                        className={styles.logoutButton}
                        onClick={handleLogout}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span>Logout</span>
                    </button>
                </div>
            </header>

            {/* Main content */}
            <main className={styles.main}>
                {children}
            </main>
        </div>
    );
}
