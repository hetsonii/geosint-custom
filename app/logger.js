const LOG_LEVEL = process.env.LOG_LEVEL || 'verbose'; // 'verbose' or 'summary'

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

function log(level, color, message) {
    const timestamp = new Date().toISOString();
    console.log(`${color}[${timestamp}] [${level}]${colors.reset} ${message}`);
}

const logger = {
    info: (msg) => log('INFO', colors.blue, msg),
    success: (msg) => log('SUCCESS', colors.green, msg),
    warn: (msg) => log('WARN', colors.yellow, msg),
    error: (msg) => log('ERROR', colors.red, msg),
    
    verbose: (msg) => {
        if (LOG_LEVEL === 'verbose') {
            log('VERBOSE', colors.cyan, msg);
        }
    },
    
    isVerbose: () => LOG_LEVEL === 'verbose',
};

module.exports = logger;