'use client';

import type {ReactNode} from 'react';
import {createContext, useContext} from 'react';

type ShellContextValue = {
    isMobile: boolean;
    openMobileSidebar: () => void;
    pendingPath: string | null;
    pendingView: 'overview' | 'model' | 'generic' | null;
    startPendingNavigation: (path: string, view?: 'overview' | 'model' | 'generic') => void;
};

const defaultShellContextValue: ShellContextValue = {
    isMobile: false,
    openMobileSidebar: () => {},
    pendingPath: null,
    pendingView: null,
    startPendingNavigation: () => {},
};

const ShellContext = createContext<ShellContextValue>(defaultShellContextValue);

export function ShellContextProvider({
    value,
    children,
}: {
    value: ShellContextValue;
    children: ReactNode;
}) {
    return (
        <ShellContext.Provider value={value}>
            {children}
        </ShellContext.Provider>
    );
}

export function useShellContext() {
    return useContext(ShellContext);
}
