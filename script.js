import { generateKeys, encryptMessage, decryptMessage, hashPassword } from './crypto.js';

class Messenger {
    constructor() {
        this.user = null;
        this.ws = null;
        this.isPageLoaded = false;
        this.init();
    }

    async init() {
        window.addEventListener('load', async () => {
            this.isPageLoaded = true;
            this.cacheElements();
            this.setupEvents();
            await this.checkAuth();
            this.setupServiceWorker();
        });
    }

    cacheElements() {
        this.elements = {
            authModal: document.querySelector('.auth-modal'),
            loginForm: document.getElementById('login-form'),
            registerForm: document.getElementById('register-form'),
            messageInput: document.getElementById('message-input'),
            messagesContainer: document.getElementById('messages-container'),
            sendBtn: document.getElementById('send-btn'),
            userId: document.getElementById('user-id'),
            onlineCount: document.getElementById('online-count'),
            // News elements
            newsContainer: document.getElementById('news-container'),
            adminNewsForm: document.getElementById('admin-news-form'),
            newsText: document.getElementById('news-text'),
            addNewsBtn: document.getElementById('add-news-btn'),
            openNewsFormBtn: document.getElementById('open-news-form-btn'),
            closeNewsFormBtn: document.getElementById('close-news-form-btn'),
            // Emoji elements
            emojiButton: document.getElementById('emoji-button'),
            emojiPicker: document.getElementById('emoji-picker'),
            // Attachment elements
            attachmentButton: document.getElementById('attachment-button')
        };
    }

