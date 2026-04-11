import {enUS, ruRU} from '@mui/x-date-pickers/locales';
import type {AdminLocale} from '../types';

const pickersLocaleTextByLocale = {
    en: enUS.components.MuiLocalizationProvider.defaultProps.localeText,
    ru: ruRU.components.MuiLocalizationProvider.defaultProps.localeText,
} satisfies Record<AdminLocale, typeof enUS.components.MuiLocalizationProvider.defaultProps.localeText>;

export function getMuiPickersLocaleText(locale: AdminLocale) {
    return pickersLocaleTextByLocale[locale];
}
