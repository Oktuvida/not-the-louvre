[Unit]
Description={{SERVICE_NAME}}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User={{SERVICE_USER}}
Group={{SERVICE_USER}}
WorkingDirectory={{WORKING_DIRECTORY}}
EnvironmentFile={{ENV_FILE}}
ExecStart={{NODE_PATH}} build
Restart=always
RestartSec=5
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target