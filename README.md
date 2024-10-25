# charity_event_oct2024
Репозиторий для Благотворительного хакатона джунов - Октябрь 2024

Тема хакатона - Помощь пожилым людям

## Как запустить проект (backend)
### Перед началом
- переименовать файл `.env-example` в `env`
### Локальный дев-сервер
- `npm install`
- `npm run build`
- `npm run dev`
### Docker
- `npm install`
- `npm run build`
- `docker build -t charity_back .`
- `docker run -p 4040:4040 charity_back`

## Требования
- общетехнические - `./requirements/Common.md`
- пользовательские - `./requirements/[RU] User Scenarios.md`

## OpenAPI спецификация
- файл: `./apispec.yaml`
- эндпоинт: `/api-docs`