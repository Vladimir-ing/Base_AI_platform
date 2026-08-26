"use strict";

/*
 * Перевод интерфейса приложения (EN) поверх русского кода.
 *
 * Как это устроено:
 *  — язык хранится в том же ключе localStorage, что и на лендинге/странице входа;
 *  — при русском языке движок пассивен: добавляется только кнопка-переключатель;
 *  — при английском переводятся текстовые узлы и атрибуты (placeholder, title,
 *    aria-label, alt) по словарю точных совпадений и по правилам для строк
 *    с числами и именами;
 *  — содержимое полей ввода (textarea) НЕ переводится: иначе английский текст
 *    мог бы сохраниться в данные пользователя;
 *  — русские значения в базе (статусы, периоды, категории) не меняются —
 *    переводится только их показ.
 */

(function () {
  const LANG_KEY = "ai-core-lang-v1";
  const LEGACY_KEY = "aicore_language";

  let lang = "ru";
  try {
    lang = localStorage.getItem(LANG_KEY) || localStorage.getItem(LEGACY_KEY) || "ru";
  } catch (e) { lang = "ru"; }
  if (lang !== "en") lang = "ru";

  function setLang(next) {
    try { localStorage.setItem(LANG_KEY, next === "en" ? "en" : "ru"); } catch (e) {}
    window.location.reload();
  }

  window.AICoreI18N = { lang: lang, setLang: setLang };

  function mountSwitcher() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn ghost lang-toggle";
    btn.id = "langToggle";
    btn.textContent = lang === "en" ? "RU" : "EN";
    btn.title = lang === "en" ? "Переключить интерфейс на русский" : "Switch interface to English";
    btn.addEventListener("click", () => setLang(lang === "en" ? "ru" : "en"));
    const anchor =
      document.getElementById("menu") ||
      document.getElementById("logoutBtn") ||
      document.querySelector(".topbar, .bar");
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(btn, anchor);
  }

  if (lang === "ru") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountSwitcher);
    else mountSwitcher();
    return;
  }

  document.documentElement.lang = "en";

  /* ── Словарь точных совпадений ──────────────────────────────────── */
  const D = {};
  /* ── Правила для строк с числами и именами ──────────────────────── */
  const P = [];

  function addDict(entries) { for (const ru in entries) D[ru] = entries[ru]; }
  function addRules(rules) {
    for (const re in rules) {
      const flags = re.slice(re.lastIndexOf("/") + 1);
      const body = re.slice(1, re.lastIndexOf("/"));
      /* правило-функция получает массив-подобник m: m[0] — всё совпадение, m[1..] — группы */
      const val = rules[re];
      const fn = typeof val === "function"
        ? function () { return val(arguments); }
        : val;
      P.push([new RegExp(body, flags || ""), fn]);
    }
  }

  /* ═══ Хром страниц ═══ */
  addDict({
    "Проверяю доступ…": "Checking access…",
    "Не удалось загрузить приложение. Обновите страницу.": "Failed to load the app. Please refresh the page.",
    "Аккаунт": "Account",
    "личная база AI-платформ": "personal AI platform database",
    "личная база AI-платформ · сейф ещё не создан": "personal AI platform database · vault not created yet",
    "AI CORE — личная база AI-платформ": "AI CORE — personal AI platform database",
    "Поиск: название, задача, приём…": "Search: name, task, workflow…",
    "Поиск по каталогу": "Search the catalog",
    "Инструкция по работе с базой": "Database user guide",
    "? Инструкция": "? Guide",
    "Админ": "Admin",
    "✦ Помощник": "✦ Assistant",
    "⇄ Сравнить": "⇄ Compare",
    "+ Платформа": "+ Platform",
    "Подключение к облачному хранилищу": "Connecting to cloud storage",
    "Облако…": "Cloud…",
    "Тариф…": "Plan…",
    "Текущая учётная запись": "Current account",
    "Выйти": "Sign out",
    "Меню": "Menu",
    "Экспорт бэкапа (с секретами)": "Export backup (with secrets)",
    "Экспорт без доступов": "Export without credentials",
    "Импорт из файла…": "Import from file…",
    "Оплата: сервисы и карты…": "Payments: services & cards…",
    "Мастер-пароль…": "Master password…",
    "Досыпать каталог платформ": "Restore catalog platforms",
    "Сменить тему": "Switch theme",
    "Инструкция по сайту": "Site guide",
    "Ничего не найдено. Сбросьте поиск или фильтры.": "Nothing found. Clear the search or filters.",
    "AI CORE — продукт": "AI CORE — a product of",
    "Вход": "Sign-in",
    "Сайт": "Website"
  });

  /* ═══ Справочники: статусы, периоды, использование, категории ═══ */
  addDict({
    "Активна": "Active",
    "Пробный период": "Trial",
    "Отменена": "Canceled",
    "Заблокирована": "Blocked",
    "Не зарегистрирован": "Not registered",
    "месяц": "month",
    "год": "year",
    "разово": "one-time",
    "Email + пароль": "Email + password",
    "Телефон": "Phone",
    "SSO / корпоративный": "SSO / corporate",
    "Текст/ассистенты": "Text/assistants",
    "Изображения": "Images",
    "Код": "Code",
    "Видео": "Video",
    "Аудио": "Audio",
    "Дизайн и презентации": "Design & presentations",
    "Автоматизация": "Automation",
    "Обучение": "Learning",
    "Оплата": "Payments",
    "Прочее": "Other",
    "Ежедневно": "Daily",
    "Еженедельно": "Weekly",
    "Редко": "Rarely",
    "Не использую": "Not using",
    "ежедневно": "daily",
    "еженедельно": "weekly",
    "редко": "rarely",
    "не использую": "not using"
  });

  /* ═══ Тариф и доступ ═══ */
  addDict({
    "Администратор": "Administrator",
    "Бесплатный полный доступ": "Free full access",
    "Тариф": "Plan",
    "без лимита": "unlimited",
    "LLM без лимита": "Unlimited LLM",
    "LLM осталось:": "LLM requests left:",
    "Тариф недоступен": "Plan unavailable"
  });
  addRules({
    "/^до ([\\d\\s\\u00a0\\u202f]+) платформ$/": "up to $1 platforms",
    "/^Бесплатный доступ включён; до (.+)$/": "Free access enabled; until $1"
  });

  /* ═══ Панель администратора ═══ */
  addDict({
    "Проверяю права администратора…": "Checking admin rights…",
    "Администрирование": "Administration",
    "пользователи, тарифы и использование LLM": "users, plans and LLM usage",
    "← К базе": "← Back to database",
    "Расходы LLM сегодня (UTC)": "LLM spend today (UTC)",
    "Баланс OpenAI ↗": "OpenAI balance ↗",
    "README администратора": "Admin README",
    "Будущие тарифы": "Future plans",
    "Цены сохранены, продажи пока выключены": "Prices saved, sales currently disabled",
    "Активные": "Active",
    "Все статусы": "All statuses",
    "Обновить": "Refresh",
    "Отменённые": "Canceled",
    "Поиск по email": "Search by email",
    "Пользователи": "Users",
    "LLM за 30 дней": "LLM in 30 days",
    "Trial до": "Trial until",
    "Пользователь": "User",
    "Последняя активность": "Last activity",
    "Регистрация": "Signed up",
    "Пользователи не найдены.": "No users found.",
    "Администрирование — База AI-платформ": "Administration — AI platform database",
    "Бесплатный доступ": "Free access",
    "Нет профиля": "No profile",
    "Просрочка": "Overdue",
    "LLM-запросы за 30 дней": "LLM requests in 30 days",
    "Активны за 30 дней": "Active in 30 days",
    "Активны за 7 дней": "Active in 7 days",
    "Активные подписки": "Active subscriptions",
    "Всего зарегистрировано": "Total registered",
    "Расчётный расход LLM за 30 дней": "Estimated LLM spend in 30 days",
    "· это расчёт по использованным токенам": "· estimated from tokens used",
    "За последние 30 дней:": "Over the last 30 days:",
    "LLM-запросов на пользователя в месяц": "LLM requests per user per month",
    "Тарифные ограничения включены": "Plan limits enabled",
    "Бесплатно": "Free",
    "Без оплаты": "No charge",
    "LLM-запросов/мес": "LLM requests/mo",
    "До": "Until",
    "· администратор": "· administrator",
    "Без email": "No email",
    "Загружаю статистику…": "Loading stats…",
    "Не удалось загрузить админ-панель:": "Failed to load the admin panel:",
    "Обновлено:": "Updated:"
  });
  addRules({
    "/^(\\d[\\d\\s\\u00a0\\u202f]*) токенов ·/": "$1 tokens ·",
    "/^в год \\(\\$(.+)$/": "/yr ($$1",
    "/^\\/мес\\)(.+)$/": "/mo)$1"
  });

  /* ═══ Облачная синхронизация и сейф ═══ */
  addDict({
    "Синхронизация…": "Syncing…",
    "Изменения ожидают сохранения в Supabase": "Changes pending upload to Supabase",
    "Сохраняю изменения в Supabase": "Saving changes to Supabase",
    "Сохранено": "Saved",
    "ошибка": "error",
    "Разрешить": "Resolve",
    "Локальный кэш принадлежит другому аккаунту": "Local cache belongs to another account",
    "Только локально": "Local only",
    "Конфликт изменений": "Version conflict",
    "Выберите, какую версию сохранить": "Choose which version to keep",
    "В облаке уже есть более свежая версия": "A newer version exists in the cloud",
    "Данные изменились в другом окне или на другом устройстве": "Data changed in another window or on another device",
    "Облачное сохранение недоступно:": "Cloud save unavailable:",
    "Не удалось проверить облако:": "Could not check the cloud:",
    "Конфликт синхронизации": "Sync conflict",
    "Эта база была изменена в другом окне или на другом устройстве.": "This database was changed in another window or on another device.",
    "Загрузите свежую облачную версию или явно сохраните текущую локальную версию поверх неё.":
      "Load the fresh cloud version or explicitly overwrite it with your current local version.",
    "Загрузить облачную": "Load cloud version",
    "Сохранить мою версию": "Keep my version",
    "Разрешаю конфликт версий": "Resolving version conflict",
    "Не удалось разрешить конфликт:": "Could not resolve the conflict:",
    "Проверяю облачное хранилище": "Checking cloud storage",
    "Нет активной сессии": "No active session",
    "Облачная версия изменилась после последней синхронизации": "Cloud version changed since last sync",
    "Обнаружены локальные и более свежие облачные изменения": "Local and newer cloud changes detected",
    "Данные загружены из облака": "Data loaded from the cloud",
    "Облачная синхронизация недоступна:": "Cloud sync unavailable:",
    "Нет подключения к сети": "No network connection",
    "Сейф заблокирован": "Vault locked",
    "Закрыть": "Close",
    "Отмена": "Cancel",
    "Продолжить": "Continue",
    "Мастер-пароль": "Master password",
    "Повторите пароль": "Repeat password",
    "Готово": "Done",
    "Введите пароль.": "Enter a password.",
    "Минимум 8 символов — это ключ ко всем вашим паролям.": "At least 8 characters — this is the key to all your passwords.",
    "Пароли не совпадают.": "Passwords do not match.",
    "Создать мастер-пароль": "Create master password",
    "Новый мастер-пароль": "New master password",
    "Создать сейф": "Create vault",
    "Восстановить его невозможно": "It cannot be recovered",
    "Этим паролем шифруются пароли, API-ключи и приватные заметки.":
      "Passwords, API keys and private notes are encrypted with it.",
    "— запишите в менеджер паролей или на бумагу. Остальные поля базы останутся читаемыми даже без него.":
      "— write it down in a password manager or on paper. The rest of the database stays readable even without it.",
    "Сейф создан и разблокирован": "Vault created and unlocked",
    "Разблокировать": "Unlock",
    "Разблокировать сейф": "Unlock vault",
    "Неверный мастер-пароль": "Wrong master password",
    "Сейф разблокирован на 10 минут": "Vault unlocked for 10 minutes",
    "Все сохранённые секреты будут перешифрованы": "All saved secrets will be re-encrypted",
    "Сменить": "Change",
    "Старые бэкапы останутся на старом пароле — сделайте новый экспорт после смены.":
      "Old backups stay on the old password — make a fresh export after changing it.",
    "Мастер-пароль изменён — сделайте новый бэкап": "Master password changed — make a new backup",
    "🔐 Создать сейф": "🔐 Create vault",
    "Задать мастер-пароль для хранения паролей": "Set a master password for storing passwords",
    "🔓 Сейф открыт": "🔓 Vault open",
    "Нажмите, чтобы заблокировать": "Click to lock",
    "🔒 Сейф закрыт": "🔒 Vault locked",
    "Нажмите, чтобы разблокировать": "Click to unlock",
    "· сейф ещё не создан": "· vault not created yet",
    "Есть локальный кэш и персональная копия в Supabase. Экспорт остаётся дополнительным бэкапом.":
      "There is a local cache and a personal copy in Supabase. Export remains an extra backup.",
    "Локальный кэш недоступен. При наличии сети данные сохраняются в Supabase.":
      "Local cache unavailable. With a network connection, data is saved to Supabase.",
    "Сейчас действует бесплатный ранний доступ. Для пользователей установлен лимит 20 LLM-запросов в месяц.":
      "Free early access is active. Users have a limit of 20 LLM requests per month.",
    "Браузер не даёт сохранять данные.": "The browser blocks data storage.",
    "Всё, что вы введёте, живёт только до закрытия вкладки — сделайте «Экспорт бэкапа» перед закрытием.":
      "Everything you enter lives only until the tab is closed — run “Export backup” before closing.",
    "У вас есть сохранённые секреты, но нет независимого файла бэкапа. Облачная копия уже работает; экспорт полезен для дополнительного восстановления.":
      "You have saved secrets but no standalone backup file. The cloud copy already works; export is useful as an extra recovery option.",
    "Данные сохранены в облаке:": "Data saved to the cloud:",
    "Загружена свежая версия из облака": "Fresh version loaded from the cloud"
  });
  addRules({
    "/^Сейчас действует бесплатный ранний доступ: все функции открыты, осталось (.+) LLM-запросов на этот месяц\\.$/":
      "Free early access is active: all features are open, $1 LLM requests left this month.",
    "/^Полный trial Max: осталось (.+) дн\\. После него автоматически включится бесплатный Basic на 10 платформ\\.$/":
      "Full Max trial: $1 days left. After that, the free Basic plan (10 platforms) starts automatically.",
    "/^Лимит тарифа — (.+) платформ\\. Существующие данные доступны; для новых платформ понадобится освободить место или повысить тариф\\.$/":
      "Plan limit — $1 platforms. Existing data stays available; to add new platforms, free up space or upgrade.",
    "/^Последний бэкап был (.+) дн\\. назад\\.?$/": "Last backup was $1 days ago."
  });

  /* ═══ Сводка, внимание, экономика ═══ */
  addDict({
    "Платформ в базе": "Platforms in database",
    "Платформ в выборке": "Platforms in view",
    "Активных": "Active",
    "пробных нет": "no trials",
    "Расходы в месяц": "Monthly spend",
    "годовые тарифы приведены к месяцу": "yearly plans prorated to monthly",
    "Ближайшее списание": "Next charge",
    "дата не указана": "no date set",
    "Бесплатных в работе": "Free in use",
    "используются без оплаты": "used without payment",
    "ещё не заведено": "not set up yet",
    "в базе": "in database",
    "на пробном периоде": "on trial",
    "Пробный период — проверьте условия и дату окончания": "Trial period — check the terms and end date",
    "сегодня": "today",
    "завтра": "tomorrow",
    "Платная подписка не используется ·": "Paid subscription not in use ·",
    "Используется редко · проверьте, стоит ли продлевать": "Rarely used · check whether it is worth renewing",
    "Требуют внимания": "Needs attention",
    "Списания, пробные периоды и подписки с низким использованием": "Charges, trials and low-usage subscriptions",
    "Экономика подписок": "Subscription economics",
    "Платные сервисы, которые используются редко или не используются":
      "Paid services that are rarely used or not used",
    "Потенциальная экономия:": "Potential savings:",
    "не указано": "not specified",
    "Бесплатный": "Free",
    "Стоит своих денег": "Worth the money",
    "Скорее стоит": "Probably worth it",
    "Под вопросом": "Questionable",
    "Кандидат на отмену": "Cancel candidate",
    "Нет данных об использовании": "No usage data"
  });
  addRules({
    "/^из ([\\d\\s\\u00a0\\u202f]+) в базе$/": "of $1 in database",
    "/^([\\d\\s\\u00a0\\u202f]+) ещё не заведено$/": "$1 not set up yet",
    "/^([\\d\\s\\u00a0\\u202f]+) на пробном периоде$/": "$1 on trial",
    "/^через ([\\d\\s\\u00a0\\u202f]+) дн\\.$/": "in $1 days",
    "/^Потенциальная экономия: (.+)$/": "Potential savings: $1",
    "/^Списание (сегодня|завтра|in .*)( · .*)?$/": function (m) {
      const when = m[1] === "сегодня" ? "today" : m[1] === "завтра" ? "tomorrow" : m[1];
      return "Charge " + when + (m[2] || "");
    }
  });

  /* ═══ Помощник и сравнение ═══ */
  addDict({
    "Введите вопрос о вашей базе AI-сервисов.": "Ask a question about your AI service database.",
    "Отметьте частоту использования у платных сервисов — тогда анализ станет точнее.":
      "Mark how often you use paid services — the analysis will be more accurate.",
    "Я не вижу очевидных кандидатов на сокращение расходов.": "I don't see obvious candidates for cutting costs.",
    "/мес.": "/mo.",
    "Сначала стоит проверить эти подписки:": "Check these subscriptions first:",
    "частота не указана": "usage not specified",
    "Это рекомендация по данным вашей базы, а не автоматическая команда на отмену.":
      "This is a recommendation based on your database, not an automatic cancellation.",
    "Ближайшие списания не найдены.": "No upcoming charges found.",
    "Проверьте, заполнены ли даты продления в карточках.": "Check that renewal dates are filled in on the cards.",
    "Ближайшие списания": "Upcoming charges",
    "цена не указана": "price not specified",
    "Вот наиболее подходящие варианты из вашей базы": "Here are the best matches from your database",
    "Для": "For",
    "я бы сначала рассмотрел:": "I would start with:",
    "В базе нет достаточно подходящей карточки.": "No sufficiently matching card in the database.",
    "Попробуйте сформулировать задачу через категорию: презентация, код, изображения, видео, аудио, текст или автоматизация.":
      "Try describing the task via a category: presentations, code, images, video, audio, text or automation.",
    "Лучший матч ·": "Best match ·",
    "рейтинг": "rating",
    "модель": "model",
    "Рекомендовано моделью по данным вашей базы": "Recommended by the model based on your database",
    "; LLM осталось:": "; LLM requests left:",
    "Платформы без лимита": "Platforms with no limit",
    "месячный лимит LLM-запросов исчерпан": "monthly LLM request limit reached",
    "лимит раннего доступа — 20 LLM-запросов в месяц — исчерпан": "early access limit — 20 LLM requests per month — reached",
    "не удалось проверить тариф": "could not check the plan",
    "настройки тарифа временно недоступны": "plan settings temporarily unavailable",
    "не удалось проверить лимит запросов": "could not check the request limit",
    "🔒 В LLM отправляются только описания сервисов, рейтинги и тарифные поля. Логины, пароли, API-ключи и приватные заметки не отправляются.":
      "🔒 Only service descriptions, ratings and plan fields are sent to the LLM. Logins, passwords, API keys and private notes are never sent.",
    "LLM через защищённый аккаунт": "LLM via a secured account",
    "Авторизация выполняется автоматически через Supabase": "Authorization happens automatically via Supabase",
    "Спросить": "Ask",
    "Презентация": "Presentations",
    "Списания": "Charges",
    "Экономия": "Savings",
    "Задайте вопрос о сервисах, подписках или задачах.": "Ask about services, subscriptions or tasks.",
    "Помощник по AI-базе": "AI database assistant",
    "LLM с безопасным fallback на локальный анализ": "LLM with a safe fallback to local analysis",
    "✦ Анализирую базу через LLM…": "✦ Analyzing the database via LLM…",
    "). Показан локальный анализ.": "). Showing local analysis.",
    "LLM сейчас недоступен (": "LLM currently unavailable (",
    "Параметр": "Attribute",
    "Категория": "Category",
    "Статус": "Status",
    "Цена": "Price",
    "Рейтинг": "Rating",
    "Использование": "Usage",
    "Ценность": "Value",
    "Назначение": "Purpose",
    "Сильные стороны": "Strengths",
    "Для сравнения нужно минимум две платформы": "At least two platforms are needed to compare",
    "Выберите от 2 до 4 платформ.": "Select 2 to 4 platforms.",
    "Сравнить AI-сервисы": "Compare AI services",
    "Цена, использование, рейтинг и ценность": "Price, usage, rating and value",
    "Сравнить": "Compare",
    "Выберите минимум две платформы.": "Select at least two platforms.",
    "Можно сравнить максимум четыре платформы.": "You can compare up to four platforms.",
    "Сравнение платформ": "Platform comparison"
  });

  /* ═══ Фильтры и сетка ═══ */
  addDict({
    "Все": "All",
    "Любой статус": "Any status",
    "Оплата: любая": "Payment: any",
    "Только бесплатные": "Free only",
    "Способ не указан": "No payment method set",
    "⚙ Настроить способы оплаты…": "⚙ Configure payment methods…",
    "Сортировка: по категориям": "Sort: by category",
    "Сортировка: по названию": "Sort: by name",
    "Сортировка: по оценке": "Sort: by rating",
    "Сортировка: по статусу": "Sort: by status",
    "Сортировка: по цене": "Sort: by price",
    "Описание не заполнено": "No description yet",
    "Добавить платформу": "Add platform",
    "вручную, своими полями": "manually, with your own fields",
    "Через сервис оплаты": "Via payment service",
    "Картой или счётом": "By card or account",
    "Фильтр по способу оплаты": "Filter by payment method",
    "В сейфе есть пароль или ключ": "Vault has a password or key",
    "Закреплено": "Pinned"
  });
  addRules({
    "/^Только платные \\((\\d+)\\)$/": "Paid only ($1)",
    "/^Открыть (сайт|личный кабинет): (.+)$/": function (m) {
      return "Open " + (m[1] === "сайт" ? "website" : "dashboard") + ": " + m[2];
    },
    "/^Открыть (.+) в новой вкладке$/": "Open $1 in a new tab",
    "/^Удалить «(.+)» из базы$/": "Delete “$1” from the database"
  });

  /* ═══ Карточка платформы ═══ */
  addDict({
    "Тариф и оплата": "Plan & payment",
    "Для чего нужна": "What it's for",
    "Приёмы и фишки": "Tips & tricks",
    "Особенности регистрации": "Sign-up notes",
    "Что даёт бесплатно": "What the free tier gives",
    "Доступ": "Access",
    "Логин": "Login",
    "Копировать": "Copy",
    "не указан": "not set",
    "Вход через": "Sign in via",
    "· 2FA включена": "· 2FA enabled",
    "включена": "enabled",
    "Пароль": "Password",
    "в сейфе не сохранён": "not saved in the vault",
    "🔒 сейф заблокирован": "🔒 vault locked",
    "не удалось расшифровать": "could not decrypt",
    "Показать": "Show",
    "API-ключ": "API key",
    "Заметки": "Notes",
    "Где ещё пароль": "Where else the password is",
    "Стоимость": "Cost",
    "Следующее списание": "Next charge",
    "Дата продления": "Renewal date",
    "Чем платим": "Paid with",
    "Ценность подписки": "Subscription value",
    "Цены проверял": "Prices checked",
    "Теги": "Tags",
    "Тариф и учёт": "Plan & billing",
    "Через него оплачивается": "Pays for",
    "Итого:": "Total:",
    "без оплаты": "no charge",
    "в месяц": "per month",
    "Пока ни одна платформа не привязана. Выберите этот сервис в поле «Чем платим» у нужных платформ.":
      "No platforms are linked yet. Pick this service in the “Paid with” field on the relevant platforms.",
    "Служебное": "Service info",
    "Обновлено": "Updated",
    "Удалить": "Delete",
    "Редактировать": "Edit",
    "Скрыть": "Hide",
    "— не указан": "— not set",
    "Вернуть": "Restore",
    "бесплатно": "free",
    "/год": "/yr",
    "/мес": "/mo",
    "Карточка": "Card",
    "Изменить": "Edit"
  });
  addRules({
    "/^Итого: (.+) без оплаты$/": "Total: $1, no charge"
  });

  /* ═══ Форма редактирования ═══ */
  addDict({
    "+ Новый сервис оплаты…": "+ New payment service…",
    "+ Новая карта или счёт…": "+ New card or account…",
    "⚙ Управление…": "⚙ Manage…",
    "🔒 Сейф заблокирован — пароль и API-ключ сохранятся без изменений. Разблокируйте сейф, чтобы их менять.":
      "🔒 Vault locked — the password and API key will be saved unchanged. Unlock the vault to edit them.",
    "Мастер-пароль ещё не задан. Нажмите «🔐 Создать сейф» в шапке — и поля пароля станут доступны.":
      "No master password yet. Click “🔐 Create vault” in the header — the password fields will unlock.",
    "Название *": "Name *",
    "Ссылка на сайт": "Website URL",
    "Ссылка на вход в кабинет": "Sign-in URL",
    "Ссылка на тариф / оплату": "Pricing / payment URL",
    "Приёмы и фишки — по одному в строке": "Tips & tricks — one per line",
    "Логин / email": "Login / email",
    "Способ входа": "Sign-in method",
    "Приватные заметки (шифруются)": "Private notes (encrypted)",
    "например: менеджер паролей": "e.g. a password manager",
    "Где ещё лежит пароль": "Where else the password is stored",
    "Включена двухфакторная авторизация": "Two-factor authentication enabled",
    "Название тарифа": "Plan name",
    "Валюта": "Currency",
    "Период": "Period",
    "Сервис-посредник или карта. Новый добавляется прямо здесь, ⚙ — управление списком.":
      "Payment service or card. Add a new one right here; ⚙ manages the list.",
    "Частота использования": "Usage frequency",
    "Моя оценка": "My rating",
    "без оценки": "unrated",
    "Когда проверял цены": "When prices were checked",
    "Теги через запятую": "Tags, comma-separated",
    "Закрепить в начале списка": "Pin to the top",
    "Достигнут лимит тарифа": "Plan limit reached",
    "Новая платформа": "New platform",
    "Редактирование": "Editing",
    "Заполните хотя бы название и ссылку": "Fill in at least the name and URL",
    "Сохранить": "Save",
    "Название обязательно": "Name is required",
    "Сейф закрылся — сохранил всё, кроме пароля и ключа": "Vault locked — saved everything except the password and key",
    "Изменения сохранены": "Changes saved",
    "Платформа добавлена": "Platform added",
    "Сервис создан — допишите логин и условия в карточке": "Service created — add the login and terms in its card",
    "Сервис создан — его карточку можно заполнить позже": "Service created — you can fill in its card later"
  });
  addRules({
    "/^Проверьте (ссылку на сайт|ссылку на вход|ссылку на оплату): разрешены только полные http:\\/\\/ или https:\\/\\/ адреса$/":
      function (m) {
        const what = { "ссылку на сайт": "the website URL", "ссылку на вход": "the sign-in URL", "ссылку на оплату": "the payment URL" }[m[1]];
        return "Check " + what + ": only full http:// or https:// addresses are allowed";
      }
  });

  /* ═══ Экспорт и импорт ═══ */
  addDict({
    "Бэкап сохранён (секреты внутри зашифрованы)": "Backup saved (secrets encrypted inside)",
    "Выгружено без доступов": "Exported without credentials",
    "Это не похоже на файл базы": "This doesn't look like a database file",
    "Восстановить из файла": "Restore from file",
    "Восстановить": "Restore",
    "записей": "records",
    "Что делать с платформами, которые уже есть в базе?": "What to do with platforms already in the database?",
    "Заменить совпадения": "Overwrite matches",
    "данные из файла перезапишут существующие записи": "file data will overwrite existing records",
    "Пропустить совпадения": "Skip matches",
    "добавятся только новые платформы": "only new platforms will be added",
    "Добавить всё как новое": "Add everything as new",
    "дубликаты допускаются": "duplicates allowed",
    "В файле нет параметров шифрования — секреты пропущены": "The file has no encryption parameters — secrets skipped",
    "Импорт отменён: нужен доступ к сейфу": "Import canceled: vault access needed",
    "Мастер-пароль бэкапа": "Backup master password",
    "зашифрованных записей": "encrypted records",
    "Файл зашифрован другим паролем, чем текущий сейф. Введите пароль":
      "The file is encrypted with a different password than the current vault. Enter the",
    "от бэкапа": "backup password",
    "— секреты будут перешифрованы под ваш текущий мастер-пароль.":
      "— secrets will be re-encrypted with your current master password.",
    "Расшифровать": "Decrypt",
    "Неверный пароль бэкапа — импорт отменён": "Wrong backup password — import canceled",
    "Импорт": "Import",
    "Все платформы каталога уже в базе": "All catalog platforms are already in the database",
    "Добавлено платформ:": "Platforms added:",
    "Файл не читается как JSON": "File cannot be read as JSON",
    "Экспорт": "Export"
  });
  addRules({
    "/^Импорт: добавлено (\\d+), заменено (\\d+), пропущено (\\d+)$/": "Import: added $1, overwritten $2, skipped $3",
    "/^Восстановлено: (\\d+) записей$/": "Restored: $1 records",
    "/^В базе только исходный каталог\\. Заменить его содержимым файла \\((\\d+) платформ\\)\\?$/":
      "The database only has the original catalog. Replace it with the file contents ($1 platforms)?",
    "/^В файле (\\d+) зашифрованных записей$/": "The file has $1 encrypted records",
    "/^Удалено: «(.+)»$/": "Deleted: “$1”",
    "/^Восстановлено: «(.+)»$/": "Restored: “$1”",
    "/\\. Введите мастер-пароль бэкапа для доступа к секретам$/": ". Enter the backup master password to access the secrets"
  });

  /* ═══ Оплата платформ ═══ */
  addDict({
    "Новый способ оплаты": "New payment method",
    "Способ оплаты:": "Payment method:",
    "Только метка: «Карта Т-Банк», «Счёт в PayPal», «Карта мужа».":
      "Just a label: “T-Bank card”, “PayPal account”, “Husband's card”.",
    "Номера карт, срок и CVV сюда вписывать не нужно.": "Card numbers, expiry and CVV do not belong here.",
    "Карта №1": "Card #1",
    "например: основная, до 2028": "e.g. main, until 2028",
    "Пометка": "Note",
    "Обычная валюта": "Default currency",
    "Добавить": "Add",
    "Введите название.": "Enter a name.",
    "Такой способ уже есть в списке.": "This method is already in the list.",
    "Новый сервис оплаты": "New payment service",
    "Посредник, конвертация, виртуальные карты": "Intermediaries, currency conversion, virtual cards",
    "Сервис станет обычной карточкой каталога в категории «Оплата»: у него будет свой сайт, логин, пароль в сейфе и заметки. Здесь достаточно названия — остальное допишете в карточке.":
      "The service becomes a regular card in the “Payments” category: with its own site, login, vault password and notes. A name is enough here — fill in the rest in its card.",
    "Комиссия / условия": "Fees / terms",
    "Создать": "Create",
    "Платформа с таким названием уже есть в базе.": "A platform with this name already exists.",
    "Сайт должен начинаться с http:// или https://.": "The site URL must start with http:// or https://.",
    "не используется": "not used",
    "Всего по способам оплаты:": "Across payment methods:",
    "Пока ни одна платформа не привязана к способу оплаты": "No platform is linked to a payment method yet",
    "Оплата платформ": "Platform payments",
    "Сервисы-посредники и карты — общий список для всей базы":
      "Intermediary services and cards — one shared list for the whole database",
    "Сервисы оплаты": "Payment services",
    "Сервисов пока нет. Посредник, конвертация или виртуальная карта заводится как обычная карточка каталога — со своим логином, паролем в сейфе и условиями.":
      "No services yet. An intermediary, conversion service or virtual card is added as a regular catalog card — with its own login, vault password and terms.",
    "Карты и счета": "Cards & accounts",
    "Меток пока нет. Это простые записи без сайта и логина — «Карта Т-Банк», «Наличными».":
      "No labels yet. These are simple records without a site or login — “T-Bank card”, “Cash”.",
    "+ Карта или счёт": "+ Card or account",
    "+ Сервис оплаты": "+ Payment service",
    "Карта добавлена в список": "Card added to the list",
    "пока ничего не оплачивается": "nothing is paid through it yet",
    "Способ не используется ни одной платформой.": "No platform uses this method.",
    ". Сами платформы останутся, у них просто опустеет поле «Чем платим».":
      ". The platforms themselves stay; their “Paid with” field just becomes empty."
  });
  addRules({
    "/^(\\d+) платф\\. · через него: (.+)$/": "$1 platforms · via it: $2",
    "/^Показано всё, что оплачивается через «(.+)»$/": "Showing everything paid via “$1”",
    "/^Показаны платформы, оплаченные через «(.+)»$/": "Showing platforms paid via “$1”",
    "/^Удалить сервис «(.+)»$/": "Delete service “$1”",
    "/^Удалить способ «(.+)»$/": "Delete method “$1”",
    "/^К нему привязано платформ: (\\d+) — они останутся, у них опустеет поле «Чем платим»\\.$/":
      "$1 platforms are linked to it — they stay, their “Paid with” field becomes empty."
  });

  /* ═══ Удаление и разное ═══ */
  addDict({
    "Карточка и её секреты исчезнут. Отменить это будет нельзя.": "The card and its secrets will disappear. This cannot be undone.",
    "Вернуть её потом можно через «⋯ → Досыпать каталог платформ».": "You can restore it later via “⋯ → Restore catalog platforms”.",
    "Запись и её секреты исчезнут из базы. Отменить это будет нельзя.": "The record and its secrets will disappear. This cannot be undone.",
    "Короткий маршрут от входа до резервной копии": "The short path from sign-in to backup",
    "Понятно": "Got it",
    "Светлая тема": "Light theme",
    "Тёмная тема": "Dark theme",
    "Браузер не дал доступ к буферу обмена": "The browser denied clipboard access"
  });
  addRules({
    "/^Удалить «(.+)» из базы\\?$/": "Delete “$1” from the database?",
    "/^Через неё оплачивается платформ: (\\d+)$/": "$1 platforms are paid through it",
    "/^(.+) скопирован — буфер очистится через 30 сек$/": "$1 copied — the clipboard clears in 30 s",
    "/^Не удалось прочитать секреты «(.+)» — смена отменена$/": "Could not read the secrets of “$1” — change canceled"
  });

  /* ═══ Даты и числа ═══ */
  const MONTHS = {
    "января": "January", "февраля": "February", "марта": "March", "апреля": "April",
    "мая": "May", "июня": "June", "июля": "July", "августа": "August",
    "сентября": "September", "октября": "October", "ноября": "November", "декабря": "December"
  };
  addRules({
    "/^(\\d{1,2})[\\s\\u00a0\\u202f](января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)[\\s\\u00a0\\u202f](\\d{4})(?:[\\s\\u00a0\\u202f]?г\\.?)?$/u":
      function (m) { return MONTHS[m[2]] + " " + (+m[1]) + ", " + m[3]; }
  });
  /* самый общий шаблон — строго последним, чтобы не перехватывать специфичные */
  addRules({
    "/^Удалить (.+)$/": "Delete $1"
  });

  addDict({
    "Например: чем лучше сделать презентацию?": "E.g.: how do I make a better presentation?",
    "Чем подтверждали аккаунт, какие были сложности, ограничения, чем оплачивали…":
      "How you verified the account, any difficulties or limits, what you paid with…",
    "например: Сервис-посредник": "e.g. an intermediary service",
    "например: +12% к сумме, минимум 500 ₽": "e.g. +12% fee, 500 minimum"
  });
  addRules({
    "/^Не удалось загрузить админ-панель: (.+)$/": "Failed to load the admin panel: $1"
  });

  /* ═══ Каталог-сид: описания платформ ═══ */
  addDict({
    "Платформа, на которой идёт само обучение по ИИ: уроки, домашние задания, записи вебинаров и материалы курса.":
      "The platform hosting the AI course itself: lessons, homework, webinar recordings and course materials.",
    "Всё обучение в одном кабинете: расписание, задания с проверкой, записи занятий, чаты потока.":
      "All learning in one place: schedule, graded assignments, class recordings and cohort chats.",
    "Впишите в «Ссылку на вход» адрес кабинета именно вашей школы — у GetCourse это отдельный поддомен, общий getcourse.ru нужен только как точка входа.":
      "Put your school's own dashboard address in “Sign-in URL” — with GetCourse it's a separate subdomain; the shared getcourse.ru is only an entry point.",
    "Записи вебинаров и материалы обычно в разделе «Мои курсы» → нужный урок; полезные ссылки из уроков сразу заносите в эту базу.":
      "Webinar recordings and materials usually live under “My courses” → the lesson you need; save useful links from lessons straight into this database.",
    "Письма о занятиях приходят на почту аккаунта — проверьте, что это ваш рабочий email.":
      "Class emails go to the account's inbox — make sure it's your working email.",
    "Чат-ассистент Anthropic: длинные тексты, аналитика, разбор документов, код, интерактивные артефакты.":
      "Anthropic's chat assistant: long-form writing, analytics, document review, code, interactive artifacts.",
    "Большое контекстное окно и аккуратная работа с длинными документами, Артефакты (готовые страницы и приложения прямо в чате), Проекты с постоянным контекстом.":
      "Large context window and careful handling of long documents, Artifacts (ready pages and apps right in the chat), Projects with persistent context.",
    "Заводите отдельный Проект на каждую тему и складывайте туда файлы-контекст — не придётся объяснять всё заново.":
      "Create a separate Project per topic and keep context files there — no need to explain everything from scratch.",
    "Перед большой задачей просите сначала план, потом исполнение.":
      "For big tasks, ask for a plan first, then the execution.",
    "Артефакты удобно сохранять и переиспользовать как шаблоны.":
      "Artifacts are easy to save and reuse as templates.",
    "Агент Claude в терминале и IDE: читает и правит файлы проекта, запускает команды, работает с git.":
      "The Claude agent in your terminal and IDE: reads and edits project files, runs commands, works with git.",
    "Работает с реальными файлами на диске, помнит правила проекта через CLAUDE.md, расширяется навыками и хуками.":
      "Works with real files on disk, remembers project rules via CLAUDE.md, extends with skills and hooks.",
    "Положите в корень проекта CLAUDE.md с описанием проекта и правилами — экономит объяснения в каждой сессии.":
      "Put a CLAUDE.md with the project description and rules in the project root — it saves explanations in every session.",
    "Для крупных правок сначала план-режим, только потом запуск.":
      "For large edits, use plan mode first, then execute.",
    "Тот же аккаунт и подписка, что у Claude в браузере.":
      "Same account and subscription as Claude in the browser.",
    "Чат-ассистент OpenAI: текст, изображения, анализ файлов, голосовой режим, кастомные GPT.":
      "OpenAI's chat assistant: text, images, file analysis, voice mode, custom GPTs.",
    "Живой голосовой режим, генерация картинок внутри чата, магазин готовых GPT под узкие задачи.":
      "Lively voice mode, in-chat image generation, a store of ready GPTs for narrow tasks.",
    "В настройках персонализации один раз опишите, кто вы и как вам отвечать — это работает во всех чатах.":
      "In the personalization settings, describe once who you are and how to answer — it works across all chats.",
    "Под повторяющиеся задачи собирайте свой GPT вместо копирования промпта.":
      "For recurring tasks, build your own GPT instead of copy-pasting a prompt.",
    "Аккаунт общий с Sora и API-платформой OpenAI.":
      "The account is shared with Sora and the OpenAI API platform.",
    "Ассистент Google: работа с большими файлами, связка с Gmail, Диском и Документами.":
      "Google's assistant: handles large files, connects to Gmail, Drive and Docs.",
    "Очень длинный контекст (можно скормить целую книгу или большой PDF) и интеграция с сервисами Google.":
      "Very long context (a whole book or a large PDF fits) and integration with Google services.",
    "Входите тем же Google-аккаунтом, где живут ваш Диск и почта — иначе интеграции бесполезны.":
      "Sign in with the Google account where your Drive and mail live — otherwise the integrations are useless.",
    "Один аккаунт открывает Gemini, Flow, NotebookLM и AI Studio — держите его основным для Google-инструментов.":
      "One account unlocks Gemini, Flow, NotebookLM and AI Studio — keep it as your main one for Google tools.",
    "Поисковик-ассистент: отвечает по свежим данным из интернета и показывает источники.":
      "A search assistant: answers from fresh internet data and shows its sources.",
    "Ответ со ссылками, которые можно проверить; режимы глубокого исследования; коллекции по темам.":
      "Answers with verifiable links; deep research modes; topic collections.",
    "Когда важна точность — прямо просите перечислить источники и даты.":
      "When accuracy matters, explicitly ask it to list sources and dates.",
    "Заводите Space под каждое исследование, чтобы контекст не смешивался.":
      "Create a separate Space for each research topic to keep contexts from mixing.",
    "Чат-модель с сильным логическим выводом и открытыми весами, очень дешёвый API.":
      "A chat model with strong reasoning and open weights; a very cheap API.",
    "Соотношение цена/качество: годится для потоковой генерации и черновиков, есть режим размышления.":
      "Great price-to-quality ratio: good for streaming generation and drafts; has a reasoning mode.",
    "Хороший вариант для массовой рутины, когда топ-модель не нужна.":
      "A good pick for high-volume routine work when a top model isn't needed.",
    "Если работаете через API — ключ храните в сейфе этой базы, а не в коде.":
      "If you work via the API, keep the key in this database's vault, not in code.",
    "Ассистент xAI с доступом к контенту соцсети X — полезен для актуальных тем и трендов.":
      "xAI's assistant with access to X content — useful for current topics and trends.",
    "Реакция на происходящее прямо сейчас, свободный тон, генерация изображений.":
      "Reacts to what's happening right now, casual tone, image generation.",
    "Аккаунт связан с профилем X — если его нет, регистрация начнётся с него.":
      "The account is tied to an X profile — if you don't have one, sign-up starts there.",
    "Рабочая тетрадь по вашим материалам: загружаете PDF, ссылки, видео — получаете конспекты, ответы и аудиообзор.":
      "A notebook over your own materials: upload PDFs, links, videos — get summaries, answers and an audio overview.",
    "Отвечает только по загруженным источникам и ссылается на них — почти не выдумывает; умеет делать подкаст-обзор.":
      "Answers only from the uploaded sources and cites them — rarely makes things up; can produce a podcast-style overview.",
    "Идеально под конспекты курса: залейте материалы урока и слушайте аудиообзор по дороге.":
      "Perfect for course notes: upload the lesson materials and listen to the audio overview on the go.",
    "Один блокнот = одна тема, иначе ответы расплываются.":
      "One notebook = one topic, otherwise answers get blurry.",
    "Редактор кода на базе VS Code с ИИ-агентом внутри: правки по всему проекту, чат по кодовой базе.":
      "A VS Code based editor with a built-in AI agent: project-wide edits, chat over the codebase.",
    "Привычный VS Code плюс агент, который видит проект целиком; умное автодополнение.":
      "Familiar VS Code plus an agent that sees the whole project; smart autocomplete.",
    "При первом запуске можно перенести расширения и настройки из VS Code одним нажатием.":
      "On first launch you can import extensions and settings from VS Code in one click.",
    "Правила проекта задаются файлом правил — аналог CLAUDE.md.":
      "Project rules are set by a rules file — an equivalent of CLAUDE.md.",
    "ИИ-автодополнение и чат прямо в редакторе, ревью пул-реквестов.":
      "AI autocomplete and chat right in the editor, pull request reviews.",
    "Живёт внутри IDE и не требует переключения контекста; тесная связка с GitHub.":
      "Lives inside the IDE with no context switching; tight GitHub integration.",
    "Нужен аккаунт GitHub — заведите его до подписки.":
      "A GitHub account is required — create one before subscribing.",
    "Студентам и авторам открытых проектов доступ обычно бесплатный — проверьте право на льготу.":
      "Students and open-source authors usually get free access — check if you qualify.",
    "Генерация интерфейсов и React-компонентов по текстовому описанию, с предпросмотром и экспортом кода.":
      "Generates interfaces and React components from a text description, with preview and code export.",
    "Быстрый путь от идеи до рабочего прототипа UI; аккуратный современный код.":
      "A fast path from idea to a working UI prototype; clean modern code.",
    "Вход через аккаунт Vercel — он же понадобится для публикации результата.":
      "Sign in with a Vercel account — you'll also need it to publish the result.",
    "Просите компонент по частям: сначала структура, потом стили.":
      "Ask for the component in parts: structure first, then styles.",
    "Генератор изображений с очень сильной картинкой «из коробки»: концепты, иллюстрации, референсы.":
      "An image generator with a very strong out-of-the-box look: concepts, illustrations, references.",
    "Эстетика и детализация, богатые стили, инструменты ретуши, апскейла и вариаций.":
      "Aesthetics and detail, rich styles, retouch, upscale and variation tools.",
    "Записывайте удачные параметры (--ar, --style, ссылки на референсы) — половина результата в них.":
      "Write down winning parameters (--ar, --style, reference links) — half the result is in them.",
    "Раньше работал только через Discord, теперь есть веб-версия; аккаунт может быть привязан к Discord.":
      "It used to be Discord-only; there's now a web version, and the account may be tied to Discord.",
    "Свои удачные промпты храните в заметках карточки платформы.":
      "Keep your best prompts in the platform card's notes.",
    "Генератор изображений и настоящей векторной графики — сделан под дизайнеров.":
      "An image and true vector graphics generator — built for designers.",
    "Выдаёт редактируемый SVG, держит единый стиль в серии, умеет брендовые наборы стилей.":
      "Outputs editable SVG, keeps a consistent style across a series, supports brand style sets.",
    "Незаменим, когда картинка должна лечь в макет как вектор — иконки, логотипы, паттерны.":
      "Indispensable when the artwork must land in a layout as a vector — icons, logos, patterns.",
    "Создайте свой стиль по референсам, чтобы вся серия выглядела одинаково.":
      "Create your own style from references so the whole series looks consistent.",
    "Генератор изображений, который лучше других рисует текст внутри картинки.":
      "An image generator that renders text inside images better than the rest.",
    "Читаемые надписи, логотипы, плакаты и обложки; аккуратная типографика.":
      "Readable captions, logos, posters and covers; careful typography.",
    "Текст для картинки берите в кавычки в промпте.":
      "Put the text for the image in quotes in the prompt.",
    "Первый выбор для афиш, обложек и постов с надписями.":
      "The first pick for posters, covers and posts with lettering.",
    "Генерация и улучшение изображений в реальном времени: рисуете набросок — видите результат сразу.":
      "Real-time image generation and editing: sketch something — see the result instantly.",
    "Real-time canvas, мощный апскейл до печатного размера, обучение своего стиля.":
      "Real-time canvas, a strong print-size upscaler, custom style training.",
    "Удобно доводить чужой или свой рендер: набросок → уточнение → апскейл.":
      "Handy for refining your own or someone else's render: sketch → refine → upscale.",
    "Хорошо работает в паре с Midjourney: там картинка, здесь доработка.":
      "Works well paired with Midjourney: image there, refinement here.",
    "Генератор изображений с готовыми моделями и тонким контролем композиции; много ассетов для игр.":
      "An image generator with ready models and fine composition control; lots of game assets.",
    "Контроль позы и композиции, собственные обученные модели, пакетная генерация.":
      "Pose and composition control, custom trained models, batch generation.",
    "Смотрите готовые модели сообщества — часто быстрее, чем настраивать с нуля.":
      "Browse the community's ready models — often faster than training from scratch.",
    "Генеративные инструменты Adobe: изображения, заливка, замена объектов; встроены в Photoshop и Illustrator.":
      "Adobe's generative tools: images, fill, object replacement; built into Photoshop and Illustrator.",
    "Обучен на лицензионном контенте — спокойнее с коммерческим использованием; генеративная заливка в Photoshop.":
      "Trained on licensed content — safer for commercial use; generative fill in Photoshop.",
    "Аккаунт — общий Adobe ID; если уже работаете в Photoshop, часть возможностей уже у вас есть.":
      "The account is a shared Adobe ID; if you already use Photoshop, you have some of this already.",
    "Генеративная заливка сильнее самой генерации с нуля.":
      "Generative fill is stronger than generating from scratch.",
    "Локальный узловой интерфейс для Stable Diffusion и Flux: генерация изображений и видео на своём компьютере.":
      "A local node-based interface for Stable Diffusion and Flux: generate images and video on your own computer.",
    "Бесплатно и без лимитов, полный контроль над процессом, любые модели и дополнения. Нужна нормальная видеокарта.":
      "Free and unlimited, full control over the process, any models and extensions. Needs a decent GPU.",
    "Регистрация не нужна — ставится локально, аккаунта нет вообще.":
      "No sign-up — it runs locally, there is no account at all.",
    "Модели весят десятки гигабайт: качайте заранее и складывайте в одну папку.":
      "Models weigh tens of gigabytes: download in advance and keep in one folder.",
    "Готовые workflow сообщества экономят недели изучения.":
      "Ready community workflows save weeks of learning.",
    "Киноинструмент Google на моделях Veo: генерация видеосцен по описанию и кадрам, сборка сцен в историю.":
      "Google's film tool on Veo models: generates video scenes from descriptions and frames, assembles them into a story.",
    "Качество и звук моделей Veo, работа сценами и кадрами, управление камерой.":
      "Veo model quality and sound, scene and shot workflow, camera control.",
    "Вход Google-аккаунтом; объём генераций зависит от уровня подписки Google AI — уточните лимиты до оплаты.":
      "Sign in with Google; generation volume depends on your Google AI plan level — check the limits before paying.",
    "Работайте короткими сценами и склеивайте: так предсказуемее, чем один длинный промпт.":
      "Work in short scenes and stitch them: more predictable than one long prompt.",
    "Первый кадр-референс сильно повышает попадание в задумку.":
      "A first reference frame greatly improves hitting your intent.",
    "Генератор видео OpenAI: из текста или картинки, с ремиксом и продолжением сцен.":
      "OpenAI's video generator: from text or an image, with remix and scene extension.",
    "Связность сцены и физика движения, ремиксы чужих работ, лента с примерами.":
      "Scene consistency and motion physics, remixes of others' works, a feed of examples.",
    "Аккаунт общий с ChatGPT.": "The account is shared with ChatGPT.",
    "Оживление своей картинки обычно даёт более управляемый результат, чем генерация с нуля.":
      "Animating your own image usually gives a more controllable result than generating from scratch.",
    "Генератор видео: оживление статичных изображений, липсинк, длинные клипы.":
      "A video generator: animating still images, lip sync, long clips.",
    "Хорошо двигает объекты в кадре из одной картинки, есть синхронизация губ под озвучку.":
      "Moves objects in frame well from a single image; has lip sync for voiceover.",
    "Связка «картинка из Midjourney → движение в Kling» — рабочая схема для роликов.":
      "The combo “image from Midjourney → motion in Kling” is a proven workflow for clips.",
    "Ставьте начальный и конечный кадр, чтобы задать движение.":
      "Set the start and end frames to define the motion.",
    "Видеоредактор с ИИ: генерация, удаление объектов, замена фона, управление движением кистью.":
      "An AI video editor: generation, object removal, background replacement, motion brush control.",
    "Это ещё и постпродакшн, а не только генерация: чистка кадра, ротоскоп, апскейл.":
      "It's also post-production, not just generation: frame cleanup, rotoscoping, upscaling.",
    "Motion brush задаёт, что именно двигается в кадре — точнее, чем описание словами.":
      "The motion brush defines what exactly moves in the frame — more precise than words.",
    "Видео с говорящим аватаром: обучающие ролики без съёмки, перевод и липсинк на другие языки.":
      "Talking-avatar video: training videos without filming, translation and lip sync to other languages.",
    "Аватар по вашему короткому видео, дубляж с сохранением голоса, шаблоны под обучение.":
      "An avatar from your short video, dubbing that keeps your voice, training templates.",
    "Для своего аватара нужно записать образец видео и подтвердить согласие.":
      "A custom avatar requires recording a sample video and giving consent.",
    "Удобно делать одну и ту же лекцию на нескольких языках.":
      "Handy for producing the same lecture in several languages.",
    "Синтез речи и клонирование голоса, дубляж видео, звуковые эффекты.":
      "Speech synthesis and voice cloning, video dubbing, sound effects.",
    "Очень естественная русская речь, клон своего голоса, тонкая настройка подачи.":
      "Very natural Russian speech, clone of your own voice, fine delivery control.",
    "Сохраняйте в заметках идентификатор удачного голоса и настройки стабильности — иначе не повторите звучание.":
      "Save the winning voice ID and stability settings in the notes — otherwise you won't reproduce the sound.",
    "Длинный текст читайте кусками: меньше срывов интонации.":
      "Read long text in chunks: fewer intonation glitches.",
    "Есть API — ключ храните в сейфе этой базы.":
      "It has an API — keep the key in this database's vault.",
    "Генерация музыки и песен с вокалом по описанию или своему тексту.":
      "Generates music and songs with vocals from a description or your own lyrics.",
    "Полный трек с вокалом за пару минут, много стилей, продление и переработка трека.":
      "A full vocal track in a couple of minutes, many styles, track extension and rework.",
    "Свой текст вставляйте в режиме Custom, иначе модель напишет его сама.":
      "Paste your own lyrics in Custom mode, otherwise the model writes them itself.",
    "Стиль задавайте жанром и инструментами, а не названиями групп.":
      "Define the style by genre and instruments, not by band names.",
    "Основной инструмент интерфейсного дизайна: макеты, компоненты, прототипы, совместная работа.":
      "The core interface design tool: layouts, components, prototypes, collaboration.",
    "Стандарт индустрии, богатая экосистема плагинов (в том числе к ИИ-сервисам), удобная передача в разработку.":
      "The industry standard, a rich plugin ecosystem (including AI services), smooth handoff to development.",
    "Плагины связывают Figma с генераторами картинок и текста — ищите по названию нужного сервиса.":
      "Plugins connect Figma to image and text generators — search by the service you need.",
    "Аккаунт удобно завести на тот же email, что и остальные рабочие сервисы.":
      "Convenient to register with the same email as your other work services.",
    "Быстрый визуал по шаблонам: посты, презентации, обложки, видео; ИИ-инструменты Magic Studio.":
      "Quick visuals from templates: posts, presentations, covers, videos; Magic Studio AI tools.",
    "Результат без навыков дизайна: огромная база шаблонов, ИИ-заливка и удаление фона, единый бренд-кит.":
      "Results without design skills: a huge template library, AI fill and background removal, one brand kit.",
    "Заведите бренд-кит с цветами и шрифтами — все материалы станут единообразными.":
      "Set up a brand kit with colors and fonts — all materials become consistent.",
    "Подходит, когда нужно быстро и прилично, а не идеально.":
      "Fits when you need fast and decent rather than perfect.",
    "Презентации, документы и лендинги из текста: даёте конспект — получаете готовые слайды.":
      "Presentations, documents and landing pages from text: give an outline — get finished slides.",
    "От промпта или конспекта до презентабельного дека за минуты, аккуратные темы, экспорт в PDF и PowerPoint.":
      "From a prompt or outline to a presentable deck in minutes, clean themes, PDF and PowerPoint export.",
    "Залейте конспект урока — получите презентацию для повторения материала.":
      "Upload a lesson outline — get a presentation for reviewing the material.",
    "Правьте текст прямо на слайдах: оформление подстроится само.":
      "Edit text right on the slides: the layout adapts automatically.",
    "Визуальный конструктор автоматизаций и ИИ-агентов: связывает сервисы, обрабатывает данные, ходит в LLM по API.":
      "A visual builder for automations and AI agents: connects services, processes data, calls LLMs via API.",
    "Сотни интеграций, ветвления и код внутри нод, можно поднять у себя бесплатно.":
      "Hundreds of integrations, branching and code inside nodes, self-hosting is free.",
    "API-ключи вносите в Credentials n8n, а не в текст нод — иначе они попадут в экспорт сценария.":
      "Put API keys into n8n Credentials, not into node text — otherwise they leak into workflow exports.",
    "Начните с готового шаблона из библиотеки и переделайте под себя.":
      "Start from a ready template in the library and adapt it.",
    "Облачные сценарии-автоматизации без кода: связки между сервисами по расписанию и событиям.":
      "Cloud-based no-code automations: service combos on schedules and triggers.",
    "Наглядный визуальный конструктор, много готовых модулей, ничего не нужно ставить.":
      "A clear visual builder, many ready modules, nothing to install.",
    "Считайте операции: тарифы упираются в их количество, а не в число сценариев.":
      "Count operations: plans are limited by their number, not by the number of scenarios.",
    "Тестируйте сценарий по шагам, прежде чем включать по расписанию.":
      "Test a scenario step by step before putting it on a schedule.",
    "Сервис, через который оплачиваются другие платформы.":
      "A service used to pay for other platforms.",

    /* OpenRouter */
    "Единый API-шлюз к сотням моделей разных вендоров: один ключ и один счёт вместо кучи аккаунтов.":
      "A single API gateway to hundreds of models from different vendors: one key and one balance instead of a pile of accounts.",
    "Один баланс и один ключ для OpenAI, Anthropic, Google, Meta и других; прозрачная оплата за токены, есть бесплатные модели; удобное сравнение моделей по цене и качеству.":
      "One balance and one key for OpenAI, Anthropic, Google, Meta and others; transparent per-token billing, free models available; easy side-by-side model comparison.",
    "Пополняйте баланс и платите по факту за токены — подписка на каждую модель не нужна.":
      "Top up the balance and pay per token as you go — no per-model subscriptions needed.",
    "API-ключ храните в сейфе этой базы, а не в коде проекта.":
      "Keep the API key in this database's vault, not in your project's code.",
    "Модели с пометкой «:free» ограничены по лимитам, но для тестов и черновиков их хватает.":
      "Models marked “:free” are rate-limited, but enough for tests and drafts.",

    /* MiMo (Xiaomi) */
    "Агентная платформа Xiaomi на моделях MiMo: чат, код и пошаговые задачи с вызовом инструментов.":
      "Xiaomi's agentic platform powered by MiMo models: chat, code and step-by-step tasks with tool use.",
    "Быстрые открытые модели линейки MiMo-V2, агентный режим, API и подписка на токены; сильное соотношение цены и качества.":
      "Fast open-weight MiMo-V2 model family, agentic mode, API and a token subscription; strong price-to-performance ratio.",
    "Один аккаунт Xiaomi открывает и чат, и API — ключ держите в сейфе этой базы.":
      "One Xiaomi account unlocks both the chat and the API — keep the key in this database's vault.",
    "Token Plan выгоден при регулярных агентных сценариях: оплата подпиской, а не по токенам.":
      "Token Plan pays off for regular agentic workloads: a flat subscription instead of per-token billing.",
    "Flash берите для рутины и быстрых ответов, Pro — для сложных задач.":
      "Pick Flash for routine quick answers, Pro for demanding tasks.",

    /* GLM (Z.ai) */
    "Чат и API на моделях GLM от Z.ai: сильный код, агентные задачи и рассуждения.":
      "Chat and API on Z.ai's GLM models: strong coding, agentic tasks and reasoning.",
    "Открытые веса моделей, низкие цены; Coding Plan подключается к Claude Code, Cline и другим инструментам вместо оплаты по токенам.":
      "Open model weights and low prices; the Coding Plan plugs into Claude Code, Cline and other tools instead of per-token billing.",
    "Если много кодите — берите Coding Plan (от $18/мес): квоты вместо токенов, лимиты на 5 часов и на неделю.":
      "If you code a lot, take the Coding Plan (from $18/mo): quotas instead of tokens, with 5-hour and weekly limits.",
    "Подписку и API-ключ удобнее вести отдельными записями, чтобы не смешивать оплату.":
      "Track the subscription and the API key as separate entries to keep billing clear.",
    "Аккаунт общий для чата z.ai и API — ключ храните в сейфе.":
      "One account for both the z.ai chat and the API — keep the key in the vault."
  });

  /* ═══ Теги и одиночные слова сида ═══ */
  addDict({
    "обучение": "learning",
    "курс": "course",
    "текст": "text",
    "анализ": "analysis",
    "код": "code",
    "агент": "agent",
    "терминал": "terminal",
    "картинки": "images",
    "голос": "voice",
    "google": "google",
    "большой контекст": "large context",
    "поиск": "search",
    "факты": "facts",
    "дешёвый api": "cheap api",
    "тренды": "trends",
    "конспекты": "notes",
    "прототип": "prototype",
    "иллюстрации": "illustrations",
    "вектор": "vector",
    "постеры": "posters",
    "типографика": "typography",
    "апскейл": "upscale",
    "игры": "games",
    "коммерческое": "commercial",
    "локально": "local",
    "липсинк": "lip sync",
    "оживление": "animation",
    "монтаж": "editing",
    "постпродакшн": "post-production",
    "дубляж": "dubbing",
    "озвучка": "voiceover",
    "вокал": "vocals",
    "музыка": "music",
    "макеты": "layouts",
    "презентации": "presentations",
    "соцсети": "social media",
    "шаблоны": "templates",
    "слайды": "slides",
    "автоматизация": "automation",
    "агенты": "agents",
    "сайт": "website"
  });

  /* ── Движок перевода DOM ────────────────────────────────────────── */
  const ATTRS = ["placeholder", "title", "aria-label", "alt"];
  const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };

  function tr(text) {
    if (!text) return null;
    const lead = text.match(/^\s*/)[0];
    const tail = text.match(/\s*$/)[0];
    const t = text.trim();
    if (!t) return null;
    let hit = Object.prototype.hasOwnProperty.call(D, t) ? D[t] : null;
    if (hit === null) {
      /* «🎓 Обучение», «Код:», «Активна.» — эмодзи/кавычки/знаки вокруг известного слова */
      const lead2 = (t.match(/^[^\p{L}\p{N}]+/u) || [""])[0];
      const tail2 = (t.match(/[^\p{L}\p{N}]+$/u) || [""])[0];
      const core = t.slice(lead2.length, t.length - tail2.length);
      if ((lead2 || tail2) && Object.prototype.hasOwnProperty.call(D, core)) {
        hit = lead2 + D[core] + tail2;
      }
    }
    if (hit === null) {
      for (let i = 0; i < P.length; i++) {
        if (P[i][0].test(t)) {
          const r = typeof P[i][1] === "function" ? t.replace(P[i][0], P[i][1]) : t.replace(P[i][0], P[i][1]);
          hit = r;
          break;
        }
      }
    }
    return hit === null ? null : lead + hit + tail;
  }

  function translateTree(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      const hit0 = tr(root.nodeValue);
      if (hit0 !== null && hit0 !== root.nodeValue) root.nodeValue = hit0;
      return;
    }
    const base = root.nodeType === 1 ? root : document.documentElement;
    if (SKIP_TAGS[base.tagName]) return;
    const walker = document.createTreeWalker(
      base,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: function (n) {
          if (n.nodeType === 1 && SKIP_TAGS[n.tagName]) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) {
        const hit = tr(node.nodeValue);
        if (hit !== null && hit !== node.nodeValue) node.nodeValue = hit;
      } else {
        ATTRS.forEach(function (a) {
          if (node.hasAttribute(a)) {
            const hit = tr(node.getAttribute(a));
            if (hit !== null && hit !== node.getAttribute(a)) node.setAttribute(a, hit);
          }
        });
      }
    }
    if (base.hasAttribute) {
      ATTRS.forEach(function (a) {
        if (base.hasAttribute(a)) {
          const hit = tr(base.getAttribute(a));
          if (hit !== null && hit !== base.getAttribute(a)) base.setAttribute(a, hit);
        }
      });
    }
  }

  /* Любой пакет мутаций → один полный проход после короткого дебаунса.
     setTimeout, а не requestAnimationFrame: rAF замирает в скрытой вкладке
     и перевод зависал бы до возврата пользователя. Полный проход безопасен:
     английский текст словарём не накрывается, повторных записей нет. */
  let queued = false;
  function scheduleTranslate() {
    if (queued) return;
    queued = true;
    window.setTimeout(function () {
      queued = false;
      try { translateTree(document.documentElement); } catch (e) { /* перевод не должен ломать приложение */ }
    }, 50);
  }

  function start() {
    try { translateTree(document.documentElement); } catch (e) {}
    mountSwitcher();
    const observer = new MutationObserver(function () { scheduleTranslate(); });
    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
