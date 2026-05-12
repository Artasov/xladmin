'use client';

import {memo, useEffect, useRef} from 'react';
import LogoutIcon from '@mui/icons-material/Logout';
import {Box, IconButton, ListItemButton, Tooltip, Typography} from '@mui/material';
import {useAdminTranslation} from '@xladmin-core/i18n';
import {useAdminLocation} from '@xladmin-core/router';
import type {AdminCurrentUser, AdminModelMeta, AdminModelsBlockMeta} from '@xladmin-core/types';
import {ModelsBlocks} from '../ModelsBlocks';
import {NavLink} from '@xladmin-core/components/NavLink';
import {useShellContext} from './ShellContext';

type SidebarProps = {
    models: AdminModelMeta[];
    blocks: AdminModelsBlockMeta[];
    basePath: string;
    currentUser?: AdminCurrentUser | null;
    isLoggingOut?: boolean;
    onLogout?: () => void;
};

function getOffsetTopWithinContainer(element: HTMLElement, container: HTMLElement) {
    let offsetTop = element.offsetTop;
    let currentParent = element.offsetParent;

    while (currentParent instanceof HTMLElement && currentParent !== container) {
        offsetTop += currentParent.offsetTop;
        currentParent = currentParent.offsetParent;
    }

    return offsetTop;
}

export const Sidebar = memo(function Sidebar({
                                                 models,
                                                 blocks,
                                                 basePath,
                                                 currentUser,
                                                 isLoggingOut = false,
                                                 onLogout,
                                             }: SidebarProps) {
    const t = useAdminTranslation();
    const {pathname} = useAdminLocation();
    const {pendingPath, startPendingNavigation} = useShellContext();
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const effectivePathname = pendingPath ?? pathname;
    const normalizedBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    const fallbackBasePath = normalizedBasePath.replace(/^\/(ru|en)(?=\/|$)/, '') || '/';
    const matchedBasePath = effectivePathname.startsWith(normalizedBasePath)
        ? normalizedBasePath
        : effectivePathname.startsWith(fallbackBasePath)
            ? fallbackBasePath
            : null;
    const relativePath = matchedBasePath ? effectivePathname.slice(matchedBasePath.length) : '';
    const activeModelSlug = relativePath.split('/').filter(Boolean)[0] ?? null;
    const isOverviewActive = matchedBasePath !== null && (effectivePathname === matchedBasePath || effectivePathname === `${matchedBasePath}/`);

    useEffect(() => {
        if (!activeModelSlug) {
            return;
        }

        const container = scrollContainerRef.current;
        if (!container) {
            return;
        }

        let scheduledFrame: number | null = null;
        let cancelled = false;
        let startedAt = 0;
        let lastTargetScrollTop: number | null = null;
        let stableFrames = 0;

        const ensureActiveModelVisible = (timestamp: number) => {
            if (cancelled) {
                return;
            }

            if (startedAt === 0) {
                startedAt = timestamp;
            }

            const elapsed = timestamp - startedAt;
            const allowAllModelsFallback = elapsed >= 250;

            const blockContainer = container.querySelector<HTMLElement>(
                '[data-xladmin-active-block="true"][data-xladmin-block-origin="block"]',
            );
            const fallbackBlockContainer = container.querySelector<HTMLElement>(
                '[data-xladmin-active-block="true"][data-xladmin-block-origin="all-models"]',
            );
            const blockItem = container.querySelector<HTMLElement>(
                '[data-xladmin-active-model="true"][data-xladmin-model-origin="block"]',
            );
            const fallbackItem = container.querySelector<HTMLElement>(
                '[data-xladmin-active-model="true"][data-xladmin-model-origin="all-models"]',
            );
            const activeBlock = blockContainer ?? (allowAllModelsFallback ? fallbackBlockContainer : null);
            const activeItem = blockItem ?? (allowAllModelsFallback ? fallbackItem : null);

            if (!activeBlock || !activeItem) {
                if (elapsed < 1200) {
                    scheduledFrame = window.requestAnimationFrame(ensureActiveModelVisible);
                }
                return;
            }

            const rangeTop = getOffsetTopWithinContainer(activeBlock, container);
            const rangeBottom = getOffsetTopWithinContainer(activeItem, container) + activeItem.offsetHeight;
            const rangeCenter = (rangeTop + rangeBottom) / 2;
            const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
            const targetScrollTop = Math.min(
                maxScrollTop,
                Math.max(0, rangeCenter - (container.clientHeight / 2)),
            );

            container.scrollTop = targetScrollTop;

            if (lastTargetScrollTop !== null && Math.abs(lastTargetScrollTop - targetScrollTop) < 1) {
                stableFrames += 1;
            }
            else {
                stableFrames = 0;
            }

            lastTargetScrollTop = targetScrollTop;

            if (stableFrames >= 3 || elapsed >= 1200) {
                return;
            }

            scheduledFrame = window.requestAnimationFrame(ensureActiveModelVisible);
        };

        scheduledFrame = window.requestAnimationFrame(ensureActiveModelVisible);

        return () => {
            cancelled = true;
            if (scheduledFrame !== null) {
                window.cancelAnimationFrame(scheduledFrame);
            }
        };
    }, [activeModelSlug, blocks]);

    return (
        <Box sx={{height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0}}>
            <Box
                ref={scrollContainerRef}
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'scroll',
                    overflowX: 'hidden',
                    scrollbarGutter: 'stable',
                    direction: 'rtl',
                    ml: 0,
                    pl: 0,
                }}
            >
                <Box sx={{direction: 'ltr', pl: 1}}>
                    <NavLink
                        href={basePath}
                        style={{textDecoration: 'none', display: 'block'}}
                        onClick={() => startPendingNavigation(basePath, 'overview')}
                    >
                        <ListItemButton
                            selected={isOverviewActive}
                            sx={{
                                mb: 2,
                                borderRadius: '8px',
                                backgroundColor: isOverviewActive
                                    ? 'rgba(255, 255, 255, 0.18)'
                                    : 'rgba(255, 255, 255, 0.035)',
                                boxShadow: isOverviewActive
                                    ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.08)'
                                    : 'none',
                                '&:hover': {
                                    backgroundColor: isOverviewActive
                                        ? 'rgba(255, 255, 255, 0.2)'
                                        : 'rgba(255, 255, 255, 0.055)',
                                },
                            }}
                        >
                            <Typography variant="subtitle1" sx={{fontWeight: 700}}>
                                {t('overview')}
                            </Typography>
                        </ListItemButton>
                    </NavLink>
                    <ModelsBlocks
                        models={models}
                        blocks={blocks}
                        basePath={basePath}
                        variant="sidebar"
                        activeModelSlug={activeModelSlug}
                        onModelNavigate={(href) => startPendingNavigation(href, 'model')}
                    />
                </Box>
            </Box>
            <SidebarCurrentUser currentUser={currentUser} isLoggingOut={isLoggingOut} onLogout={onLogout}/>
        </Box>
    );
});

