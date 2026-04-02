'use client';

import type {CSSProperties, ReactNode} from 'react';
import type {AdminRouter} from '../router';
import {handleNavLinkClick, useAdminRouter} from '../router';

type AdminNavLinkProps = {
    href: string;
    children: ReactNode;
    style?: CSSProperties;
    title?: string;
    onClick?: () => void;
    router?: AdminRouter;
};

export type NavLinkProps = AdminNavLinkProps;

export function NavLink({href, children, style, title, onClick, router}: NavLinkProps) {
    const resolvedRouter = useAdminRouter(router);

    return (
        <a
            href={href}
            style={{
                color: 'inherit',
                ...style,
            }}
            title={title}
            onClick={(event) => handleNavLinkClick(event, {href, onClick, router: resolvedRouter})}
        >
            {children}
        </a>
    );
}
