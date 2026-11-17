# Friendly Menu

Электронное меню Friendly Bar. Сайт статичный и хостится на **GitHub Pages**, сервер не нужен.

- Гостевое меню: `https://hmeeti.github.io/FriendlyBarMenu1/`
- Админка: `https://hmeeti.github.io/FriendlyBarMenu1/admin.html`

## Как это работает

```
админка (браузер) ──токен──▶ GitHub: коммит в menu.json / image/admin/
                                     │
                                     ▼
                    GitHub Actions: сборка (сжатие фото, переводы, минификация)
                                     │
                                     ▼
                    GitHub Pages ──▶ гости видят изменения через 1–2 минуты
```

- `menu.json` — единственный источник меню (категории, блюда, цены, фото, наличие).
  Скрытые в админке блюда остаются в файле с `"hidden": true` и до гостей не доходят.
- Журнал в админке — это история коммитов `menu.json`.

## Вход в админку

Нужен токен GitHub (fine-grained personal access token):

1. https://github.com/settings/personal-access-tokens/new
2. Repository access → Only select repositories → `Hmeeti/FriendlyBarMenu1`
3. Permissions → Repository: **Contents — Read and write**, **Actions — Read-only**
4. Generate token, затем вставить его в админку («Запомнить на этом устройстве»).

Каждому администратору лучше выдать свой токен: тогда в журнале видно, кто что менял, и токен можно отозвать по отдельности.

## Настройка GitHub Pages (один раз)

Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Структура

```
index.html, admin.html, sw.js, menu.json, manifest, robots, sitemap   сайт
css/  js/            стили и скрипты (js/config.js — репозиторий для админки)
fonts/  icons/       шрифты и иконки
image/               фото блюд; image/admin — загруженные из админки; image/opt — WebP
scripts/             сборка сайта, сжатие фото, иконки, переводы
.github/workflows/   публикация на GitHub Pages
```

## Локально

```bash
npm install
npm run dev        # сборка без сжатия фото + http://localhost:5500
npm run build      # полная сборка в _site/
npm run images     # сжать новые фото в image/opt
```
