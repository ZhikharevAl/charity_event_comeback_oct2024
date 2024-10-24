// @ts-nocheck
import { createServer } from "http";
import express, {NextFunction, Request, Response} from 'express';
import bodyParser from "body-parser";
import cors from 'cors';
import log4js from "log4js";
import dotenv from "dotenv";
import loggerSetup from "./src/utils/configureLogger";
import {UserRepository} from "./src/data/User";
import {HelpRequestRepository} from "./src/data/HelpRequest";
import {AuthRepository} from "./src/data/Auth";

// envs
dotenv.config();

// express engine
const app = express();

// express app config
app.use(cors())
app.use(bodyParser.json())

// APP INIT
const requestRepository = new HelpRequestRepository();
const userRepository = new UserRepository(requestRepository);
const authRepository = new AuthRepository(userRepository.getUsers());

// AUTH
const authMiddleware = (req: Request<never>, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(403).json({ message: 'No token provided.' });
    }
    const userId = authRepository.verifyToken(token);
    if (!userId) {
        return res.status(403).json({ message: 'No token provided.' });
    }
    req.userId = userId;
    next();
};


app.post('/api/auth', (req: Request, res: Response) => {
    const { login, password } = req.body;

    // Find the user by username
    const userId = authRepository.getUserIdByLogin(login);
    const user = userId ? userRepository.getUserById(userId) : null
    if (!user) {
        return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Compare the provided password with the stored hashed password
    const passwordIsValid = authRepository.checkCredentials(login, password)
    if (!passwordIsValid) {
        return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Create a token (JWT)
    const token = authRepository.login(login, password);
    if (!token) {
        return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Send the token back to the client
    res.json({ auth: true, token });
})

app.use(authMiddleware);

// USER
app.get('/api/user/favourites', (req: Request<never>, res: Response) => {
    const userId= req.userId;
    const favourites = userRepository.getUserFavourites(userId);
    res.json(favourites);
})

app.post('/api/user/favourites', (req: Request<{requestId: string}>, res: Response) => {
    const { requestId } = req.body;
    if (!requestId) {
        res.status(400).send("No request id");
        return;
    }
    const userId= req.userId;
    try {
        userRepository.addRequestToFavourites(requestId, userId);
        res.send("Request is added to Favourites successfully.");
    } catch (err) {
        const logger = log4js.getLogger();
        logger.error(err);
        res.status(400).send("Failed to add request to favourites");
    }
})

app.delete('/api/user/favourites/:requestId', (req: Request, res: Response) => {
    const userId = req.userId;
    const { requestId } = req.params;
    if (!requestId) {
        res.status(400).send("No request id");
        return;
    }
    try {
        userRepository.removeRequestFromFavourites(requestId, userId);
        res.send("Request is removed form Favourites successfully.");
    } catch (err) {
        const logger = log4js.getLogger();
        logger.error(err);
        res.status(400).send("Failed to add request to favourites");
    }
})

app.use('/api/user', (req: Request, res: Response) => {
    const user= userRepository.getUserById(req.userId);
    res.json(user);
})

// HELP REQUESTS

app.post('/api/request/:id/contribution', (req: Request, res: Response) => {
    const {id} = req.params;
    if (!requestRepository.checkIsRequestExist(id)) {
        res.status(404).send("No request found");
        return;
    }
    res.send(`Contribution in Requests ${id} is done successfully.`);
})

app.get('/api/request/:id', (req: Request, res: Response) => {
    const {id} = req.params;
    if (!id) {
        res.status(400).send("No request id");
        return;
    }
    const request = requestRepository.getRequestDetails(id);
    if (!request) {
        res.status(404).send("No request found");
        return;
    }
    res.json(request);
})

app.get('/api/request', (req: Request, res: Response) => {
    const requests = requestRepository.getRequests();
    res.send(requests);
})

// web server
const port = process.env.PORT || 3030;
const server = createServer(app);

// configure of server
loggerSetup();

// start of application
server.listen(port, () => {
    const logger = log4js.getLogger();
    logger.info(`Server is listening on port ${port}`)
});