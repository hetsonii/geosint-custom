module.exports = {
    apps: [
        {
            name: "geosint",
            script: "server.js",
        },
        {
            name: "process",
            script: "process.js",
            args: "continuous"
        },
        {
            name: "pull_fast",
            script: "pull_challs_fast.js",
            args: "continuous"
        }
    ]
}