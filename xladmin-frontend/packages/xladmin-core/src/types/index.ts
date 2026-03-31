export type AdminLocale = 'ru' | 'en';

export type AdminFieldInputKind =
    | 'text'
    | 'textarea'
    | 'password'
    | 'number'
    | 'decimal'
    | 'boolean'
    | 'date'
    | 'datetime'
    | 'json'
    | 'relation'
    | 'relation-multiple';

export type AdminFieldDisplayKind = 'text' | 'image';

export type AdminListFilterInputKind = 'text' | 'select' | 'boolean';

export type AdminFieldMeta = {
    name: string;
    label: string;
    help_text: string | null;
    width_px?: number | null;
    display_kind: AdminFieldDisplayKind;
    image_url_prefix?: string | null;
    nullable: boolean;
    read_only: boolean;
    hidden_in_list: boolean;
    hidden_in_detail: boolean;
    hidden_in_form: boolean;
    type: string;
    input_kind: AdminFieldInputKind;
    is_primary_key: boolean;
    is_virtual: boolean;
    has_choices: boolean;
    is_relation: boolean;
    is_relation_many: boolean;
    is_sortable: boolean;
};

export type AdminListFilterOptionMeta = {
    value: string;
    label: string;
};

export type AdminListFilterMeta = {
    slug: string;
    label: string;
    group: string | null;
    field_name: string | null;
    input_kind: AdminListFilterInputKind;
    placeholder: string | null;
    has_choices: boolean;
    options: AdminListFilterOptionMeta[];
};

export type AdminBulkActionMeta = {
    slug: string;
    label: string;
};

export type AdminObjectActionMeta = {
    slug: string;
    label: string;
};

export type AdminModelMeta = {
    locale: AdminLocale;
    slug: string;
    title: string;
    description?: string | null;
    pk_field: string;
    display_field: string | null;
    page_size: number;
    list_filters: AdminListFilterMeta[];
    list_fields: string[];
    detail_fields: string[];
    create_fields: string[];
    update_fields: string[];
    bulk_actions: AdminBulkActionMeta[];
    object_actions: AdminObjectActionMeta[];
    fields: AdminFieldMeta[];
};

export type AdminModelsBlockMeta = {
    slug: string;
    title: string;
    description?: string | null;
    color?: string | null;
    collapsible: boolean;
    default_expanded: boolean;
    models: AdminModelMeta[];
};

export type AdminListResponse = {
    meta: AdminModelMeta;
    pagination: { limit: number; offset: number; total: number };
    items: Record<string, unknown>[];
};

export type AdminDetailResponse = {
    meta: AdminModelMeta;
    item: Record<string, unknown>;
};

export type AdminDeletePreviewNode = {
    model_slug: string | null;
    model_title: string;
    relation_name: string | null;
    id: string | number;
    label: string;
    effect: 'delete' | 'protect' | 'set-null';
    children: AdminDeletePreviewNode[];
};

export type AdminDeletePreviewResponse = {
    can_delete: boolean;
    summary: {
        roots: number;
        delete: number;
        protect: number;
        set_null: number;
        total: number;
    };
    roots: AdminDeletePreviewNode[];
};

export type AdminObjectActionResponse = {
    item: Record<string, unknown>;
    result: Record<string, unknown>;
};

export type AdminModelsResponse = {
    locale: AdminLocale;
    items: AdminModelMeta[];
    blocks: AdminModelsBlockMeta[];
};

export type AdminChoicesResponse = {
    items: Array<{ id: string | number; label: string }>;
};
