'use client';

import type {ReactNode} from 'react';
import {createContext, useContext} from 'react';

type ShellContextValue = {
    isMobile: boolean;
    openMobileSidebar: () => void;
};

const defaultShellContextValue: ShellContextValue = {
    isMobile: false,
    openMobileSidebar: () => {},
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
