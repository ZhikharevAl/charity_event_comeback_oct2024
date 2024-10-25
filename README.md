# Требования и ассеты к "Благотворительному React-ивенту джунов", 2024

**Тема хакатона - Помощь пожилым людям**

## Дизайн

## Требования
- общетехнические - `./requirements/Common.md`
- пользовательские - `./requirements/[RU] User Scenarios.md`

## Как запустить проект (backend)
### Перед началом
- переименовать файл `.env-example` в `env`
### Локальный дев-сервер (основной способ запуска)
- `npm install`
- `npm run build`
- `npm run dev`
### Docker (опционально, если вдруг захотите)
- `npm install`
- `npm run build`
- `docker build -t charity_back .`
- `docker run -p 4040:4040 charity_back`

## OpenAPI спецификация
- файл: `./apispec.yaml`
- эндпоинт: `/api-docs`
