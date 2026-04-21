'use client';

import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    leftIcon?: ReactNode;
    wrapperClassName?: string;
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(' ');
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
    { className, leftIcon, wrapperClassName, ...props },
    ref
) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className={joinClasses('relative', wrapperClassName)}>
            {leftIcon && (
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-warm-border">
                    {leftIcon}
                </div>
            )}
            <input
                {...props}
                ref={ref}
                type={showPassword ? 'text' : 'password'}
                className={joinClasses(leftIcon ? 'pl-11' : 'pl-4', 'pr-12', className)}
            />
            <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center text-warm-outline transition-colors hover:text-warm-dark"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
            >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
        </div>
    );
});

export default PasswordInput;
