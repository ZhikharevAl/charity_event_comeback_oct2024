import { createServer } from "http";
import express, {Request, Response} from 'express';
import path from "node:path";
import bodyParser from "body-parser";
import cors from 'cors';
import log4js from "log4js";
import dotenv from "dotenv";
import loggerSetup from "./src/utils/configureLogger";
import {UserRepository} from "./src/data/User";
import {HelpRequestRepository} from "./src/data/HelpRequest";

// envs
dotenv.config();

// express engine
const app = express();

// express app config
app.use(cors())
app.use(bodyParser.json())

app.use('/api/hui', (req: Request, res: Response) => {
    res.send("HUI");
})

// APP INIT
const requestRepository = new HelpRequestRepository();
const userRepository = new UserRepository(requestRepository);

// USER
app.get('/api/user/favourites', (req: Request, res: Response) => {
    const userId= userRepository.getTestUser().id; // todo: change with userId from JWT
    const favourites = userRepository.getUserFavourites(userId);
    res.json(favourites);
})

app.post('/api/user/favourites', (req: Request<{requestId: string}>, res: Response) => {
    const { requestId } = req.body;
    if (!requestId) {
        res.status(400).send("No request id");
        return;
    }
    const userId= userRepository.getTestUser().id; // todo: change with userId from JWT
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
    const { requestId } = req.params;
    if (!requestId) {
        res.status(400).send("No request id");
        return;
    }
    const userId= userRepository.getTestUser().id; // todo: change with userId from JWT
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
    const user= userRepository.getTestUser();
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

// static server
app.use(express.static(path.join(__dirname, 'public')));

/* Catch-all route for redirecting undefined routes
* All not-api routes should be redirected to index.html
* */
app.get(/^\/(?!api).*/, (req, res) => {
    console.log("INTERCEPTOR: ", req.method, req.url);
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// web server
const port = process.env.PORT || 3030;
// todo: used in servicesConfig | move in separate service
const server = createServer(app);

// configure of server
loggerSetup();

// start of application
server.listen(port, () => {
    const logger = log4js.getLogger();
    logger.info(`Server is listening on port ${port}`)
});