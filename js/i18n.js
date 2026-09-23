// Основная локализация интерфейса. Русский является исходной локалью проекта.
(function () {
    const translations = {
        ru: {
            'app.title': 'PFRangeTool - Построение префлоп-диапазонов',
            'app.subtitle': 'построение префлоп-диапазонов',
            'tabs.showPanel': 'Показать панель вкладок',
            'tabs.openMenu': 'Открыть меню вкладок',
            'tabs.editor': 'Редактор',
            'tabs.view': 'Просмотр',
            'auth.account': 'Аккаунт',
            'auth.login': 'Войти',
            'auth.register': 'Регистрация',
            'auth.import': 'Импорт конфигурации',
            'auth.export': 'Экспорт конфигурации',
            'auth.logout': 'Выйти',
            'language.label': 'Язык',
            'tree.createFolder': 'Создать папку',
            'tree.createRange': 'Создать диапазон',
            'tree.renameRange': 'Переименовать диапазон',
            'tree.moveUp': 'Переместить вверх',
            'tree.moveDown': 'Переместить вниз',
            'tree.delete': 'Удалить диапазон',
            'tree.collapseAll': 'Свернуть все',
            'editor.save': 'Сохранить',
            'editor.saveRange': 'Сохранить диапазон',
            'editor.undo': 'Отменить',
            'editor.undoChanges': 'Отменить изменения',
            'editor.clear': 'Очистить',
            'editor.clearTable': 'Очистить таблицу',
            'editor.copy': 'Копировать',
            'editor.copyRange': 'Копировать диапазон',
            'editor.paste': 'Вставить',
            'editor.pasteRange': 'Вставить диапазон',
            'editor.import': 'Импорт',
            'editor.importRange': 'Импорт диапазона',
            'editor.more': 'Дополнительно',
            'editor.mode': 'Режим редактора',
            'editor.analysisMode': 'Режим анализа',
            'colors.add': 'Добавить цвет',
            'colors.addMulti': 'Добавить мультицвет',
            'colors.removeUnused': 'Удалить неиспользуемые цвета',
            'colors.title': 'Цвет',
            'gto.addToEditor': 'Добавить в редактор',
            'gto.range': 'GTO диапазон',
            'gto.filter': 'Фильтр',
            'gto.gameType': 'Дисциплина',
            'gto.table': 'Стол',
            'gto.limit': 'Лимит',
            'gto.stack': 'Стек',
            'gto.sizing': 'Сайзинг',
            'stats.noData': 'Нет данных',
            'stats.color': 'Цвет',
            'stats.action': 'Действие',
            'matrix.rangeHeight': 'высота диапазона',
            'matrix.fullHeight': 'полная высота',
            'matrix.editStyles': 'Редактировать стили кнопок',
            'matrix.comments': 'Комментарии',
            'matrix.showDetails': 'Показать подробную статистику',
            'matrix.hideDetails': 'Скрыть подробную статистику',
            'matrix.commentPlaceholder': 'Комментарий к диапазону...',
            'work.rng': 'ГСЧ',
            'status.loading': 'Загрузка...',
            'status.saving': 'Сохранение...',
            'status.synced': 'Синхронизировано',
            'status.error': 'Ошибка синхронизации',

            'tabs.showPanelHide': 'Скрыть панель вкладок',
            'tabs.openMenuClose': 'Закрыть меню вкладок',
            'tree.back': 'Назад',

            'auth.forgotTitle': 'Восстановление пароля',
            'auth.forgotHint': 'Введите email, указанный при регистрации.',
            'auth.email': 'Email',
            'auth.sendLink': 'Отправить ссылку',
            'auth.backToLogin': 'Вернуться ко входу',
            'auth.registerTitle': 'Регистрация',
            'auth.loginLabel': 'Логин',
            'auth.passwordLabel': 'Пароль',
            'auth.passwordConfirmLabel': 'Повтор пароля',
            'auth.registerSubmit': 'Зарегистрироваться',
            'auth.loginTitle': 'Вход',
            'auth.loginSubmit': 'Войти',
            'auth.haveAccount': 'Уже есть аккаунт? Войти',
            'auth.forgotLink': 'Забыли пароль?',
            'auth.close': 'Закрыть',
            'auth.forgotSent': 'Если такой email зарегистрирован, письмо отправлено.',
            'auth.operationFailed': 'Не удалось выполнить операцию',
            'auth.networkError': 'Не удалось связаться с сервером',
            'auth.badResponse': 'Сервер вернул некорректный ответ',
            'auth.requireAuthToSave': 'Чтобы сохранить изменения, войдите или зарегистрируйтесь',
            'auth.guestUnsaved': 'Изменения не будут сохранены. Чтобы сохранить изменения, требуется войти в аккаунт',

            'reset.title': 'Сброс пароля - PFRangeTool',
            'reset.heading': 'Новый пароль',
            'reset.password': 'Пароль',
            'reset.passwordConfirm': 'Повтор пароля',
            'reset.submit': 'Сменить пароль',
            'reset.passwordsMismatch': 'Пароли не совпадают',
            'reset.tokenMissing': 'В ссылке отсутствует токен',
            'reset.success': 'Пароль изменён. Теперь можно войти на главной странице.',
            'reset.goToLogin': 'Перейти ко входу',
            'reset.genericError': 'Не удалось изменить пароль',

            'modal.messageTitle': 'Сообщение',
            'modal.yes': 'Да',
            'modal.no': 'Нет',
            'modal.ok': 'ОК',
            'modal.cancel': 'Отмена',
            'modal.allColors': 'Все цвета',
            'modal.color': 'Цвет',
            'modal.noColorName': 'Без имени',
            'tree.deleteSingleRangeError': 'Нельзя удалить единственный диапазон',
            'tree.deleteFolderSingleRangeError': 'Эту папку удалить нельзя, так как в ней содержится единственный диапазон',
            'tree.folderHasFilledRanges': 'В данной папке есть заполненные диапазоны. Все равно удалить?',
            'tree.rangeNotEmptyConfirm': 'Данный диапазон не пустой. Все равно удалить?',
            'tree.noActiveNodeToRename': 'Нет активного узла для переименования',
            'range.noActive': 'Нет активного диапазона',
            'range.noActiveSave': 'Нет активного диапазона для сохранения',
            'range.noActiveCopy': 'Нет активного диапазона для копирования',
            'range.noActivePaste': 'Нет активного диапазона для вставки',
            'range.saveChangesQuestion': 'Сохранить изменения?',
            'range.saveChangesNamedQuestion': 'Диапазон «{name}» был отредактирован. Сохранить изменения?',
            'range.saveFailed': 'Не удалось сохранить изменения',
            'range.undoChangesNamedQuestion': 'Отменить все изменения в диапазоне «{name}»?',
            'range.undoChangesQuestion': 'Отменить все изменения в текущем диапазоне?',
            'range.clearTableNamedQuestion': 'Очистить всю таблицу диапазона «{name}»?',
            'range.clearTableQuestion': 'Очистить всю таблицу?',
            'clipboard.pasteOverwriteConfirm': 'Диапазон «{name}» не пустой. Вставить новые данные?',
            'colors.removedUnused': 'Удалено неиспользуемых цветов: {count}',
            'colors.noUnusedFound': 'Неиспользуемых цветов не найдено',
            'import.errorNoData': 'Ошибка: нет диапазона, текста или цвета',
            'import.noHandsFound': 'Не найдено ни одной руки для импорта',
            'clipboard.rangeNotFound': 'Диапазон не найден',
            'clipboard.copyRangesOnly': 'Можно копировать только диапазоны',
            'clipboard.noCopiedRange': 'Нет скопированного диапазона',
            'clipboard.targetNotFound': 'Целевой диапазон не найден',
            'clipboard.pasteRangesOnly': 'Вставлять можно только в диапазоны',

            'import.title': 'Импортировать диапазон из GTO Wizard',
            'import.fillOneField': 'Вставьте данные хотя бы в одно поле',
            'import.createColorFirst': 'Сначала создайте хотя бы один цвет в палитре',
            'import.clipboardEmpty': 'Буфер обмена пуст',
            'import.clipboardReadError': 'Не удалось прочитать буфер обмена. Разрешите доступ к буферу обмена в браузере.',
            'import.placeholder1': 'Вставьте руки для первого цвета...',
            'import.placeholder2': 'Вставьте руки для второго цвета (оставьте пустым, если не нужно)...',
            'import.color1': 'Цвет 1',
            'import.color2': 'Цвет 2 (опционально)',
            'import.overwrite': 'Перезаписать текущий диапазон',
            'import.cancel': 'Отмена',
            'import.apply': 'Импортировать',

            'colors.createActionFirst': 'Сначала создайте простое действие!',
            'colors.createOneActionFirst': 'Сначала создайте хотя бы одно простое действие!',
            'colors.newActionPrompt': 'Введите название действия:',
            'colors.newActionDefault': 'Новое действие',
            'colors.usedInMultiConfirm': 'Данное действие используется в мультицвете. Все равно удалить?',
            'colors.usedInMultiDeleteFirst': 'Данное действие используется в мультицвете. Сначала удалите мультицвет, использующий его.',
            'colors.usedInMatrixConfirm': 'Данное действие используется в матрице. Все равно удалить?',
            'colors.deleteColorTitle': 'Удалить цвет',
            'colors.addColorTitle': 'Добавить цвет',
            'colors.actionNamePlaceholder': 'Название действия...',
            'clipboard.copyRangeFirst': 'Сначала скопируйте диапазон',
            'menu.addFolder': 'Добавить папку',
            'menu.addRange': 'Добавить диапазон',
            'menu.addSubrange': 'Добавить поддиапазон',
            'menu.duplicateRange': 'Дублировать диапазон',
            'menu.copyRange': 'Копировать диапазон',
            'menu.pasteRange': 'Вставить диапазон',
            'menu.rename': 'Переименовать',
            'menu.moveUp': 'Вверх',
            'menu.moveDown': 'Вниз',
            'menu.delete': 'Удалить',

            'backup.noDataToExport': 'Нет данных для экспорта',
            'backup.invalidFormat': 'Неверный формат файла. Импорт отменён.',
            'backup.imported': 'Импортировано {count} узлов с цветами и матрицей',
            'backup.importError': 'Ошибка импорта: {error}',
            'backup.noGtoData': 'Нет данных GTO для добавления',
            'backup.gtoAdded': '✅ Добавлено {count} узлов в редактор',
            'backup.export': 'Экспорт',
            'backup.import': 'Импорт',

            'move.confirm': 'Переместить {typeName} <strong>«{sourceName}»</strong><br>в {targetTypeName} <strong>«{targetName}»</strong>?',
            'move.folder': 'папку',
            'move.range': 'диапазон',
            'styles.editTitle': 'Редактировать стили',
            'styles.editRangeTitle': 'Редактировать стили диапазона',
            'styles.editFolderTitle': 'Редактировать стили папки',
            'styles.editButtonStyles': 'Редактировать стили кнопок',
            'styles.bgColor': 'Цвет фона',
            'styles.textColor': 'Цвет текста',
            'styles.resetDefault': 'Сбросить на значение по умолчанию',
            'styles.cancel': 'Отменить',
            'styles.save': 'Сохранить',

            'matrix.addSubrange': 'Добавить поддиапазон',
            'work.selectRange': 'Выберите диапазон',

            'gto.notAvailable': 'В данный момент такое решение GTO недоступно',
            'gto.noSolutionsFor': 'Решений для {label} «{value}» не найдено',
            'gto.fileNameMissing': 'Имя файла не указано',

            'api.serverError': 'Произошла ошибка сервера. Попробуйте ещё раз позже.',

            // ===== Коды API-ответов (auth-api.php / storage-api.php) =====
            'api.INVALID_CREDENTIALS': 'Неверный логин или пароль',
            'api.EMAIL_EXISTS': 'Такой email уже зарегистрирован',
            'api.LOGIN_EXISTS': 'Такой логин уже занят',
            'api.LOGIN_OR_EMAIL_EXISTS': 'Такой логин или email уже зарегистрирован',
            'api.INVALID_EMAIL': 'Некорректный email',
            'api.INVALID_LOGIN': 'Логин должен быть 3–32 символа: латинские буквы, цифры, "_.-"',
            'api.WEAK_PASSWORD': 'Пароль должен быть не короче 8 символов',
            'api.PASSWORDS_DO_NOT_MATCH': 'Пароли не совпадают',
            'api.MISSING_REQUIRED_FIELD': 'Заполните все обязательные поля',
            'api.TOO_MANY_ATTEMPTS': 'Слишком много неудачных попыток входа. Попробуйте позже.',
            'api.RESET_TOKEN_MISSING': 'В ссылке отсутствует токен',
            'api.RESET_TOKEN_INVALID_OR_EXPIRED': 'Ссылка для восстановления недействительна или устарела',
            'api.PASSWORD_RESET_SUCCESS': 'Пароль успешно изменён. Теперь вы можете войти.',
            'api.FORGOT_PASSWORD_SENT': 'Если такой email зарегистрирован, письмо отправлено.',
            'api.AUTH_REQUIRED': 'Требуется авторизация',
            'api.DATA_SAVED': 'Данные сохранены',
            'api.DATA_LOADED': 'Данные загружены',
            'api.DATA_DELETED': 'Данные удалены',
            'api.DATA_NOT_FOUND': 'Данные не найдены',
            'api.GUEST_MODE_NO_SERVER_DATA': 'Гостевой режим: данные не загружаются с сервера',
            'api.INVALID_JSON': 'Некорректный формат данных запроса',
            'api.EMPTY_KEY': 'Ключ не может быть пустым',
            'api.SERVER_ERROR': 'Произошла ошибка сервера. Попробуйте ещё раз позже.'
        },
        en: {
            'app.title': 'PFRangeTool - Preflop range construction',
            'app.subtitle': 'Preflop range construction',
            'tabs.showPanel': 'Show tabs panel',
            'tabs.openMenu': 'Open tabs menu',
            'tabs.editor': 'Editor',
            'tabs.view': 'View',
            'auth.account': 'Account',
            'auth.login': 'Log in',
            'auth.register': 'Sign up',
            'auth.import': 'Import configuration',
            'auth.export': 'Export configuration',
            'auth.logout': 'Log out',
            'language.label': 'Language',
            'tree.createFolder': 'Create folder',
            'tree.createRange': 'Create range',
            'tree.renameRange': 'Rename range',
            'tree.moveUp': 'Move up',
            'tree.moveDown': 'Move down',
            'tree.delete': 'Delete range',
            'tree.collapseAll': 'Collapse all',
            'editor.save': 'Save',
            'editor.saveRange': 'Save range',
            'editor.undo': 'Undo',
            'editor.undoChanges': 'Undo changes',
            'editor.clear': 'Clear',
            'editor.clearTable': 'Clear table',
            'editor.copy': 'Copy',
            'editor.copyRange': 'Copy range',
            'editor.paste': 'Paste',
            'editor.pasteRange': 'Paste range',
            'editor.import': 'Import',
            'editor.importRange': 'Import range',
            'editor.more': 'More',
            'editor.mode': 'Editor mode',
            'editor.analysisMode': 'Analysis mode',
            'colors.add': 'Add color',
            'colors.addMulti': 'Add multicolor',
            'colors.removeUnused': 'Remove unused colors',
            'colors.title': 'Color',
            'gto.addToEditor': 'Add to editor',
            'gto.range': 'GTO range',
            'gto.filter': 'Filter',
            'gto.gameType': 'Game type',
            'gto.table': 'Table',
            'gto.limit': 'Limit',
            'gto.stack': 'Stack',
            'gto.sizing': 'Sizing',
            'stats.noData': 'No data',
            'stats.color': 'Color',
            'stats.action': 'Action',
            'matrix.rangeHeight': 'Range height',
            'matrix.fullHeight': 'Full height',
            'matrix.editStyles': 'Edit button styles',
            'matrix.comments': 'Comments',
            'matrix.showDetails': 'Show detailed statistics',
            'matrix.hideDetails': 'Hide detailed statistics',
            'matrix.commentPlaceholder': 'Comment on range...',
            'work.rng': 'RNG',
            'status.loading': 'Loading...',
            'status.saving': 'Saving...',
            'status.synced': 'Synchronized',
            'status.error': 'Synchronization error',

            'tabs.showPanelHide': 'Hide tabs panel',
            'tabs.openMenuClose': 'Close tabs menu',
            'tree.back': 'Back',

            'auth.forgotTitle': 'Password recovery',
            'auth.forgotHint': 'Enter the email you used to register.',
            'auth.email': 'Email',
            'auth.sendLink': 'Send link',
            'auth.backToLogin': 'Back to login',
            'auth.registerTitle': 'Sign up',
            'auth.loginLabel': 'Login',
            'auth.passwordLabel': 'Password',
            'auth.passwordConfirmLabel': 'Confirm password',
            'auth.registerSubmit': 'Sign up',
            'auth.loginTitle': 'Log in',
            'auth.loginSubmit': 'Log in',
            'auth.haveAccount': 'Already have an account? Log in',
            'auth.forgotLink': 'Forgot password?',
            'auth.close': 'Close',
            'auth.forgotSent': 'If such an email is registered, a letter has been sent.',
            'auth.operationFailed': 'Failed to complete the operation',
            'auth.networkError': 'Failed to connect to the server',
            'auth.badResponse': 'The server returned an invalid response',
            'auth.requireAuthToSave': 'To save changes, log in or sign up',
            'auth.guestUnsaved': 'Changes will not be saved. Log in to your account to save changes',

            'reset.title': 'Password reset - PFRangeTool',
            'reset.heading': 'New password',
            'reset.password': 'Password',
            'reset.passwordConfirm': 'Confirm password',
            'reset.submit': 'Change password',
            'reset.passwordsMismatch': 'Passwords do not match',
            'reset.tokenMissing': 'The link is missing a token',
            'reset.success': 'Password changed. You can now log in on the main page.',
            'reset.goToLogin': 'Go to login',
            'reset.genericError': 'Failed to change password',

            'modal.messageTitle': 'Message',
            'modal.yes': 'Yes',
            'modal.no': 'No',
            'modal.ok': 'OK',
            'modal.cancel': 'Cancel',
            'modal.allColors': 'All colors',
            'modal.color': 'Color',
            'modal.noColorName': 'No name',
            'tree.deleteSingleRangeError': 'Cannot delete the only range',
            'tree.deleteFolderSingleRangeError': 'This folder cannot be deleted because it contains the only range',
            'tree.folderHasFilledRanges': 'This folder contains filled ranges. Delete anyway?',
            'tree.rangeNotEmptyConfirm': 'This range is not empty. Delete anyway?',
            'tree.noActiveNodeToRename': 'No active node to rename',
            'range.noActive': 'No active range',
            'range.noActiveSave': 'No active range to save',
            'range.noActiveCopy': 'No active range to copy',
            'range.noActivePaste': 'No active range to paste',
            'range.saveChangesQuestion': 'Save changes?',
            'range.saveChangesNamedQuestion': 'Range "{name}" has been edited. Save changes?',
            'range.saveFailed': 'Failed to save changes',
            'range.undoChangesNamedQuestion': 'Undo all changes in range "{name}"?',
            'range.undoChangesQuestion': 'Undo all changes in the current range?',
            'range.clearTableNamedQuestion': 'Clear the entire table for range "{name}"?',
            'range.clearTableQuestion': 'Clear the entire table?',
            'clipboard.pasteOverwriteConfirm': 'Range "{name}" is not empty. Paste new data anyway?',
            'colors.removedUnused': 'Unused colors removed: {count}',
            'colors.noUnusedFound': 'No unused colors found',
            'import.errorNoData': 'Error: no range, text, or color',
            'import.noHandsFound': 'No hands found to import',
            'clipboard.rangeNotFound': 'Range not found',
            'clipboard.copyRangesOnly': 'Only ranges can be copied',
            'clipboard.noCopiedRange': 'No copied range',
            'clipboard.targetNotFound': 'Target range not found',
            'clipboard.pasteRangesOnly': 'You can only paste into ranges',

            'import.title': 'Import range from GTO Wizard',
            'import.fillOneField': 'Paste data into at least one field',
            'import.createColorFirst': 'First create at least one color in the palette',
            'import.clipboardEmpty': 'Clipboard is empty',
            'import.clipboardReadError': 'Failed to read the clipboard. Allow clipboard access in your browser.',
            'import.placeholder1': 'Paste hands for the first color...',
            'import.placeholder2': 'Paste hands for the second color (leave empty if not needed)...',
            'import.color1': 'Color 1',
            'import.color2': 'Color 2 (optional)',
            'import.overwrite': 'Overwrite current range',
            'import.cancel': 'Cancel',
            'import.apply': 'Import',

            'colors.createActionFirst': 'First create a simple action!',
            'colors.createOneActionFirst': 'First create at least one simple action!',
            'colors.newActionPrompt': 'Enter action name:',
            'colors.newActionDefault': 'New action',
            'colors.usedInMultiConfirm': 'This action is used in a multicolor. Delete anyway?',
            'colors.usedInMultiDeleteFirst': 'This action is used in a multicolor. Delete the multicolor using it first.',
            'colors.usedInMatrixConfirm': 'This action is used in the matrix. Delete anyway?',
            'colors.deleteColorTitle': 'Delete color',
            'colors.addColorTitle': 'Add color',
            'colors.actionNamePlaceholder': 'Action name...',
            'clipboard.copyRangeFirst': 'Copy a range first',
            'menu.addFolder': 'Add folder',
            'menu.addRange': 'Add range',
            'menu.addSubrange': 'Add subrange',
            'menu.duplicateRange': 'Duplicate range',
            'menu.copyRange': 'Copy range',
            'menu.pasteRange': 'Paste range',
            'menu.rename': 'Rename',
            'menu.moveUp': 'Move up',
            'menu.moveDown': 'Move down',
            'menu.delete': 'Delete',

            'backup.noDataToExport': 'No data to export',
            'backup.invalidFormat': 'Invalid file format. Import cancelled.',
            'backup.imported': 'Imported {count} nodes with colors and matrix',
            'backup.importError': 'Import error: {error}',
            'backup.noGtoData': 'No GTO data to add',
            'backup.gtoAdded': '✅ Added {count} nodes to the editor',
            'backup.export': 'Export',
            'backup.import': 'Import',

            'move.confirm': 'Move {typeName} <strong>"{sourceName}"</strong><br>to {targetTypeName} <strong>"{targetName}"</strong>?',
            'move.folder': 'folder',
            'move.range': 'range',
            'styles.editTitle': 'Edit styles',
            'styles.editRangeTitle': 'Edit range styles',
            'styles.editFolderTitle': 'Edit folder styles',
            'styles.editButtonStyles': 'Edit button styles',
            'styles.bgColor': 'Background color',
            'styles.textColor': 'Text color',
            'styles.resetDefault': 'Reset to default',
            'styles.cancel': 'Cancel',
            'styles.save': 'Save',

            'matrix.addSubrange': 'Add subrange',
            'work.selectRange': 'Select a range',

            'gto.notAvailable': 'This GTO solution is currently unavailable',
            'gto.noSolutionsFor': 'No solutions found for {label} "{value}"',
            'gto.fileNameMissing': 'File name is not specified',

            'api.serverError': 'A server error occurred. Please try again later.',

            // ===== API response codes (auth-api.php / storage-api.php) =====
            'api.INVALID_CREDENTIALS': 'Invalid login or password',
            'api.EMAIL_EXISTS': 'This email is already registered',
            'api.LOGIN_EXISTS': 'This login is already taken',
            'api.LOGIN_OR_EMAIL_EXISTS': 'This login or email is already registered',
            'api.INVALID_EMAIL': 'Invalid email',
            'api.INVALID_LOGIN': 'Login must be 3-32 characters: Latin letters, digits, "_.-"',
            'api.WEAK_PASSWORD': 'Password must be at least 8 characters',
            'api.PASSWORDS_DO_NOT_MATCH': 'Passwords do not match',
            'api.MISSING_REQUIRED_FIELD': 'Please fill in all required fields',
            'api.TOO_MANY_ATTEMPTS': 'Too many failed login attempts. Please try again later.',
            'api.RESET_TOKEN_MISSING': 'The link is missing a token',
            'api.RESET_TOKEN_INVALID_OR_EXPIRED': 'The recovery link is invalid or has expired',
            'api.PASSWORD_RESET_SUCCESS': 'Password changed successfully. You can now log in.',
            'api.FORGOT_PASSWORD_SENT': 'If such an email is registered, a letter has been sent.',
            'api.AUTH_REQUIRED': 'Authorization required',
            'api.DATA_SAVED': 'Data saved',
            'api.DATA_LOADED': 'Data loaded',
            'api.DATA_DELETED': 'Data deleted',
            'api.DATA_NOT_FOUND': 'Data not found',
            'api.GUEST_MODE_NO_SERVER_DATA': 'Guest mode: data is not loaded from the server',
            'api.INVALID_JSON': 'Invalid request data format',
            'api.EMPTY_KEY': 'Key cannot be empty',
            'api.SERVER_ERROR': 'A server error occurred. Please try again later.'
        }
    };

    const storageKey = 'pfrangetool-language';
    let language = 'ru';
    let languageTransitionTimer = null;

    function detectLanguage() {
        const saved = window.localStorage.getItem(storageKey);
        if (saved && translations[saved]) return saved;
        return (navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
    }

    function translate(key, params) {
        const value = (translations[language] && translations[language][key]) || translations.ru[key] || key;
        if (!params) return value;
        return value.replace(/\{(\w+)\}/g, function (match, paramName) {
            return Object.prototype.hasOwnProperty.call(params, paramName) ? params[paramName] : match;
        });
    }

    function applyLanguage() {
        document.documentElement.lang = language;
        document.title = translate('app.title');
        document.querySelectorAll('[data-i18n]').forEach(function (element) {
            element.textContent = translate(element.dataset.i18n);
        });
        document.querySelectorAll('[data-i18n-aria-label]').forEach(function (element) {
            element.setAttribute('aria-label', translate(element.dataset.i18nAriaLabel));
        });
        document.querySelectorAll('[data-i18n-tooltip]').forEach(function (element) {
            element.dataset.tooltip = translate(element.dataset.i18nTooltip);
        });
        const dynamicTooltips = {
            '#commentsToggleBtn': 'matrix.comments',
            '#styleEditToggle': 'matrix.editStyles',
            '#workCommentsToggleBtn': 'matrix.comments',
            '#workStatsToggleBtn': 'matrix.showDetails'
        };
        Object.keys(dynamicTooltips).forEach(function (selector) {
            const element = document.querySelector(selector);
            if (element) element.dataset.tooltip = translate(dynamicTooltips[selector]);
        });
        const overlayTooltips = [
            ['#constructorOverlayToggleBtn', '#constructorPage .matrix-wrapper'],
            ['#workOverlayToggleBtn', '#workPage .matrix1-wrapper']
        ];
        overlayTooltips.forEach(function (entry) {
            const button = document.querySelector(entry[0]);
            const wrapper = document.querySelector(entry[1]);
            if (button) {
                button.dataset.tooltip = wrapper && wrapper.classList.contains('hide-subrange-overlays')
                    ? translate('matrix.fullHeight')
                    : translate('matrix.rangeHeight');
            }
        });
        document.querySelectorAll('#constructorPage [data-tooltip], #workPage [data-tooltip]').forEach(function (element) {
            const tooltipMap = {
                'Комментарии': 'matrix.comments',
                'Высота диапазона': 'matrix.rangeHeight',
                'высота диапазона': 'matrix.rangeHeight',
                'полная высота': 'matrix.fullHeight',
                'Редактировать стили кнопок': 'matrix.editStyles',
                'Показать подробную статистику': 'matrix.showDetails',
                'Скрыть подробную статистику': 'matrix.hideDetails',
                'ГСЧ': 'work.rng'
            };
            if (tooltipMap[element.dataset.tooltip]) {
                element.dataset.tooltip = translate(tooltipMap[element.dataset.tooltip]);
            }
        });
        document.querySelectorAll('#commentsTextarea, #workCommentsTextarea').forEach(function (comments) {
            comments.placeholder = translate('matrix.commentPlaceholder');
        });
        document.querySelectorAll('[data-language]').forEach(function (button) {
            button.classList.toggle('active', button.dataset.language === language);
        });
        document.dispatchEvent(new CustomEvent('languagechange', { detail: { language: language } }));
    }

    window.App = window.App || {};
    App.i18n = {
        t: translate,
        getLanguage: function () { return language; },
        setLanguage: function (nextLanguage) {
            if (!translations[nextLanguage] || nextLanguage === language) return;
            language = nextLanguage;
            window.localStorage.setItem(storageKey, language);
            applyLanguage();
        },
        apply: applyLanguage,
        // Переводит код ответа API (см. auth-api.php / storage-api.php) в
        // текст текущей локали. Если код неизвестен — используем переданный
        // серверный текст как запасной вариант (например для нестандартных
        // сообщений), а при его отсутствии — общий SERVER_ERROR.
        translateApiCode: function (code, fallbackMessage) {
            if (!code) return fallbackMessage || translate('api.SERVER_ERROR');
            const key = 'api.' + code;
            const hasTranslation = (translations.ru && translations.ru[key]) || (translations.en && translations.en[key]);
            if (hasTranslation) return translate(key);
            return fallbackMessage || translate('api.SERVER_ERROR');
        }
    };

    function setLanguageWithFade(nextLanguage) {
        if (!translations[nextLanguage] || nextLanguage === language) return;
        const appCard = document.querySelector('.app-card');
        if (!appCard) {
            App.i18n.setLanguage(nextLanguage);
            return;
        }

        if (languageTransitionTimer) window.clearTimeout(languageTransitionTimer);
        appCard.classList.add('language-transitioning');
        // Дожидаемся начала opacity-перехода перед сменой текста.
        window.requestAnimationFrame(function () {
            languageTransitionTimer = window.setTimeout(function () {
                App.i18n.setLanguage(nextLanguage);
                window.requestAnimationFrame(function () {
                    appCard.classList.remove('language-transitioning');
                    languageTransitionTimer = null;
                });
            }, 150);
        });
    }

    language = detectLanguage();
    document.addEventListener('DOMContentLoaded', function () {
        applyLanguage();
        document.querySelectorAll('[data-language]').forEach(function (button) {
            button.addEventListener('click', function () {
                setLanguageWithFade(button.dataset.language);
            });
        });
        const tooltipObserver = new MutationObserver(function () {
            tooltipObserver.disconnect();
            applyLanguage();
            tooltipObserver.observe(document.body, { childList: true, subtree: true });
        });
        tooltipObserver.observe(document.body, { childList: true, subtree: true });
    });
})();