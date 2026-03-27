'use client';

import type {CSSProperties, ReactNode} from 'react';
import Link from 'next/link.js';

type AdminNavLinkProps = {
    href: string;
    children: ReactNode;
    style?: CSSProperties;
};

export function AdminNavLink({href, children, style}: AdminNavLinkProps) {
    return (
        <Link href={href} style={style}>
            {children}
        </Link>
    );
}
