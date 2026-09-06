<div align="center">
  <a href="../README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# xladmin

`xladmin` — framework-agnostic React-фронтенд для backend-пакета `xladmin`.

## Модели только для чтения

Обязательное поле `AdminModelMeta.read_only` приходит из backend. Для такой модели список и карточка не предлагают создание, редактирование, удаление и действия; обработчики также не отправляют мутации. Просмотр, фильтры и выделение строк для экспорта сохраняются. При смене режима открытая `FormDialog` закрывается через обычную анимацию, а отправка сразу блокируется.

Расширения получают тот же флаг через `ModelPageToolbarContext.meta.read_only`. Import/export скрывает импорт и блокирует проверку/применение файла, сохраняя экспорт. Backend, frontend и расширение нужно обновлять согласованно. UI не заменяет серверные проверки доступа и доменные команды проведения.

## Установка

```bash
npm install xladmin
```

Также нужен один router adapter:

- `xladmin-next`
- `xladmin-react-router`

## Что экспортирует пакет

- `Shell`
- `OverviewPage`
- `ModelPage`
- `ObjectPage`
- `FormDialog`
- `FieldEditor`
- `NavLink`
- `createAxiosAdminClient(...)`
- `createFetchAdminClient(...)`
- `createBrowserAdminRouter(...)`
- admin types, i18n helpers и default theme

## Минимальный пример

```tsx
import {useEffect, useMemo, useState} from 'react';
import {Shell, OverviewPage, createAxiosAdminClient, type AdminModelMeta, type AdminModelsBlockMeta} from 'xladmin';
import axios from 'axios';

const api = axios.create({baseURL: '/api/admin'});

export function AdminApp() {
  const client = useMemo(() => createAxiosAdminClient(api), []);
  const [models, setModels] = useState<AdminModelMeta[]>([]);
  const [blocks, setBlocks] = useState<AdminModelsBlockMeta[]>([]);

  useEffect(() => {
    client.getModels().then((response) => {
      setModels(response.items);
      setBlocks(response.blocks);
    });
  }, [client]);

  return (
    <Shell client={client} models={models} blocks={blocks} basePath="/admin" locale="en">
      <OverviewPage client={client} basePath="/admin" />
    </Shell>
  );
}
```

Если нужен framework router, используй один из адаптеров вместо дефолтного browser router.

## Текущий пользователь и logout

`Shell` показывает компактную плашку текущего пользователя, прибитую к низу сайдбара.
Длинные логины переносятся внутри плашки и не вылезают за сайдбар.
По умолчанию `Shell` вызывает:

- `client.getCurrentUser()` -> `GET /xladmin/me/`
- `client.logout()` -> `POST /xladmin/logout/`

После logout `Shell` перенаправляет на `loginPath`, по умолчанию `/login`.

```tsx
<Shell
  client={client}
  models={models}
  blocks={blocks}
  basePath="/admin"
  loginPath="/login"
>
  {content}
</Shell>
```

## Контекст навигации и жизненный цикл клиента

Каждый `AdminRouter` реализует `resolveHref(href)`. Стандартные browser/Next.js/React Router адаптеры возвращают исходный URL. Приложение может переопределить метод для сохранения своего workspace или tenant в query-параметрах. `NavLink` использует результат и в настоящем href, и при обработке клика: копирование ссылки и новая вкладка сохраняют контекст. Resolver должен быть чистым и идемпотентным; используйте его также в обёртках push/replace приложения. Собственные реализации роутера должны добавить этот метод. Выбор tenant и авторизация остаются ответственностью приложения.

При смене пользователя или workspace создавайте новый `AdminClient` и перемонтируйте поддерево с новым React key: кэш разделён по экземплярам клиента. Контроллер карточки не применяет поздние ответы и завершения мутаций закрытой области, включая навигацию после удаления. Приложение также должно отменять старый транспорт и запрещать новые запросы через закрытый клиент. Отмена запроса не откатывает операцию, уже принятую сервером.

## Контракты ответа карточки

`getItem` возвращает `AdminDetailResponse` с `{meta, item}`. Методы `createItem` и `patchItem` возвращают `AdminItemResponse` только с `{item}`. Собственные клиенты и подставные ответы транспорта в тестах должны соблюдать тот же формат. После сохранения карточки сохраняйте загруженную metadata и заменяйте item ответом сервера: HTTP API не возвращает metadata в ответе мутации.

## Разработка

```bash
npm test
npm run check
npm run build
```

## Документация

- [English README](../README.md)
- [frontend workspace](../../README.md)
- [корень монорепы](../../../../README.md)
