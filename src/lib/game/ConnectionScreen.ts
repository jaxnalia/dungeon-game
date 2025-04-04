import * as THREE from 'three';

export class ConnectionScreen {
    private container: HTMLElement;
    private onConnect: (ip: string, port: number) => void;
    private connectionDiv: HTMLElement;

    constructor(container: HTMLElement, onConnect: (ip: string, port: number) => void) {
        this.container = container;
        this.onConnect = onConnect;
        this.connectionDiv = document.createElement('div');
        this.createUI();
    }

    private createUI() {
        this.connectionDiv.style.position = 'absolute';
        this.connectionDiv.style.top = '50%';
        this.connectionDiv.style.left = '50%';
        this.connectionDiv.style.transform = 'translate(-50%, -50%)';
        this.connectionDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.connectionDiv.style.padding = '20px';
        this.connectionDiv.style.borderRadius = '10px';
        this.connectionDiv.style.color = 'white';
        this.connectionDiv.style.textAlign = 'center';
        this.connectionDiv.style.zIndex = '1000';

        const title = document.createElement('h1');
        title.textContent = 'Connect to Server';
        title.style.marginBottom = '20px';
        this.connectionDiv.appendChild(title);

        const infoText = document.createElement('p');
        infoText.textContent = 'For local development, use "localhost". For remote servers, use the server domain or IP address.';
        infoText.style.marginBottom = '15px';
        infoText.style.fontSize = '14px';
        this.connectionDiv.appendChild(infoText);

        // Add a warning about mixed content blocking
        const warningText = document.createElement('p');
        warningText.textContent = 'Note: When connecting from HTTPS to a non-SSL server, your browser may block the connection. Try using the IP address directly.';
        warningText.style.marginBottom = '15px';
        warningText.style.fontSize = '14px';
        warningText.style.color = '#FFA500';
        this.connectionDiv.appendChild(warningText);

        const ipLabel = document.createElement('label');
        ipLabel.textContent = 'Server IP:';
        ipLabel.style.display = 'block';
        ipLabel.style.marginBottom = '5px';
        this.connectionDiv.appendChild(ipLabel);

        const ipInput = document.createElement('input');
        ipInput.type = 'text';
        ipInput.value = 'localhost';
        ipInput.style.width = '200px';
        ipInput.style.padding = '5px';
        ipInput.style.marginBottom = '15px';
        this.connectionDiv.appendChild(ipInput);

        const portLabel = document.createElement('label');
        portLabel.textContent = 'Port:';
        portLabel.style.display = 'block';
        portLabel.style.marginBottom = '5px';
        this.connectionDiv.appendChild(portLabel);

        const portInput = document.createElement('input');
        portInput.type = 'text';
        portInput.value = '8080';
        portInput.style.width = '200px';
        portInput.style.padding = '5px';
        portInput.style.marginBottom = '20px';
        this.connectionDiv.appendChild(portInput);

        const protocolInfo = document.createElement('p');
        protocolInfo.textContent = `Using ws:// connection (non-secure) - Multiple connection strategies will be attempted`;
        protocolInfo.style.marginBottom = '15px';
        protocolInfo.style.fontSize = '14px';
        protocolInfo.style.color = '#FFA500';
        this.connectionDiv.appendChild(protocolInfo);

        const connectButton = document.createElement('button');
        connectButton.textContent = 'Connect';
        connectButton.style.padding = '10px 20px';
        connectButton.style.backgroundColor = '#4CAF50';
        connectButton.style.color = 'white';
        connectButton.style.border = 'none';
        connectButton.style.borderRadius = '5px';
        connectButton.style.cursor = 'pointer';
        connectButton.onclick = () => {
            const ip = ipInput.value.trim();
            const port = parseInt(portInput.value.trim());
            
            if (ip && !isNaN(port)) {
                this.onConnect(ip, port);
            } else {
                alert('Please enter valid IP and port');
            }
        };
        this.connectionDiv.appendChild(connectButton);

        this.container.appendChild(this.connectionDiv);
    }

    public hide() {
        console.log('ConnectionScreen: Hiding connection screen');
        if (this.connectionDiv && this.connectionDiv.parentNode) {
            this.connectionDiv.parentNode.removeChild(this.connectionDiv);
        }
    }
} 