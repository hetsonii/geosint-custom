module.exports = {
    apps: [
        {
            name: "geosint",
            script: "server.js",
        },
        {
            name: "process",
            script: "workers/process.worker.js",
            args: "continuous"
        },
        {
            name: "pull_fast",
            script: "workers/pull.worker.js",
            args: "continuous"
        }
    ]
};