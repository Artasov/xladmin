import {isDeepEqual} from '../../utils/isDeepEqual';

/** Refresh server-owned fields without discarding an unsaved card draft. */
export function mergeObjectActionValues(
    values: Record<string, unknown>,
    baseline: Record<string, unknown>,
    item: Record<string, unknown>,
    editableNames: ReadonlySet<string>,
): Record<string, unknown> {
    const next = {...item};
    for (const name of editableNames) {
        if (!isDeepEqual(values[name], baseline[name])) next[name] = values[name];
    }
    return next;
}
