# charity_event_oct2024
Assests for charity event in October 2024

## Как запустить проект
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