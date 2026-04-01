'use client';

import {createContext, type ReactNode, useContext} from 'react';
import type {AdminLocale, AdminModelMeta, AdminModelsBlockMeta} from '@xladmin-core/types';

type AdminDataContextValue = {
    locale: AdminLocale;
    models: AdminModelMeta[];
    blocks: AdminModelsBlockMeta[];
};

const defaultAdminDataContextValue: AdminDataContextValue = {
    locale: 'ru',
    models: [],
    blocks: [],
};

const AdminDataContext = createContext<AdminDataContextValue>(defaultAdminDataContextValue);

type AdminDataProviderProps = {
    value: AdminDataContextValue;
    children: ReactNode;
};

export function AdminDataProvider({value, children}: AdminDataProviderProps) {
    return (
        <AdminDataContext.Provider value={value}>
            {children}
        </AdminDataContext.Provider>
    );
}

export function useAdminData() {
    return useContext(AdminDataContext);
}
