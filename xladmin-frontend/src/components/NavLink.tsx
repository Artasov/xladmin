'use client';

import type {CSSProperties, ReactNode} from 'react';
import Link from 'next/link.js';

type AdminNavLinkProps = {
    href: string;
    children: ReactNode;
    style?: CSSProperties;
};

export type NavLinkProps = AdminNavLinkProps;

export function NavLink({href, children, style}: NavLinkProps) {
    return (
        <Link href={href} style={style}>
            {children}
        </Link>
    );
}
