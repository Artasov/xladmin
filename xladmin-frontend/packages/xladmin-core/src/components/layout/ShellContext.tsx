'use client';

import type {ReactNode} from 'react';
import {createContext, useContext} from 'react';

type ShellContextValue = {
    hasSidebar: boolean;
    sidebarId: string;
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    pendingPath: string | null;
    pendingView: 'overview' | 'model' | 'generic' | null;
    startPendingNavigation: (path: string, view?: 'overview' | 'model' | 'generic') => void;
    finishPendingNavigation: (path?: string) => void;
};

const defaultShellContextValue: ShellContextValue = {
    hasSidebar: false,
    sidebarId: '',
    isSidebarOpen: false,
    toggleSidebar: () => {
    },
    pendingPath: null,
    pendingView: null,
    startPendingNavigation: () => {
    },
    finishPendingNavigation: () => {
    },
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
