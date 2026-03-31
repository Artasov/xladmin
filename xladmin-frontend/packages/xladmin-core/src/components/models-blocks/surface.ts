import type {NormalizedBlock} from './types';

export function getBlockSurfaceSx(block: NormalizedBlock, variant: 'sidebar' | 'dashboard') {
    const neutralGradient = 'linear-gradient(180deg, rgba(255, 255, 255, 0.024) 0%, rgba(255, 255, 255, 0.018) 58%, rgba(255, 255, 255, 0.014) 100%)';
    const neutralSidebarColor = 'rgba(255, 255, 255, 0.018)';

    if (!block.color) {
        if (variant === 'sidebar') {
            return {
                backgroundColor: neutralSidebarColor,
            };
        }

        return {
            backgroundColor: 'rgba(255, 255, 255, 0.008)',
            backgroundImage: neutralGradient,
        };
    }

    if (variant === 'sidebar') {
        return {
            backgroundColor: block.color,
        };
    }

    return {
        backgroundColor: 'rgba(255, 255, 255, 0.008)',
        backgroundImage: `linear-gradient(180deg, ${block.color} 0%, color-mix(in srgb, ${block.color} 50%, transparent) 100%)`,
    };
}
