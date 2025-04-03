export class UI {
    container: HTMLElement;
    menuElement: HTMLDivElement;
    inventoryElement: HTMLDivElement;
    hotbarElement: HTMLDivElement;

    constructor(container: HTMLElement) {
        this.container = container;
        this.createMenu();
        this.createInventory();
        this.createHotbar();
    }

    createMenu() {
        this.menuElement = document.createElement('div');
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
        this.inventoryElement = document.createElement('div');
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
        this.hotbarElement = document.createElement('div');
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

    toggleMenu(show: boolean) {
        this.menuElement.style.display = show ? 'block' : 'none';
    }

    toggleInventory(show: boolean) {
        this.inventoryElement.style.display = show ? 'grid' : 'none';
    }

    resize(width: number, height: number) {
        // Update UI positions if needed
    }
}