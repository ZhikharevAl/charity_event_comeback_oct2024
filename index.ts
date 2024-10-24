import { createServer } from "http";
import express, {Request, Response} from 'express';
import path from "node:path";
import bodyParser from "body-parser";
import cors from 'cors';
import log4js from "log4js";
import dotenv from "dotenv";
import loggerSetup from "./src/utils/configureLogger";

// envs
dotenv.config();

// express engine
const app = express();

// express app config
app.use(cors())
app.use(bodyParser.json())

app.use('/api/hui', (req: Request, res: Response) => {
    res.send("HUI");
} )

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