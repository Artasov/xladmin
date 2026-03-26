export type AdminFieldMeta = {
    name: string;
    label: string;
    help_text: string | null;
    nullable: boolean;
    read_only: boolean;
    hidden_in_list: boolean;
    hidden_in_detail: boolean;
    hidden_in_form: boolean;
    type: string;
    input_kind: string;
    is_primary_key: boolean;
    is_virtual: boolean;
    has_choices: boolean;
    is_relation: boolean;
    is_relation_many: boolean;
    is_sortable: boolean;
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
    slug: string;
    title: string;
    pk_field: string;
    display_field: string | null;
    page_size: number;
    list_fields: string[];
    detail_fields: string[];
    create_fields: string[];
    update_fields: string[];
    bulk_actions: AdminBulkActionMeta[];
    object_actions: AdminObjectActionMeta[];
    fields: AdminFieldMeta[];
};

export type AdminListResponse = {
    meta: AdminModelMeta;
    pagination: {limit: number; offset: number; total: number};
    items: Record<string, unknown>[];
};

export type AdminDetailResponse = {
    meta: AdminModelMeta;
    item: Record<string, unknown>;
};

export type AdminObjectActionResponse = {
    item: Record<string, unknown>;
    result: Record<string, unknown>;
};

export type AdminModelsResponse = {
    items: AdminModelMeta[];
};

export type AdminChoicesResponse = {
    items: Array<{id: string | number; label: string}>;
};
