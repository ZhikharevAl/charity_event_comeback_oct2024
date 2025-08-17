// @ts-nocheck
import { createServer } from "http";
import express, { NextFunction, Request, Response } from 'express';
import bodyParser from "body-parser";
import cors from 'cors';
import log4js from "log4js";
import dotenv from "dotenv";
import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';
import loggerSetup from "./src/utils/configureLogger";
import { UserRepository } from "./src/data/User";
import { HelpRequestRepository } from "./src/data/HelpRequest";
import { AuthRepository } from "./src/data/Auth";
import client from 'prom-client';

// envs
dotenv.config();

// express engine
const app = express();

// express app config
app.use(cors())
app.use(bodyParser.json())

// === PROMETHEUS METRICS SETUP ===
const register = new client.Registry();

// Добавляем метки приложения
register.setDefaultLabels({
    app: 'help-request-api',
    version: process.env.APP_VERSION || '1.0.0'
});

client.collectDefaultMetrics({ register });

// HTTP метрики
const httpRequestCounter = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
});

const httpDurationHistogram = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.001, 0.01, 0.1, 0.3, 0.5, 0.7, 1, 1.5, 2, 5],
    registers: [register]
});

// Бизнес-метрики
const authAttempts = new client.Counter({
    name: 'auth_attempts_total',
    help: 'Total number of authentication attempts',
    labelNames: ['status'], // success, failed
    registers: [register]
});

const activeUsers = new client.Gauge({
    name: 'active_users_total',
    help: 'Current number of active users',
    registers: [register]
});

const helpRequestsCounter = new client.Counter({
    name: 'help_requests_total',
    help: 'Total number of help requests',
    labelNames: ['action'], // created, viewed, contributed
    registers: [register]
});

const favouritesCounter = new client.Counter({
    name: 'favourites_operations_total',
    help: 'Total number of favourites operations',
    labelNames: ['action'], // added, removed
    registers: [register]
});

// Метрики ошибок
const errorCounter = new client.Counter({
    name: 'application_errors_total',
    help: 'Total number of application errors',
    labelNames: ['type', 'endpoint'],
    registers: [register]
});

// APP INIT
const requestRepository = new HelpRequestRepository();
const userRepository = new UserRepository(requestRepository);
const authRepository = new AuthRepository(userRepository.getUsers());

// OpenAPI specification
const openApiDocumentation = YAML.load('./apispec2.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocumentation));

// Функция для нормализации путей (группировка параметризованных маршрутов)
const normalizeRoute = (path: string): string => {
    return path
        .replace(/\/\d+/g, '/:id')
        .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
        .replace(/\/[a-zA-Z0-9]+/g, '/:param');
};

// METRICS MIDDLEWARE
app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/metrics' || req.path === '/health') {
        return next();
    }

    const normalizedRoute = normalizeRoute(req.path);
    const startTime = Date.now();
    const end = httpDurationHistogram.startTimer({
        method: req.method,
        route: normalizedRoute
    });

    res.on('finish', () => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = res.statusCode.toString();

        httpRequestCounter.inc({
            method: req.method,
            route: normalizedRoute,
            status_code: statusCode
        });

        end({ status_code: statusCode });

        // Логирование медленных запросов
        if (duration > 1) {
            const logger = log4js.getLogger();
            logger.warn(`Slow request: ${req.method} ${req.path} took ${duration}s`);
        }
    });

    next();
});

// ERROR MIDDLEWARE с метриками
let ERROR_REQUEST_NUMBER = 1;
const errorMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Пропускаем health и metrics эндпоинты
    if (req.path === '/health' || req.path === '/metrics') {
        return next();
    }

    const logger = log4js.getLogger();
    logger.info("ERROR_MIDDLEWARE request log: ", req?.originalUrl, req?.body);

    if (ERROR_REQUEST_NUMBER % 5 === 0) {
        logger.warn(`Planned server Error ` + ERROR_REQUEST_NUMBER);

        // Увеличиваем счетчик ошибок
        errorCounter.inc({
            type: 'planned_error',
            endpoint: normalizeRoute(req.path)
        });

        ERROR_REQUEST_NUMBER++;
        return res.status(500).send('Planned Server Error')
    } else {
        ERROR_REQUEST_NUMBER++;
        next();
    }
}

app.use(errorMiddleware);

// AUTH с метриками
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Пропускаем health и metrics эндпоинты
    if (req.path === '/health' || req.path === '/metrics') {
        return next();
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        const logger = log4js.getLogger();
        logger.error("No token provided ", req?.originalUrl);

        authAttempts.inc({ status: 'failed' });
        errorCounter.inc({
            type: 'auth_error',
            endpoint: normalizeRoute(req.path)
        });

        return res.status(403).json({ message: 'No token provided.' });
    }

    const userId = authRepository.verifyToken(token);
    if (!userId) {
        const logger = log4js.getLogger();
        logger.error("Token is not valid ", req?.originalUrl);

        authAttempts.inc({ status: 'failed' });
        errorCounter.inc({
            type: 'auth_error',
            endpoint: normalizeRoute(req.path)
        });

        return res.status(403).json({ message: 'Invalid token.' });
    }

    req.userId = userId;
    next();
};

// HEALTH CHECK ENDPOINT (ПЕРЕД middleware'ами)
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.APP_VERSION || '1.0.0'
    });
});

// METRICS ENDPOINT
app.get('/metrics', async (req: Request, res: Response) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        const logger = log4js.getLogger();
        logger.error('Error serving metrics:', err);
        res.status(500).end('Error serving metrics');
    }
});

