export function isDeepEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) {
        return true;
    }

    if (left instanceof Date && right instanceof Date) {
        return left.getTime() === right.getTime();
    }

    if (Array.isArray(left) && Array.isArray(right)) {
        if (left.length !== right.length) {
            return false;
        }
        return left.every((item, index) => isDeepEqual(item, right[index]));
    }

    if (isPlainObject(left) && isPlainObject(right)) {
        const leftKeys = Object.keys(left).sort();
        const rightKeys = Object.keys(right).sort();
        if (!isDeepEqual(leftKeys, rightKeys)) {
            return false;
        }
        return leftKeys.every((key) => isDeepEqual(left[key], right[key]));
    }

    return false;
}


function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
