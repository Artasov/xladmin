'use client';

import {memo} from 'react';
import type {MouseEvent} from 'react';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {Checkbox, IconButton, TableCell, TableRow} from '@mui/material';
import type {AdminFieldMeta, AdminLocale} from '../../types';
import {formatAdminValue} from '../../utils/adminFields';
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
            <TableCell padding="checkbox">
                <Checkbox
                    checked={isSelected}
                    onChange={(_, checked) => onToggleSelection(rowId, checked)}
                />
            </TableCell>
            {listFields.map((fieldName, index) => {
                const field = fieldMap.get(fieldName);
                const fieldValue = formatAdminValue(row[fieldName], {locale, field});
                if (index === 0) {
                    return (
                        <TableCell
                            key={fieldName}
                            sx={{
                                '& a': {
                                    color: 'text.primary',
                                    transition: 'color 160ms ease, opacity 160ms ease',
                                },
                                '& a:hover': {
                                    color: 'primary.main',
                                },
                            }}
                        >
                            <NavLink
                                href={`${basePath}/${slug}/${rowId}`}
                                style={{textDecoration: 'none'}}
                            >
                                {fieldValue}
                            </NavLink>
                        </TableCell>
                    );
                }
                return <TableCell key={fieldName}>{fieldValue}</TableCell>;
            })}
            <TableCell align="right">
                <IconButton size="small" onClick={(event) => onOpenMenu(event, rowId)}>
                    <MoreVertIcon fontSize="small" />
                </IconButton>
            </TableCell>
        </TableRow>
    );
});