// HEALTH CHECK ENDPOINT
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// AUTH с метриками
app.post('/api/auth', (req: Request, res: Response) => {
    const { login, password } = req.body;
    const logger = log4js.getLogger();

    // Find the user by username
    const userId = authRepository.getUserIdByLogin(login);
    const user = userId ? userRepository.getUserById(userId) : null

    if (!user) {
        logger.error("User not found by log/pass ", req?.body);
        authAttempts.inc({ status: 'failed' });
        return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Compare the provided password with the stored hashed password
    const passwordIsValid = authRepository.checkCredentials(login, password)
    if (!passwordIsValid) {
        logger.error("Invalid password ", req?.body);
        authAttempts.inc({ status: 'failed' });
        return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Create a token (JWT)
    const token = authRepository.login(login, password);
    if (!token) {
        logger.error("Empty token on token creation", req?.body);
        authAttempts.inc({ status: 'failed' });
        return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Send the token back to the client
    logger.info("Successful authentication ", req?.body);
    authAttempts.inc({ status: 'success' });
    activeUsers.inc(); // Увеличиваем количество активных пользователей

    res.json({ auth: true, token });
});

app.use(authMiddleware);

// USER ENDPOINTS с метриками
app.get('/api/user/favourites', (req: Request, res: Response) => {
    const logger = log4js.getLogger();
    const userId = req.userId;
    const favourites = userRepository.getUserFavourites(userId);
    logger.info("Successful favourites ", userId);
    res.json(favourites);
});

app.post('/api/user/favourites', (req: Request<{ requestId: string }>, res: Response) => {
    const logger = log4js.getLogger();
    const { requestId } = req.body;

    if (!requestId) {
        logger.error("No requestId provided", req?.body);
        errorCounter.inc({
            type: 'validation_error',
            endpoint: '/api/user/favourites'
        });
        res.status(400).send("No request id");
        return;
    }

    const userId = req.userId;
    try {
        userRepository.addRequestToFavourites(requestId, userId);
        logger.info("Successful add favourites ", userId, requestId);
        favouritesCounter.inc({ action: 'added' });
        res.send("Request is added to Favourites successfully.");
    } catch (err) {
        logger.error('Failed to add request to favourites', userId, requestId, err);
        errorCounter.inc({
            type: 'database_error',
            endpoint: '/api/user/favourites'
        });
        res.status(400).send("Failed to add request to favourites");
    }
});

app.delete('/api/user/favourites/:requestId', (req: Request, res: Response) => {
    const logger = log4js.getLogger();
    const userId = req.userId;
    const { requestId } = req.params;

    if (!requestId) {
        logger.error("Delete favorite failed. No requestId provided", userId, req?.body);
        errorCounter.inc({
            type: 'validation_error',
            endpoint: '/api/user/favourites/:requestId'
        });
        res.status(400).send("No request id");
        return;
    }

    try {
        userRepository.removeRequestFromFavourites(requestId, userId);
        logger.info("Successful remove favourites ", userId, requestId);
        favouritesCounter.inc({ action: 'removed' });
        res.send("Request is removed form Favourites successfully.");
    } catch (err) {
        logger.error('Failed to delete request to favourites', userId, requestId, err);
        errorCounter.inc({
            type: 'database_error',
            endpoint: '/api/user/favourites/:requestId'
        });
        res.status(400).send("Failed to remove request from favourites");
    }
});

app.use('/api/user', (req: Request, res: Response) => {
    const logger = log4js.getLogger();
    const user = userRepository.getUserById(req.userId);
    logger.info("Successful user", user, req.userId);
    res.json(user);
});

// HELP REQUESTS с метриками
app.post('/api/request/:id/contribution', (req: Request, res: Response) => {
    const logger = log4js.getLogger();
    const { id } = req.params;

    if (!requestRepository.checkIsRequestExist(id)) {
        logger.error("Add contribution. No request found", id, req?.body);
        errorCounter.inc({
            type: 'not_found_error',
            endpoint: '/api/request/:id/contribution'
        });
        res.status(404).send("No request found");
        return;
    }

    logger.info("Successful contribution", id, req?.body);
    helpRequestsCounter.inc({ action: 'contributed' });
    res.send(`Contribution in Requests ${id} is done successfully.`);
});

app.get('/api/request/:id', (req: Request, res: Response) => {
    const logger = log4js.getLogger();
    const { id } = req.params;

    if (!id) {
        logger.error("Get Request. No request id provided", req?.body);
        errorCounter.inc({
            type: 'validation_error',
            endpoint: '/api/request/:id'
        });
        res.status(400).send("No request id");
        return;
    }

    const request = requestRepository.getRequestDetails(id);
    if (!request) {
        logger.info("Get Request. Not found", id);
        res.status(404).send("No request found");
        return;
    }

    helpRequestsCounter.inc({ action: 'viewed' });
    res.json(request);
});

app.get('/api/request', (req: Request, res: Response) => {
    const logger = log4js.getLogger();
    const requests = requestRepository.getRequests();
    logger.info("Successful requests ", req?.body);
    res.send(requests);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    const logger = log4js.getLogger();
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

// web server
const port = process.env.PORT || 4040;
const server = createServer(app);

// configure of server
loggerSetup();

// start of application
server.listen(port, () => {
    const logger = log4js.getLogger();
    logger.info(`Server is listening on port ${port}`);
    logger.info(`Metrics available at http://localhost:${port}/metrics`);
    logger.info(`Health check available at http://localhost:${port}/health`);
});
