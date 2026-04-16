import Link from 'next/link';
import type { ReactNode } from 'react';

function cx(...values: Array<string | false | null | undefined>) {
    return values.filter(Boolean).join(' ');
}

export function ExperiencePage({
    children,
    containerClassName,
    className,
}: {
    children: ReactNode;
    containerClassName?: string;
    className?: string;
}) {
    return (
        <div className={cx('experience-shell', className)}>
            <div className={cx('experience-container', containerClassName)}>{children}</div>
        </div>
    );
}

export function ExperienceBackLink({
    href,
    children,
    className,
}: {
    href: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <Link
            href={href}
            className={cx(
                'experience-button experience-button-secondary mb-8 w-fit text-[11px] tracking-[0.22em]',
                className
            )}
        >
            {children}
        </Link>
    );
}

export function ExperienceHero({
    kicker,
    title,
    subtitle,
    aside,
    className,
}: {
    kicker?: ReactNode;
    title: ReactNode;
    subtitle?: ReactNode;
    aside?: ReactNode;
    className?: string;
}) {
    return (
        <header
            className={cx(
                'mb-12 flex flex-col gap-8 md:mb-16 md:flex-row md:items-end md:justify-between',
                className
            )}
        >
            <div className="max-w-3xl">
                {kicker ? <div className="mb-6">{kicker}</div> : null}
                <h1 className="experience-title">{title}</h1>
                {subtitle ? <div className="experience-subtitle mt-6">{subtitle}</div> : null}
            </div>
            {aside ? <div className="w-full max-w-sm">{aside}</div> : null}
        </header>
    );
}

export function ExperiencePanel({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return <div className={cx('experience-panel p-6 md:p-8', className)}>{children}</div>;
}

export function ExperienceCard({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return <div className={cx('experience-card p-5 md:p-6', className)}>{children}</div>;
}
