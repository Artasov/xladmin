'use client';

import type {CSSProperties, ReactNode} from 'react';
import type {XLAdminRouter} from '../router';
import {handleNavLinkClick, useXLAdminRouter} from '../router';

type AdminNavLinkProps = {
    href: string;
    children: ReactNode;
    style?: CSSProperties;
    title?: string;
    onClick?: () => void;
    router?: XLAdminRouter;
};

export type NavLinkProps = AdminNavLinkProps;

export function NavLink({href, children, style, title, onClick, router}: NavLinkProps) {
    const resolvedRouter = useXLAdminRouter(router);

    return (
        <a
            href={href}
            style={style}
            title={title}
            onClick={(event) => handleNavLinkClick(event, {href, onClick, router: resolvedRouter})}
        >
            {children}
        </a>
    );
}
