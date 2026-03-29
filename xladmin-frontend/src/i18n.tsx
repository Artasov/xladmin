'use client';

import {createContext, type ReactNode, useContext, useMemo} from 'react';
import type {AdminLocale} from './types';

type AdminTranslationKey =
    | 'loading'
    | 'overview'
    | 'overview_title'
    | 'overview_subtitle'
    | 'all_models'
    | 'all_models_description'
    | 'models_load_error'
    | 'model_load_error'
    | 'object_load_error'
    | 'object_save_error'
    | 'object_delete_error'
    | 'object_action_error'
    | 'search'
    | 'filters'
    | 'active_filters'
    | 'reset_filters'
    | 'create'
    | 'all'
    | 'actions'
    | 'selected_count'
    | 'delete'
    | 'save'
    | 'saving'
    | 'deleting'
    | 'executing'
    | 'cancel'
    | 'objects_count'
    | 'yes'
    | 'no'
    | 'delete_object_title'
    | 'delete_bulk_title'
    | 'delete_preview_hint'
    | 'delete_preview_blocked_hint'
    | 'delete_preview_roots'
    | 'delete_preview_delete'
    | 'delete_preview_protect'
    | 'delete_preview_set_null'
    | 'delete_preview_total'
    | 'delete_preview_empty'
    | 'delete_preview_loading'
    | 'delete_preview_error'
    | 'delete_preview_no_selection'
    | 'delete_effect_delete'
    | 'delete_effect_protect'
    | 'delete_effect_set_null'
    | 'invalid_json'
    | 'back'
    | 'menu'
    | 'staff_only';

const messages: Record<AdminLocale, Record<AdminTranslationKey, string>> = {
    ru: {
        loading: 'Загрузка...',
        overview: 'Обзор',
        overview_title: 'Обзор',
        overview_subtitle: 'Кастомные блоки моделей выводятся сверху, ниже всегда доступен общий блок всех моделей.',
        all_models: 'Все модели',
        all_models_description: 'Все подключённые модели доступны в одном общем списке.',
        models_load_error: 'Не удалось загрузить модели.',
        model_load_error: 'Не удалось загрузить модель.',
        object_load_error: 'Не удалось загрузить объект.',
        object_save_error: 'Не удалось сохранить объект.',
        object_delete_error: 'Не удалось удалить объект.',
        object_action_error: 'Не удалось выполнить действие.',
        search: 'Поиск',
        filters: 'Фильтры',
        active_filters: 'Активно: {count}',
        reset_filters: 'Сбросить',
        create: 'Создать',
        all: 'Все',
        actions: 'Действия',
        selected_count: 'Выбрано: {count}',
        delete: 'Удалить',
        save: 'Сохранить',
        saving: 'Сохранение...',
        deleting: 'Удаление...',
        executing: 'Выполнение...',
        cancel: 'Отмена',
        objects_count: '{count} объектов',
        yes: 'Да',
        no: 'Нет',
        delete_object_title: 'Удалить объект?',
        delete_bulk_title: 'Удалить выбранные объекты?',
        delete_preview_hint: 'Будут удалены следующие объекты и связанные записи.',
        delete_preview_blocked_hint: 'Удаление сейчас невозможно: есть связанные объекты, которые блокируют hard delete.',
        delete_preview_roots: 'Выбрано: {count}',
        delete_preview_delete: 'Будут удалены: {count}',
        delete_preview_protect: 'Блокируют удаление: {count}',
        delete_preview_set_null: 'Будут отвязаны: {count}',
        delete_preview_total: 'Всего будет затронуто: {count}',
        delete_preview_empty: 'Связанные объекты не будут удалены.',
        delete_preview_loading: 'Загрузка...',
        delete_preview_error: 'Не удалось построить дерево удаления.',
        delete_preview_no_selection: 'Нет объектов для удаления.',
        delete_effect_delete: 'Удалится',
        delete_effect_protect: 'Блокирует',
        delete_effect_set_null: 'Будет отвязано',
        invalid_json: 'Некорректный JSON.',
        back: 'Назад',
        menu: 'Меню',
        staff_only: 'Доступ к админке есть только у staff-пользователей.',
    },
    en: {
        loading: 'Loading...',
        overview: 'Overview',
        overview_title: 'Overview',
        overview_subtitle: 'Custom model blocks are shown above, and the shared all-models block is always available below.',
        all_models: 'All models',
        all_models_description: 'All connected models are available in one shared list.',
        models_load_error: 'Failed to load models.',
        model_load_error: 'Failed to load model.',
        object_load_error: 'Failed to load object.',
        object_save_error: 'Failed to save object.',
        object_delete_error: 'Failed to delete object.',
        object_action_error: 'Failed to execute action.',
        search: 'Search',
        filters: 'Filters',
        active_filters: 'Active: {count}',
        reset_filters: 'Reset',
        create: 'Create',
        all: 'All',
        actions: 'Actions',
        selected_count: 'Selected: {count}',
        delete: 'Delete',
        save: 'Save',
        saving: 'Saving...',
        deleting: 'Deleting...',
        executing: 'Running...',
        cancel: 'Cancel',
        objects_count: '{count} items',
        yes: 'Yes',
        no: 'No',
        delete_object_title: 'Delete object?',
        delete_bulk_title: 'Delete selected objects?',
        delete_preview_hint: 'The following objects and related records will be deleted.',
        delete_preview_blocked_hint: 'Deletion is currently blocked because related objects prevent hard delete.',
        delete_preview_roots: 'Selected: {count}',
        delete_preview_delete: 'Will be deleted: {count}',
        delete_preview_protect: 'Blocking deletion: {count}',
        delete_preview_set_null: 'Will be detached: {count}',
        delete_preview_total: 'Total affected: {count}',
        delete_preview_empty: 'No related objects will be deleted.',
        delete_preview_loading: 'Loading...',
        delete_preview_error: 'Failed to build delete tree.',
        delete_preview_no_selection: 'No objects selected for deletion.',
        delete_effect_delete: 'Will be deleted',
        delete_effect_protect: 'Blocks deletion',
        delete_effect_set_null: 'Will be detached',
        invalid_json: 'Invalid JSON.',
        back: 'Back',
        menu: 'Menu',
        staff_only: 'Only staff users can access the admin.',
    },
};

const AdminLocaleContext = createContext<AdminLocale>('ru');

type AdminLocaleProviderProps = {
    locale?: string | null;
    children: ReactNode;
};

export function normalizeAdminLocale(locale?: string | null): AdminLocale {
    return locale === 'en' ? 'en' : 'ru';
}

export function translateAdmin(
    locale: string | null | undefined,
    key: AdminTranslationKey,
    params?: Record<string, string | number>,
): string {
    const template = messages[normalizeAdminLocale(locale)][key];
    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function AdminLocaleProvider({locale, children}: AdminLocaleProviderProps) {
    const normalizedLocale = useMemo(() => normalizeAdminLocale(locale), [locale]);
    return (
        <AdminLocaleContext.Provider value={normalizedLocale}>
            {children}
        </AdminLocaleContext.Provider>
    );
}

export function useAdminLocale(): AdminLocale {
    return normalizeAdminLocale(useContext(AdminLocaleContext));
}

export function useAdminTranslation() {
    const locale = useAdminLocale();
    return useMemo(() => (
        (key: AdminTranslationKey, params?: Record<string, string | number>) => translateAdmin(locale, key, params)
    ), [locale]);
}
