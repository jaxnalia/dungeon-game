export class UI {
    container: HTMLElement;
    menuElement: HTMLDivElement = document.createElement('div');
    inventoryElement: HTMLDivElement = document.createElement('div');
    hotbarElement: HTMLDivElement = document.createElement('div');
    notificationElement: HTMLDivElement = document.createElement('div');
    notificationTimeout: number | null = null;
    private messageContainer: HTMLElement;

    constructor(container: HTMLElement) {
        this.container = container;
        this.createMenu();
        this.createInventory();
        this.createHotbar();
        this.createNotification();
        this.messageContainer = document.createElement('div');
        this.messageContainer.style.position = 'absolute';
        this.messageContainer.style.top = '10px';
        this.messageContainer.style.left = '10px';
        this.messageContainer.style.color = 'white';
        this.messageContainer.style.fontFamily = 'Arial, sans-serif';
        this.messageContainer.style.zIndex = '1000';
        this.container.appendChild(this.messageContainer);
    }

    createMenu() {
        this.menuElement.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            padding: 20px;
            border-radius: 5px;
            color: white;
            display: none;
        `;
        this.menuElement.innerHTML = `
            <h2>Menu</h2>
            <button onclick="window.location.reload()">Restart Game</button>
            <p>Press ESC to close</p>
        `;
        this.container.appendChild(this.menuElement);
    }

    createInventory() {
        this.inventoryElement.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            padding: 20px;
            border-radius: 5px;
            color: white;
            display: none;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
        `;
        
        // Create 20 inventory slots
        for (let i = 0; i < 20; i++) {
            const slot = document.createElement('div');
            slot.style.cssText = `
                width: 50px;
                height: 50px;
                border: 2px solid #666;
                border-radius: 5px;
            `;
            this.inventoryElement.appendChild(slot);
        }
        
        this.container.appendChild(this.inventoryElement);
    }

    createHotbar() {
        this.hotbarElement.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            padding: 10px;
            border-radius: 5px;
            display: flex;
            gap: 5px;
        `;
        
        // Create 10 hotbar slots
        for (let i = 0; i < 10; i++) {
            const slot = document.createElement('div');
            slot.style.cssText = `
                width: 40px;
                height: 40px;
                border: 2px solid #666;
                border-radius: 5px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #666;
            `;
            slot.textContent = (i + 1) % 10 + '';
            this.hotbarElement.appendChild(slot);
        }

        // Add inventory button
        const invButton = document.createElement('button');
        invButton.style.cssText = `
            margin-left: 10px;
            padding: 0 10px;
            background: #444;
            border: none;
            border-radius: 5px;
            color: white;
            cursor: pointer;
        `;
        invButton.textContent = 'B';
        invButton.onclick = () => {
            this.toggleInventory(!this.inventoryElement.style.display || this.inventoryElement.style.display === 'none');
        };
        this.hotbarElement.appendChild(invButton);
        
        this.container.appendChild(this.hotbarElement);
    }

    createNotification() {
        this.notificationElement.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            padding: 10px 20px;
            border-radius: 5px;
            color: white;
            font-size: 16px;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            text-align: center;
            white-space: nowrap;
        `;
        this.container.appendChild(this.notificationElement);
    }

    showNotification(message: string, duration: number = 3000) {
        // Clear any existing timeout
        if (this.notificationTimeout !== null) {
            clearTimeout(this.notificationTimeout);
        }

        // Update and show the notification
        this.notificationElement.textContent = message;
        this.notificationElement.style.opacity = '1';

        // Hide the notification after duration
        this.notificationTimeout = window.setTimeout(() => {
            this.notificationElement.style.opacity = '0';
            this.notificationTimeout = null;
        }, duration);
    }

    toggleMenu(show: boolean) {
        this.menuElement.style.display = show ? 'block' : 'none';
    }

    toggleInventory(show: boolean) {
        this.inventoryElement.style.display = show ? 'grid' : 'none';
    }

    resize(width: number, height: number) {
        // Update UI positions if needed
    }

    public showMessage(message: string, duration: number = 3000) {
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        messageElement.style.padding = '10px';
        messageElement.style.marginBottom = '5px';
        messageElement.style.borderRadius = '5px';
        messageElement.style.opacity = '0';
        messageElement.style.transition = 'opacity 0.3s';

        this.messageContainer.appendChild(messageElement);

        // Fade in
        setTimeout(() => {
            messageElement.style.opacity = '1';
        }, 10);

        // Fade out and remove
        setTimeout(() => {
            messageElement.style.opacity = '0';
            setTimeout(() => {
                this.messageContainer.removeChild(messageElement);
            }, 300);
        }, duration);
    }

    public cleanup() {
        this.container.removeChild(this.messageContainer);
    }
}