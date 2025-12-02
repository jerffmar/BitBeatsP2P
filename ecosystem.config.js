module.exports = {
	apps: [
		{
			name: "bitbeats-api",
			script: "dist/server.js",
			instances: "max",
			exec_mode: "cluster",
			env: {
				NODE_ENV: "production",
				PORT: "3000"
			}
		}
	]
};