type SidebarCurrentUserProps = {
    currentUser?: AdminCurrentUser | null;
    isLoggingOut: boolean;
    onLogout?: () => void;
};

function SidebarCurrentUser({currentUser, isLoggingOut, onLogout}: SidebarCurrentUserProps) {
    if (!currentUser) {
        return null;
    }

    return (
        <Box
            sx={{
                flexShrink: 0,
                ml: 1,
                mt: 1.25,
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.03)',
                display: 'flex',
                alignItems: 'center',
                minHeight: 44,
                px: 1,
                gap: 1,
            }}
        >
            <Typography
                title={currentUser.login}
                sx={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 13,
                    fontWeight: 650,
                }}
            >
                {currentUser.login}
            </Typography>
            {onLogout ? (
                <Tooltip title="Logout">
                    <span>
                        <IconButton
                            aria-label="Logout"
                            size="small"
                            disabled={isLoggingOut}
                            onClick={onLogout}
                            sx={{
                                width: 32,
                                height: 32,
                                color: 'text.secondary',
                                '&:hover': {
                                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                    color: 'text.primary',
                                },
                            }}
                        >
                            <LogoutIcon sx={{fontSize: 18}}/>
                        </IconButton>
                    </span>
                </Tooltip>
            ) : null}
        </Box>
    );
}
