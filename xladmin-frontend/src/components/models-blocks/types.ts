import type {AdminModelMeta} from '../../types';

export type NormalizedBlock = {
    slug: string;
    title: string;
    description?: string | null;
    color?: string | null;
    collapsible: boolean;
    default_expanded: boolean;
    models: AdminModelMeta[];
    isAllModels?: boolean;
};
