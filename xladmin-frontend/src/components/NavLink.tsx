'use client';

import type {CSSProperties, ReactNode} from 'react';
import Link from 'next/link.js';

type AdminNavLinkProps = {
    href: string;
    children: ReactNode;
    style?: CSSProperties;
    title?: string;
};

export type NavLinkProps = AdminNavLinkProps;

export function NavLink({href, children, style, title}: NavLinkProps) {
    return (
        <Link href={href} style={style} title={title}>
            {children}
        </Link>
    );
}
