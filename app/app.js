const express = require('express');
const bodyParser = require('body-parser');
const logger = require('./utils/logger');
const paths = require('./config/paths');

const app = express();

// Middleware
app.use((req, res, next) => {
    if (req.path && req.path.startsWith('/img/')) {
        logger.verbose(`Image requested: ${req.path}`);
    }
    next();
});

app.use(express.static(paths.PUBLIC_DIR));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', paths.VIEWS_DIR);

module.exports = app;