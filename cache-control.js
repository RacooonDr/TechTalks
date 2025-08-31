// Функция для обновления ресурсов
function updateResources() {
    const version = 'v=' + Date.now();
    
    // Обновляем CSS
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const url = new URL(link.href);
        if (url.origin === location.origin) {
            url.searchParams.set('v', version);
            link.href = url.toString();
        }
    });

    // Обновляем JS (кроме этого скрипта)
    document.querySelectorAll('script[src]').forEach(script => {
        const url = new URL(script.src);
        if (url.origin === location.origin && !script.src.includes('cache-control.js')) {
            url.searchParams.set('v', version);
            script.src = url.toString();
        }
    });

    // Очищаем кеш при перезагрузке
    if (performance.navigation.type === performance.navigation.TYPE_RELOAD) {
        localStorage.setItem('lastReload', Date.now());
    }
}

// Регистрация Service Worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .then(registration => {
                console.log('ServiceWorker registered');
                // Проверяем обновления каждый час
                setInterval(() => registration.update(), 3600000);
            })
            .catch(err => console.error('ServiceWorker registration failed:', err));
    }
}

// Запускаем при полной загрузке страницы
window.addEventListener('load', () => {
    updateResources();
    registerServiceWorker();
    
    // Периодическое обновление (каждые 5 минут)
    setInterval(updateResources, 300000);
});