    setupEvents() {
        // Auth forms
        this.elements.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.elements.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`${tabName}-form`).classList.add('active');
            });
        });
        // Messaging
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        // News events
        if (this.elements.addNewsBtn) {
            this.elements.addNewsBtn.addEventListener('click', () => this.addNews());
        }
        if (this.elements.openNewsFormBtn) {
            this.elements.openNewsFormBtn.addEventListener('click', () => {
                this.elements.adminNewsForm.style.display = 'block';
                this.elements.newsText.focus();
            });
        }
        if (this.elements.closeNewsFormBtn) {
            this.elements.closeNewsFormBtn.addEventListener('click', () => {
                this.elements.adminNewsForm.style.display = 'none';
                this.elements.newsText.value = '';
            });
        }

        // --- Emoji Events ---
        if (this.elements.emojiButton && this.elements.emojiPicker) {
            this.elements.emojiButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = this.elements.emojiPicker.style.display !== 'none';
                this.elements.emojiPicker.style.display = isVisible ? 'none' : 'flex';
            });

            // Вставка эмодзи
            this.elements.emojiPicker.querySelectorAll('.emoji-option').forEach(emojiEl => {
                emojiEl.addEventListener('click', () => {
                    const emoji = emojiEl.textContent;
                    this.insertTextAtCursor(emoji);
                    this.elements.emojiPicker.style.display = 'none';
                });
            });

            // Закрытие палитры при клике вне её
            document.addEventListener('click', (e) => {
                if (this.elements.emojiPicker.style.display !== 'none' &&
                    !this.elements.emojiPicker.contains(e.target) &&
                    e.target !== this.elements.emojiButton) {
                    this.elements.emojiPicker.style.display = 'none';
                }
            });
        }

        // --- Attachment Events (заглушка) ---
        if (this.elements.attachmentButton) {
            this.elements.attachmentButton.addEventListener('click', () => {
                this.handleAttachment();
            });
        }
    }

    // Вспомогательная функция для вставки текста в позицию курсора
    insertTextAtCursor(text) {
        const input = this.elements.messageInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const value = input.value;

        input.value = value.substring(0, start) + text + value.substring(end);
        // Установить курсор после вставленного текста
        const newCursorPos = start + text.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
        input.focus();
    }

    // --- Attachment Methods (заглушка) ---
    handleAttachment() {
        this.showError('Функционал вложений пока не реализован.');
        console.log('Attachment button clicked. Feature not implemented yet.');
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка входа');
            }
            const data = await response.json();
            await this.startSession(data);
        } catch (error) {
            this.showError(error.message);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        if (password !== confirmPassword) {
            return this.showError('Пароли не совпадают');
        }
        try {
            const keyPair = await generateKeys();
            const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    password,
                    publicKey
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка регистрации');
            }
            const data = await response.json();
            localStorage.setItem('privateKey', JSON.stringify(
                await crypto.subtle.exportKey('jwk', keyPair.privateKey)
            ));
            localStorage.setItem('username', username);
            await this.startSession(data);
        } catch (error) {
            this.showError(error.message);
        }
    }

    async startSession(authData) {
        this.user = {
            id: authData.userId,
            username: authData.username,
            token: authData.token
        };
        localStorage.setItem('authToken', authData.token);
        localStorage.setItem('username', authData.username);
        this.elements.userId.textContent = authData.userId.toString().slice(-4);
        if (this.elements.authModal) {
            this.elements.authModal.style.display = 'none';
        }
        await this.connectWebSocket();
        await this.loadMessages();
        this.loadNews();
        this.checkAdminStatus();
    }

    async connectWebSocket() {
        const wsUrl = `wss://${window.location.host}/ws?token=${this.user.token}`;
        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.loadMessages();
        };
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'new_message') {
                    this.displayMessage({
                        sender: message.sender,
                        content: message.content,
                        timestamp: new Date(message.timestamp),
                        isOwn: message.sender === this.user.username
                    });
                } else if (message.type === 'online_count') {
                    this.elements.onlineCount.textContent = message.count;
                } else if (message.type === 'news_update') {
                    this.loadNews();
                }
            } catch (err) {
                console.error('Ошибка обработки сообщения:', err);
            }
        };
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        this.ws.onclose = () => {
            console.log('WebSocket disconnected, reconnecting...');
            setTimeout(() => this.connectWebSocket(), 3000);
        };
    }

    async sendMessage() {
        const text = this.elements.messageInput.value.trim();
        if (!text || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        try {
            this.elements.messageInput.value = '';
            this.ws.send(JSON.stringify({
                type: 'message',
                content: text,
                timestamp: Date.now()
            }));
        } catch (err) {
            console.error('Ошибка отправки сообщения:', err);
            this.showError('Ошибка отправки сообщения');
        }
    }

    async loadMessages() {
        try {
            const response = await fetch('/api/messages', {
                headers: {
                    'Authorization': `Bearer ${this.user?.token || ''}`
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const { messages } = await response.json();
            this.elements.messagesContainer.innerHTML = '';
            messages.forEach(msg => {
                this.displayMessage({
                    sender: msg.sender,
                    content: msg.content,
                    timestamp: new Date(msg.timestamp),
                    isOwn: msg.sender === this.user?.username
                });
            });
            this.scrollToBottom();
        } catch (err) {
            console.error('Ошибка загрузки сообщений:', err);
            if (err.message.includes('Failed to fetch')) {
                setTimeout(() => this.loadMessages(), 2000);
            }
        }
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            this.elements.messagesContainer.scrollTop =
                this.elements.messagesContainer.scrollHeight;
        });
    }

    displayMessage(message) {
        if (!this.isPageLoaded) return;
        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.isOwn ? 'own' : ''}`;
        // Сообщения уже содержат эмодзи как текст, браузер отобразит их правильно
        messageEl.innerHTML = `
            <div class="sender">${this.sanitize(message.sender)}</div>
            <div class="content">${this.sanitize(message.content)}</div>
            <div class="time">${message.timestamp.toLocaleTimeString()}</div>
        `;
        this.elements.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    }

    async checkAuth() {
        const token = localStorage.getItem('authToken');
        const username = localStorage.getItem('username');
        if (!token || !username) {
            if (this.elements.authModal) {
                this.elements.authModal.style.display = 'flex';
            }
            return;
        }
        try {
            const response = await fetch('/api/validate', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                await this.startSession(data);
            } else {
                localStorage.removeItem('authToken');
                localStorage.removeItem('username');
                if (this.elements.authModal) {
                    this.elements.authModal.style.display = 'flex';
                }
            }
        } catch (err) {
            console.error('Ошибка проверки авторизации:', err);
            if (this.elements.authModal) {
                this.elements.authModal.style.display = 'flex';
            }
        }
    }

    showError(message) {
        if (!this.isPageLoaded) return;
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.textContent = message;
        document.body.appendChild(errorEl);
        setTimeout(() => errorEl.remove(), 5000);
    }

    sanitize(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('ServiceWorker registered'))
                .catch(err => console.error('ServiceWorker registration failed:', err));
        }
    }

    // --- News Functionality ---
    checkAdminStatus() {
        if (this.user?.username === 'admin') {
            if (this.elements.openNewsFormBtn) {
                this.elements.openNewsFormBtn.style.display = 'flex';
            }
        } else {
            if (this.elements.openNewsFormBtn) {
                this.elements.openNewsFormBtn.style.display = 'none';
            }
            if (this.elements.adminNewsForm) {
                this.elements.adminNewsForm.style.display = 'none';
            }
        }
    }

    async loadNews() {
        try {
            const response = await fetch('/api/news', {
                headers: {
                    'Authorization': `Bearer ${this.user?.token || ''}`
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const { news } = await response.json();
            this.renderNews(news);
        } catch (err) {
            console.error('Ошибка загрузки новостей:', err);
            if (err.message.includes('Failed to fetch')) {
                setTimeout(() => this.loadNews(), 2000);
            }
        }
    }

    renderNews(news) {
        if (!this.elements.newsContainer) return;
        this.elements.newsContainer.innerHTML = '';
        if (news.length === 0) {
            const emptyNewsEl = document.createElement('div');
            emptyNewsEl.className = 'news-item';
            emptyNewsEl.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">Новостей пока нет</p>`;
            this.elements.newsContainer.appendChild(emptyNewsEl);
            return;
        }
        news.forEach(item => {
            const newsItem = document.createElement('div');
            newsItem.className = 'news-item';
            const formattedDate = this.formatTimestamp(new Date(item.created_at));
            newsItem.innerHTML = `
                <p>${this.sanitize(item.text)}</p>
                <span>${formattedDate}</span>
            `;
            this.elements.newsContainer.appendChild(newsItem);
        });
    }

    async addNews() {
        if (this.user?.username !== 'admin') {
            this.showError('У вас нет прав для добавления новостей');
            return;
        }
        const text = this.elements.newsText.value.trim();
        if (!text) {
            this.showError('Введите текст новости');
            return;
        }
        const originalBtnText = this.elements.addNewsBtn.innerHTML;
        this.elements.addNewsBtn.disabled = true;
        this.elements.addNewsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
        try {
            const response = await fetch('/api/news', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.user.token}`
                },
                body: JSON.stringify({ text })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка добавления новости');
            }
            this.elements.newsText.value = '';
            this.elements.adminNewsForm.style.display = 'none';
            this.loadNews();
        } catch (err) {
            console.error('Ошибка добавления новости:', err);
            this.showError(err.message);
        } finally {
            this.elements.addNewsBtn.disabled = false;
            this.elements.addNewsBtn.innerHTML = originalBtnText;
        }
    }

    formatTimestamp(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1) {
            return 'только что';
        } else if (diffMins < 60) {
            return `${diffMins} мин. назад`;
        } else if (diffHours < 24) {
            return `${diffHours} ч. назад`;
        } else if (diffDays < 7) {
            return `${diffDays} дн. назад`;
        } else {
            return date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit'
            }) + ' ' + date.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Messenger();
});