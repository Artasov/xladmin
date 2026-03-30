'use client';

import type {CSSProperties, ReactNode} from 'react';
import Link from 'next/link.js';

type AdminNavLinkProps = {
    href: string;
    children: ReactNode;
    style?: CSSProperties;
    title?: string;
    onClick?: () => void;
};

export type NavLinkProps = AdminNavLinkProps;

export function NavLink({href, children, style, title, onClick}: NavLinkProps) {
    return (
        <Link href={href} style={style} title={title} onClick={onClick}>
            {children}
        </Link>
    );
}
