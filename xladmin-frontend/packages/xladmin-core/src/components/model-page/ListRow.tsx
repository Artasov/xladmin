'use client';

import {memo} from 'react';
import type {MouseEvent} from 'react';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {Box, Checkbox, IconButton, TableCell, TableRow} from '@mui/material';
import type {AdminFieldMeta, AdminLocale} from '../../types';
import {formatAdminValue, getListFieldWidthPx, resolveAdminMediaUrl} from '../../utils/adminFields';
import {NavLink} from '../NavLink';

export type ListRowProps = {
    row: Record<string, unknown>;
    pkField: string;
    listFields: string[];
    basePath: string;
    slug: string;
    locale: AdminLocale;
    fieldMap: Map<string, AdminFieldMeta>;
    isSelected: boolean;
    onToggleSelection: (rowId: string | number, checked: boolean) => void;
    onOpenMenu: (event: MouseEvent<HTMLElement>, rowId: string | number) => void;
};

export const ListRow = memo(function ListRow({
                                                 row,
                                                 pkField,
                                                 listFields,
                                                 basePath,
                                                 slug,
                                                 locale,
                                                 fieldMap,
                                                 isSelected,
                                                 onToggleSelection,
                                                 onOpenMenu,
                                             }: ListRowProps) {
    const checkboxColumnWidth = 56;
    const actionsColumnWidth = 56;
    const rowId = row[pkField] as string | number;

    return (
        <TableRow
            hover
            sx={{
                transition: 'background-color 180ms ease',
                '& > .MuiTableCell-root': {
                    transition: 'background-color 180ms ease, border-color 180ms ease',
                },
                '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.032)',
                },
            }}
        >
            <TableCell
                padding="none"
                sx={{
                    width: checkboxColumnWidth,
                    minWidth: checkboxColumnWidth,
                    maxWidth: checkboxColumnWidth,
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    px: 1,
                }}
            >
                <Checkbox
                    checked={isSelected}
                    onChange={(_, checked) => onToggleSelection(rowId, checked)}
                />
            </TableCell>
            {listFields.map((fieldName, index) => {
                const field = fieldMap.get(fieldName);
                const fullFieldValue = formatAdminValue(row[fieldName], {locale, field});
                const fieldValue = formatAdminValue(row[fieldName], {locale, field, maxLength: 200});
                const widthPx = getListFieldWidthPx(field);
                const imageUrl = field?.display_kind === 'image'
                    ? resolveAdminMediaUrl(row[fieldName], field)
                    : null;
                const commonCellSx = {
                    width: widthPx,
                    minWidth: widthPx,
                    maxWidth: widthPx,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                };
                if (imageUrl) {
                    return (
                        <TableCell key={fieldName} title={fullFieldValue} sx={{...commonCellSx, py: 0.75}}>
                            <Box
                                component="img"
                                src={imageUrl}
                                alt={field?.label ?? fieldName}
                                sx={{
                                    display: 'block',
                                    width: 52,
                                    height: 52,
                                    objectFit: 'cover',
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(255,255,255,0.04)',
                                }}
                            />
                        </TableCell>
                    );
                }
                if (index === 0) {
                    return (
                        <TableCell
                            key={fieldName}
                            title={fullFieldValue}
                            sx={{
                                ...commonCellSx,
                                '& a': {
                                    color: 'text.primary',
                                    transition: 'color 160ms ease, opacity 160ms ease',
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                },
                                '& a:hover': {
                                    color: 'primary.main',
                                },
                            }}
                        >
                            <NavLink
                                href={`${basePath}/${slug}/${rowId}`}
                                style={{textDecoration: 'none'}}
                                title={fullFieldValue}
                            >
                                {fieldValue}
                            </NavLink>
                        </TableCell>
                    );
                }
                return <TableCell key={fieldName} title={fullFieldValue} sx={commonCellSx}>{fieldValue}</TableCell>;
            })}
            <TableCell
                align="right"
                sx={{
                    width: actionsColumnWidth,
                    minWidth: actionsColumnWidth,
                    maxWidth: actionsColumnWidth,
                }}
            >
                <IconButton size="small" onClick={(event) => onOpenMenu(event, rowId)}>
                    <MoreVertIcon fontSize="small"/>
                </IconButton>
            </TableCell>
        </TableRow>
    );
});
